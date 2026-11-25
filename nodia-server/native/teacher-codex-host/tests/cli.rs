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
    #[cfg(feature = "cv")]
    assert_eq!(value["protocol"], "nodia-cv-codex-host/1");
    #[cfg(not(feature = "cv"))]
    assert_eq!(value["protocol"], "nodia-teacher-codex-host/1");
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

#[cfg(feature = "cv")]
#[test]
#[ignore = "requires ModelInfo extracted from the verified official Codex 0.171.0 bundle"]
fn cv_model_probe_checks_exact_selection_without_opening_a_profile() {
    let catalog_path = std::env::var_os("NODIA_CV_CATALOG_FIXTURE").unwrap();
    let raw = std::fs::read_to_string(catalog_path).unwrap();
    let root = tempfile::tempdir().unwrap();
    let forbidden = root.path().join("must-not-be-created");
    let probe = |slug| {
        Command::new(env!("CARGO_BIN_EXE_nodia-teacher-codex-host"))
            .env_clear()
            .env("CODEX_HOME", &forbidden)
            .args([
                "--check-model",
                slug,
                "\"high\"",
                "--model-metadata-json",
                &raw,
            ])
            .output()
            .unwrap()
    };

    let matched = probe("gpt-6.2-sol");
    assert!(matched.status.success());
    assert_eq!(
        serde_json::from_slice::<Value>(&matched.stdout).unwrap(),
        serde_json::json!({"model_id": "gpt-6.2-sol", "effort_id": "high"})
    );
    let alias = probe("gpt-6.2-sol-latest");
    assert!(!alias.status.success());
    let failure: Value = serde_json::from_slice(&alias.stdout).unwrap();
    assert_eq!(failure["code"], "selection_changed");
    assert_eq!(failure["remote_outcome"], "not_dispatched");
    assert!(!forbidden.exists());
}
