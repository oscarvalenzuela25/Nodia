"""Offline successor: preserve R01 and bind closed terminal/qualification facts."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "docs/evidence"
PREFIX = "nodia-ai-ai38-profile-reservation-"
OUTPUT = EVIDENCE / (PREFIX + "validation-r02.json")


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    refs, checks = {}, []

    def read(path):
        raw = (ROOT / path).read_bytes()
        refs[path] = digest(raw)
        return json.loads(raw)

    def verify(condition, name):
        if not condition:
            raise AssertionError(name)
        checks.append(name)

    previous_path = "docs/evidence/" + PREFIX + "validation-r01.json"
    previous = read(previous_path)
    verify(refs[previous_path] == "e75fa850fa113007174c2d81b3374038b46ac87925e92e7c502b460c290f95a0"
           and previous["checks_passed"] == len(previous["checks"]) == 70
           and previous["status"] == "passed_profile_contention_fix_MCP_unverified",
           "scoped_70_check_R01_receipt_preserved_exactly")
    previous_script = "docs/evidence/scripts/" + PREFIX + "validation.py"
    refs[previous_script] = digest((ROOT / previous_script).read_bytes())
    verify(refs[previous_script] == previous["validator_sha256"]
           and all(digest((ROOT / path).read_bytes()) == pin for path, pin in previous["source_files_sha256"].items()),
           "R01_validator_and_entire_saved_evidence_chain_bytes_unchanged")
    terminal_path = "docs/evidence/" + PREFIX + "mcp-terminal-r02.json"
    terminal = read(terminal_path)
    mcp_path = "docs/evidence/" + PREFIX + "mcp-r01.json"
    mcp = read(mcp_path)
    verify(terminal["native_epoch"] == mcp["native_epoch_before"]
           and mcp["same_native_epoch_after"] and terminal["exact_attempt_and_closed_terminal_schema_verified"]
           and terminal["terminal_record_count"] == len(terminal["terminal_records"]) == 1
           and terminal["terminal_records"][0]["attempt_id"] == mcp["native_result"]["diagnostics"]["attempt_id"]
           and terminal["HTTP_requests"] == terminal["provider_generation_requests"] == terminal["service_changes"] == 0
           and not terminal["raw_logs_headers_bodies_or_account_files_saved"],
           "closed_terminal_metadata_exact_attempt_and_FIX_epoch_without_new_dispatch")
    row = terminal["terminal_records"][0]
    verify(row["phase"] == "running_cli" and row["state"] == "unknown"
           and row["exception_type"] == "TimeoutError" and row["callbacks"] == 0
           and row["rpc_messages"] == row["rpc"]["events"] == 6 and row["exit_code"] is None
           and not row["gate_verified"] and row["cli"]["terminal_status"] == "absent"
           and row["rpc"]["tools_list_successes"] == 1 and row["rpc"]["methods"]["tools_call"] == 0
           and row["rpc"]["reply_construction_not_cli_consumption"]
           and row["cli_log"]["text_indicators_are_not_verified_cause"],
           "terminal_timeout_and_tools_list_reply_do_not_prove_provider_cause_CLI_consumption_or_MCP")
    guard_path = "docs/evidence/nodia-ai-ai38-profile-reattest-modalities-no-start-r01.json"
    guard = read(guard_path)
    verify(guard["status"] == "blocked_MCP_qualification_failed"
           and guard["qualification_guard_invoked_locally"] and guard["qualification_rejected"]
           and guard["qualification_rejection_code"] == "MCP_qualification_failed"
           and guard["mcp_report"] == mcp_path and guard["mcp_report_sha256"] == refs[mcp_path],
           "local_modalities_guard_rejected_exact_failed_fresh_MCP_qualification")
    for path_key, digest_key in (("staging_receipt", "staging_receipt_sha256"), ("cohort_source", "cohort_source_sha256")):
        raw = (ROOT / guard[path_key]).read_bytes()
        refs[guard[path_key]] = digest(raw)
        assert refs[guard[path_key]] == guard[digest_key]
    verify(guard["not_started"] == guard["maximum_generations"] == 8
           and all(guard[key] == 0 for key in ("generations", "generation_starts", "provider_calls", "VM_calls", "SQL_calls", "subprocess_calls"))
           and not any(guard[key] for key in ("historic_proof_reused", "runtime_proofs_restored", "capabilities_marked_verified")),
           "eight_modality_canaries_not_started_no_historical_proof_reuse_or_capability_promotion")
    separate = guard["real_MCP_attempt_separate_from_this_guard"]
    verify(separate["status"] == "failed" and separate["error_code"] == "mcp_result_unknown"
           and separate["provider_dispatch_requests"] == 1 and separate["callbacks"] == 0
           and separate["native_ACK"] and not separate["native_pending_identity"]
           and previous["MCP"]["supports_mcp_after"] is None
           and previous["MCP"]["current_epoch_MCP_verified"] is False,
           "failed_MCP_attempt_and_zero_generation_guard_distinguished_unknown_not_available")
    report = {
        "schema": "ai38-profile-reservation-offline-validation-successor-v1",
        "status": previous["status"],
        "scope": "R01_integrity_plus_closed_terminal_and_local_qualification_guard_receipts",
        "predecessor": {"path": previous_path, "sha256": refs[previous_path], "checks_preserved": 70,
                        "older_chains": previous["predecessor"]},
        "additional_checks_passed": len(checks), "additional_checks": checks,
        "source_files_sha256": refs, "validator_sha256": digest(Path(__file__).read_bytes()),
        "MCP": previous["MCP"],
        "limits": previous["limits"] + [
            "Closed terminal metadata shows a running_cli TimeoutError and a constructed tools/list reply; CLI consumption and provider root cause remain unproven.",
            "The modality no-start receipt validates a local qualification guard; it is not modality acceptance or a second MCP generation."
        ],
        "validator_runtime_actions": {"VM_mutations": 0, "provider_requests": 0, "SQL_requests": 0, "full_QA_runs": 0}
    }
    raw = (json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode()
    if OUTPUT.exists():
        assert OUTPUT.read_bytes() == raw, "Frozen successor differs; do not overwrite"
    elif args.write:
        with OUTPUT.open("xb") as target:
            target.write(raw)
    print(json.dumps({"status": report["status"], "preserved_checks": 70, "additional_checks": len(checks),
                      "receipt_written": OUTPUT.exists(), "receipt_sha256": digest(raw)}))


if __name__ == "__main__":
    main()
