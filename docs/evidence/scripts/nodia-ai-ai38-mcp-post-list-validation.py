"""Offline delivery-chain checks; missing live evidence never becomes success."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "docs/evidence"
PREFIX = "nodia-ai-ai38-mcp-post-list-"
OUTPUT = EVIDENCE / (PREFIX + "validation-r01.json")
PREVIOUS = "docs/evidence/nodia-ai-ai38-profile-reservation-validation-r02.json"
LIVE = tuple("docs/evidence/" + PREFIX + suffix + ".json" for suffix in ("live-r01", "ipc-r01", "control-r02", "epoch-r02"))


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


class Chain:
    def __init__(self):
        self.refs, self.checks = {}, []

    def read(self, path):
        raw = (ROOT / path).read_bytes()
        self.refs[path] = sha(raw)
        return json.loads(raw)

    def verify(self, condition, name):
        if not condition:
            raise AssertionError(name)
        self.checks.append(name)

    def preflight(self):
        previous = self.read(PREVIOUS)
        self.verify(self.refs[PREVIOUS] == "a9709f2f49a6aa451cb903d15c220a077f5866e61f9b016d508d7e53e3fdfe75"
                    and previous["additional_checks_passed"] == 7 and previous["predecessor"]["checks_preserved"] == 70,
                    "previous_scoped_validation_R02_and_70_plus_7_chain_preserved")
        self.verify(all(sha((ROOT / path).read_bytes()) == pin for path, pin in previous["source_files_sha256"].items()),
                    "previous_R02_saved_evidence_pins_unchanged")
        review = "docs/evidence/nodia-ai-ai38-mcp-post-list-review-r01.md"
        self.refs[review] = sha((ROOT / review).read_bytes())
        self.verify(self.refs[review] == "8157eba0b25d661e51fd8e37326b31936e8e9f358ae4e68d2be70dab07f18f81",
                    "offline_protocol_review_exact_bytes")
        offline_path = "docs/evidence/" + PREFIX + "offline-r01.json"
        offline = self.read(offline_path)
        self.verify(self.refs[offline_path] == "9405192ee4860bf8da16c73aadbd818b182fecb5a540d16959bee644bc07f5a6"
                    and offline["status"] == "passed" and offline["bridge_subprocesses"] == 3
                    and offline["provider_generations"] == offline["VM_calls"] == offline["SQL_calls"] == 0
                    and all(sha((ROOT / "nodia-gemini-microservice" / name).read_bytes()) == pin
                            for name, pin in offline["runtime_FIX_public_source_pins"].items()),
                    "three_synthetic_bridge_controls_not_live_provider_acceptance_public_FIX_bytes_match")
        qa = self.read("docs/evidence/nodia-ai-ai38-profile-reservation-mcp-post-list-offline-qa-r01.json")
        self.verify(qa["status"] == "passed_offline_not_live" and qa["tests"] == 2
                    and qa["errors"] == qa["failures"] == qa["VM_calls"] == qa["provider_calls"] == qa["generations"] == 0
                    and all(sha((ROOT / path).read_bytes()) == pin for path, pin in qa["source_pins"].items()),
                    "one_deliberate_new_attempt_wrapper_two_guard_tests_and_frozen_sources")

    def live(self):
        live, ipc, control, epoch = [self.read(path) for path in LIVE]
        old_path = "docs/evidence/nodia-ai-ai38-profile-reservation-mcp-r01.json"
        old = self.read(old_path)
        native, old_native = live["native_result"], old["native_result"]
        diag = native["diagnostics"]
        self.verify(control["new_report_sha256"] == epoch["input_report_sha256"] == self.refs[LIVE[0]]
                    and control["new_attempt_id"] == epoch["attempt_id"] == diag["attempt_id"]
                    and control["prior_closed_attempt_id"] == old_native["diagnostics"]["attempt_id"]
                    and control["new_attempt_id"] != control["prior_closed_attempt_id"]
                    and control["prior_report_sha256"] == self.refs[old_path]
                    and not control["prior_identity_passed_to_harness"]
                    and control["maximum_new_generations"] == 1 and control["automatic_retries"] == 0,
                    "fresh_deliberate_attempt_distinct_from_closed_failure_not_an_automatic_retry")
        expected_epoch = old["native_epoch_before"]
        self.verify(live["native_epoch_before"] == ipc["native_epoch_before"] == ipc["native_epoch_after"] == expected_epoch
                    and live["same_native_epoch_after"] and ipc["same_native_epoch"] and control["same_native_epoch"]
                    and epoch["same_container_epoch_after_capture"] and epoch["container_id"] == expected_epoch["id"]
                    and epoch["container_image"] == expected_epoch["image"] and epoch["container_started_at_utc"] == expected_epoch["started_at"],
                    "MCP_IPC_control_and_qualification_all_same_existing_FIX_epoch_no_restart")
        source_pairs = (("docs/evidence/scripts/nodia-ai-ai38-profile-reservation-mcp-post-list.py", control["source_sha256"]),
                        ("docs/evidence/scripts/nodia-ai-ai38-profile-reservation-mcp.py", control["base_driver_sha256"]),
                        ("nodia-server/test/nodia-ai-ai38-mcp-diagnostic.mjs", control["harness_sha256"]),
                        ("docs/evidence/scripts/nodia-ai-ai38-mcp-post-list-live-ipc-r01.py", ipc["observer_source_sha256"]))
        for path, pin in source_pairs:
            self.refs[path] = sha((ROOT / path).read_bytes())
            assert self.refs[path] == pin
        self.verify(live["source_sha256"] == control["base_driver_sha256"]
                    and live["harness_sha256"] == control["harness_sha256"],
                    "actual_driver_harness_wrapper_and_readonly_observer_sources_pinned")
        self.verify(live["status"] == native["status"] == "passed" and live["exit_code"] == 0
                    and native["diagnostic_nonce_verified"] and diag["callbacks"] == 1
                    and native["supports_mcp_after"] is True and native["native_terminal_proof_acknowledged"]
                    and native["real_provider_dispatch_requests"] == live["maximum_provider_generation_requests"] == 1
                    and not native["native_pending_identity"] and not live["native_pending_identity"]
                    and not native["inference_replayed"],
                    "one_real_nonce_callback_terminal_ACK_and_MCP_support_verified_for_this_epoch")
        counters = diag["endpoints"]
        self.verify(all(counters[name]["requests"] == counters[name]["completed"] == 1 and counters[name]["failed"] == 0
                    for name in ("start", "results", "attest", "acknowledge"))
                    and all(counters[name]["requests"] == 0 for name in ("cancel", "reconcile"))
                    and live["configured_SQL_writes"] == live["business_effects"] == live["automatic_inference_retries"] == 0
                    and native["configured_database_read_only"] and not native["configured_database_modified"]
                    and not native["configured_selection_modified"] and not live["services_restarted"]
                    and control["configured_SQL_writes"] == 0 and not control["services_restarted"],
                    "one_start_result_attest_ACK_no_replay_selection_change_or_business_effect")
        observation = ipc["observation"]
        self.verify(ipc["observer_ready"] == {"event": "observer_ready", "maximum_seconds": 180, "poll_interval_ms": 100}
                    and ipc["observer_exit_code"] == ipc["private_stderr_bytes"] == 0
                    and not ipc["private_stderr_saved_or_emitted"]
                    and observation["status"] == "candidate_removed" and observation["candidate_seen"]
                    and observation["update_count"] == len(observation["updates"]) == observation["unique_ordinals"] == 7
                    and observation["only_bridge_request_files_opened"] and not observation["profile_or_session_bytes_opened"]
                    and not observation["payload_names_arguments_or_raw_logs_emitted"]
                    and observation["polling_cannot_prove_unobserved_intermediate_states"]
                    and observation["raw_method_names_not_retained_by_current_bridge"]
                    and all(value[key] == 0 for value in (ipc, observation) for key in ("HTTP_requests", "provider_generation_requests", "service_changes")),
                    "readonly_IPC_observer_seven_ordinals_closed_metadata_and_explicit_snapshot_limits")
        updates = observation["updates"]
        self.verify([row["ordinal"] for row in updates] == list(range(1, 8))
                    and updates[0]["rpc_diagnostic"] == {"method": "other", "response": "error", "error_code": -32000, "unrecognized_error_code": False}
                    and updates[2]["rpc_diagnostic"]["method"] == "initialize" and updates[2]["rpc_diagnostic"]["response"] == "success"
                    and updates[4]["rpc_diagnostic"]["method"] == "tools_list" and updates[4]["rpc_diagnostic"]["response"] == "success"
                    and updates[6]["kind"] == "tool_request" and updates[6]["rpc_diagnostic"] is None
                    and updates[6]["tool_requests"] == diag["callbacks"] == 1,
                    "observed_pre_ready_error_ordinal1_precedes_initialize3_list5_and_callback7")
        self.verify(all(datetime.fromisoformat(live["began_at_utc"]) <= datetime.fromisoformat(row["observed_VM_utc"])
                    <= datetime.fromisoformat(live["finished_at_utc"]) for row in updates)
                    and all(row["observed_relative_ms"] <= updates[index + 1]["observed_relative_ms"] for index, row in enumerate(updates[:-1])),
                    "IPC_VM_observations_inside_live_window_no_cross_host_clock_or_emission_time_claim")
        for suffix in ("control-r01", "epoch-r01"):
            path = "docs/evidence/" + PREFIX + suffix + ".json"
            raw = (ROOT / path).read_bytes()
            self.refs[path] = sha(raw)
            assert raw == b""
        self.verify(True, "empty_permission_failed_capture_R01_files_preserved_R02_recaptures_used_without_generation_replay")
        return live

    def modalities(self, live):
        path = "docs/evidence/" + PREFIX + "modalities-r01.json"
        cohort = self.read(path)
        cases = cohort["cases"]
        self.verify(cohort["qualification_sha256"] == self.refs[LIVE[0]]
                    and cohort["qualification_epoch_sha256"] == self.refs[LIVE[3]]
                    and cohort["epoch"]["id"] == live["native_epoch_before"]["id"]
                    and cohort["epoch"]["image"] == live["native_epoch_before"]["image"]
                    and cohort["epoch"]["started_at_utc"] == live["native_epoch_before"]["started_at"]
                    and cohort["epoch"]["running"] and cohort["maximum_generations"] == 8
                    and cohort["inference_replays"] == cohort["configured_SQL_writes"] == cohort["business_effects"] == 0,
                    "actual_modality_cohort_qualified_by_new_MCP_same_epoch_no_replay_or_business_effect")
        for script, field in (("nodia-ai-ai38-profile-reattest-modalities-r01.py", "source_sha256"),
                              ("nodia-ai-ai38-verifications-modalities.py", "helper_sha256")):
            source_path = "docs/evidence/scripts/" + script
            self.refs[source_path] = sha((ROOT / source_path).read_bytes())
            assert self.refs[source_path] == cohort[field]
        binding = cohort["bindings"]["agentic"]
        self.verify(all(binding[key] == live["native_result"]["diagnostics"][key]
                    for key in ("selection", "configuration_generation", "session_generation")),
                    "Agentic_modality_identity_matches_fresh_MCP_selection_session_and_configuration")
        keys = [(case["mode"], case["format"]) for case in cases]
        self.verify(keys == [("agentic", fmt) for fmt in ("png", "pdf", "wav", "webm")]
                    + [("web", fmt) for fmt in ("png", "pdf", "wav")]
                    and cohort["generation_requests_declared"] == len(cases) == 7
                    and len({case["helper_report"]["attempt_id"] for case in cases}) == 7,
                    "seven_unique_actual_format_attempts_no_WebM_attempt_in_stopped_cohort")
        for case in cases:
            helper = case["helper_report"]
            assert sha((json.dumps(helper, indent=2) + "\n").encode()) == case["report_sha256"]
            assert all(helper[key] == cohort["bindings"][case["mode"]][key]
                       for key in ("selection", "configuration_generation", "session_generation"))
            assert helper["generation_requests"] == helper["maximum_generations"] == 1
            assert helper["native_acknowledged"] and helper["native_pending_identity"] is False
            assert helper["inference_replayed"] is False
            assert helper["configured_SQL_writes"] == helper["business_effects"] == 0
        self.verify(True, "all_seven_embedded_helper_serializations_match_declared_hashes_exact_bindings_and_ACK_closed_identity")
        self.verify(all(case["status"] == case["helper_report"]["status"] == "passed"
                    and case["helper_report"]["semantic_match"] and case["helper_report"]["exact_format_verified_after"]
                    and case["helper_report"]["expected_answer_sha256"] == case["helper_report"]["actual_answer_sha256"]
                    and case["helper_report"]["native_outcome"] == "completed" and case["helper_report"]["http_status"] == 200
                    for case in cases[:6]), "six_actual_format_cases_semantic_exact_completed_ACK_separate_from_Web_WAV_failure")
        failed = cases[-1]["helper_report"]
        self.verify(cohort["status"] == "stopped_no_replay_no_next_probe"
                    and cohort["failure_code"] == "native_state_not_closed_completed_ACK" and cohort["unknown_native_state"] is True
                    and cases[-1]["status"] == "starting" and failed["status"] == "gates_open"
                    and failed["error_code"] == "chat_result_unknown" and failed["http_status"] == 502
                    and failed["native_outcome"] == "abandoned_unknown" and failed["native_pending_identity"] is False
                    and failed["semantic_match"] is False and failed["exact_format_verified_after"] is False
                    and cohort["audio_source"] == "known_synthetic_speech_not_current_physical_microphone",
                    "Web_WAV_failed_result_reconciled_ACK_without_pending_identity_wrapper_unknown_is_not_pending_or_success")
        return cohort

    def web_generation_loss(self, cohort):
        observed = self.read("docs/evidence/" + PREFIX + "web-binding-r01.json")
        snapshot = observed["snapshot"]
        binding = snapshot["observed"]
        old = cohort["bindings"]["web"]
        self.verify(observed["status"] == "observed_read_only"
                    and binding["selection"] == old["selection"] and binding["configuration_generation"] == old["configuration_generation"]
                    and binding["session_generation"] != old["session_generation"]
                    and binding["verified_attachment_media_types"] == [] and binding["supports_mcp"] is False
                    and binding["available"] is True and snapshot["quiet"] == {"jobs": 0, "attempts": 0, "slots": 0}
                    and observed["configured_SQL_writes"] == observed["provider_generations"] == 0,
                    "post_failure_Web_generation_changed_old_PNG_PDF_proofs_not_current_available_not_format_verified")
        return binding

    def web_requalification(self, live, initial, new_binding):
        path = "docs/evidence/" + PREFIX + "web-modalities-r02.json"
        web = self.read(path)
        qa = self.read("docs/evidence/nodia-ai-ai38-post-list-web-modalities-r02-offline-qa.json")
        self.verify(qa["status"] == "passed_offline_not_live" and qa["tests"] == 2
                    and qa["failures"] == qa["errors"] == qa["generations"] == qa["VM_calls"] == qa["provider_calls"] == 0
                    and all(sha((ROOT / name).read_bytes()) == pin for name, pin in qa["source_pins"].items())
                    and web["source_sha256"] == qa["source_pins"]["docs/evidence/scripts/nodia-ai-ai38-post-list-web-modalities-r02.py"],
                    "new_Web_generation_wrapper_two_offline_guard_tests_and_actual_source_pins")
        self.verify(web["MCP_sha256"] == self.refs[LIVE[0]] and web["MCP_epoch_sha256"] == self.refs[LIVE[3]]
                    and web["prior_cohort_sha256"] == self.refs["docs/evidence/" + PREFIX + "modalities-r01.json"]
                    and web["epoch"] == initial["epoch"] and web["Web_session_changed_from_prior"]
                    and web["Web_binding"] == {key: new_binding[key] for key in ("selection", "configuration_generation", "session_generation", "resource_key")}
                    and web["Agentic_binding"] == initial["bindings"]["agentic"]
                    and web["maximum_generations"] == 4 and web["generation_requests_declared"] == 2
                    and web["inference_replays"] == web["Agentic_generations"] == web["configured_SQL_writes"] == web["business_effects"] == 0
                    and not web["services_restarted"],
                    "second_Web_cohort_new_binding_same_FIX_Agentic_MCP_no_Agentic_reexecution_or_business_effect")
        cases = web["cases"]
        old_ids = {case["helper_report"]["attempt_id"] for case in initial["cases"]}
        self.verify([(case["mode"], case["format"]) for case in cases] == [("web", "wav"), ("web", "webm")]
                    and len({case["helper_report"]["attempt_id"] for case in cases}) == 2
                    and not old_ids.intersection(case["helper_report"]["attempt_id"] for case in cases)
                    and live["native_result"]["diagnostics"]["attempt_id"] not in old_ids,
                    "two_distinct_new_Web_attempt_UUIDs_and_PNG_PDF_not_started_in_second_cohort")
        for case in cases:
            helper = case["helper_report"]
            assert sha((json.dumps(helper, indent=2) + "\n").encode()) == case["report_sha256"]
            assert all(helper[key] == web["Web_binding"][key] for key in ("selection", "configuration_generation", "session_generation"))
            assert helper["generation_requests"] == helper["maximum_generations"] == 1
            assert helper["native_acknowledged"] and not helper["native_pending_identity"] and not helper["inference_replayed"]
        self.verify(True, "both_new_Web_helpers_exact_hashes_binding_and_ACK_closed_identity")
        wav, webm = [case["helper_report"] for case in cases]
        self.verify(cases[0]["status"] == wav["status"] == "passed" and wav["semantic_match"] and wav["exact_format_verified_after"]
                    and wav["native_outcome"] == "completed" and wav["http_status"] == 200
                    and wav["expected_answer_sha256"] == wav["actual_answer_sha256"]
                    and web["status"] == "stopped_no_replay_no_next_probe" and not web["unknown_native_state"]
                    and web["failure_code"] == "native_state_not_closed_completed_ACK" and cases[1]["status"] == "starting"
                    and webm["http_status"] == 502 and webm["error_code"] == "chat_result_unknown"
                    and webm["native_outcome"] == "abandoned_unknown" and not webm["exact_format_verified_after"] and not webm["semantic_match"],
                    "new_Web_WAV_semantic_pass_then_WebM_unknown_ACK_stops_cohort_not_eight_format_acceptance")
        for suffix, helper in (("web-audio-diag-r01", initial["cases"][-1]["helper_report"]), ("webm-audio-diag-r01", webm)):
            diagnostic = self.read("docs/evidence/" + PREFIX + suffix + ".json")
            failures = [row for row in diagnostic["records"] if row["event"] == "nodia_ai_chat_failure"]
            assert diagnostic["attempt_id"] == helper["attempt_id"] and diagnostic["native_epoch"] == live["native_epoch_before"]
            assert diagnostic["same_epoch_after"] and len(failures) == 1 and failures[0]["error_type"] == "TimeoutError"
            failure = failures[0]["web_generation"]
            assert failure["uploads"]["roundtrips_completed"] == 1 and failure["uploads"]["records"][0]["http_status"] == 200
            assert failure["http_status"] == 200 and failure["candidate_outputs"] == 0 and failure["client_close_calls"] == 1
            assert failure["upstream_eof_seen"] is False and failure["upstream_eof_elapsed_ms"] is None
            assert failures[0]["failure_category"] is None and not diagnostic["raw_logs_audio_text_messages_tokens_or_headers_saved"]
        self.verify(True, "both_closed_Web_timeout_diagnostics_upload_HTTP200_no_candidate_or_EOF_no_verified_provider_cause")
        return web

    def png_attempt(self, live, initial, web):
        before = self.read("docs/evidence/" + PREFIX + "current-bindings-r01.json")
        bindings = {row["mode"]: row["snapshot"]["observed"] for row in before["snapshots"]}
        self.verify(before["native_epoch_before"] == before["native_epoch_after"] == live["native_epoch_before"]
                    and before["same_native_epoch"] and bindings["agentic"]["supports_mcp"] is True
                    and set(bindings["agentic"]["verified_attachment_media_types"]) == {"image/png", "application/pdf", "audio/wav", "audio/webm"}
                    and bindings["web"]["session_generation"] != web["Web_binding"]["session_generation"]
                    and bindings["web"]["verified_attachment_media_types"] == [],
                    "second_Web_timeout_again_changes_generation_and_invalidates_earlier_WAV_proof_Agentic_preserved")
        png = self.read("docs/evidence/" + PREFIX + "web-png-r04.json")
        prior_ids = {case["helper_report"]["attempt_id"] for case in initial["cases"] + web["cases"]}
        self.verify(png["attempt_id"] not in prior_ids and png["generation_requests"] == png["maximum_generations"] == 1
                    and png["source_sha256"] == initial["helper_sha256"]
                    and all(png[key] == bindings["web"][key] for key in ("selection", "configuration_generation", "session_generation"))
                    and png["kind"] == "image" and png["media_type"] == "image/png"
                    and png["native_acknowledged"] and not png["native_pending_identity"] and not png["inference_replayed"]
                    and png["http_status"] == 502 and png["error_code"] == "chat_result_unknown"
                    and png["native_outcome"] == "abandoned_unknown" and not png["semantic_match"] and not png["exact_format_verified_after"]
                    and png["configured_SQL_writes"] == png["business_effects"] == 0,
                    "independent_PNG_attempt_new_UUID_failed_unknown_ACK_closed_identity_no_image_success_or_replay")
        empty = "docs/evidence/" + PREFIX + "web-png-r03.json"
        raw = (ROOT / empty).read_bytes()
        self.refs[empty] = sha(raw)
        self.verify(raw == b"" and not (EVIDENCE / (PREFIX + "web-pdf-r03.json")).exists(),
                    "failed_empty_PNG_activation_capture_preserved_no_PDF_helper_receipt_claimed")
        diagnostic = self.read("docs/evidence/" + PREFIX + "web-png-diag-r01.json")
        failures = [row for row in diagnostic["records"] if row["event"] == "nodia_ai_chat_failure"]
        self.verify(diagnostic["attempt_id"] == png["attempt_id"] and diagnostic["native_epoch"] == live["native_epoch_before"]
                    and diagnostic["same_epoch_after"] and len(failures) == 1 and failures[0]["error_type"] == "TimeoutError"
                    and failures[0]["web_generation"]["http_status"] == 200
                    and failures[0]["web_generation"]["candidate_outputs"] == 0
                    and failures[0]["web_generation"]["upstream_eof_seen"] is False
                    and failures[0]["web_generation"]["audio_transport"]["applied"] is False
                    and not diagnostic["raw_logs_audio_text_messages_tokens_or_headers_saved"],
                    "PNG_also_times_out_before_candidates_without_audio_adapter_no_audio_only_or_JSON_parse_cause_claim")
        return png

    def final(self, live, initial, web, png):
        current = self.read("docs/evidence/" + PREFIX + "current-bindings-r02.json")
        snapshots = {row["mode"]: row for row in current["snapshots"]}
        agentic, final_web = [snapshots[mode]["snapshot"]["observed"] for mode in ("agentic", "web")]
        self.verify(current["same_native_epoch"] and current["native_epoch_before"] == current["native_epoch_after"] == live["native_epoch_before"]
                    and current["native_observe_requests"] == 2 and current["provider_generation_requests"] == current["configured_SQL_writes"] == current["service_changes"] == 0
                    and all(agentic[key] == initial["bindings"]["agentic"][key] for key in ("selection", "configuration_generation", "session_generation", "resource_key"))
                    and agentic["supports_mcp"] is True and agentic["available"] is True
                    and set(agentic["verified_attachment_media_types"]) == {"image/png", "application/pdf", "audio/wav", "audio/webm"},
                    "final_same_epoch_Agentic_exact_live_MCP_binding_and_four_semantically_verified_formats_retained")
        self.verify(final_web["selection"] == png["selection"] and final_web["configuration_generation"] == png["configuration_generation"]
                    and final_web["session_generation"] != png["session_generation"] and final_web["verified_attachment_media_types"] == []
                    and final_web["supports_mcp"] is False and final_web["available"] is True
                    and all(datetime.fromisoformat(row["began_VM_utc"]) >= datetime.fromisoformat(png["finished_at_utc"]) for row in current["snapshots"])
                    and all(row["snapshot"]["quiet"] == {"jobs": 0, "attempts": 0, "slots": 0}
                            and all(row["snapshot"][key] == initial["configuration_before"][key]
                                    for key in ("connection_id", "provider_key", "selections", "mode_fields_sha256", "updated_at")) for row in current["snapshots"]),
                    "post_PNG_final_Web_new_generation_all_formats_unverified_metadata_available_is_not_inference_proof_config_unchanged")
        before = self.read("docs/evidence/" + PREFIX + "final-r01.json")
        final = self.read("docs/evidence/" + PREFIX + "final-r02.json")
        preserved = ("server_manifest_sha256", "server_members", "dist_outputs", "knowledge_release", "consumers", "Gemini",
                     "native_public_source_hashes", "native_public_source_count", "requirements_sha256", "distribution_inventory", "distribution_count",
                     "SQL_schema_and_selection", "operator_configuration", "timers", "oneshots", "nginx_sha256", "FIX_plan_sha256", "FIX_build_receipt_sha256")
        self.verify(all(final[key] == before[key] for key in preserved)
                    and final["server_members"] == 3879 and final["native_public_source_count"] == 47 and final["distribution_count"] == 42
                    and final["Gemini"]["id"] == live["native_epoch_before"]["id"]
                    and final["Gemini"]["image"] == live["native_epoch_before"]["image"]
                    and final["Gemini"]["started_at"] == live["native_epoch_before"]["started_at"]
                    and datetime.fromisoformat(final["observed_at_VM_utc"]) >= max(datetime.fromisoformat(row["ended_VM_utc"]) for row in current["snapshots"]),
                    "post_final_observation_environment_full_Server_3879_native47_deps42_process_epochs_schema_and_config_preserved")
        journal = final["external_status"]
        self.verify(journal["coverage_from"] == before["external_status"]["coverage_from"] and journal["coverage_closed_at"] is None
                    and journal["backups"] == 8 and journal["entries"] == journal["unconfirmed"] == journal["expired_backups"] == 0
                    and not journal["release_authorized"]
                    and all(final["quiet"]["native"][key] == 0 for key in ("unknown_markers", "armed_native_proofs", "terminal_native_proofs", "invalid_native_proofs", "temporary_attachment_directories", "temporary_cli_directories"))
                    and all(final["quiet"]["SQL"][key] == 0 for key in ("pending_jobs", "open_attempts", "retained_slots"))
                    and all(final[key] == 0 for key in ("configured_SQL_writes", "provider_generation_requests", "storage_mutations", "service_changes")),
                    "final_external_journal_eight_backups_open_era_timers_preserved_native_SQL_quiet_zero")
        sql = self.read("docs/evidence/" + PREFIX + "sql-r01.json")
        prior_sql = self.read("docs/evidence/nodia-ai-ai38-profile-reservation-final-sql-r02.json")
        self.verify(sql["transaction"] == {"read_only": True, "isolation": "repeatable read"}
                    and sql["snapshot"] == prior_sql["snapshot"]
                    and sha(json.dumps(sql["snapshot"], separators=(",", ":"), ensure_ascii=False).encode()) == sql["snapshot_sha256"]
                    and sql["snapshot"]["counts"]["messages"] == 6 and sql["snapshot"]["counts"]["runs"] == 3
                    and len(sql["snapshot"]["movements"]) == 1 and sql["configured_SQL_writes"] == sql["provider_requests"] == 0
                    and all(sql["global_quiet"][key] == 0 for key in ("pending_jobs", "open_attempts", "retained_slots"))
                    and datetime.fromisoformat(sql["observed_at_VM_utc"]) >= max(datetime.fromisoformat(row["ended_VM_utc"]) for row in current["snapshots"]),
                    "final_readonly_SQL_projection_identical_six_messages_three_runs_one_historical_effect_no_duplicate")
        local = self.read("docs/evidence/" + PREFIX + "local-r01.json")
        self.verify(local["vite_workspace_identity_matches"] and local["own_bridge_identity_matches"] and local["bridge_loopback_only"]
                    and local["HTTP_status"] == 200 and local["nginx_root_HTTP_status"] == 404
                    and local["vite_entry_script_present"] and not local["new_UI_window_opened"]
                    and local["services_retained_for_user"] and local["VM_mutations"] == 0
                    and all(row["LocalAddress"] in ("127.0.0.1", "::1") and row["OwningProcess"] == local["bridge_pid"]
                            for row in local["listeners"] if row["LocalPort"] == 3100)
                    and any(row["LocalPort"] == 5174 and row["OwningProcess"] == local["vite_pid"] for row in local["listeners"]),
                    "local_Vite200_original_nginx_root404_loopback_bridge_retained_no_new_UI_acceptance_claim")
        client = self.read(".tmp/ai38-ownerclient-r01/nodia-client/manifest.json")
        baseline = self.read(".tmp/ai37-baseline.json")
        self.verify(self.refs[".tmp/ai38-ownerclient-r01/nodia-client/manifest.json"] == "cdc832c045cb26a4050d4fcceb979b9b7ef910b3ce3471c56c05cd7f219a1a93"
                    and len(client["production_sources"]) == 648
                    and all(sha((ROOT / "nodia-client" / path).read_bytes()) == pin
                            for field in ("production_sources", "additional_JSON_inputs", "public_source_inputs") for path, pin in client[field].items())
                    and len(baseline["approved_knowledge_hashes"]) == 31
                    and all(sha((ROOT / path).read_bytes()) == pin for path, pin in baseline["approved_knowledge_hashes"].items()),
                    "Client_R01_sources_and_31_approved_knowledge_unchanged_mutable_draft_docs_excluded")
        helpers = [case["helper_report"] for case in initial["cases"] + web["cases"]] + [png]
        completed = sum(item["native_outcome"] == "completed" for item in helpers) + 1
        unknown = sum(item["native_outcome"] == "abandoned_unknown" for item in helpers)
        attempts = [item["attempt_id"] for item in helpers] + [live["native_result"]["diagnostics"]["attempt_id"]]
        self.verify(len(attempts) == len(set(attempts)) == 11 and completed == 8 and unknown == 3
                    and all(item["native_acknowledged"] and item["native_pending_identity"] is False for item in helpers),
                    "delivery_eleven_distinct_declared_generations_eight_completed_three_unknown_ACK_closed_not_pending")
        return {"status": "MCP_Agentic_attachments_verified_Web_unverified", "current_epoch": live["native_epoch_before"],
                "Agentic_MCP_verified": True, "Agentic_verified_formats": sorted(agentic["verified_attachment_media_types"]),
                "Web_metadata_available": final_web["available"], "Web_verified_formats": final_web["verified_attachment_media_types"],
                "declared_generation_requests": len(attempts), "completed": completed, "unknown_ACK_closed": unknown,
                "new_business_effects": 0, "new_UI_acceptance": False, "AI38_fully_closed": False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    chain = Chain()
    chain.preflight()
    missing = [path for path in LIVE if not (ROOT / path).is_file()]
    if missing:
        print(json.dumps({"status": "pending_live_receipts_no_final_output", "preflight_checks": len(chain.checks), "missing": missing}))
        if args.write:
            raise SystemExit(2)
        return
    live = chain.live()
    modalities = EVIDENCE / (PREFIX + "modalities-r01.json")
    if not modalities.is_file() or not modalities.stat().st_size:
        print(json.dumps({"status": "MCP_verified_modalities_receipt_pending_no_final_output", "checks_passed": len(chain.checks)}))
        if args.write:
            raise SystemExit(2)
        return
    cohort = chain.modalities(live)
    if (EVIDENCE / (PREFIX + "web-binding-r01.json")).is_file():
        new_binding = chain.web_generation_loss(cohort)
        if (EVIDENCE / (PREFIX + "web-modalities-r02.json")).is_file():
            web = chain.web_requalification(live, cohort, new_binding)
            if (EVIDENCE / (PREFIX + "web-png-r04.json")).is_file():
                png = chain.png_attempt(live, cohort, web)
    final_paths = ["docs/evidence/" + PREFIX + suffix + ".json" for suffix in ("current-bindings-r02", "final-r02", "sql-r01", "local-r01")]
    missing = [path for path in final_paths if not (ROOT / path).is_file() or not (ROOT / path).stat().st_size]
    if missing:
        print(json.dumps({"status": "pending_final_receipts_no_output", "checks_passed": len(chain.checks), "missing": missing}))
        if args.write:
            raise SystemExit(2)
        return
    result = chain.final(live, cohort, web, png)
    report = {"schema": "ai38-mcp-post-list-offline-validation-v1", "status": result["status"], "acceptance": result,
              "checks_passed": len(chain.checks), "checks": chain.checks, "source_files_sha256": chain.refs,
              "validator_sha256": sha(Path(__file__).read_bytes()), "predecessor": {"path": PREVIOUS, "sha256": chain.refs[PREVIOUS]},
              "limits": [
                  "Receipt integrity and concordance only; no new provider, VM, SQL or full-QA execution by this validator.",
                  "The live MCP attempt succeeded; the earlier unknown failed attempt remains preserved. Neither proves the historical timeout cause.",
                  "The observed -32000 error precedes initialize/list in the successful attempt. Unknown method names remain unknown; snapshot times do not prove emission or CLI consumption.",
                  "Three Web timeouts include WAV, WebM and PNG. Upload/generation HTTP200 and no candidate/EOF do not establish provider or SDK root cause.",
                  "Historical Web PNG/PDF/WAV successes do not survive later session generations. Final Web format proofs are empty despite metadata availability.",
                  "Audio used known synthetic speech; there was no new physical microphone, R2 upload, authenticated UI or full UI-to-business-effect acceptance.",
                  "Declared generation totals cover these collected harness receipts, not unrelated global provider traffic. No PDF restoration was initiated after the final PNG failure.",
              ], "validator_runtime_actions": {"VM_requests": 0, "provider_requests": 0, "SQL_requests": 0, "full_QA_runs": 0}}
    raw = (json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode()
    if OUTPUT.exists():
        assert OUTPUT.read_bytes() == raw, "Frozen output differs; do not overwrite"
    elif args.write:
        with OUTPUT.open("xb") as target:
            target.write(raw)
    print(json.dumps({"status": result["status"], "checks_passed": len(chain.checks),
                      "receipt_written": OUTPUT.exists(), "receipt_sha256": sha(raw)}))


if __name__ == "__main__":
    main()
