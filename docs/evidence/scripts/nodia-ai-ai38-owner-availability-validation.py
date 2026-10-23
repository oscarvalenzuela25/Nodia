"""Offline chain validation of frozen packages, observed deployment and two turns.

Reads existing local evidence and source pins only. Does not import applications,
emit builds, access the VM, replay inference, confirm effects, or change services.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import tarfile

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "docs/evidence"
OUTPUT = EVIDENCE / "nodia-ai-ai38-owner-availability-validation-r01.json"
SERVER_SHA = "4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92"
CLIENT_SHA = "cdc832c045cb26a4050d4fcceb979b9b7ef910b3ce3471c56c05cd7f219a1a93"
OLD_VALIDATION_SHA = "eddd42dcc808edfbba4dc05739d3d9a9c9498760cde2ba78c9dce8c7f71296e6"
NGINX_SHA = "2f96d9f04d2bc2eba6e1d8bc126ec7d4a5c5b5202bfa3238d87d23e94c52a857"
KNOWLEDGE = "4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130"
CHAT = "a160f615-ea41-4a05-831d-acdbb413ec4d"
RUNS = {"A": "2e9cd4ef-160b-4de8-9456-7ea2930550d3", "B": "b4c1221c-549b-48ce-80d1-f5dd790c4cd7"}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def moment(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main():
    refs = {}
    checks = []

    def read(name):
        path = EVIDENCE / name if "/" not in name else ROOT / name
        raw = path.read_bytes()
        refs[path.relative_to(ROOT).as_posix()] = sha(raw)
        return json.loads(raw)

    def verify(condition, name):
        if not condition:
            raise AssertionError(name)
        checks.append(name)

    # Preserve the earlier physical-human/MCP/effect chain, not a second replay.
    historical = read("nodia-ai-ai38-live-ui-validation-r01.json")
    verify(refs["docs/evidence/nodia-ai-ai38-live-ui-validation-r01.json"] == OLD_VALIDATION_SHA,
           "historical_86_check_receipt_byte_identical")
    verify(historical["checks_passed"] == len(historical["checks"]) == 86
           and historical["status"] == "passed_offline_evidence_chain", "historical_86_checks_preserved")
    for name, digest in historical["source_files_sha256"].items():
        read(name)
        assert refs["docs/evidence/" + name] == digest
    verify(True, "all_historical_effect_chain_evidence_pins_preserved")

    server_build = read("nodia-ai-ai38-owner-deploy-package-build-r01.json")
    server = read(server_build["manifest_path"])
    server_base = read("nodia-ai-ai38-journal-package-r02.json")
    server_QA = read("nodia-ai-ai38-owner-deploy-qa-r01.json")
    client_ref = read("nodia-ai-ai38-ownerclient-r01.json")
    client = read(client_ref["path"] + "/manifest.json")
    client_validation = read("nodia-ai-ai38-ownerclient-r01-validation.json")

    def archive(reference, manifest, manifest_name):
        path = ROOT / reference["archive_path"]
        refs[path.relative_to(ROOT).as_posix()] = sha(path.read_bytes())
        assert refs[path.relative_to(ROOT).as_posix()] == reference["archive_sha256"]
        with tarfile.open(path, "r:gz") as stream:
            members = stream.getmembers()
            assert len({member.name for member in members}) == len(members)
            assert all(member.isfile() for member in members)
            assert {member.name for member in members} == set(manifest["files"]) | {manifest_name}
            assert sha(stream.extractfile(manifest_name).read()) == reference["manifest_sha256"]
            assert all(sha(stream.extractfile(name).read()) == digest for name, digest in manifest["files"].items())
            return len(members)

    verify(server_build["manifest_sha256"] == SERVER_SHA
           and refs[server_build["manifest_path"]] == SERVER_SHA, "Server_successor_manifest_pin")
    verify(archive(server_build, server, "release-manifest.json") == 3880, "Server_all_3880_tar_members_verified")
    verify(len(server["files"]) == 3879 and sum(name.startswith("dist/") for name in server["files"]) == 2851,
           "Server_3879_files_2851_outputs")
    delta = {name for name, digest in server["files"].items() if server_base["files"][name] != digest}
    verify(delta == set(server_build["changes"]) and len(delta) == 4, "only_four_reviewed_Server_DTO_members_changed")
    verify(server["knowledge_release"] == KNOWLEDGE and server_QA["test_counts"] == {"passed": 12, "failed": 0, "skipped": 0, "files": 1}
           and server_QA["build_exit"] == server_QA["lint_exit"] == 0, "Server_focused_QA_and_knowledge_preserved")
    for name, digest in server["files"].items():
        if name.startswith("src/"):
            assert sha((ROOT / "nodia-server" / name).read_bytes()) == digest
    for name, digest in server_QA["source_pins"].items():
        assert sha((ROOT / name).read_bytes()) == digest
    verify(True, "current_Server_sources_and_QA_pins_match_reviewed_successor")
    verify(client_ref["manifest_sha256"] == CLIENT_SHA and refs[client_ref["path"] + "/manifest.json"] == CLIENT_SHA,
           "Client_successor_manifest_pin")
    verify(archive(client_ref, client, "manifest.json") == 178 and client["build_outputs"] == 171,
           "Client_all_178_tar_members_171_outputs_verified")
    verify(client_validation["manifest_sha256"] == CLIENT_SHA
           and len(client_validation["all_47_output_changes_explained"]) == 47
           and client_validation["source_comparison"] == {"old": 647, "new": 648, "unchanged": 644, "changed": 3, "added": 1, "removed": 0},
           "Client_all_source_and_compiled_differences_reviewed")
    for group in ("production_sources", "additional_JSON_inputs", "public_source_inputs"):
        for name, digest in client[group].items():
            assert sha((ROOT / "nodia-client" / name).read_bytes()) == digest
    verify(True, "current_Client_sources_JSON_public_assets_match_R01_no_exploratory_R02")
    client_QA = read("nodia-ai-ai38-turn-availability-qa-r01.json")
    for pin in client_QA["source_pins"]:
        assert sha((ROOT / pin["path"]).read_bytes()) == pin["sha256"]
    test = next(item for item in client_QA["checks"] if item["command"] == "npm run test")
    verify(test["tests_passed"] == 1802 and test["files_passed"] == 229 and test["isolated_from_heavy_compilation"]
           and all(item["exit_code"] == 0 for item in client_QA["checks"]), "Client_1802_tests_isolated_and_quality_checks_pinned")

    approved = read(".tmp/ai37-baseline.json")["approved_knowledge_hashes"]
    verify(len(approved) == 31 and all(sha((ROOT / name).read_bytes()) == digest for name, digest in approved.items()),
           "all_31_approved_knowledge_documents_byte_identical_to_baseline")

    adopted = read("nodia-ai-ai38-owner-adopt-r01.json")
    preflight = read("nodia-ai-ai38-owner-adopt-preflight-r01.json")
    stage = read("nodia-ai-ai38-owner-stage-r01.json")
    client_stage = read("nodia-ai-ai38-ownerclient-stage-r01.json")
    final = read("nodia-ai-ai38-owner-final-r01.json")
    verify(stage["manifest_sha256"] == SERVER_SHA and stage["members"] == 3880
           and client_stage["manifest_sha256"] == CLIENT_SHA and client_stage["members"] == 178,
           "remote_staging_receipts_match_frozen_archives")
    verify(adopted["status"] == "adopt_completed" and preflight["status"] == "preflight_passed_no_mutations"
           and adopted["new_manifest_sha256"] == SERVER_SHA and adopted["changed_files"] == sorted(delta),
           "real_Server_adoption_matches_reviewed_four_file_successor")
    verify(adopted["post_consumers"] == final["consumers"]
           and all(unit["working_directory"] == server_build["release"] and unit["active"] == "active"
                   and unit["argv_exact_match"] and unit["original_dotenv_path_verified"] and unit["recovery_config_path_verified"]
                   for unit in final["consumers"].values()), "final_effective_Server_processes_preserve_adopted_epoch")
    verify(final["SQL_schema_and_selection"] == adopted["before"]["schema_and_selection"]
           and final["SQL_schema_and_selection"]["migrations"] == 29,
           "live_schema_migration_ledger_and_provider_configuration_preserved")
    verify(adopted["migrations"] == adopted["SQL_restores"] == adopted["provider_requests"] == adopted["business_effects"] == 0
           and adopted["journal_era_preserved"] and adopted["timers_restored"] and not adopted["journal_bootstrap_or_close"],
           "adoption_preserves_journal_and_does_not_replay_business_or_provider")
    journal = final["external_status"]
    verify(journal["coverage_from"] == adopted["before"]["journal"]["coverage_from"]
           and journal["coverage_closed_at"] is None and journal["unconfirmed"] == journal["expired_backups"] == 0
           and journal["backups"] == 6 and all(timer["active"] == "active" for timer in final["timers"].values()),
           "journal_era_and_six_backups_timers_observed_at_final_cut")
    backup = adopted["fresh_backup"]
    verify(backup["status"] == "ready" and (moment(backup["expires_at"]) - moment(backup["captured_at"])).total_seconds() == 7 * 86400,
           "fresh_adoption_backup_ready_with_fixed_seven_day_expiry")
    verify(final["Gemini"] == adopted["before"]["Gemini"] and final["nginx_sha256"] == NGINX_SHA,
           "Gemini_epoch_unchanged_and_original_proxy_restored")
    verify(all(final["quiet"]["SQL"][key] == 0 for key in ("pending_jobs", "open_attempts", "retained_slots")),
           "final_SQL_quiescence_observed")

    for window, client_hash, consumers in (("baseline", "0c54fcafebe607a661b169288daa92fe12ca7110278d94eac9160478214ee49b", adopted["pre_consumers"]),
                                            ("server", "0c54fcafebe607a661b169288daa92fe12ca7110278d94eac9160478214ee49b", adopted["post_consumers"]),
                                            ("client", CLIENT_SHA, adopted["post_consumers"])):
        opened = read(f"nodia-ai-ai38-owner-ui-{window}-open-r01.json")
        closed = read(f"nodia-ai-ai38-owner-ui-{window}-close-r01.json")
        verify(all(item["status"] == "passed" and item["client_manifest_sha256"] == client_hash
                   and item["client_outputs"] == 171 and item["server_consumers"] == consumers
                   and item["Gemini"] == final["Gemini"] and item["scoped20m_preserved"]
                   and not item["API_worker_Gemini_restarted"] for item in (opened, closed))
               and closed["site_sha256"] == NGINX_SHA, window + "_UI_window_closed_with_exact_original_proxy_and_expected_processes")

    static = read("nodia-ai-ai38-ownerclient-static-r01.json")
    served = {"dist/" + row["path"]: row for row in static["static_outputs"]}
    expected_outputs = {name: digest for name, digest in client["files"].items() if name.startswith("dist/")}
    verify(static["manifest_sha256"] == CLIENT_SHA and set(served) == set(expected_outputs)
           and all(served[name]["status"] == 200 and served[name]["sha256"] == digest for name, digest in expected_outputs.items())
           and static["deep_route_matches_index"], "all_171_Client_outputs_served_exactly_and_deep_route_matches_index")
    selector = read("nodia-ai-ai38-owner-selector-http-r01.json")
    verify(selector["full_window_scanned"] and any(row["phase"] == "after_adoption_owner_fix" and row["status"] == 200
           and row["id_eq_filter_present"] and row["count"] >= 1 for row in selector["counts"]), "native_owner_id_eq_HTTP_200_after_adoption")

    snapshots = {}
    for label, name in (("preserved", "nodia-ai-ai38-owner-sql-preserved-r01.json"), ("A", "nodia-ai-ai38-turn-a-sql-r01.json"),
                        ("B", "nodia-ai-ai38-turn-b-sql-r01.json"), ("final", "nodia-ai-ai38-owner-turn-final-sql-r01.json")):
        item = read(name)
        snapshot = item["snapshot"]
        verify(item["transaction"] == {"read_only": True, "isolation": "repeatable read"}
               and sha(json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False).encode()) == item["snapshot_sha256"]
               and snapshot["conversation"]["id"] == CHAT and item["configured_SQL_writes"] == item["provider_requests"] == 0,
               label + "_SQL_snapshot_hash_and_readonly_scope")
        snapshots[label] = snapshot
    verify(snapshots["B"] == snapshots["final"] and snapshots["final"]["counts"]["messages"] == 6
           and snapshots["final"]["counts"]["runs"] == 3, "final_entire_SQL_projection_equal_to_B_six_messages_three_runs")
    for key in ("movements", "executions", "execution_steps", "proposals", "proposal_steps", "challenges"):
        assert snapshots["preserved"][key] == snapshots["final"][key]
    effect = snapshots["final"]["movements"]
    steps = snapshots["final"]["execution_steps"]
    verify(snapshots["final"]["marker_count"]["owned_marker_count"] == 1 and len(effect) == len(steps) == len(snapshots["final"]["executions"]) == 1
           and effect[0]["id"] == historical["identities"]["movement_id"] and effect[0]["amount"] == "1"
           and effect[0]["status"] == "pending" and effect[0]["type"] == "expense"
           and steps[0]["minimal_receipt"]["resource_id"] == effect[0]["id"] and steps[0]["state"] == "completed"
           and steps[0]["minimal_receipt"]["resource_key"] == "finance_movements",
           "one_historical_pending_effect_and_atomic_receipt_preserved_without_new_confirmation")

    native_receipts = {}
    for label, run_id in RUNS.items():
        native = read(f"nodia-ai-ai38-turn-{label.lower()}-native-r01.json")
        native_receipts[label] = native
        run = next(row for row in snapshots[label]["runs"] if row["id"] == run_id)
        native_run = native["SQL"]["runs"][0]
        verify(native_run["id"] == run_id and native_run["state"] == run["state"] == "completed"
               and native_run["completed_at"] == run["completed_at"] and run["provider_dispatches_used"] == 1
               and run["tool_calls_used"] == 0 and run["mcp_rpc_messages_used"] == 6,
               label + "_one_completed_dispatch_zero_domain_tools_six_protocol_RPC")
        verify(len(native["per_attempt"]) == 1 and native["per_attempt"][0]["HTTP_200_ACK_count"] == 1
               and native["all_attempt_ACK_HTTP_200_observed"] and native["global_native_artifacts_absent"]
               and all(count == 0 for count in native["native_artifact_counts"].values())
               and native["provider_requests"] == native["configured_SQL_writes"] == 0 and not native["ACK_or_reconcile_requested"],
               label + "_one_correlated_native_ACK_and_no_artifacts_or_observer_effect")
        verify(native["container_epoch"] == {"Id": final["Gemini"]["id"], "Image": final["Gemini"]["image"], "started_at": final["Gemini"]["started_at"]}
               and native["same_container_epoch_after"] and native["per_attempt"][0]["exact_terminal_diagnostics"] is None,
               label + "_native_epoch_preserved_terminal_diagnostics_unknown")

    timeline = read("nodia-ai-ai38-turn-http-timeline-r01.json")
    verify(timeline["start_anchor_verified"] and not timeline["HTTP_body_semantics_or_eligibility_reason_observed"]
           and sum(row["count"] for row in timeline["counts"] if row["endpoint"] == "acceptance_message_admission" and row["status"] == 202) == 2,
           "bounded_HTTP_window_has_exactly_two_admitted_messages_not_response_semantics")
    for label in RUNS:
        finished = moment(native_receipts[label]["SQL"]["runs"][0]["completed_at"])
        later = [row for row in timeline["timeline"] if row["endpoint"] == "connection_eligibility" and row["status"] == 200
                 and row["known_selection_exact_match"] and moment(row["timestamp_utc"]) > finished]
        verify(bool(later), label + "_exact_selection_GET_observed_strictly_after_SQL_completion")
    probe = read("nodia-ai-ai38-probe-http-metadata-r03.json")
    observations = [row for row in probe["timeline"] if row["endpoint"] == "native_agentic_observe"]
    verify([row["status"] for row in observations] == [409, 200]
           and moment(observations[0]["timestamp_utc"]) < moment(observations[1]["timestamp_utc"])
           and not probe["response_reasons_observed"] and not probe["concurrency_or_cause_proven_by_timestamps"],
           "probe_R03_native_409_then_200_observed_without_claiming_cause")

    DOM = read("nodia-ai-ai38-turn-live-dom-r01.json")
    reopened = read("nodia-ai-ai38-turn-reopened-dom-r01.json")
    recovered = read("nodia-ai-ai38-turn-recovery-dom-r01.json")
    index = (ROOT / client_ref["path"] / "dist/index.html").read_text(encoding="utf-8")
    main_script = re.search(r'<script[^>]*src="([^"]+)"', index).group(1)
    verify(DOM["reply_A_exact_count"] == DOM["reply_B_exact_count"] == 1 and DOM["composer_enabled"]
           and DOM["main_script"] == main_script and DOM["generation_messages_sent_by_operator"] == 2,
           "authenticated_DOM_has_both_exact_responses_and_enabled_composer")
    verify(not reopened["composer_enabled"] and recovered["composer_enabled"]
           and recovered["reply_A_exact_count"] == recovered["reply_B_exact_count"] == 1
           and recovered["visible"]["main_script"] == main_script and not recovered["visible"]["busy_message_visible"]
           and recovered["generation_messages_sent_by_operator"] == 2 and recovered["new_business_confirmations"] == 0,
           "reopened_busy_composer_recovers_without_an_extra_message_or_confirmation")
    restored = read("nodia-ai-ai38-owner-local-restored-r01.json")
    verify(restored["port"] == 5174 and restored["restored_vite_pid"] > 0 and restored["own_tunnel_stopped"] > 0
           and restored["restored_vite_pid"] != restored["own_tunnel_stopped"] and restored["window_style"] == "Hidden"
           and restored["entry"].endswith("nodia-client/node_modules/vite/bin/vite.js"), "local_Vite_restore_and_owned_tunnel_stop_receipt_present")
    local_verified = read("nodia-ai-ai38-owner-local-verified-r01.json")
    verify(local_verified["vite_pid"] == restored["restored_vite_pid"] and local_verified["listener_5174_matches"]
           and local_verified["workspace_identity_matches"] and local_verified["vite_script_present"]
           and local_verified["http_status"] == 200 and local_verified["own_tunnel_65028_absent"],
           "restored_local_Vite_process_socket_HTTP_and_owned_SSH_absence_observed")

    report = {
        "schema": "nodia-ai-ai38-owner-availability-validation-v1", "status": "passed_offline_evidence_chain_AI38_partial",
        "validator_sha256": sha(Path(__file__).read_bytes()), "checks_passed": len(checks), "checks": checks,
        "historical_effect_chain": {"sha256": OLD_VALIDATION_SHA, "checks_preserved": 86, "not_replayed": True},
        "frozen_Server_manifest_sha256": SERVER_SHA, "frozen_Client_manifest_sha256": CLIENT_SHA,
        "source_files_sha256": dict(sorted(refs.items())),
        "approved_documents_byte_identical": 31, "knowledge_release": KNOWLEDGE,
        "new_turns_completed": 2, "new_dispatches": 2, "new_domain_tool_calls": 0, "new_ACK_HTTP_200": 2,
        "new_business_confirmations": 0, "historical_effects_preserved": 1,
        "network_requests_by_validator": 0, "VM_or_runtime_mutations_by_validator": 0,
        "limits": [
            "Validates local observed receipts and frozen bytes; it does not independently repeat OAuth, DOM, SQL, provider calls, physical confirmation or deployment.",
            "Two completed conversational turns and two ACKs do not prove uninterrupted availability; a later idle runtime_busy state and native observe409 were recorded, followed by recovery and observe200.",
            "The cause or owner of the transient busy condition remains unknown. Attachments R02 speculation was discarded; current sources still match Client R01.",
            "Nginx eligibility200 does not prove admissibility because no response body is retained. Timeline ordering is restricted to VM timestamps; browser/operator clock is not used for cross-host chronology.",
            "Exact native terminal diagnostics remain unknown; ACK and artifact absence are metadata observations. No proof/token files were opened by the new turn observers.",
            "Vite restoration uses the saved process/socket/HTTP verification cut; the offline validator does not make a new availability probe.",
            "No new rollback, migration, restore, new domain MCP execution, public TLS, full catalog publication, seven-day observed stability, or production acceptance is established here. AI-38 remains partial.",
        ],
    }
    if OUTPUT.exists():
        verify_existing = json.loads(OUTPUT.read_bytes())
        assert verify_existing == report, "frozen_validation_differs_do_not_overwrite"
    else:
        with OUTPUT.open("xb") as stream:
            stream.write(json.dumps(report, sort_keys=True, indent=2).encode() + b"\n")
    print(json.dumps({"status": report["status"], "new_checks": len(checks), "historical_checks_preserved": 86,
                      "path": OUTPUT.relative_to(ROOT).as_posix(), "sha256": sha(OUTPUT.read_bytes())}))


if __name__ == "__main__":
    main()
