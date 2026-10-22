"""One explicit synthetic native canary; reconciliation never repeats inference.

Run on the private VM. The historical AI-32 helper is imported only for private
configuration and synthetic fixtures; no historical artifacts are overwritten.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.util
import json
import re
import subprocess
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4


def answer_digest(value: str, normalization: str) -> str:
    normalized = (" ".join(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFC", value).casefold()))
                  if normalization == "speech_words_v1" else value.strip())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def semantic_diagnostic(answer: object, expected: str) -> dict:
    """Shape-only comparisons. Never stores answer, expected text or prefixes."""
    if not isinstance(answer, str):
        return {"answer_is_string": False, "expected_chars": len(expected)}
    decoded_equals = False
    try:
        decoded = json.loads(answer)
        decoded_equals = isinstance(decoded, str) and decoded == expected
    except (ValueError, TypeError):
        pass
    return {"answer_is_string": True, "answer_chars": len(answer), "expected_chars": len(expected),
            "line_count": len(answer.splitlines()), "trim_equals": answer.strip() == expected.strip(),
            "casefold_equals": answer.strip().casefold() == expected.strip().casefold(),
            "whitespace_collapse_equals": " ".join(answer.split()) == " ".join(expected.split()),
            "contains_expected": expected in answer, "expected_is_prefix": answer.startswith(expected),
            "expected_is_suffix": answer.endswith(expected), "json_string_decoded_equals": decoded_equals}


def diagnostics(attempt: str) -> list[dict]:
    """Project only code-owned metadata for this explicitly synthetic attempt."""
    process = subprocess.run(["docker", "logs", "--since", "20m", "nodia-gemini-microservice"],
                             capture_output=True, text=True, timeout=20, check=False)
    safe = []
    if process.returncode:
        return safe
    for line in (process.stdout + "\n" + process.stderr).splitlines():
        if "nodia_ai_chat_failure " not in line:
            continue
        try:
            item = json.loads(line.split("nodia_ai_chat_failure ", 1)[1])
        except ValueError:
            continue
        if item.get("attempt_id") != attempt:
            continue
        projected = {key: item.get(key) for key in
                     ["engine", "attempt_id", "phase", "error_type", "failure_category", "elapsed_ms"]}
        shape = item.get("reply_format") or {}
        projected["reply_format"] = {key: shape[key] for key in
            ["text_bytes", "leading_category"] if key in shape}
        if isinstance(shape.get("json_syntax"), dict):
            projected["reply_format"]["json_syntax"] = {key: shape["json_syntax"][key] for key in
                ["category", "position", "line", "column", "document_chars", "document_sha256", "at_end",
                 "character_category", "previous_category", "next_category", "ending_category"]
                if key in shape["json_syntax"]}
        web = item.get("web_generation") or {}
        projected["generation"] = {key: web.get(key) for key in
            ["http_status", "upstream_eof_seen", "upstream_eof_elapsed_ms", "candidate_outputs",
             "recovery_calls", "client_close_calls"]}
        projected["generation"]["text_outputs"] = (web.get("output_shape") or {}).get("text_outputs")
        agentic = item.get("agentic_generation")
        if isinstance(agentic, dict):
            projected["agentic_generation"] = {key: agentic[key] for key in
                ["stage", "phase", "events", "invalid_lines", "stdout_bytes", "initialized",
                 "document_read_completed", "result_seen", "last_event_age_ms", "result_status",
                 "denied_actions_count"] if key in agentic}
            categories = agentic.get("tool_error_categories")
            if isinstance(categories, list):
                projected["agentic_generation"]["tool_error_categories"] = [value for value in categories if value in
                    ["permission", "unsupported", "missing_file", "format", "timeout", "hook", "unclassified"]]
            tool_names = {"view_file", "finish", "task_boundary", "notify_user", "view_file_outline", "list_dir", "find_by_name",
                          "grep_search", "run_command", "write_to_file", "read_url_content", "call_mcp_tool", "other"}
            for key in ["tool_event_counts", "tool_completed_counts", "tool_error_counts"]:
                counts = agentic.get(key)
                if isinstance(counts, dict):
                    projected["agentic_generation"][key] = {name: count for name, count in counts.items()
                        if name in tool_names and type(count) is int and count >= 0}
        safe.append(projected)
    return safe


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", required=True)
    parser.add_argument("--historical-helper", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--engine", choices=["web", "agentic"])
    parser.add_argument("--kind", choices=["image", "pdf", "audio"])
    parser.add_argument("--synthetic-speech", type=Path)
    parser.add_argument("--synthetic-speech-text", help="Explicit synthetic audio oracle; never inserted into the provider prompt.")
    parser.add_argument("--audio-media", choices=["audio/wav", "audio/webm", "audio/ogg"], default="audio/wav")
    parser.add_argument("--resume-attempt-report", type=Path,
                        help="Reconcile/acknowledge only. This option never starts a generation.")
    args = parser.parse_args()
    if args.synthetic_speech_text is not None and (args.kind != "audio" or not args.synthetic_speech_text.strip()):
        parser.error("--synthetic-speech-text requires audio and nonempty explicitly synthetic text")
    if args.output.exists():
        parser.error("output already exists; preserve prior evidence")
    spec = importlib.util.spec_from_file_location("ai32_frozen_helper", args.historical_helper)
    if spec is None or spec.loader is None:
        raise RuntimeError("historical_helper_missing")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    config = helper.configuration()
    report = {"stage": "AI-32-R01", "scope": "individual_real_gemini_synthetic_native_canary",
              "status": "running", "observed_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
              "generation_requests": 0, "maximum_generations": 1, "automatic_inference_retries": 0,
              "credentials_logged": False, "provider_response_text_stored": False,
              "provider_configuration_modified": False, "configured_database_modified": False,
              "verification_semantics": "this_canary_semantic_match_and_completed_ack_and_exact_cached_modality"}

    def save() -> None:
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    def post(path: str, payload: dict) -> tuple[int, dict]:
        request = urllib.request.Request(config["url"].rstrip("/") + path,
                    data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
                    headers={"Content-Type": "application/json", "X-Nodia-Service-Token": config["token"]},
                    method="POST")
        try:
            with urllib.request.urlopen(request, timeout=150) as response:
                raw = response.read(131073)
                if len(raw) > 131072:
                    raise RuntimeError("response_exceeds_bound")
                return response.status, json.loads(raw)
        except urllib.error.HTTPError as error:
            raw = error.read(4097)
            try:
                value = json.loads(raw) if len(raw) <= 4096 else {}
            except ValueError:
                value = {}
            return error.code, {"code": value.get("code", "remote_error")}

    proof = None
    if args.resume_attempt_report:
        previous = json.loads(args.resume_attempt_report.read_text(encoding="utf-8"))
        item = previous["probe"]
        engine = item["engine"]
        reference = item["reference"]
        attempt = item["attempt_id"]
        observation = {key: item[key] for key in ["model_id", "effort_id", "configuration_generation"]}
        report["scope"] = "reconciliation_only_of_explicit_prior_synthetic_attempt"
        report["maximum_generations"] = 0
        report["probe"] = {**item, "native_acknowledged": False}
        report["reply_kind"] = previous.get("reply_kind") if previous.get("reply_kind") in ["answer", "delegation_request"] else "other"
    else:
        if args.engine is None or args.kind is None or args.synthetic_speech is None:
            parser.error("one --engine, --kind and --synthetic-speech are required for a new canary")
        engine = args.engine
        selection = config["selections"].get(engine)
        if selection is None:
            raise RuntimeError("exact_engine_configuration_missing")
        observation = {key: selection[key] for key in ["model_id", "effort_id", "configuration_generation"]}
        status, observed = post("/nodia-ai/" + engine + "/observe", observation)
        if status != 200 or observed.get("available") is not True:
            report.update(status="runtime_unavailable", observation_http_status=status,
                          observation_reason=observed.get("reason") or observed.get("code"))
            save()
            return
        data = helper.fixtures(args.synthetic_speech)
        content, media, expected = data[args.kind]
        if args.kind == "audio":
            media = args.audio_media
            if args.synthetic_speech_text is not None:
                expected = args.synthetic_speech_text
        normalization = "speech_words_v1" if args.kind == "audio" else "literal"
        attempt = str(uuid4())
        reference = {"resource_key": observed["resource_key"], "session_generation": observed["session_generation"],
                     "operation_ref": attempt}
        report["probe"] = {"engine": engine, "kind": args.kind, **observation, "reference": reference,
                            "attempt_id": attempt, "file_bytes": len(content), "media_type": media,
                            "file_sha256": hashlib.sha256(content).hexdigest(),
                            "expected_answer_sha256": answer_digest(expected, normalization),
                            "answer_normalization": normalization, "native_acknowledged": False,
                            "verified": False, "fixture": "synthetic_known_canary"}
        if args.kind == "audio":
            report["probe"]["audio_oracle_source"] = "explicit_cli_synthetic_text" if args.synthetic_speech_text is not None else "historical_helper_synthetic_text"
        save()
        started = time.monotonic()
        try:
            report["generation_requests"] = 1
            save()  # Durable operator intent before the only generative request.
            status, result = post("/nodia-ai/" + engine + "/attachments/probe", {
                **observation, "attempt_id": attempt, **{key: reference[key] for key in
                    ["resource_key", "session_generation"]}, "timeout_seconds": 120,
                "canonical_prompt": "Synthetic verification; the service substitutes its fixed instruction.",
                "attachments": [{"kind": args.kind, "media_type": media,
                    "sha256": hashlib.sha256(content).hexdigest(), "content_base64": base64.b64encode(content).decode("ascii")}],
                "expected_answer_sha256": report["probe"]["expected_answer_sha256"],
                "answer_normalization": normalization})
            report["probe"]["http_status"] = status
            proof = result.get("terminal_proof")
            if status == 200:
                reply = result.get("reply")
                reply = reply if isinstance(reply, dict) else {}
                kind = reply.get("kind")
                report["reply_kind"] = kind if kind in ["answer", "delegation_request"] else "other"
                if kind == "delegation_request" and isinstance(reply.get("reason"), str):
                    reason = reply["reason"]
                    folded = unicodedata.normalize("NFC", reason).casefold()
                    report["delegation_reason"] = {"sha256": hashlib.sha256(reason.encode("utf-8")).hexdigest(),
                        "utf8_bytes": len(reason.encode("utf-8")),
                        "keyword_present": {key: key in folded for key in
                            ["audio", "transcrib", "formato", "archivo", "acced", "agentic", "mcp"]}}
                answer = reply.get("text")
                digest = answer_digest(answer, normalization) if isinstance(answer, str) else None
                report["probe"].update(answer_sha256=digest,
                    semantic_canary_matches=digest == report["probe"]["expected_answer_sha256"],
                    semantic_diagnostic=semantic_diagnostic(answer, expected))
            else:
                report["probe"]["error_code"] = result.get("code")
        except Exception as error:
            report["probe"].update(transport_result_uncertain=True, safe_error_type=type(error).__name__)
        finally:
            report["probe"]["elapsed_seconds"] = round(time.monotonic() - started, 2)
            save()

    try:
        if proof is None:
            # Polling terminal identity is not an inference retry. Never deletes
            # armed or uncertain state if a real terminal proof is unavailable.
            deadline = time.monotonic() + 45
            while True:
                status, value = post("/nodia-ai/" + engine + "/attempts/" + attempt + "/reconcile", reference)
                report["probe"]["reconciliation_http_status"] = status
                report["probe"]["reconciliation_code"] = value.get("code")
                if status == 200:
                    proof = value
                    break
                if status != 409 or time.monotonic() >= deadline:
                    break
                time.sleep(2)
        if proof is not None:
            report["probe"]["native_outcome"] = proof.get("outcome")
            status, acknowledged = post("/nodia-ai/" + engine + "/attempts/" + attempt + "/acknowledge",
                                        {**reference, "terminal_proof_id": proof["terminal_proof_id"]})
            report["probe"]["native_acknowledged"] = status == 200 and acknowledged.get("acknowledged") is True
        status, after = post("/nodia-ai/" + engine + "/observe", observation)
        item = report["probe"]
        item["cached_modality_verified"] = status == 200 and after.get("available") is True and item["kind"] in after.get("verified_modalities", [])
        item["verified"] = (item["cached_modality_verified"] and item.get("semantic_canary_matches") is True
            and item.get("native_acknowledged") is True and item.get("native_outcome") == "completed"
            and item.get("http_status") == 200 and report.get("reply_kind") == "answer")
        report["observation_after"] = {"http_status": status, "available": after.get("available"),
            "reason": after.get("reason"), "verified_modalities": after.get("verified_modalities"),
            "supports_mcp": after.get("supports_mcp")}
    except Exception as error:
        report["reconciliation_safe_error_type"] = type(error).__name__
    finally:
        try:
            report["diagnostics"] = diagnostics(attempt)
        except Exception as error:
            report["diagnostics_safe_error_type"] = type(error).__name__
        try:
            report["quiet_after"] = helper.configuration()["quiet"]
        except Exception as error:
            report["quiet_observation_safe_error_type"] = type(error).__name__
        item = report["probe"]
        report["status"] = "passed" if item.get("semantic_canary_matches") and item.get("native_acknowledged") and item.get("verified") else "gates_open"
        report["completed_at_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save()
    print(json.dumps({"status": report["status"], "generation_requests": report["generation_requests"],
                      "attempt_id": attempt, "verified": report["probe"].get("verified"),
                      "native_acknowledged": report["probe"].get("native_acknowledged")}))


if __name__ == "__main__":
    main()
