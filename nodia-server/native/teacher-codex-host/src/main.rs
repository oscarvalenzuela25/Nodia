#[cfg(feature = "codex")]
mod native;
mod protocol;

use protocol::{emit, hash, terminal_error};
use serde_json::json;
use std::path::PathBuf;

fn main() {
    // Capability inspection does not inspect CODEX_HOME, cwd, credentials, config or the provider.
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args == ["--capabilities"] {
        if emit(&protocol::capabilities()).is_err() {
            std::process::exit(1);
        }
        return;
    }
    let result = run(args);
    if let Err(code) = result {
        let _ = emit(&terminal_error(code, false, true, None));
        std::process::exit(1);
    }
}

fn run(args: Vec<String>) -> Result<(), &'static str> {
    if args.len() != 4
        || args[0] != "--config-json"
        || args[2] != "--workspace"
        || args[1].len() > 32_768
    {
        return Err("invalid_arguments");
    }
    let trusted: serde_json::Value =
        serde_json::from_str(&args[1]).map_err(|_| "invalid_configuration")?;
    let workspace = PathBuf::from(&args[3]);
    let profile = PathBuf::from(std::env::var_os("CODEX_HOME").ok_or("profile_unavailable")?);
    for path in [&workspace, &profile] {
        let metadata = std::fs::symlink_metadata(path).map_err(|_| "profile_unavailable")?;
        if !path.is_absolute() || !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err("profile_unavailable");
        }
    }
    if workspace == profile
        || workspace.starts_with(&profile)
        || profile.starts_with(&workspace)
        || std::fs::read_dir(&workspace)
            .map_err(|_| "invalid_workspace")?
            .next()
            .is_some()
        || profile.join("auth.json").exists()
    {
        return Err("invalid_workspace");
    }
    let request = protocol::read_request(std::io::stdin().lock())?;
    #[cfg(feature = "codex")]
    {
        native::validate_configuration(&trusted)?;
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .thread_stack_size(8 * 1024 * 1024)
            .enable_all()
            .build()
            .map_err(|_| "native_unavailable")?;
        let binding = request.binding_hash();
        let config = runtime.block_on(async {
            let remaining = request.remaining();
            tokio::time::timeout(
                remaining,
                native::configuration(&request, trusted, &profile, &workspace),
            )
            .await
            .map_err(|_| "deadline_exceeded")?
        })?;
        let nonce = uuid::Uuid::new_v4().to_string();
        emit(
            &json!({"event":"started", "operation_id":request.operation_id,
            "binding_hash":binding,"proof_nonce":nonce,"policy_hash":hash(protocol::POLICY.as_bytes())}),
        )?;
        let outcome = runtime.block_on(native::execute(
            &request,
            config,
            cancellation(request.operation_id.clone()),
            &nonce,
        ));
        let success = outcome.result.is_ok() && outcome.local_closed;
        let mut terminal = match outcome.result {
            Ok(text) if outcome.local_closed => json!({"event":"terminal","status":"completed",
                "binding_hash":binding,"proof_nonce":nonce,"text_hash":hash(text.as_bytes()),"text":text,
                "local_closed":true,"remote_outcome":"completed"}),
            Ok(_) => terminal_error("local_close_unverified", true, false, Some(&binding)),
            Err(code) => terminal_error(code, true, outcome.local_closed, Some(&binding)),
        };
        terminal["proof_nonce"] = json!(nonce);
        // Drop every runtime task/transport before asserting local closure to Server.
        runtime.shutdown_timeout(std::time::Duration::from_secs(2));
        emit(&terminal)?;
        if !success {
            std::process::exit(1);
        }
        Ok(())
    }
    #[cfg(not(feature = "codex"))]
    {
        let _ = (trusted, request, workspace, profile);
        Err("native_not_compiled")
    }
}

#[cfg(feature = "codex")]
async fn cancellation(operation_id: String) {
    use tokio::io::AsyncBufReadExt;
    let stdin = async {
        let mut input = tokio::io::BufReader::new(tokio::io::stdin());
        let mut line = String::new();
        // Only a small exact cancellation envelope is accepted after the one-shot request.
        match tokio::io::AsyncReadExt::take(&mut input, 257)
            .read_line(&mut line)
            .await
        {
            Ok(size) if size > 0 && size <= 256 => {
                if serde_json::from_str::<serde_json::Value>(&line).ok()
                    == Some(json!({"event":"cancel","operation_id":operation_id}))
                {
                    return;
                }
                std::future::pending::<()>().await;
            }
            _ => std::future::pending::<()>().await,
        }
    };
    #[cfg(unix)]
    {
        let terminate = async {
            if let Ok(mut signal) =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            {
                signal.recv().await;
            } else {
                std::future::pending::<()>().await;
            }
        };
        tokio::select! { _=stdin=>{}, _=terminate=>{}, _=tokio::signal::ctrl_c()=>{} }
    }
    #[cfg(not(unix))]
    tokio::select! { _=stdin=>{}, _=tokio::signal::ctrl_c()=>{} }
}
