use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::io::{BufRead, Write};

pub const SOURCE_COMMIT: &str = "979011409de0a60b52f179721948e65531d26144";
pub const PROVIDER_ID: &str = "nodia_codex";
pub const MAX_PROMPT: usize = 131_072;
pub const MAX_RESULT: usize = 32_768;
pub const MAX_FRAME: usize = 800_000;
pub const POLICY: &str = "teacher-text/1;tool-policy=empty;isolation=isolated;environments=empty;dynamic-tools=empty;attachments=empty;extensions=response-firewall;one-turn;retries=0;prompt=131072;result=32768";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub operation_id: String,
    pub model_id: String,
    pub effort_id: Option<String>,
    pub prompt: String,
    pub deadline_at: String,
    pub configuration_generation: String,
    pub session_generation: String,
    pub resource_key: String,
}

impl Request {
    pub fn validate(&self) -> Result<(), &'static str> {
        if uuid::Uuid::parse_str(&self.operation_id).is_err()
            || self.model_id.is_empty()
            || self.model_id.len() > 1024
            || self.model_id.trim() != self.model_id
            || self.model_id.chars().any(char::is_control)
            || self
                .effort_id
                .as_ref()
                .is_some_and(|x| x.is_empty() || x.len() > 256)
            || self.prompt.trim().is_empty()
            || self.prompt.len() > MAX_PROMPT
            || [
                &self.configuration_generation,
                &self.session_generation,
                &self.resource_key,
            ]
            .iter()
            .any(|x| x.is_empty() || x.len() > 256 || x.chars().any(char::is_control))
        {
            return Err("invalid_input");
        }
        let remaining = self.remaining().as_millis();
        if remaining == 0 || remaining > 600_000 {
            return Err("invalid_deadline");
        }
        Ok(())
    }

    pub fn remaining(&self) -> std::time::Duration {
        DateTime::parse_from_rfc3339(&self.deadline_at)
            .ok()
            .and_then(|deadline| deadline.signed_duration_since(Utc::now()).to_std().ok())
            .unwrap_or_default()
    }

    pub fn binding_hash(&self) -> String {
        hash(serde_json::to_vec(&json!({
            "operation_id": self.operation_id, "model_id": self.model_id,
            "effort_id": self.effort_id, "prompt_hash": hash(self.prompt.as_bytes()),
            "deadline_at": self.deadline_at, "configuration_generation": self.configuration_generation,
            "session_generation": self.session_generation, "resource_key": self.resource_key,
            "policy_hash": hash(POLICY.as_bytes()), "source_commit": SOURCE_COMMIT
        })).expect("fixed serializable fields").as_slice())
    }
}

pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn capabilities() -> Value {
    json!({"protocol":"nodia-teacher-codex-host/1", "purpose":"teacher-text/1",
        "source_commit":SOURCE_COMMIT, "policy_hash":hash(POLICY.as_bytes()),
        "compiled_native":cfg!(feature="codex"), "provider_id":PROVIDER_ID,
        "tools":[], "attachments":[], "maximum_prompt_utf8_bytes":MAX_PROMPT,
        "maximum_result_utf8_bytes":MAX_RESULT, "retries":0,
        "maximum_request_frame_bytes":MAX_FRAME,"maximum_terminal_frame_bytes":262144,
        "qualification":"required_per_selection_and_epoch"})
}

/// Bounded before JSON parsing. A process accepts exactly one newline-terminated request.
pub fn read_request(mut reader: impl BufRead) -> Result<Request, &'static str> {
    let mut raw = Vec::new();
    loop {
        let buffer = reader.fill_buf().map_err(|_| "invalid_input")?;
        if buffer.is_empty() {
            return Err("invalid_input");
        }
        let take = buffer
            .iter()
            .position(|x| *x == b'\n')
            .map_or(buffer.len(), |n| n + 1);
        if raw.len() + take > MAX_FRAME {
            return Err("input_too_large");
        }
        raw.extend_from_slice(&buffer[..take]);
        reader.consume(take);
        if raw.last() == Some(&b'\n') {
            break;
        }
    }
    let request: Request = serde_json::from_slice(&raw).map_err(|_| "invalid_input")?;
    request.validate()?;
    Ok(request)
}

pub fn emit(value: &impl Serialize) -> Result<(), &'static str> {
    let stdout = std::io::stdout();
    let mut stdout = stdout.lock();
    serde_json::to_writer(&mut stdout, value).map_err(|_| "output_closed")?;
    stdout
        .write_all(b"\n")
        .and_then(|_| stdout.flush())
        .map_err(|_| "output_closed")
}

pub fn terminal_error(
    code: &'static str,
    armed: bool,
    local_closed: bool,
    binding_hash: Option<&str>,
) -> Value {
    json!({"event":"terminal", "status":"error", "code":code,
        "binding_hash":binding_hash, "local_closed":local_closed,
        "remote_outcome":if armed { "unknown" } else { "not_dispatched" }, "retry":false})
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    fn fixture() -> Value {
        json!({"operation_id":"7abb6520-54b4-4e7b-86ab-feb418c4d03b", "model_id":"synthetic-model",
            "effort_id":null, "prompt":"Synthetic", "deadline_at":Utc::now()+chrono::Duration::seconds(20),
            "configuration_generation":"synthetic-config", "session_generation":"synthetic-session", "resource_key":"synthetic-resource"})
    }
    fn parse(value: Value) -> Result<Request, &'static str> {
        read_request(Cursor::new(format!("{value}\n")))
    }
    #[test]
    fn exact_selection_required_and_bound_without_echoing_prompt() {
        let source = fixture();
        let request = parse(source.clone()).unwrap();
        assert_eq!(request.binding_hash().len(), 64);
        for field in [
            "model_id",
            "prompt",
            "configuration_generation",
            "session_generation",
            "resource_key",
        ] {
            let mut changed = source.clone();
            changed[field] = json!("different-synthetic-value");
            assert_ne!(
                parse(changed).unwrap().binding_hash(),
                request.binding_hash()
            );
        }
        let mut missing = fixture();
        missing["model_id"] = json!("");
        assert!(parse(missing).is_err());
        let mut extra = fixture();
        extra["tools"] = json!([]);
        assert!(parse(extra).is_err());
        let mut extended = fixture();
        extended["model_id"] = json!("x".repeat(1024));
        extended["effort_id"] = json!("e".repeat(256));
        assert!(parse(extended.clone()).is_ok());
        extended["model_id"] = json!("x".repeat(1025));
        assert!(parse(extended).is_err());
    }
    #[test]
    fn utf8_budget_and_deadline_are_checked_before_native_work() {
        let mut value = fixture();
        value["prompt"] = json!("é".repeat(MAX_PROMPT / 2 + 1));
        assert!(parse(value).is_err());
        let mut value = fixture();
        value["deadline_at"] = json!(Utc::now() - chrono::Duration::seconds(1));
        assert!(parse(value).is_err());
        assert!(read_request(Cursor::new(vec![b'x'; MAX_FRAME + 1])).is_err());
    }
    #[test]
    fn capabilities_are_static_and_errors_expose_no_private_fields() {
        assert_eq!(capabilities()["tools"], json!([]));
        let error = terminal_error("invalid_input", false, true, None);
        assert_eq!(error["remote_outcome"], "not_dispatched");
        assert!(error.get("prompt").is_none());
        assert!(error.get("model_id").is_none());
    }
}
