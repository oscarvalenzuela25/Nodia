"""Offline evidence-chain validator; never fills missing live acceptance with defaults."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "docs/evidence"
PREFIX = "nodia-ai-ai38-profile-reservation-"
OUTPUT = EVIDENCE / (PREFIX + "validation-r01.json")
PREDECESSOR_SHA = "63944af75f6def58f25646d042029d6cb142f1c4d77dbf2eefd44d4b9ed96f15"
HISTORICAL_86_SHA = "eddd42dcc808edfbba4dc05739d3d9a9c9498760cde2ba78c9dce8c7f71296e6"
DIAG_PROBE_SHA = "33cda4b0c8429729118b403b027885939ddc8d212f51b0b96f6ddbab065688ca"
DIAG_PROBE_EVENTS_SHA = "81be36cb115390e76e9e782c323e6ef46b0441bc6ead8b4140b2a4db93e4dee8"
FINAL_NAMES = ("fix-build-manifest-r01", "fix-build-r01", "fix-adopt-plan-r01", "fix-adopt-r01",
               "fix-probe-a-r01", "fix-probe-a-events-r01", "fix-probe-b-r01", "fix-probe-b-events-r01",
               "mcp-r01", "ui-r01", "ui-events-r01", "final-sql-r01", "final-sql-r02", "final-r01", "local-r01")
DIAG_FIELDS = {"event", "engine", "purpose", "reservation_nonce", "owner_engine", "owner_purpose", "elapsed_ms", "quarantined", "reason"}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def moment(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class Chain:
    def __init__(self):
        self.refs = {}
        self.checks = []

    def read(self, name):
        path = ROOT / name if "/" in name else EVIDENCE / (PREFIX + name + ".json")
        raw = path.read_bytes()
        self.refs[path.relative_to(ROOT).as_posix()] = sha(raw)
        return json.loads(raw)

    def verify(self, condition, label):
        if not condition:
            raise AssertionError(label)
        self.checks.append(label)

    def build(self, phase, revision, expected_delta):
        manifest = self.read(f"{phase}-build-manifest-{revision}")
        built = self.read(f"{phase}-build-{revision}")
        manifest_path = "docs/evidence/" + PREFIX + f"{phase}-build-manifest-{revision}.json"
        self.verify(self.refs[manifest_path] == built["manifest_sha256"], phase + "_build_manifest_pin")
        archive = ROOT / f".tmp/ai38-profile-reservation-{phase}-build-{revision}.tar"
        self.refs[archive.relative_to(ROOT).as_posix()] = sha(archive.read_bytes())
        self.verify(self.refs[archive.relative_to(ROOT).as_posix()] == built["archive_sha256"], phase + "_archive_pin")
        with tarfile.open(archive) as bundle:
            members = bundle.getmembers()
            assert all(member.isfile() for member in members)
            assert len({member.name for member in members}) == len(members)
            assert {member.name for member in members} == {"manifest.json", "context/Dockerfile"} | {"context/" + name for name in manifest["image_sources"]} | {"tests/" + name for name in manifest["test_files"]}
            assert sha(bundle.extractfile("manifest.json").read()) == built["manifest_sha256"]
            assert sha(bundle.extractfile("context/Dockerfile").read()) == manifest["dockerfile_sha256"]
            for name, digest in manifest["image_sources"].items():
                assert sha(bundle.extractfile("context/" + name).read()) == digest
            for name, digest in manifest["test_files"].items():
                assert sha(bundle.extractfile("tests/" + name).read()) == digest
        self.verify(True, phase + "_all_archive_members_verified_without_runtime_imports")
        base, target = manifest["base_public_python_hashes"], built["target_public_python_hashes"]
        self.verify(set(base) == set(target) and len(target) == 47 and {name for name in base if base[name] != target[name]} == expected_delta
                    and set(manifest["image_sources"]) == expected_delta
                    and all(target[name] == digest for name, digest in manifest["image_sources"].items()),
                    phase + "_exact_public_source_delta_and_other_B8_bytes_preserved")
        self.verify(built["status"] == "passed" and built["Linux_QA_exit"] == built["Linux_runtime_skips"] == 0
                    and built["build_exit"] == 0 and built["operational_epoch_unchanged"] and not built["candidate_activated"],
                    phase + "_isolated_Linux_QA_no_adoption_or_runtime_skips")
        self.verify(built["requirements_unchanged"] and built["distribution_inventory_unchanged"]
                    and built["baseline_distribution_count"] == len(built["baseline_distribution_inventory"]) == 42
                    and built["added_layers"] == 1 and built["image_Config_unchanged"]
                    and built["build_and_QA_network"] == "none" and built["QA_root_read_only"]
                    and not built["operational_profiles_environment_or_credentials_mounted"],
                    phase + "_COPY_only_dependency_and_offline_isolation_guarantees")
        return manifest, built

    def predecessor(self):
        old_path = "docs/evidence/nodia-ai-ai38-owner-availability-validation-r01.json"
        old = self.read(old_path)
        self.verify(self.refs[old_path] == PREDECESSOR_SHA and old["checks_passed"] == len(old["checks"]) == 49,
                    "predecessor_49_check_receipt_preserved_exactly")
        self.verify(old["historical_effect_chain"]["sha256"] == HISTORICAL_86_SHA
                    and old["historical_effect_chain"]["checks_preserved"] == 86, "predecessor_keeps_historical_86_check_chain")
        for name, digest in old["source_files_sha256"].items():
            assert sha((ROOT / name).read_bytes()) == digest
        self.verify(True, "all_saved_predecessor_evidence_pins_unchanged")

    def diagnostic(self):
        failed = self.read("diag-build-r01")
        failed_manifest = self.read("diag-build-manifest-r01")
        self.verify(failed["status"] == "failed" and failed["Linux_QA_exit"] == 1
                    and failed["failure_code"] == "isolated_Linux_QA_failed" and not failed["candidate_activated"]
                    and failed["operational_epoch_unchanged"] and failed["owned_offline_containers_remaining"] == 0,
                    "failed_DIAG_R01_retained_without_operational_adoption")
        self.verify(sha((EVIDENCE / (PREFIX + "diag-build-manifest-r01.json")).read_bytes()) == failed["manifest_sha256"]
                    and len(failed_manifest["image_sources"]) == 5, "failed_DIAG_R01_manifest_pin_preserved")
        manifest, built = self.build("diag", "r02", {"durable_login.py", "main.py", "native_mcp_sessions.py", "nodia_ai_chat.py", "profile_admission.py"})
        self.verify(built["Linux_tests_discovered_and_executed"] == 458
                    and manifest["historic_test_sources"] == 42 and manifest["test_source_count"] == 44
                    and not manifest["full_local_suite_parity_claimed"], "DIAG_R02_458_applicable_tests_not_full_local_backlog_parity")
        proofs = manifest["purpose_only_AST_proof"]
        self.verify(len(proofs) == 5 and all(item.get("only_purpose_keywords_changed") or item.get("diagnostic_owner_instrumentation") for item in proofs),
                    "DIAG_R02_purpose_only_AST_proofs_and_gate_diagnostics")
        drift = self.read("source-drift-r01")
        self.verify(drift["base_count"] == 47 and drift["local_count"] == 48 and drift["preserved"] == 39
                    and len(drift["changed"]) == 8 and set(drift["added"]) == {"invoice_mcp_contract.py"},
                    "local_backlog_47_vs_48_inventory_not_silently_deployed")
        plan = self.read("diag-adopt-plan-r01")
        adopt = self.read("diag-adopt-r01")
        self.verify(adopt["status"] == "adopt_completed" and adopt["plan_sha256"] == self.refs["docs/evidence/" + PREFIX + "diag-adopt-plan-r01.json"]
                    and adopt["epoch_after"]["image_id"] == plan["target_image_id"] == built["candidate_image_id"]
                    and adopt["public_sources_after"] == built["target_public_python_hashes"], "DIAG_R02_real_adoption_matches_frozen_image")
        self.verify(adopt["provider_generation_requests"] == adopt["configured_SQL_writes"] == adopt["business_effects"] == adopt["migrations"] == 0
                    and not adopt["journal_bootstrap_or_close"] and adopt["timers_restored"]
                    and adopt["new_epoch_requires_explicit_inference_MCP_acceptance"],
                    "DIAG_adoption_no_generation_or_effect_and_old_ephemeral_proofs_not_reused")
        probe = self.read("diag-probe-a-r01")
        events = self.read("diag-probe-a-events-r01")
        self.verify(self.refs["docs/evidence/" + PREFIX + "diag-probe-a-r01.json"] == DIAG_PROBE_SHA
                    and self.refs["docs/evidence/" + PREFIX + "diag-probe-a-events-r01.json"] == DIAG_PROBE_EVENTS_SHA,
                    "original_real_DIAG_probe_and_owner_event_receipts_byte_identical")
        self.verify(probe["provider_generation_requests"] == probe["configured_SQL_writes"] == probe["automatic_retries"] == 0
                    and sorted(row["status"] for row in probe["HTTP_requests"]) == [200, 409]
                    and probe["native_epoch_before"] == probe["native_epoch_after"], "real_DIAG_metadata_probe_reproduces_contention_without_generation")
        rejected = [row for row in events["reservation_events"] if row["engine"] == "agentic" and row["purpose"] == "eligibility" and row["event"] == "reject"]
        self.verify(len(rejected) == 1 and rejected[0]["reason"] == "runtime_busy" and not rejected[0]["quarantined"], "real_DIAG_eligibility_busy_is_not_quarantine")
        reject = rejected[0]
        owner = [row for row in events["reservation_events"] if row["reservation_nonce"] == reject["reservation_nonce"] and row["event"] == "acquire"]
        release = [row for row in events["reservation_events"] if row["reservation_nonce"] == reject["reservation_nonce"] and row["event"] == "release"]
        self.verify(len(owner) == len(release) == 1 and owner[0]["purpose"] == reject["owner_purpose"] == "health_status"
                    and moment(owner[0]["timestamp_utc"]) < moment(reject["timestamp_utc"]) < moment(release[0]["timestamp_utc"])
                    and reject["elapsed_ms"] > 0 and release[0]["elapsed_ms"] > reject["elapsed_ms"]
                    and not release[0]["quarantined"] and events["holder_chain_is_based_on_instrumented_reservation_nonce_not_HTTP_coincidence"],
                    "real_DIAG_full_nonce_chain_identifies_live_health_owner_before_eligibility_rejection")
        self.verify(all(set(row) == DIAG_FIELDS | {"timestamp_utc"} for row in events["reservation_events"])
                    and events["malformed_diagnostic_lines"] == 0 and not events["raw_logs_or_credential_bytes_saved"],
                    "DIAG_nine_closed_fields_plus_observer_timestamp_no_payloads")
        browser = self.read("diag-ui-r01")
        browser_events = self.read("diag-ui-events-r01")
        self.verify(not browser["composer_enabled"] and browser["visible_busy"]
                    and browser["new_messages_sent"] == browser["new_business_confirmations"] == 0
                    and browser_events["native_epoch"] == events["native_epoch"],
                    "natural_authenticated_DIAG_reload_busy_recorded_without_message_or_effect")
        correlations = browser_events["closed_owner_correlations"]
        self.verify(len(correlations) == 1 and correlations[0]["request_purpose"] == "eligibility"
                    and correlations[0]["owner_purpose"] == "health_status" and correlations[0]["owner_acquisition_observed"]
                    and correlations[0]["owner_nonquarantined_release_after_rejection"]
                    and not correlations[0]["owner_nonquarantined_release_before_rejection"]
                    and correlations[0]["live_owner_chain_observed"] and not correlations[0]["quarantined"],
                    "natural_DIAG_UI_reload_has_complementary_live_health_owner_nonce_chain")
        return manifest, built, adopt

    def fix_build(self, diagnostic_manifest, diagnostic_build):
        manifest, built = self.build("fix", "r01", {"main.py", "nodia_ai_chat.py", "profile_admission.py"})
        self.verify(manifest["base_image_id"] == diagnostic_build["candidate_image_id"]
                    and manifest["base_public_python_hashes"] == diagnostic_build["target_public_python_hashes"]
                    and built["baseline_requirements_sha256"] == diagnostic_build["baseline_requirements_sha256"]
                    and built["baseline_distribution_inventory"] == diagnostic_build["baseline_distribution_inventory"],
                    "FIX_derives_from_exact_DIAG_R02_and_preserves_42_distributions")
        self.verify(built["Linux_tests_discovered_and_executed"] == 474 and manifest["test_source_count"] == 45
                    and not manifest["full_local_suite_parity_claimed"], "FIX_474_applicable_Linux_tests_not_local_full_backlog_parity")
        callers = self.read("fix-callers-ast-r01")
        self.verify(self.refs["docs/evidence/" + PREFIX + "fix-callers-ast-r01.json"] == manifest["callers_AST_proof_sha256"]
                    and len(callers["proofs"]) == 2 and all(item["entire_remaining_module_AST_identical"]
                    and item["CLI_session_model_effort_MCP_and_modality_checks_preserved"] and item["exact_pinned_transform_match"]
                    and item["fixed_sha256"] == manifest["image_sources"][item["file"]]
                    and item["diagnostic_sha256"] == diagnostic_manifest["image_sources"][item["file"]] for item in callers["proofs"]),
                    "FIX_callers_surgical_AST_proof_retains_CLI_session_model_MCP_and_modalities")
        self.verify(manifest["image_sources"]["profile_admission.py"] == sha((ROOT / "nodia-gemini-microservice/profile_admission.py").read_bytes()),
                    "FIX_current_gate_source_matches_frozen_runtime_overlay")
        local = self.read("fix-source-qa-r01")
        asgi = self.read("fix-asgi-qa-r01")
        self.verify(local["exit"] == 0 and local["tests_discovered"] == local["tests_passed"] + local["platform_skips"]
                    and local["tests_passed"] == 503 and local["platform_skips"] == 2,
                    "FIX_local_Windows_503_passes_two_platform_skips_separate_from_Linux_slice")
        for name, digest in local["source_pins"].items():
            assert sha((ROOT / "nodia-gemini-microservice" / name).read_bytes()) == digest
        self.verify(asgi["tests"] == 8 and asgi["failures"] == asgi["errors"] == 0
                    and sha((ROOT / asgi["test_file"]).read_bytes()) == asgi["test_sha256"]
                    and asgi["real_CLI_processes"] == asgi["real_provider_generations"] == 0,
                    "FIX_eight_synthetic_ASGI_coordination_cases_not_real_CLI_acceptance")
        return manifest, built

    def fix_adoption(self, manifest, built, diagnostic_adopt):
        plan = self.read("fix-adopt-plan-r01")
        adopt = self.read("fix-adopt-r01")
        self.verify(adopt["status"] == "adopt_completed" and adopt["phase"] == "fix"
                    and adopt["plan_sha256"] == self.refs["docs/evidence/" + PREFIX + "fix-adopt-plan-r01.json"]
                    and adopt["epoch_before"] == diagnostic_adopt["epoch_after"]
                    and adopt["epoch_after"]["image_id"] == plan["target_image_id"] == built["candidate_image_id"]
                    and adopt["public_sources_after"] == built["target_public_python_hashes"],
                    "FIX_real_adoption_derives_from_DIAG_epoch_with_exact_frozen_sources")
        self.verify(adopt["provider_generation_requests"] == adopt["configured_SQL_writes"] == adopt["business_effects"] == adopt["migrations"] == 0
                    and not adopt["journal_bootstrap_or_close"] and adopt["timers_restored"]
                    and adopt["journal_after"]["coverage_from"] == diagnostic_adopt["journal_after"]["coverage_from"]
                    and adopt["journal_after"]["coverage_closed_at"] is None,
                    "FIX_adoption_preserves_external_era_no_replay_or_business_effect")
        self.verify(all(adopt["quiet_after"]["SQL"][key] == 0 for key in ("pending_jobs", "open_attempts", "retained_slots"))
                    and all(unit["working_directory"] == "/opt/nodia/releases/nodia-server-ai38-owner-r01" and unit["active"] == "active"
                            for unit in adopt["consumers_after"].values()),
                    "FIX_reopens_same_Server_release_only_after_quiescence")
        return adopt

    def fix_probe(self, label, adopt):
        probe = self.read(f"fix-probe-{label.lower()}-r01")
        events = self.read(f"fix-probe-{label.lower()}-events-r01")
        expected_epoch = {"id": adopt["epoch_after"]["container_id"], "image": adopt["epoch_after"]["image_id"],
                          "started_at": adopt["epoch_after"]["started_at_utc"]}
        self.verify(probe["phase"] == "fix" and probe["trial"] == label
                    and probe["provider_generation_requests"] == probe["configured_SQL_writes"] == probe["automatic_retries"] == 0
                    and len(probe["HTTP_requests"]) == 2 and all(row["status"] == 200 for row in probe["HTTP_requests"])
                    and probe["native_epoch_before"] == probe["native_epoch_after"] == events["native_epoch"] == expected_epoch,
                    label + "_FIX_real_metadata_probe_both_HTTP200_same_new_epoch_without_retry_or_generation")
        observations = {row["operation"]: row for row in probe["observations"]}
        self.verify(observations["health"]["returned"] and observations["health"]["agentic_available"]
                    and observations["health"]["agentic_session_active"] and observations["health"]["reason"] is None
                    and observations["observe"]["returned"] and observations["observe"]["available"]
                    and observations["observe"]["reason"] is None and not probe["configured_selection_changed"],
                    label + "_FIX_live_health_and_exact_selection_observation_available")
        agentic = [row for row in events["reservation_events"] if row["engine"] == "agentic"]
        self.verify(events["malformed_diagnostic_lines"] == 0
                    and all(set(row) == DIAG_FIELDS | {"timestamp_utc"} for row in events["reservation_events"])
                    and not any(row["event"] == "reject" for row in agentic)
                    and all(not row["quarantined"] for row in agentic), label + "_FIX_closed_native_events_no_reject_or_quarantine")
        intervals = []
        for acquired in [row for row in agentic if row["event"] == "acquire"]:
            released = [row for row in agentic if row["event"] == "release" and row["reservation_nonce"] == acquired["reservation_nonce"]]
            assert len(released) == 1
            assert moment(released[0]["timestamp_utc"]) >= moment(acquired["timestamp_utc"])
            intervals.append((moment(acquired["timestamp_utc"]), moment(released[0]["timestamp_utc"])))
        intervals.sort()
        self.verify(len(intervals) >= 2 and all(intervals[index][1] <= intervals[index + 1][0] for index in range(len(intervals) - 1)),
                    label + "_FIX_observed_Agentic_owner_intervals_do_not_overlap")
        waits = events["wait_blocking_owner_correlations"]
        self.verify(bool(waits) and all(row["blocking_owner_acquisition_observed"] and row["blocking_owner_nonquarantined_release_observed"]
                    and row["later_same_engine_purpose_acquisitions"] and row["waiter_request_identity_not_available"]
                    and not row["same_request_wait_to_acquire_proven"] and all(item["reservation_nonce"] != row["blocking_owner_reservation_nonce"]
                    for item in row["later_same_engine_purpose_acquisitions"]) for row in waits),
                    label + "_FIX_wait_owner_release_then_later_acquisition_with_distinct_nonce_no_false_waiter_identity_claim")

    def mcp(self, adopt):
        result = self.read("mcp-r01")
        expected_epoch = {"id": adopt["epoch_after"]["container_id"], "image": adopt["epoch_after"]["image_id"],
                          "started_at": adopt["epoch_after"]["started_at_utc"]}
        native = result["native_result"]
        self.verify(result["native_epoch_before"] == expected_epoch and result["same_native_epoch_after"]
                    and native["real_provider_dispatch_requests"] == result["maximum_provider_generation_requests"] == 1
                    and native["native_terminal_proof_acknowledged"] and not native["native_pending_identity"]
                    and not result["native_pending_identity"],
                    "one_explicit_real_MCP_attempt_ACK_and_native_closure_on_the_exact_FIX_epoch")
        counters = native["diagnostics"]["endpoints"]
        self.verify(counters["start"]["requests"] == counters["start"]["completed"] == 1
                    and counters["acknowledge"]["requests"] == counters["acknowledge"]["completed"] == 1
                    and not native["inference_replayed"] and result["automatic_inference_retries"] == 0
                    and result["configured_SQL_writes"] == result["business_effects"] == 0,
                    "MCP_one_start_one_ACK_without_replay_or_business_effect")
        # A reconciled unknown result is a failed acceptance, not a provider
        # success. Missing post-observation capability remains unknown.
        self.verify(result["status"] == "failed_no_replay" and native["status"] == "failed"
                    and native["error_code"] == "mcp_result_unknown" and native["diagnostic_nonce_verified"] is False
                    and native["supports_mcp_before"] is False and "supports_mcp_after" not in native
                    and native["diagnostics"]["callbacks"] == 0
                    and counters["cancel"]["requests"] == counters["cancel"]["completed"] == 1
                    and counters["reconcile"]["requests"] == counters["reconcile"]["completed"] == 1
                    and counters["results"]["requests"] == counters["attest"]["requests"] == 0,
                    "MCP_acceptance_failed_reconciled_unknown_is_not_verified_availability")
        return result

    def final_sql(self):
        before = self.read("docs/evidence/nodia-ai-ai38-owner-turn-final-sql-r01.json")
        earlier = self.read("final-sql-r01")
        after = self.read("final-sql-r02")
        snapshot = after["snapshot"]
        self.verify(after["transaction"] == {"read_only": True, "isolation": "repeatable read"}
                    and sha(json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False).encode()) == after["snapshot_sha256"]
                    and after["configured_SQL_writes"] == after["provider_requests"] == 0,
                    "final_projected_SQL_snapshot_hash_and_readonly_scope")
        self.verify(snapshot == before["snapshot"] and snapshot["counts"]["messages"] == 6 and snapshot["counts"]["runs"] == 3,
                    "entire_chat_SQL_projection_stable_after_metadata_MCP_and_UI_acceptance")
        self.verify(snapshot == earlier["snapshot"] and moment(after["observed_at_VM_utc"]) > moment(earlier["observed_at_VM_utc"]),
                    "post_UI_final_SQL_R02_preserves_earlier_R01_cut_and_material_projection")
        movements, steps = snapshot["movements"], snapshot["execution_steps"]
        self.verify(snapshot["marker_count"]["owned_marker_count"] == 1 and len(movements) == len(steps) == len(snapshot["executions"]) == 1
                    and movements[0]["amount"] == "1" and movements[0]["status"] == "pending"
                    and steps[0]["state"] == "completed" and steps[0]["minimal_receipt"]["resource_id"] == movements[0]["id"]
                    and steps[0]["minimal_receipt"]["resource_key"] == "finance_movements"
                    and all(after["global_quiet"][key] == 0 for key in ("pending_jobs", "open_attempts", "retained_slots")),
                    "one_historical_pending_movement_and_atomic_receipt_no_duplicate_or_pending_job")
        return after

    def ui(self, adopt):
        ui = self.read("ui-r01")
        events = self.read("ui-events-r01")
        self.verify(ui["status"] == "passed_sampled_reload_recovery" and len(ui["initial_open_and_three_reloads"]) == 4
                    and [row["case"] for row in ui["initial_open_and_three_reloads"]] == ["initial_open", "reload_1", "reload_2", "reload_3"]
                    and all(row["composer_enabled"] and not row["visible_busy"] and not row["checking"]
                    and row["turn_a_count"] == row["turn_b_count"] == 2 and row["turn_completed"]
                    and row["browser_entry_scripts"] == ["/@vite/client", "/src/main.tsx"] for row in ui["initial_open_and_three_reloads"]),
                    "authenticated_Vite_initial_open_and_three_reloads_enabled_with_existing_history")
        self.verify(ui["manual_retry_clicks"] == ui["new_messages_sent"] == ui["new_business_confirmations"] == 0
                    and not ui["credential_or_token_storage_accessed"] and ui["operator_clock_not_used_for_VM_log_correlation"]
                    and ui["entrypoint"] == "Vite_5174_current_workspace_not_frozen_Client_distribution",
                    "UI_acceptance_scoped_to_sampled_metadata_reloads_without_messages_or_MCP_claim")
        screenshot = ROOT / ui["screenshot"]
        self.refs[ui["screenshot"]] = sha(screenshot.read_bytes())
        self.verify(self.refs[ui["screenshot"]] == ui["screenshot_sha256"], "UI_screenshot_bytes_pinned")
        expected_epoch = {"id": adopt["epoch_after"]["container_id"], "image": adopt["epoch_after"]["image_id"],
                          "started_at": adopt["epoch_after"]["started_at_utc"]}
        self.verify(events["native_epoch"] == expected_epoch and events["same_native_epoch_after"]
                    and events["malformed_diagnostic_lines"] == 0
                    and not any(row["engine"] == "agentic" and row["event"] == "reject" for row in events["reservation_events"])
                    and events["HTTP_requests"] == events["provider_generation_requests"] == events["service_changes"] == 0,
                    "UI_closed_native_metadata_observer_matches_FIX_epoch_no_Agentic_rejection")
        self.verify(moment(events["began_at_utc"]) == moment(ui["VM_window_begin_utc"])
                    and moment(events["finished_at_utc"]) == moment(ui["VM_window_end_utc"])
                    and all(row["status"] == 200 for row in events["HTTP_metadata"])
                    and sum(row["endpoint"] == "health" for row in events["HTTP_metadata"]) == 4
                    and sum(row["endpoint"] == "observe" for row in events["HTTP_metadata"]) == 4
                    and all(not row["quarantined"] and set(row) == DIAG_FIELDS | {"timestamp_utc"}
                            for row in events["reservation_events"]),
                    "UI_VM_window_four_health_and_four_observe_HTTP200_no_quarantine")
        waits = events["wait_blocking_owner_correlations"]
        self.verify(len(waits) == 2 and all(row["request_purpose"] == "eligibility"
                    and row["owner_purpose"] == "health_status" and row["blocking_owner_acquisition_observed"]
                    and row["blocking_owner_nonquarantined_release_observed"]
                    and row["later_acquire_reservation_nonce_is_not_blocking_owner_nonce"]
                    and row["waiter_request_identity_not_available"] and not row["same_request_wait_to_acquire_proven"] for row in waits),
                    "UI_two_observed_health_owner_wait_chains_without_unproven_waiter_identity")
        final_sql = self.read("final-sql-r02")
        self.verify(moment(final_sql["observed_at_VM_utc"]) >= moment(ui["VM_window_end_utc"]),
                    "final_SQL_R02_cut_follows_complete_UI_window_on_VM_clock")
        return ui

    def final_state(self, adopt, built):
        final = self.read("final-r01")
        old = self.read("docs/evidence/nodia-ai-ai38-owner-final-r01.json")
        local = self.read("local-r01")
        epoch = adopt["epoch_after"]
        self.verify(final["status"] == "observed_read_only"
                    and final["Gemini"]["id"] == epoch["container_id"]
                    and final["Gemini"]["image"] == epoch["image_id"]
                    and final["Gemini"]["started_at"] == epoch["started_at_utc"]
                    and final["Gemini"]["same_epoch_after_inventory"]
                    and final["native_public_source_hashes"] == built["target_public_python_hashes"]
                    and final["native_public_source_count"] == 47,
                    "final_readonly_inventory_same_FIX_epoch_all_47_public_sources")
        self.verify(final["requirements_sha256"] == built["baseline_requirements_sha256"]
                    and final["distribution_inventory"] == built["baseline_distribution_inventory"]
                    and final["distribution_count"] == 42
                    and final["FIX_plan_sha256"] == self.refs["docs/evidence/" + PREFIX + "fix-adopt-plan-r01.json"]
                    and final["FIX_build_receipt_sha256"] == self.refs["docs/evidence/" + PREFIX + "fix-build-r01.json"],
                    "final_42_dependencies_and_plan_build_pins_match_frozen_FIX")
        self.verify(all(final[key] == old[key] for key in ("server_manifest_sha256", "server_members", "dist_outputs", "knowledge_release",
                    "SQL_schema_and_selection", "operator_configuration", "nginx_sha256"))
                    and final["consumers"] == adopt["consumers_after"]
                    and final["timers"] == old["timers"] and final["oneshots"] == old["oneshots"],
                    "final_Server_3879_members_schema_selection_operator_config_and_timers_preserved")
        journal = final["external_status"]
        self.verify(journal["coverage_from"] == old["external_status"]["coverage_from"]
                    and journal["coverage_closed_at"] is None and not journal["release_authorized"]
                    and journal["backups"] == adopt["journal_after"]["backups"] == 8
                    and journal["entries"] == journal["unconfirmed"] == journal["expired_backups"] == 0,
                    "external_journal_era_open_with_eight_backups_no_unconfirmed_or_expired_entries")
        self.verify(all(final["quiet"]["native"][key] == 0 for key in ("unknown_markers", "armed_native_proofs", "terminal_native_proofs",
                    "invalid_native_proofs", "temporary_attachment_directories", "temporary_cli_directories"))
                    and all(final["quiet"]["SQL"][key] == 0 for key in ("pending_jobs", "open_attempts", "retained_slots"))
                    and all(final[key] == 0 for key in ("configured_SQL_writes", "native_HTTP_requests", "provider_generation_requests", "storage_mutations", "service_changes"))
                    and not final["operational_profile_or_login_bytes_opened"]
                    and moment(final["observed_at_VM_utc"]) >= moment(self.read("ui-r01")["VM_window_end_utc"]),
                    "post_UI_final_native_and_SQL_quiet_without_new_generation_or_operational_mutation")
        self.verify(local["status"] == "observed" and local["vite_workspace_identity_matches"]
                    and local["own_bridge_identity_matches"] and local["bridge_loopback_only"]
                    and local["HTTP_status"] == 200 and local["vite_entry_script_present"]
                    and any(row["LocalPort"] == 5174 and row["OwningProcess"] == local["vite_pid"] for row in local["listeners"])
                    and all(row["LocalAddress"] in ("127.0.0.1", "::1") and row["OwningProcess"] == local["bridge_pid"]
                            for row in local["listeners"] if row["LocalPort"] == 3100)
                    and local["own_UI_tab_closed"] and local["services_retained_for_user"]
                    and local["VM_mutations"] == local["new_services_stopped"] == 0
                    and not local["HTTP_body_or_command_lines_emitted"],
                    "local_Vite_and_loopback_bridge_identified_HTTP200_user_services_retained")
        client = self.read(".tmp/ai38-ownerclient-r01/nodia-client/manifest.json")
        self.verify(self.refs[".tmp/ai38-ownerclient-r01/nodia-client/manifest.json"] == "cdc832c045cb26a4050d4fcceb979b9b7ef910b3ce3471c56c05cd7f219a1a93"
                    and len(client["production_sources"]) == 648
                    and all(sha((ROOT / "nodia-client" / name).read_bytes()) == digest
                            for field in ("production_sources", "additional_JSON_inputs", "public_source_inputs")
                            for name, digest in client[field].items()),
                    "current_Client_648_production_sources_JSON_and_public_inputs_still_frozen_R01_no_R02")
        baseline = self.read(".tmp/ai37-baseline.json")
        self.verify(len(baseline["approved_knowledge_hashes"]) == 31
                    and all(sha((ROOT / name).read_bytes()) == digest for name, digest in baseline["approved_knowledge_hashes"].items()),
                    "31_approved_knowledge_sources_unchanged_draft_operational_docs_excluded")
        return final


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    chain = Chain()
    chain.predecessor()
    diagnostic_manifest, diagnostic_build, diagnostic_adopt = chain.diagnostic()
    if all((EVIDENCE / (PREFIX + name + ".json")).is_file() for name in ("fix-build-manifest-r01", "fix-build-r01")):
        fixed_manifest, fixed_build = chain.fix_build(diagnostic_manifest, diagnostic_build)
        if (EVIDENCE / (PREFIX + "fix-adopt-r01.json")).is_file():
            fixed_adopt = chain.fix_adoption(fixed_manifest, fixed_build, diagnostic_adopt)
            for label in ("A", "B"):
                if all((EVIDENCE / (PREFIX + f"fix-probe-{label.lower()}{suffix}-r01.json")).is_file() for suffix in ("", "-events")):
                    chain.fix_probe(label, fixed_adopt)
            if (EVIDENCE / (PREFIX + "mcp-r01.json")).is_file():
                chain.mcp(fixed_adopt)
            if all((EVIDENCE / (PREFIX + name + ".json")).is_file() for name in ("final-sql-r01", "final-sql-r02")):
                chain.final_sql()
            if all((EVIDENCE / (PREFIX + name + ".json")).is_file() for name in ("ui-r01", "ui-events-r01", "final-sql-r02")):
                chain.ui(fixed_adopt)
    pending = [PREFIX + name + ".json" for name in FINAL_NAMES if not (EVIDENCE / (PREFIX + name + ".json")).is_file()]
    if pending:
        print(json.dumps({"status": "pending_live_acceptance_no_final_receipt_written", "existing_checks_passed": len(chain.checks), "missing": pending}))
        if args.write:
            raise SystemExit(2)
        return
    final = chain.final_state(fixed_adopt, fixed_build)
    report = {
        "schema": "ai38-profile-reservation-offline-validation-v1",
        "status": "passed_profile_contention_fix_MCP_unverified",
        "scope": "receipt_integrity_and_concordance_not_new_runtime_acceptance",
        "observed_final_VM_utc": final["observed_at_VM_utc"],
        "checks_passed": len(chain.checks), "checks": chain.checks,
        "source_files_sha256": chain.refs,
        "validator_sha256": sha(Path(__file__).read_bytes()),
        "predecessor": {"sha256": PREDECESSOR_SHA, "checks_preserved": 49,
                        "historical_86_checks_sha256": HISTORICAL_86_SHA},
        "MCP": {"acceptance": "conclusive_failed_reconciled", "provider_result": "mcp_result_unknown",
                "current_epoch_MCP_verified": False, "supports_mcp_after": None,
                "real_dispatches": 1, "callbacks": 0, "nonce_verified": False,
                "cancel_reconcile_ACK_completed": True, "automatic_retries": 0,
                "modalities_acceptance_executed": False},
        "limits": [
            "Profile contention fix accepted in sampled metadata races and four authenticated Vite reload samples; AI-38 not fully closed.",
            "Fresh MCP canary failed with unknown result and was reconciled; metadata availability is not proof of inference or MCP capability.",
            "Wait logs identify the blocking owner; they do not uniquely identify a waiter or prove same-request wait-to-acquire linkage.",
            "UI used current Vite workspace, not the frozen production Client distribution; operator and VM clocks are not cross-correlated.",
            "Linux image QA covers the surgical B8-derived slice; current local backlog parity is not claimed.",
            "Only saved receipt projections and pinned public bytes were checked; no raw profiles, credentials, model payloads or terminal diagnostics were opened.",
        ],
        "validator_runtime_actions": {"VM_mutations": 0, "provider_requests": 0, "SQL_requests": 0, "full_QA_runs": 0},
    }
    raw = (json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode()
    if OUTPUT.exists():
        assert OUTPUT.read_bytes() == raw, "Frozen receipt differs; do not overwrite"
    elif args.write:
        with OUTPUT.open("xb") as target:
            target.write(raw)
    print(json.dumps({"status": report["status"], "checks_passed": len(chain.checks),
                      "receipt_written": OUTPUT.exists(), "receipt_sha256": sha(raw)}))


if __name__ == "__main__":
    main()
