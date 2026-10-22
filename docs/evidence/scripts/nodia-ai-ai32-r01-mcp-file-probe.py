"""One real synthetic MCP callback plus one attested attachment read.

The diagnostic flag bootstraps only MCP proof. Existing exact-session native
modality proof remains mandatory and is checked before dispatching this canary.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.util
import json
import secrets
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", required=True)
    parser.add_argument("--historical-helper", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--kind", choices=["image", "pdf"], required=True)
    parser.add_argument("--synthetic-speech", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("output already exists; preserve prior evidence")
    spec = importlib.util.spec_from_file_location("ai32_frozen_helper", args.historical_helper)
    if spec is None or spec.loader is None:
        raise RuntimeError("historical_helper_missing")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    config = helper.configuration()
    selection = config["selections"]["agentic"]
    report = {"stage": "AI-32-R01", "scope": "real_agentic_mcp_and_attachment_synthetic_canary",
              "status": "running", "generation_requests": 0, "maximum_generations": 1,
              "automatic_inference_retries": 0, "callbacks": 0, "business_writes": 0,
              "configured_database_modified": False, "provider_response_text_stored": False,
              "credentials_logged": False, "native_acknowledged": False}

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

    observation = {key: selection[key] for key in ["model_id", "effort_id", "configuration_generation"]}
    status, observed = post("/nodia-ai/agentic/observe", observation)
    report.update(observation_http_status=status, observed_at_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    if status != 200 or observed.get("available") is not True or args.kind not in observed.get("verified_modalities", []):
        report.update(status="exact_agentic_modality_unverified", generation_requests=0)
        save()
        return
    content, media, marker = helper.fixtures(args.synthetic_speech)[args.kind]
    nonce = "AI32R01_" + secrets.token_hex(12)
    attempt = str(uuid4())
    reference = {"resource_key": observed["resource_key"], "session_generation": observed["session_generation"], "operation_ref": attempt}
    report.update(attempt_id=attempt, reference=reference, **observation,
                  kind=args.kind, file_sha256=hashlib.sha256(content).hexdigest(), file_bytes=len(content),
                  expected_answer_sha256=hashlib.sha256((marker+"\n"+nonce).encode()).hexdigest())
    proof = None
    finished = False
    start_admitted = False
    save()
    try:
        report["generation_requests"] = 1
        save()
        status, started = post("/nodia-ai/agentic/mcp/start", {**observation,
            "attempt_id": attempt, "resource_key": reference["resource_key"], "session_generation": reference["session_generation"],
            "timeout_seconds": 120, "diagnostic": True,
            "canonical_prompt": "Esta es una prueba sintética de lectura. Lee el adjunto usando view_file. "
                "Invoca exactamente una vez nodia_ai_canary_read con {}. Responde JSON answer cuyo campo text "
                "contenga exactamente dos líneas: primero el texto completo del adjunto, segundo el nonce devuelto "
                "por la herramienta. No agregues etiquetas, explicaciones, comillas o líneas adicionales dentro de text.",
            "attachments": [{"kind": args.kind, "media_type": media, "sha256": hashlib.sha256(content).hexdigest(),
                              "content_base64": base64.b64encode(content).decode("ascii")}],
            "tools": [{"name": "nodia_ai_canary_read", "description": "Read one synthetic nonce; no network, product records or writes.",
                       "input_schema": {"type": "object", "properties": {}, "additionalProperties": False}}]})
        report["start_http_status"] = status
        start_admitted = status == 200
        report["native_start_accepted"] = start_admitted
        if not start_admitted:
            report["start_error_code"] = started.get("code")
            raise RuntimeError("native_start_rejected")
        deadline = time.monotonic() + 135
        cursor = 0
        calls = set()
        while time.monotonic() < deadline:
            status, events = post("/nodia-ai/agentic/attempts/" + attempt + "/mcp/events", {**reference, "after": cursor})
            if status != 200:
                raise RuntimeError("mcp_poll_rejected")
            for event in events.get("events", []):
                cursor = max(cursor, event["seq"])
                if event["kind"] == "tool_request":
                    if event.get("name") != "nodia_ai_canary_read" or event.get("arguments") != {} or event["call_id"] in calls or calls:
                        raise RuntimeError("unexpected_or_duplicate_callback")
                    calls.add(event["call_id"])
                    report["callbacks"] += 1
                    save()
                    status, accepted = post("/nodia-ai/agentic/attempts/" + attempt + "/mcp/results",
                                {**reference, "call_id": event["call_id"], "result": {"nonce": nonce, "synthetic": True}})
                    if status != 200 or accepted.get("accepted") is not True:
                        raise RuntimeError("mcp_callback_rejected")
                elif event["kind"] == "answer":
                    proof = event["terminal_proof"]
                    text = event.get("text")
                    digest = hashlib.sha256(text.strip().encode()).hexdigest() if isinstance(text, str) else None
                    report["answer_sha256"] = digest
                    report["semantic_canary_matches"] = digest == report["expected_answer_sha256"]
                    finished = True
                elif event["kind"] == "unknown":
                    raise RuntimeError("mcp_native_unknown")
            if finished:
                break
            time.sleep(.25)
        if not finished:
            raise RuntimeError("mcp_poll_deadline")
        status, attested = post("/nodia-ai/agentic/attempts/" + attempt + "/mcp/attest", reference)
        report["native_hook_file_and_mcp_attested"] = status == 200 and attested.get("verified") is True
    except Exception as error:
        report["safe_error_type"] = type(error).__name__
        report["safe_error_category"] = str(error) if isinstance(error, RuntimeError) else "transport_error"
    finally:
        try:
            if proof is None and not finished:
                # Cancellation closes the same native process; it is not replay.
                status, cancelled = post("/nodia-ai/agentic/attempts/" + attempt + "/mcp/cancel", reference)
                report["cancel_http_status"] = status
                report["cancel_state"] = cancelled.get("state")
            if proof is None:
                status, value = post("/nodia-ai/agentic/attempts/" + attempt + "/reconcile", reference)
                report["reconciliation_http_status"] = status
                report["reconciliation_code"] = value.get("code")
                if status == 200:
                    proof = value
            if proof is not None:
                report["native_outcome"] = proof.get("outcome")
                status, value = post("/nodia-ai/agentic/attempts/" + attempt + "/acknowledge",
                                    {**reference, "terminal_proof_id": proof["terminal_proof_id"]})
                report["native_acknowledged"] = status == 200 and value.get("acknowledged") is True
            status, after = post("/nodia-ai/agentic/observe", observation)
            report["observation_after"] = {"http_status": status, "available": after.get("available"),
                "verified_modalities": after.get("verified_modalities"), "supports_mcp": after.get("supports_mcp")}
        except Exception as error:
            report["cleanup_safe_error_type"] = type(error).__name__
        try:
            report["quiet_after"] = helper.configuration()["quiet"]
        except Exception as error:
            report["quiet_observation_safe_error_type"] = type(error).__name__
        report["status"] = "passed" if (report.get("semantic_canary_matches") and report.get("native_hook_file_and_mcp_attested")
            and report["callbacks"] == 1 and report["native_acknowledged"]) else "gates_open"
        report["completed_at_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save()
    print(json.dumps({key: report[key] for key in ["status", "generation_requests", "callbacks", "native_acknowledged"]}))


if __name__ == "__main__":
    main()
