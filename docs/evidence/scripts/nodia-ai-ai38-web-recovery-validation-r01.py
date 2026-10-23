"""Offline AI-38 receipt validation; a valid evidence chain can remain partial.

No provider, VM, SQL, SDK or app imports. Missing optional canaries remain pending.
Current formats require a semantic receipt, exact final binding and the receipt
window inside the directly observed final epoch (helpers have no epoch field).
"""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[3]
PREFIX = "nodia-ai-ai38-"
RELEASE = "4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130"
SQL_SNAPSHOT = "94b274bc90cfc7849cb676d796dd3f52dcf80a9d37edc9af3f21a312428c0256"
PINNED = {
    "mcp-post-list-validation-r01": "a43663363ea1500501308a04494730f2aa6118704a83739bcf0c0d19de8cf249",
    "mcp-post-list-final-r02": "ddca54e243551a89ba726080d14174db2b80b51af958c5ae48e8c3d956ac197b",
    "mcp-post-list-sql-r01": "8e8555d7c020da7377133f59279bd105f83b3722347a2199f2d1eb7dbfe270e0",
    "web-stream-text-r02": "a82b3fa585a3c0f416283cbaf4ffd24559e94652573a957ee0c96c723a18e002",
    "web-stream-text-r03": "75acb6717f456cf81dfe58bd0254c3958de1063f5473541961c038bb139165b7",
    "web-stream-web-png-r01": "dfb6d096f14c1554ff706c6e05d5251cf4f4f6fc0f272b57808442f9506c8042",
    "web-stream-mcp-r01": "21ce4b291752688e2b14606b0f5be0125d036278b10a667bc9d508f8f50c171f",
    "web-stream-recovery-build-r04": "9c6709a9864b5f257a8bac16df2491c5c0e22a2f5573d918daf98167485a370d",
    "web-stream-recovery-adopt-r04": "2c2f27b89cf9c5707e27fb426a4d1c73b4052509e0495308839cc9dcfd7d230a",
    "web-stream-recovery-selective-patch-r04": "8bdf85a290147a4c46a1031d1ac84cc6b740d8ca1cf87234dcee130447a2da97",
    "web-stream-recovery-review-r04": "b40d6f333ba4175bc7018cd44318e0ccb0743f5de680be20791d3cb722c5cbfe",
    "web-stream-recovery-build-VM-binding-r04": "a6bdb04bb34cc71cb70cae7e5e2dcb5791c1651abcb36da805291a3f82c6d88c",
    "web-stream-recovery-adopt-VM-binding-r04": "bd7b38522ed75c77a263afb22ff034994fea365e35fd6e0eee29461856a5ea89",
}
MIMES = {"png": "image/png", "pdf": "application/pdf", "wav": "audio/wav", "webm": "audio/webm"}
UUID = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")
SHA256 = re.compile(r"[a-f0-9]{64}")


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def pretty_hash(value, newline=False):
    return digest((json.dumps(value, indent=2) + ("\n" if newline else "")).encode())


def epoch(value):
    return {"id": value.get("id", value.get("container_id")),
            "image": value.get("image", value.get("image_id")),
            "started_at": value.get("started_at", value.get("started_at_utc"))}


def instant(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.utcoffset() is None or result.utcoffset().total_seconds() != 0:
        raise AssertionError("UTC_receipt_time_required")
    return result


def window(value):
    return (value.get("started_VM_utc", value.get("started_at_utc", value.get("began_at_utc"))),
            value.get("finished_VM_utc", value.get("finished_at_utc")))


def in_epoch(value, current_epoch, observed_at):
    start, end = window(value)
    return bool(start and end and instant(current_epoch["started_at"]) <= instant(start)
                <= instant(end) <= instant(observed_at))


def semantic_success(value):
    return (value.get("status") == "passed" and value.get("semantic_match") is True
            and value.get("native_outcome") == "completed" and value.get("http_status") == 200
            and isinstance(value.get("expected_answer_sha256"), str)
            and SHA256.fullmatch(value["expected_answer_sha256"]) is not None
            and value["expected_answer_sha256"] == value.get("actual_answer_sha256"))


def binding_matches(value, observed):
    reference = value.get("reference", {})
    session = value.get("session_generation", reference.get("session_generation"))
    resource = value.get("resource_key", reference.get("resource_key"))
    return (value.get("selection") == observed.get("selection")
            and value.get("configuration_generation") == observed.get("configuration_generation")
            and session == observed.get("session_generation")
            and (resource is None or resource == observed.get("resource_key")))


def current_format(value, observed, mime, current_epoch, observed_at):
    return (semantic_success(value) and value.get("exact_format_verified_after") is True
            and observed.get("available") is True and binding_matches(value, observed)
            and mime in observed.get("verified_attachment_media_types", [])
            and in_epoch(value, current_epoch, observed_at))


class Validation:
    def __init__(self, root=ROOT):
        self.root, self.refs, self.checks, self.attempts = Path(root), {}, [], []
        self.identities = set()

    def require(self, condition, name):
        if not condition:
            raise AssertionError(name)
        self.checks.append(name)

    def read(self, name, optional=False):
        relative = "docs/evidence/" + PREFIX + name + ".json"
        path = self.root / relative
        if optional and not path.exists():
            return None
        raw = path.read_bytes()
        self.refs[relative] = digest(raw)
        if name in PINNED:
            self.require(digest(raw) == PINNED[name], "immutable_" + name)
        value = json.loads(raw)
        self.require(type(value) is dict, "object_" + name)
        return value

    def unique(self, attempt):
        self.require(type(attempt) is str and UUID.fullmatch(attempt) is not None,
                     "admitted_UUID_valid")
        self.require(attempt not in self.identities, "admitted_UUID_not_reused")
        self.identities.add(attempt)

    def helper(self, name, value, mode, historical=False):
        count = value.get("generation_requests")
        self.require(type(count) is int and count in (0, 1), name + "_generation_count")
        self.require(value.get("configured_SQL_writes", value.get("SQL_writes")) == 0
                     and value.get("business_effects") == 0, name + "_no_SQL_or_business_effect")
        if count == 0:
            self.require(not historical and value.get("native_pending_identity") is False
                         and value.get("status") != "passed",
                         name + "_not_started_not_pending")
            return {"file": name, "status": "not_started", "current": False}
        self.unique(value.get("attempt_id"))
        self.require(value.get("maximum_generations") == 1 and value.get("inference_replayed") is False,
                     name + "_one_generation_no_replay")
        self.require(value.get("native_acknowledged") is True and value.get("native_pending_identity") is False,
                     name + "_ACK_closed_no_pending_identity")
        self.require(value.get("native_outcome") in ("completed", "abandoned_unknown"),
                     name + "_actual_terminal_outcome")
        self.require(value.get("selection") == self.selections[mode]
                     and value.get("configuration_generation") == self.configs[mode],
                     name + "_persisted_selection_configuration_preserved")
        if value.get("status") == "passed":
            self.require(semantic_success(value), name + "_success_requires_semantic_completed_evidence")
        result = {"file": name, "attempt_id": value["attempt_id"], "mode": mode,
                  "historical": historical, "outcome": value["native_outcome"],
                  "semantic_passed": semantic_success(value), "current": False}
        self.attempts.append(result)
        return result

    def mcp(self, name, value, historical=False):
        native = value.get("native_result", {})
        dispatched = native.get("real_provider_dispatch_requests")
        self.require(type(dispatched) is int and dispatched in (0, 1), name + "_MCP_dispatch_count")
        if dispatched == 0:
            self.require(not historical and value.get("native_pending_identity") is False
                         and value.get("status") != "passed",
                         name + "_MCP_not_started_not_pending")
            return {"file": name, "status": "not_started", "current": False}
        diagnostic = native.get("diagnostics", {})
        self.unique(diagnostic.get("attempt_id"))
        self.require(value.get("maximum_provider_generation_requests") == 1
                     and value.get("automatic_inference_retries") == 0
                     and native.get("maximum_provider_dispatch_requests") == 1
                     and native.get("inference_replayed") is False,
                     name + "_MCP_one_dispatch_no_replay")
        self.require(native.get("native_terminal_proof_acknowledged") is True
                     and native.get("native_pending_identity") is False
                     and value.get("native_pending_identity") is False,
                     name + "_MCP_ACK_no_pending_identity")
        self.require(value.get("configured_SQL_writes") == value.get("business_effects") == 0
                     and native.get("configured_database_modified") is False
                     and native.get("configured_selection_modified") is False,
                     name + "_MCP_no_business_or_configuration_effect")
        self.require(diagnostic.get("selection") == self.selections["agentic"]
                     and diagnostic.get("configuration_generation") == self.configs["agentic"],
                     name + "_MCP_preserved_selection_config")
        passed = (value.get("status") == native.get("status") == "passed"
                  and value.get("exit_code") == 0 and native.get("diagnostic_nonce_verified") is True
                  and diagnostic.get("callbacks") == 1 and native.get("supports_mcp_after") is True)
        if value.get("status") == "passed":
            self.require(passed, name + "_MCP_success_requires_nonce_callback_terminal")
        outcome = native.get("native_outcome")
        if outcome is None:
            outcome = ("completed" if passed else "abandoned_unknown"
                       if native.get("error_code") == "mcp_result_unknown" else "terminal_outcome_not_reported")
        self.require(outcome in ("completed", "abandoned_unknown", "terminal_outcome_not_reported"),
                     name + "_MCP_reported_outcome_not_invented")
        result = {"file": name, "attempt_id": diagnostic["attempt_id"], "mode": "agentic",
                  "historical": historical, "outcome": outcome,
                  "MCP_passed": passed, "current": False}
        self.attempts.append(result)
        return result

    def preflight(self):
        previous = self.read("mcp-post-list-validation-r01")
        self.require(previous["checks_passed"] == 39 and previous["acceptance"]["declared_generation_requests"] == 11,
                     "previous_turn_39_checks_11_generations_preserved_not_recounted")
        old_texts = [self.read(name) for name in ("web-stream-text-r02", "web-stream-text-r03")]
        old_mcp = self.read("web-stream-mcp-r01")
        self.selections = {"web": old_texts[1]["selection"],
                           "agentic": old_mcp["native_result"]["diagnostics"]["selection"]}
        self.configs = {"web": old_texts[1]["configuration_generation"],
                        "agentic": old_mcp["native_result"]["diagnostics"]["configuration_generation"]}
        first = self.helper("web-stream-text-r02", old_texts[0], "web", True)
        second = self.helper("web-stream-text-r03", old_texts[1], "web", True)
        png = self.helper("web-stream-web-png-r01", self.read("web-stream-web-png-r01"), "web", True)
        mcp = self.mcp("web-stream-mcp-r01", old_mcp, True)
        self.require(first["outcome"] == png["outcome"] == mcp["outcome"] == "abandoned_unknown"
                     and second["semantic_passed"], "four_prior_generations_three_unknowns_one_success_visible")

    def adoption(self):
        build = self.read("web-stream-recovery-build-r04")
        adoption = self.read("web-stream-recovery-adopt-r04")
        patch = self.read("web-stream-recovery-selective-patch-r04")
        review = self.read("web-stream-recovery-review-r04")
        plan = self.read("web-stream-recovery-adopt-plan-r04")
        self.require(build["status"] == "passed" and build["Linux_QA_exit"] == 0
                     and build["Linux_tests_discovered_and_executed"] == 496
                     and build["Linux_runtime_skips"] == 0 and build["owned_offline_containers_remaining"] == 0,
                     "R04_496_Linux_tests_zero_skips_no_offline_container_left")
        self.require(patch["Windows_tests"] == {**patch["Windows_tests"], "discovered": 527,
                     "passed": 525, "platform_skips": 2, "exit": 0}
                     and review["independent_tests"]["executed"] == review["independent_tests"]["passed"] == 10,
                     "R04_527_Windows_525_passed_2_skips_10_independent")
        self.require(all(review["review_checks"][key] is True for key in (
                     "one_StreamGenerate_per_simulated_attempt", "current_retry_zero_preserved",
                     "read_history_uses_current_generation_fresh_CID", "outer_chat_deadline_still_at_most_120_seconds",
                     "OCR_requests_and_watchdog_settings_unchanged_when_budget_absent",
                     "failed_chat_invalidates_initialized_only_for_same_client_with_closed_transport",
                     "SDK_namespace_silenced_at_service_construction_not_import",
                     "next_reconnection_remains_explicit_and_rotates_owned_session_generation",
                     "cancel_unknown_reconcile_and_ACK_contract_unchanged")),
                     "reviewed_generation_deadline_privacy_stale_state_and_OCR_guards")
        sources = review["reviewed_sources"]
        self.require(sources == patch["image_sources"] == build["image_sources"]
                     and set(sources) == {"gemini_service.py", "nodia_ai_chat.py", "web_chat_recovery.py"}
                     and review["archive_sha256"] == patch["archive_sha256"] == build["archive_sha256"]
                     and review["manifest_sha256"] == build["manifest_sha256"], "three_exact_reviewed_overlay_sources")
        self.require(patch["service_exact_reviewed_changes"] == 5 and patch["whole_workspace_chat_adopted"] is False
                     and patch["unchanged_base_python_files"] == 46 and patch["expected_target_python_files"] == 49,
                     "five_service_edits_single_chat_argument_not_whole_workspace")
        self.require(build["image_Config_unchanged"] and build["added_layers"] == 1
                     and build["requirements_unchanged"] and build["distribution_inventory_unchanged"]
                     and build["build_and_QA_network"] == "none"
                     and build["operational_profiles_environment_or_credentials_mounted"] is False,
                     "COPY_only_same_dependencies_offline_no_operational_mounts")
        self.require(adoption["status"] == "adopt_completed" and adoption["timers_restored"] is True
                     and adoption["configured_SQL_writes"] == adoption["business_effects"] == adoption["migrations"] == 0
                     and adoption["provider_generation_requests"] == 0,
                     "adoption_did_not_infer_mutate_business_or_schema")
        self.require(adoption["plan_sha256"] == pretty_hash(plan, True)
                     and plan["target_python_hashes"] == build["target_public_python_hashes"] == adoption["public_sources_after"]
                     and len(adoption["public_sources_after"]) == 49
                     and plan["target_image_id"] == build["candidate_image_id"] == adoption["epoch_after"]["image_id"],
                     "adopted_exact_R04_image_public_49_source_inventory")
        self.build, self.adoption, self.plan = build, adoption, plan
        self.build_VM = self.read("web-stream-recovery-build-VM-binding-r04")
        self.adoption_VM = self.read("web-stream-recovery-adopt-VM-binding-r04")
        self.require(self.build_VM["sha256"] == pretty_hash(build, True)
                     and self.build_VM["trailing_newline"] is True
                     and self.build_VM["json_reserialized_no_newline_sha256"] == pretty_hash(build)
                     and self.build_VM["only_public_build_receipt_opened"] is True
                     and self.adoption_VM["sha256"] == pretty_hash(adoption, True)
                     and self.adoption_VM["only_public_receipt_opened"] is True,
                     "VM_public_receipt_sidecars_establish_actual_serializations")
        self.current_epoch = epoch(adoption["epoch_after"])

    def final(self):
        final = self.read("web-recovery-final-r01")
        binding = self.read("web-recovery-bindings-r01")
        sql = self.read("web-recovery-sql-r01")
        self.require(final["status"] == binding["status"] == "observed_read_only"
                     and epoch(final["Gemini"]) == epoch(binding["native_epoch"]) == self.current_epoch
                     and final["Gemini"]["same_epoch_after_inventory"] is True and binding["same_epoch_after"] is True,
                     "direct_final_epoch_and_both_binding_observations_match_R04")
        # The immutable sidecar records that VM build report.json and local
        # stdout both have pretty JSON+LF. The 313a... no-LF digest is only a
        # reserialization, never the actual VM artifact. Adoption's VM report
        # is pretty JSON+LF while local stdout is compact.
        self.require(final["Web_recovery_build_receipt_sha256"] == self.build_VM["sha256"]
                     and final["Web_recovery_plan_sha256"] == pretty_hash(self.plan, True)
                     and binding["adoption_sha256"] == self.adoption_VM["sha256"],
                     "VM_and_stdout_serializations_are_explicit_not_false_raw_hash_equalities")
        self.require(final["native_public_source_hashes"] == self.adoption["public_sources_after"]
                     and final["native_public_source_count"] == 49
                     and final["requirements_sha256"] == self.build["baseline_requirements_sha256"]
                     and final["distribution_inventory"] == self.build["baseline_distribution_inventory"]
                     and final["distribution_count"] == self.build["baseline_distribution_count"],
                     "final_live_sources_dependencies_match_reviewed_R04")
        baseline = self.read("mcp-post-list-final-r02")
        self.require(final["server_manifest_sha256"] == baseline["server_manifest_sha256"]
                     and final["server_members"] == 3879 and final["dist_outputs"] == 2851
                     and final["knowledge_release"] == RELEASE
                     and final["SQL_schema_and_selection"] == baseline["SQL_schema_and_selection"]
                     and final["operator_configuration"] == baseline["operator_configuration"]
                     and final["nginx_sha256"] == baseline["nginx_sha256"],
                     "Server_schema_selection_secrets_configuration_proxy_and_catalog_preserved")
        quiet = final["quiet"]
        self.require(all(quiet["native"][key] == 0 for key in ("unknown_markers", "armed_native_proofs", "terminal_native_proofs",
                     "invalid_native_proofs", "temporary_attachment_directories", "temporary_cli_directories"))
                     and all(quiet["SQL"][key] == 0 for key in ("pending_jobs", "open_attempts", "retained_slots")),
                     "final_native_and_SQL_zero_pending")
        historical_sql = self.read("mcp-post-list-sql-r01")
        self.require(sql["transaction"] == {"read_only": True, "isolation": "repeatable read"}
                     and sql["snapshot_sha256"] == historical_sql["snapshot_sha256"] == SQL_SNAPSHOT
                     and sql["snapshot"] == historical_sql["snapshot"],
                     "same_read_only_business_SQL_projection_no_additional_effect")
        self.require(all(final[key] == 0 for key in ("configured_SQL_writes", "native_HTTP_requests", "provider_generation_requests",
                     "storage_mutations", "service_changes")) and final["external_status"]["unconfirmed"] == 0
                     and final["external_status"]["expired_backups"] == 0
                     and all(timer["active"] == "active" for timer in final["timers"].values()),
                     "final_observer_read_only_journal_and_timers_ready")
        self.observed, self.binding_at = {}, {}
        for item in binding["snapshots"]:
            mode, snapshot = item["mode"], item["snapshot"]
            self.require(mode in self.selections and mode not in self.observed
                         and snapshot["connection_id"] == "2" and snapshot["provider_key"] == "gemini"
                         and snapshot["quiet"] == {"jobs": 0, "attempts": 0, "slots": 0}, "final_binding_unique_Gemini_connection_quiet")
            observation = snapshot["observed"]
            self.require(snapshot["selections"] == self.selections
                         and observation["selection"] == self.selections[mode]
                         and observation["configuration_generation"] == self.configs[mode],
                         "final_saved_model_effort_configuration_unchanged")
            self.observed[mode] = observation
            self.require(instant(self.current_epoch["started_at"]) <= instant(item["began_VM_utc"])
                         <= instant(item["ended_VM_utc"]) <= instant(final["observed_at_VM_utc"]),
                         "binding_observed_inside_final_epoch_before_final_inventory")
            self.binding_at[mode] = item["ended_VM_utc"]
        self.require(set(self.observed) == {"web", "agentic"}, "both_final_bindings_observed")
        self.final_at = final["observed_at_VM_utc"]

    def acceptance(self):
        texts = []
        for revision in ("r04", "r05"):
            name = "web-stream-text-" + revision
            text = self.read(name, optional=revision == "r05")
            if text is None:
                continue
            result = self.helper(name, text, "web")
            result["current"] = (semantic_success(text) and self.observed["web"].get("available") is True
                                  and binding_matches(text, self.observed["web"])
                                  and in_epoch(text, self.current_epoch, self.binding_at["web"]))
            texts.append(result)
        formats = {"web": [], "agentic": []}
        pending = []
        for mode in ("web", "agentic"):
            for fmt, mime in MIMES.items():
                name = "web-recovery-" + mode + "-" + fmt + "-r01"
                value = self.read(name, True)
                if value is None:
                    pending.append(name)
                    continue
                result = self.helper(name, value, mode)
                if result.get("status") == "not_started":
                    pending.append(name)
                    continue
                self.require(value.get("media_type") == mime, name + "_exact_MIME")
                result["current"] = current_format(value, self.observed[mode], mime, self.current_epoch, self.binding_at[mode])
                if result["current"]:
                    formats[mode].append(mime)
        name = "web-recovery-mcp-r01"
        value = self.read(name, True)
        mcp_current = False
        if value is None:
            pending.append(name)
        else:
            result = self.mcp(name, value)
            if result.get("status") == "not_started":
                pending.append(name)
            else:
                native = value["native_result"]
                result["current"] = (result["MCP_passed"] and binding_matches(native["diagnostics"], self.observed["agentic"])
                    and epoch(value["native_epoch_before"]) == self.current_epoch
                    and value.get("same_native_epoch_after") is True
                    and self.observed["agentic"].get("supports_mcp") is True
                    and in_epoch(value, self.current_epoch, self.binding_at["agentic"]))
                mcp_current = result["current"]
        self.require(self.observed["web"].get("supports_mcp") is False, "Web_remains_conversation_only")
        text_current = any(row["current"] for row in texts)
        complete = text_current and mcp_current and all(len(rows) == 4 for rows in formats.values())
        return {"status": "current_native_scope_verified" if complete else "partial_current_native_acceptance",
            "current_epoch": self.current_epoch, "Web_text_current": text_current,
            "MCP_Agentic_current": mcp_current, "verified_current_formats": formats,
            "not_started": pending, "attempts": self.attempts,
            "this_turn_actual_generations": len(self.attempts),
            "completed": sum(row["outcome"] == "completed" for row in self.attempts),
            "unknown_ACK_closed": sum(row["outcome"] == "abandoned_unknown" for row in self.attempts),
            "terminal_outcome_not_reported": sum(row["outcome"] == "terminal_outcome_not_reported" for row in self.attempts),
            "new_business_effects": 0, "AI38_fully_closed": False,
            "format_epoch_evidence": "exact_final_binding_and_VM_window_within_directly_observed_R04_epoch_no_per_format_epoch_field",
            "provider_root_cause_established": False,
            "earlier_turn_11_generations_preserved_separately_not_recounted": True}

    def diagnostics(self):
        png = self.read("web-recovery-web-png-r01", True)
        text = self.read("web-stream-text-r05", True)
        png_diag = self.read("web-recovery-web-png-diag-r01", True)
        text_diag = self.read("web-recovery-text-diag-r02", True)
        mcp = self.read("web-recovery-mcp-r01", True)
        relative = "docs/evidence/" + PREFIX + "web-recovery-mcp-ipc-r01.ndjson"
        if any(value is None for value in (png, text, png_diag, text_diag, mcp)) or not (self.root / relative).exists():
            return {"status": "optional_diagnostic_chain_incomplete", "provider_root_cause_established": False}
        if (png.get("generation_requests") != 1 or text.get("generation_requests") != 1
                or mcp.get("native_result", {}).get("real_provider_dispatch_requests") != 1):
            return {"status": "optional_diagnostic_probe_not_admitted", "provider_root_cause_established": False}
        for diag, receipt in ((png_diag, png), (text_diag, text)):
            self.require(diag["attempt_id"] == receipt["attempt_id"]
                         and epoch(diag["native_epoch"]) == self.current_epoch
                         and diag["same_epoch_after"] is True
                         and diag["raw_logs_audio_text_messages_tokens_or_headers_saved"] is False
                         and all(diag[key] == 0 for key in ("HTTP_requests", "provider_generation_requests", "service_changes")),
                         "content_free_diagnostic_exact_attempt_epoch_read_only")
        failures = [row for row in png_diag["records"] if row.get("event") == "nodia_ai_chat_failure"]
        successes = [row for row in text_diag["records"] if row.get("event") == "nodia_ai_web_success"]
        self.require(len(failures) == len(successes) == 1, "one_terminal_diagnostic_per_observed_attempt")
        failed, success = failures[0]["web_generation"], successes[0]["web_generation"]
        recovery = [row for row in failed["events"] if row.get("phase") == "recovery_started"]
        self.require(failed["recovery_calls"] == 5 and failed["elapsed_ms"] == 119306
                     and len(recovery) == 1 and recovery[0]["elapsed_ms"] == 66461
                     and failed["candidate_outputs"] == failed["stream_frames"]["candidates"] == 0
                     and failed["stream_frames"]["frames"] == 2 and failed["body_bytes"] == 224
                     and failures[0]["error_type"] == "APIError" and failed["sink_errors"] == 0
                     and png["native_outcome"] == "abandoned_unknown",
                     "PNG_first_history_read_66s_five_reads_APIError_119s_no_candidate_still_unknown")
        self.require(semantic_success(text) and success["recovery_calls"] == 0
                     and success["candidate_outputs"] > 0 and success["elapsed_ms"] == 4630
                     and success["upstream_eof_seen"] is True and success["sink_errors"] == 0,
                     "final_text_4630ms_success_without_history_recovery")
        raw = (self.root / relative).read_bytes()
        self.refs[relative] = digest(raw)
        ipc = [json.loads(line) for line in raw.decode("utf-8").splitlines() if line.strip()]
        samples = [row for row in ipc if row.get("schema") == "ai38-mcp-post-list-live-IPC-v1"]
        self.require(len(samples) == 1 and samples[0]["candidate_seen"] is True
                     and samples[0]["only_bridge_request_files_opened"] is True
                     and samples[0]["payload_names_arguments_or_raw_logs_emitted"] is False
                     and samples[0]["profile_or_session_bytes_opened"] is False,
                     "MCP_IPC_single_content_free_bridge_observation")
        sample = samples[0]
        updates = sample["updates"]
        errors = [row for row in updates if (row.get("rpc_diagnostic") or {}).get("error_code") == -32000]
        initialized = [row for row in updates if (row.get("rpc_diagnostic") or {}).get("method") == "initialize"
                       and row["rpc_diagnostic"]["response"] == "success"]
        listed = [row for row in updates if (row.get("rpc_diagnostic") or {}).get("method") == "tools_list"
                  and row["rpc_diagnostic"]["response"] == "success"]
        requested = [row for row in updates if row.get("kind") == "tool_request"]
        start, end = window(mcp)
        self.require(len(errors) == len(initialized) == len(listed) == len(requested) == 1
                     and errors[0]["ordinal"] < initialized[0]["ordinal"] < listed[0]["ordinal"] < requested[0]["ordinal"]
                     and len({row["ordinal"] for row in updates}) == len(updates)
                     and all(instant(start) <= instant(row["observed_VM_utc"]) <= instant(end) for row in updates)
                     and mcp["status"] == mcp["native_result"]["status"] == "passed"
                     and mcp["native_result"]["diagnostic_nonce_verified"] is True,
                     "MCP_minus32000_precedes_successful_initialize_list_callback_in_same_probe_window")
        return {"Web_PNG": {"attempt_id": png["attempt_id"], "read_chat_calls": failed["recovery_calls"],
                    "first_read_chat_elapsed_ms": recovery[0]["elapsed_ms"],
                    "failure_elapsed_ms": failed["elapsed_ms"], "candidate_outputs": failed["candidate_outputs"],
                    "native_outcome": png["native_outcome"]},
                "Web_final_text": {"attempt_id": text["attempt_id"], "elapsed_ms": success["elapsed_ms"],
                    "read_chat_calls": success["recovery_calls"]},
                "MCP": {"minus32000_before_successful_initialize": True, "same_probe_window_nonce_passed": True,
                    "observation_limitation": "IPC_has_no_attempt_identity_time_window_and_pinned_file_link_only"},
                "successful_live_history_recovery_demonstrated": False,
                "minus32000_sufficient_to_explain_failure": False,
                "provider_root_cause_established": False}

    def run(self):
        self.preflight()
        self.adoption()
        self.final()
        acceptance = self.acceptance()
        diagnostic = self.diagnostics()
        return {"schema": "ai38-web-recovery-consolidated-validation-v1", "status": acceptance["status"],
                "acceptance": acceptance, "checks_passed": len(self.checks), "checks": self.checks,
                "diagnostic_observations": diagnostic,
                "artifact_sha256": self.refs, "runtime_calls": 0, "provider_requests": 0,
                "SQL_calls": 0, "app_sources_modified": False}


class PureTests(unittest.TestCase):
    def setUp(self):
        self.current_epoch = {"id": "synthetic", "image": "synthetic", "started_at": "2026-10-22T20:00:00Z"}
        self.observed = {"available": True, "selection": {"mode": "synthetic"}, "configuration_generation": "config",
            "session_generation": "session", "verified_attachment_media_types": ["image/png"]}
        self.value = {"status": "passed", "semantic_match": True, "native_outcome": "completed", "http_status": 200,
            "expected_answer_sha256": "a" * 64, "actual_answer_sha256": "a" * 64, "exact_format_verified_after": True,
            "selection": {"mode": "synthetic"}, "configuration_generation": "config", "session_generation": "session",
            "started_at_utc": "2026-10-22T20:01:00Z", "finished_at_utc": "2026-10-22T20:02:00Z"}

    def test_exact_semantic_binding_and_time_can_be_current(self):
        self.assertTrue(current_format(self.value, self.observed, "image/png", self.current_epoch, "2026-10-22T20:03:00Z"))

    def test_stale_session_never_becomes_current(self):
        self.value["session_generation"] = "old"
        self.assertFalse(current_format(self.value, self.observed, "image/png", self.current_epoch, "2026-10-22T20:03:00Z"))

    def test_stale_configuration_or_selection_never_becomes_current(self):
        for key in ("selection", "configuration_generation"):
            changed = {**self.value, key: "stale"}
            self.assertFalse(current_format(changed, self.observed, "image/png", self.current_epoch, "2026-10-22T20:03:00Z"))

    def test_available_metadata_never_substitutes_missing_semantic_or_MIME_evidence(self):
        for key in ("semantic_match", "exact_format_verified_after"):
            changed = {**self.value, key: False}
            self.assertFalse(current_format(changed, self.observed, "image/png", self.current_epoch, "2026-10-22T20:03:00Z"))
        self.assertFalse(current_format(self.value, self.observed, "audio/wav", self.current_epoch, "2026-10-22T20:03:00Z"))

    def test_old_epoch_and_future_completion_never_current(self):
        self.assertFalse(current_format(self.value, self.observed, "image/png", self.current_epoch, "2026-10-22T20:01:30Z"))
        self.value["started_at_utc"] = "2026-10-22T19:59:00Z"
        self.assertFalse(current_format(self.value, self.observed, "image/png", self.current_epoch, "2026-10-22T20:03:00Z"))

    def test_reused_UUID_is_rejected(self):
        validation = Validation()
        attempt = "a160f615-ea41-4a05-831d-acdbb413ec4d"
        validation.unique(attempt)
        with self.assertRaises(AssertionError):
            validation.unique(attempt)

    def test_raw_VM_serialization_newline_is_not_silently_assumed(self):
        self.assertNotEqual(pretty_hash({"synthetic": True}), pretty_hash({"synthetic": True}, True))

    def test_zero_dispatch_or_missing_ACK_cannot_report_passed(self):
        validation = Validation()
        with self.assertRaises(AssertionError):
            validation.helper("synthetic", {"generation_requests": 0, "status": "passed",
                                            "configured_SQL_writes": 0, "business_effects": 0,
                                            "native_pending_identity": False}, "web")
        with self.assertRaises(AssertionError):
            validation.mcp("synthetic", {"provider_harness_started": True, "native_result": {}})
        validation.selections, validation.configs = {"web": {}}, {"web": "synthetic"}
        receipt = {"attempt_id": "a160f615-ea41-4a05-831d-acdbb413ec4d", "generation_requests": 1,
                   "maximum_generations": 1, "inference_replayed": False, "native_acknowledged": False,
                   "configured_SQL_writes": 0, "business_effects": 0,
                   "native_pending_identity": False}
        with self.assertRaises(AssertionError):
            validation.helper("synthetic", receipt, "web")

    def test_failed_MCP_without_reported_unknown_is_not_classified_unknown(self):
        validation = Validation()
        validation.selections, validation.configs = {"agentic": {}}, {"agentic": "synthetic"}
        value = {"status": "failed_no_replay", "maximum_provider_generation_requests": 1,
            "automatic_inference_retries": 0, "configured_SQL_writes": 0, "business_effects": 0,
            "native_pending_identity": False, "native_result": {"status": "failed",
                "error_code": "synthetic_not_unknown", "real_provider_dispatch_requests": 1,
                "maximum_provider_dispatch_requests": 1, "inference_replayed": False,
                "native_terminal_proof_acknowledged": True, "native_pending_identity": False,
                "configured_database_modified": False, "configured_selection_modified": False,
                "diagnostics": {"attempt_id": "a160f615-ea41-4a05-831d-acdbb413ec4d",
                    "selection": {}, "configuration_generation": "synthetic"}}}
        self.assertEqual(validation.mcp("synthetic", value)["outcome"], "terminal_outcome_not_reported")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.loadTestsFromTestCase(PureTests))
        return 0 if result.wasSuccessful() else 1
    report = Validation().run()
    raw = json.dumps(report, indent=2) + "\n"
    if args.write:
        with (ROOT / "docs/evidence/nodia-ai-ai38-web-recovery-validation-r01.json").open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(raw)
    print(raw, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
