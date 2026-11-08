use serde_json::Value;
use std::process::Command;

#[test]
fn capabilities_do_not_require_or_create_profile_or_workspace() {
    let root = tempfile::tempdir().unwrap();
    let forbidden = root.path().join("must-not-be-created");
    let output = Command::new(env!("CARGO_BIN_EXE_nodia-teacher-codex-host"))
        .env_clear()
        .env("CODEX_HOME", &forbidden)
        .arg("--capabilities")
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    assert!(!forbidden.exists());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["tools"], serde_json::json!([]));
    assert_eq!(value["attachments"], serde_json::json!([]));
    assert_eq!(
        value["source_commit"],
        "979011409de0a60b52f179721948e65531d26144"
    );
    assert_eq!(value["qualification"], "required_per_selection_and_epoch");
}

#[test]
fn invalid_cli_arguments_fail_before_any_profile_is_available() {
    let output = Command::new(env!("CARGO_BIN_EXE_nodia-teacher-codex-host"))
        .env_clear()
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(output.stderr.is_empty());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["code"], "invalid_arguments");
    assert_eq!(value["remote_outcome"], "not_dispatched");
    assert_eq!(value["retry"], false);
}
