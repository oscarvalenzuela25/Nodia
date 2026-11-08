//! Upstream crates are dependencies, never copied or patched provider code.
use crate::protocol::{MAX_RESULT, PROVIDER_ID, Request};
use codex_config::LoaderOverrides;
use codex_core::config::{Config, ConfigBuilder, ConfigOverrides};
use codex_core::{
    CodexAppsToolsCache, StartIfIdleSubmission, StartThreadOptions, ThreadManager, TurnInputRequest,
};
use codex_exec_server::EnvironmentManager;
use codex_extension_api::{
    ExtensionRegistryBuilder, IsolatedSessionExtensions, LoadInstructionsFuture,
    LoadedUserInstructions, ModelRequestContributor, ModelRequestInput, ModelRequestKind,
    ModelResponseError, ModelResponseInterceptor, ModelResponseStream, ResponseEvent,
    SessionIsolation, ToolPolicy, UserInstructionsProvider, empty_extension_registry,
};
use codex_login::{AuthManager, GatewayLoginControl};
use codex_protocol::config_types::SandboxMode;
use codex_protocol::models::{ContentItem, ResponseItem};
use codex_protocol::openai_models::ReasoningEffort;
use codex_protocol::protocol::{AskForApproval, EventMsg, SessionSource};
use codex_protocol::user_input::UserInput;
use codex_thread_store::InMemoryThreadStore;
use futures::StreamExt;
use serde_json::Value;
use std::path::Path;
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicUsize, Ordering},
};
use std::time::Duration;

#[derive(Debug)]
struct ResponseFirewall {
    rejected: Arc<AtomicBool>,
    requests: AtomicUsize,
    model: String,
    binding_hash: String,
    proof_nonce: String,
}
impl ModelRequestContributor for ResponseFirewall {
    fn request(&self, input: ModelRequestInput<'_>) -> Option<Box<dyn ModelResponseInterceptor>> {
        if input.kind != ModelRequestKind::Generation
            || input.model != self.model
            || self.requests.fetch_add(1, Ordering::SeqCst) != 0
        {
            // The contributor runs before transmission. Upstream has no Result
            // rejection channel here, so this one-operation host exits closed.
            // Only Server can establish process-group closure after actual exit.
            let mut frame = crate::protocol::terminal_error(
                "extra_request_forbidden",
                true,
                false,
                Some(&self.binding_hash),
            );
            frame["proof_nonce"] = Value::String(self.proof_nonce.clone());
            let _ = crate::protocol::emit(&frame);
            std::process::exit(70);
        }
        Some(Box::new(Self {
            rejected: Arc::clone(&self.rejected),
            requests: AtomicUsize::new(0),
            model: self.model.clone(),
            binding_hash: self.binding_hash.clone(),
            proof_nonce: self.proof_nonce.clone(),
        }))
    }
}
impl ModelResponseInterceptor for ResponseFirewall {
    fn intercept(self: Box<Self>, mut upstream: ModelResponseStream) -> ModelResponseStream {
        Box::pin(async_stream::stream! {
            let mut output_bytes = 0usize;
            let mut completed_text_bytes = 0usize;
            while let Some(event) = upstream.next().await {
                let forbidden = match &event {
                    Ok(ResponseEvent::OutputItemAdded(item) | ResponseEvent::OutputItemDone(item)) => {
                        match item {
                            ResponseItem::Message { role, content, .. } => {
                                let mut bytes=0usize;
                                let mut invalid=role!="assistant";
                                for part in content {
                                    if let ContentItem::OutputText { text }=part { bytes=bytes.saturating_add(text.len()); }
                                    else { invalid=true; }
                                }
                                if matches!(&event,Ok(ResponseEvent::OutputItemDone(_))) {
                                    completed_text_bytes=completed_text_bytes.saturating_add(bytes);
                                }
                                invalid || bytes>MAX_RESULT || completed_text_bytes>MAX_RESULT
                            }
                            ResponseItem::Reasoning { .. }=>false,
                            _=>true,
                        }
                    }
                    Ok(ResponseEvent::ToolCallInputDelta { .. }) => true,
                    Ok(ResponseEvent::ServerModel(model)) => model != &self.model,
                    Ok(ResponseEvent::Completed { end_turn: Some(false), .. }) => true,
                    Ok(ResponseEvent::OutputTextDelta(text)) => {
                        output_bytes = output_bytes.saturating_add(text.len());
                        output_bytes > MAX_RESULT
                    }
                    _ => false,
                };
                if forbidden {
                    self.rejected.store(true, Ordering::SeqCst);
                    // A permanent error stops Core before it sees a tool item or schedules a continuation.
                    yield Err(ModelResponseError::InvalidRequest { message: "teacher_response_forbidden".into() });
                    break;
                }
                yield event;
            }
        })
    }
}

struct NoUserInstructions;
impl UserInstructionsProvider for NoUserInstructions {
    fn load_user_instructions(&self) -> LoadInstructionsFuture<'_> {
        Box::pin(async { LoadedUserInstructions::default() })
    }
}

/// JSON comes from Server's trusted CODEX_SETTINGS, never from a public Teacher DTO.
pub fn validate_configuration(value: &Value) -> Result<(), &'static str> {
    const ALLOWED: &[&str] = &[
        "model_provider",
        "model_providers",
        "cli_auth_credentials_store",
        "forced_login_method",
        "project_doc_max_bytes",
        "mcp_servers",
        "features",
        "web_search",
        "check_for_update_on_startup",
        "analytics",
        "feedback",
        "shell_environment_policy",
    ];
    if value.to_string().len() > 32_768
        || value
            .as_object()
            .is_none_or(|map| map.keys().any(|key| !ALLOWED.contains(&key.as_str())))
        || value.get("model_provider").and_then(Value::as_str) != Some(PROVIDER_ID)
        || value
            .get("cli_auth_credentials_store")
            .and_then(Value::as_str)
            != Some("keyring")
        || value.get("forced_login_method").and_then(Value::as_str) != Some("chatgpt")
        || value.get("project_doc_max_bytes").and_then(Value::as_u64) != Some(0)
        || value
            .get("mcp_servers")
            .and_then(Value::as_object)
            .is_none_or(|x| !x.is_empty())
    {
        return Err("invalid_configuration");
    }
    let provider = &value["model_providers"][PROVIDER_ID];
    const PROVIDER_KEYS: &[&str] = &[
        "name",
        "wire_api",
        "requires_openai_auth",
        "request_max_retries",
        "stream_max_retries",
        "supports_websockets",
    ];
    if provider["requires_openai_auth"] != true
        || provider["request_max_retries"] != 0
        || provider["stream_max_retries"] != 0
        || provider["supports_websockets"] != false
        || provider["wire_api"] != "responses"
        || provider.get("base_url").is_some()
        || provider.get("env_key").is_some()
        || provider.get("experimental_bearer_token").is_some()
        || value["model_providers"]
            .as_object()
            .is_none_or(|map| map.len() != 1)
        || provider
            .as_object()
            .is_none_or(|map| map.keys().any(|key| !PROVIDER_KEYS.contains(&key.as_str())))
    {
        return Err("invalid_configuration");
    }
    Ok(())
}

pub async fn configuration(
    request: &Request,
    trusted: Value,
    profile: &Path,
    workspace: &Path,
) -> Result<Config, &'static str> {
    validate_configuration(&trusted)?;
    build_configuration(request, trusted, profile, workspace).await
}

fn toml_value(value: &Value) -> Result<toml::Value, &'static str> {
    // serde_json's arbitrary_precision feature is unified by upstream crates.
    // Serializing its Number directly into TOML produces a private map marker.
    // Preserve JSON types explicitly instead of invoking that serializer path.
    Ok(match value {
        Value::Bool(value) => toml::Value::Boolean(*value),
        Value::String(value) => toml::Value::String(value.clone()),
        Value::Number(value) => {
            toml::Value::Integer(value.as_i64().ok_or("invalid_configuration")?)
        }
        Value::Array(values) => {
            toml::Value::Array(values.iter().map(toml_value).collect::<Result<_, _>>()?)
        }
        Value::Object(values) => toml::Value::Table(
            values
                .iter()
                .map(|(key, value)| Ok((key.clone(), toml_value(value)?)))
                .collect::<Result<_, &'static str>>()?,
        ),
        Value::Null => return Err("invalid_configuration"),
    })
}

async fn build_configuration(
    request: &Request,
    trusted: Value,
    profile: &Path,
    workspace: &Path,
) -> Result<Config, &'static str> {
    let mut overrides = Vec::new();
    for (key, value) in trusted.as_object().ok_or("invalid_configuration")? {
        overrides.push((key.clone(), toml_value(value)?));
    }
    // These restrictions are host-owned, even when trusted settings evolve.
    for (key, value) in [
        ("project_doc_max_bytes", Value::from(0)),
        ("web_search", Value::from("disabled")),
        ("check_for_update_on_startup", Value::from(false)),
        ("analytics.enabled", Value::from(false)),
        ("feedback.enabled", Value::from(false)),
        (
            "model_auto_compact_token_limit",
            Value::from(1_000_000_000u64),
        ),
        ("features.unbounded_connection_retries", Value::from(false)),
        ("features.enable_request_compression", Value::from(false)),
    ] {
        overrides.push((key.into(), toml_value(&value)?));
    }
    let effort: Option<ReasoningEffort> = request
        .effort_id
        .as_ref()
        .map(|x| serde_json::from_value(Value::String(x.clone())).map_err(|_| "invalid_effort"))
        .transpose()?;
    let mut config = ConfigBuilder::default()
        .codex_home(profile.to_path_buf())
        .cli_overrides(overrides)
        .loader_overrides(LoaderOverrides {
            ignore_user_config: true,
            ignore_project_config: true,
            ..Default::default()
        })
        .harness_overrides(ConfigOverrides {
            model: Some(request.model_id.clone()),
            model_provider: Some(PROVIDER_ID.into()),
            cwd: Some(workspace.to_path_buf()),
            workspace_roots: Some(vec![]),
            approval_policy: Some(AskForApproval::Never),
            sandbox_mode: Some(SandboxMode::ReadOnly),
            ephemeral: Some(true),
            base_instructions: Some(
                "Return only the requested text JSON from the supplied context.".into(),
            ),
            ..Default::default()
        })
        .strict_config(true)
        .build()
        .await
        .map_err(|error| {
            #[cfg(test)]
            eprintln!("synthetic SDK configuration failure: {error}");
            #[cfg(not(test))]
            let _ = error;
            "invalid_configuration"
        })?;
    // None is explicit absence; never inherit an old profile effort.
    config.model_reasoning_effort = effort;
    if config.model.as_deref() != Some(request.model_id.as_str())
        || config.model_provider_id != PROVIDER_ID
    {
        return Err("selection_changed");
    }
    Ok(config)
}

pub struct NativeOutcome {
    pub result: Result<String, &'static str>,
    pub local_closed: bool,
}

pub async fn execute(
    request: &Request,
    config: Config,
    cancel: impl Future<Output = ()> + Send,
    proof_nonce: &str,
) -> NativeOutcome {
    let remaining = request.remaining();
    match tokio::time::timeout(
        remaining,
        execute_inner(request, config, cancel, true, proof_nonce),
    )
    .await
    {
        Ok(outcome) => outcome,
        // Startup may have spawned a task before cancellation. Process exit must establish closure.
        Err(_) => NativeOutcome {
            result: Err("deadline_exceeded"),
            local_closed: false,
        },
    }
}

async fn execute_inner(
    request: &Request,
    config: Config,
    cancel: impl Future<Output = ()> + Send,
    require_chatgpt: bool,
    proof_nonce: &str,
) -> NativeOutcome {
    let auth = match AuthManager::shared_from_config(&config, false).await {
        Ok(auth) => auth,
        Err(_) => {
            return NativeOutcome {
                result: Err("authentication_unavailable"),
                local_closed: true,
            };
        }
    };
    GatewayLoginControl::for_runtime(&auth.runtime_config()).require_explicit_login();
    if require_chatgpt
        && !auth
            .auth()
            .await
            .is_some_and(|value| value.is_chatgpt_auth())
    {
        return NativeOutcome {
            result: Err("authentication_unavailable"),
            local_closed: true,
        };
    }
    let models = codex_core::build_models_manager(&config, Arc::clone(&auth));
    let metadata = models
        .get_model_info(&request.model_id, &config.to_models_manager_config())
        .await;
    if metadata.slug != request.model_id
        || metadata.used_fallback_model_metadata
        || config
            .model_reasoning_effort
            .as_ref()
            .is_some_and(|effort| {
                !metadata
                    .supported_reasoning_levels
                    .iter()
                    .any(|preset| &preset.effort == effort)
                    || metadata.resolve_reasoning_effort(effort.clone()) != *effort
            })
    {
        return NativeOutcome {
            result: Err("selection_changed"),
            local_closed: true,
        };
    }
    let manager = ThreadManager::new(
        &config,
        Arc::clone(&auth),
        models,
        CodexAppsToolsCache::default(),
        SessionSource::Custom("nodia_teacher_text".into()),
        Arc::new(EnvironmentManager::without_environments(
            config.http_client_factory(),
        )),
        empty_extension_registry(),
        Arc::new(NoUserInstructions),
        None,
        codex_core::passthrough_image_store(),
        Arc::new(InMemoryThreadStore::default()),
        None,
        request.operation_id.clone(),
        None,
        None,
    );
    let firewall = Arc::new(ResponseFirewall {
        rejected: Arc::new(AtomicBool::new(false)),
        requests: AtomicUsize::new(0),
        model: request.model_id.clone(),
        binding_hash: request.binding_hash(),
        proof_nonce: proof_nonce.into(),
    });
    let mut extensions = ExtensionRegistryBuilder::<Config>::new();
    extensions.model_request_contributor(firewall.clone());
    let mut options = StartThreadOptions::new(config);
    options.environments = Some(vec![]);
    options.user_instructions = Some(LoadedUserInstructions::default());
    options.thread_extension_init.insert(ToolPolicy {
        allowed_tools: Some(vec![]),
        expose_additional_permissions: false,
        ..Default::default()
    });
    options
        .thread_extension_init
        .insert(SessionIsolation::Isolated);
    options
        .thread_extension_init
        .insert(IsolatedSessionExtensions(Arc::new(extensions.build())));
    // Neither provider data nor request input can weaken the captured startup ceiling.
    let started = manager.start_thread(options).await;
    let thread = match started {
        Ok(started)
            if started.session_configured.model == request.model_id
                && request.effort_id.as_ref().is_none_or(|expected| {
                    serde_json::to_value(&started.session_configured.reasoning_effort).ok()
                        == Some(Value::String(expected.clone()))
                }) =>
        {
            started.thread
        }
        Ok(started) => {
            let closed = started.thread.shutdown_and_wait().await.is_ok();
            return NativeOutcome {
                result: Err("selection_changed"),
                local_closed: closed,
            };
        }
        Err(_) => {
            return NativeOutcome {
                result: Err("native_start_failed"),
                local_closed: false,
            };
        }
    };
    let submitted = thread
        .start_turn_if_idle(TurnInputRequest::user_input(vec![UserInput::Text {
            text: request.prompt.clone(),
            text_elements: vec![],
        }]))
        .await;
    let remaining = request.remaining();
    let wait = async {
        if !matches!(submitted, Ok(StartIfIdleSubmission::Started { .. })) {
            return Err("native_start_failed");
        }
        loop {
            match thread
                .next_event()
                .await
                .map_err(|_| "native_transport_failed")?
                .msg
            {
                EventMsg::TurnComplete(event) => {
                    if event.error.is_some() {
                        return Err("provider_error");
                    }
                    let text = event.last_agent_message.ok_or("invalid_result")?;
                    if text.trim().is_empty()
                        || text.len() > MAX_RESULT
                        || serde_json::from_str::<Value>(&text).is_err()
                    {
                        return Err("invalid_result");
                    }
                    return Ok(text);
                }
                EventMsg::Error(_) | EventMsg::StreamError(_) => {
                    return Err(if firewall.rejected.load(Ordering::SeqCst) {
                        "unexpected_response"
                    } else {
                        "provider_error"
                    });
                }
                EventMsg::DynamicToolCallRequest(_)
                | EventMsg::McpToolCallBegin(_)
                | EventMsg::ExecCommandBegin(_)
                | EventMsg::PatchApplyBegin(_) => return Err("unexpected_response"),
                _ => {}
            }
        }
    };
    tokio::pin!(cancel);
    let result = tokio::select! {
        value = wait => value,
        _ = tokio::time::sleep(remaining) => Err("deadline_exceeded"),
        _ = &mut cancel => Err("cancelled"),
    };
    // A timeout does not prove remote cancellation. Only local loop closure is acknowledged.
    let local_closed = tokio::time::timeout(Duration::from_secs(10), thread.shutdown_and_wait())
        .await
        .is_ok_and(|closed| closed.is_ok());
    NativeOutcome {
        result,
        local_closed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{Request, hash};
    use serde_json::json;
    use wiremock::{
        Mock, MockServer, ResponseTemplate,
        matchers::{method, path},
    };

    #[test]
    fn request_ceiling_exits_before_returning_a_second_provider_request() {
        for scenario in ["second", "warmup", "model_changed"] {
            let output = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "native::tests::request_ceiling_child",
                    "--nocapture",
                ])
                .env("NODIA_SYNTHETIC_CEILING_CASE", scenario)
                .output()
                .unwrap();
            assert_eq!(output.status.code(), Some(70));
            let stdout = String::from_utf8(output.stdout).unwrap();
            let frame: Value = stdout
                .lines()
                .filter_map(|line| line.find('{').map(|position| &line[position..]))
                .map(|line| serde_json::from_str(line).unwrap())
                .next()
                .expect("safe terminal frame");
            assert_eq!(frame["code"], "extra_request_forbidden");
            assert_eq!(frame["local_closed"], false);
            assert_eq!(frame["remote_outcome"], "unknown");
            assert_eq!(frame["proof_nonce"], "synthetic-nonce");
            assert!(frame.get("prompt").is_none());
        }
    }

    #[test]
    fn request_ceiling_child() {
        let Ok(scenario) = std::env::var("NODIA_SYNTHETIC_CEILING_CASE") else {
            return;
        };
        let guard = ResponseFirewall {
            rejected: Arc::new(AtomicBool::new(false)),
            requests: AtomicUsize::new(0),
            model: "synthetic-model".into(),
            binding_hash: hash(b"synthetic-binding"),
            proof_nonce: "synthetic-nonce".into(),
        };
        let mut metadata = None;
        if scenario == "second" {
            assert!(
                guard
                    .request(ModelRequestInput {
                        kind: ModelRequestKind::Generation,
                        thread_id: "synthetic-thread",
                        client_metadata: &mut metadata,
                        model: "synthetic-model"
                    })
                    .is_some()
            );
        }
        guard.request(ModelRequestInput {
            kind: if scenario == "warmup" {
                ModelRequestKind::Warmup
            } else {
                ModelRequestKind::Generation
            },
            thread_id: "synthetic-thread",
            client_metadata: &mut metadata,
            model: if scenario == "model_changed" {
                "different-synthetic-model"
            } else {
                "synthetic-model"
            },
        });
        panic!("forbidden request escaped startup ceiling");
    }

    fn request() -> Request {
        serde_json::from_value(
            json!({"operation_id":uuid::Uuid::new_v4(),"model_id":"synthetic-teacher-model",
            "effort_id":"medium","prompt":"Synthetic JSON test. No external account.",
            "deadline_at":chrono::Utc::now()+chrono::Duration::seconds(20),
            "configuration_generation":"synthetic-config","session_generation":"synthetic-session",
            "resource_key":"synthetic-resource"}),
        )
        .unwrap()
    }

    fn synthetic_configuration(url: &str) -> Value {
        json!({"model_provider":PROVIDER_ID,"model_providers":{PROVIDER_ID:{"name":"Synthetic loopback",
            "base_url":url,"requires_openai_auth":false,"wire_api":"responses",
            "request_max_retries":0,"stream_max_retries":0,"supports_websockets":false}},
            "features":{"shell_tool":false,"multi_agent":false,"apps":false,"plugins":false,
                "code_mode":false,"memories":false,"enable_request_compression":false},
            "project_doc_max_bytes":0,"mcp_servers":{},"web_search":"disabled"})
    }

    fn sse(item: Value) -> String {
        [
            json!({"type":"response.created","response":{"id":"synthetic-response"}}),
            json!({"type":"response.output_item.done","item":item}),
            json!({"type":"response.completed","response":{"id":"synthetic-response",
                "usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}),
        ]
        .iter()
        .map(|event| {
            format!(
                "event: {}\ndata: {}\n\n",
                event["type"].as_str().unwrap(),
                event
            )
        })
        .collect()
    }

    async fn config(request: &Request, server: &MockServer, home: &Path, work: &Path) -> Config {
        // Test-only discovered metadata advertises native tools; the startup
        // ceiling must remove them instead of relying on benign defaults.
        let catalog = json!({"models":[{"slug":request.model_id,"display_name":"Synthetic model",
            "base_instructions":"Synthetic fixture: return requested JSON only.",
            "description":"Isolated fixture, no provider account", "default_reasoning_level":"medium",
            "supported_reasoning_levels":[{"effort":"medium","description":"Synthetic"},
                {"effort":"ultra","description":"Synthetic remapping case"}],
            "multi_agent_reasoning_effort":"medium",
            "shell_type":"unified_exec","visibility":"list","supported_in_api":true,"priority":0,
            "support_verbosity":false,"default_verbosity":null,"apply_patch_tool_type":"freeform",
            "truncation_policy":{"mode":"bytes","limit":100000},"context_window":200000,
            "experimental_supported_tools":["clock","request_user_input_async","send_message_to_user_async"],
            "input_modalities":["text"]}]});
        let _: codex_protocol::openai_models::ModelsResponse =
            serde_json::from_value(catalog.clone()).unwrap();
        let catalog_path = home.join("synthetic-catalog.json");
        std::fs::write(&catalog_path, serde_json::to_vec(&catalog).unwrap()).unwrap();
        let mut settings = synthetic_configuration(&server.uri());
        settings["model_catalog_json"] = json!(catalog_path);
        build_configuration(request, settings, home, work)
            .await
            .unwrap()
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn real_core_sends_empty_tools_exact_selection_and_closes() {
        let server = MockServer::start().await;
        let response_text = "{\"synthetic\":true}";
        Mock::given(method("POST"))
            .and(path("/responses"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("content-type", "text/event-stream")
                    .set_body_string(sse(
                        json!({"id":"synthetic-message","type":"message","role":"assistant",
                    "content":[{"type":"output_text","text":response_text}]}),
                    )),
            )
            .expect(1)
            .mount(&server)
            .await;
        let home = tempfile::tempdir().unwrap();
        let work = tempfile::tempdir().unwrap();
        let request = request();
        let config = config(&request, &server, home.path(), work.path()).await;
        let outcome = execute_inner(
            &request,
            config,
            std::future::pending(),
            false,
            "synthetic-nonce",
        )
        .await;
        assert!(outcome.local_closed);
        assert_eq!(outcome.result.unwrap(), response_text);
        let requests = server.received_requests().await.unwrap();
        assert_eq!(
            requests.len(),
            1,
            "no retries, warmups or continuation requests"
        );
        let body: Value = serde_json::from_slice(&requests[0].body).unwrap();
        assert_eq!(body["model"], request.model_id);
        assert_eq!(body["reasoning"]["effort"], "medium");
        assert_eq!(body["tools"], json!([]));
        assert!(body.get("previous_response_id").is_none());
        assert_eq!(hash(response_text.as_bytes()).len(), 64);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn remapped_effort_is_rejected_before_any_provider_generation() {
        let server = MockServer::start().await;
        let home = tempfile::tempdir().unwrap();
        let work = tempfile::tempdir().unwrap();
        let mut request = request();
        request.effort_id = Some("ultra".into());
        let config = config(&request, &server, home.path(), work.path()).await;
        let outcome = execute_inner(
            &request,
            config,
            std::future::pending(),
            false,
            "synthetic-nonce",
        )
        .await;
        assert_eq!(outcome.result.unwrap_err(), "selection_changed");
        assert!(outcome.local_closed);
        assert!(server.received_requests().await.unwrap().is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn unknown_function_is_rejected_before_core_and_never_continued() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/responses"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("content-type", "text/event-stream")
                    .set_body_string(sse(
                        json!({"type":"function_call","call_id":"synthetic-call",
                    "name":"run_command","arguments":"{\"command\":\"must-never-run\"}"}),
                    )),
            )
            .expect(1)
            .mount(&server)
            .await;
        let home = tempfile::tempdir().unwrap();
        let work = tempfile::tempdir().unwrap();
        let request = request();
        let config = config(&request, &server, home.path(), work.path()).await;
        let outcome = execute_inner(
            &request,
            config,
            std::future::pending(),
            false,
            "synthetic-nonce",
        )
        .await;
        assert!(outcome.local_closed);
        assert_eq!(outcome.result.unwrap_err(), "unexpected_response");
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(server.received_requests().await.unwrap().len(), 1);
        assert!(std::fs::read_dir(work.path()).unwrap().next().is_none());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn cancellation_closes_local_loop_without_resending() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/responses"))
            .respond_with(ResponseTemplate::new(200).set_delay(Duration::from_secs(15)))
            .expect(1)
            .mount(&server)
            .await;
        let home = tempfile::tempdir().unwrap();
        let work = tempfile::tempdir().unwrap();
        let request = request();
        let config = config(&request, &server, home.path(), work.path()).await;
        let cancel = async {
            loop {
                if !server.received_requests().await.unwrap().is_empty() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        };
        let outcome = execute_inner(&request, config, cancel, false, "synthetic-nonce").await;
        assert_eq!(outcome.result.unwrap_err(), "cancelled");
        assert!(outcome.local_closed);
        assert_eq!(server.received_requests().await.unwrap().len(), 1);
    }
}
