"""One explicit Web text control. It never proves any attachment modality."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import secrets
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from uuid import uuid4


def load_module(name: str, location: Path):
    spec = importlib.util.spec_from_file_location(name, location)
    if spec is None or spec.loader is None:
        raise RuntimeError("helper_missing")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def unique_pairs(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate_json_key")
        value[key] = item
    return value


def valid_proof(value: object, reference: dict, attempt: str) -> bool:
    keys = {*reference, "attempt_id", "terminal_proof_id", "process_closed", "outcome", "observed_at"}
    if (not isinstance(value, dict) or set(value) != keys or value.get("attempt_id") != attempt
            or any(value.get(key) != item for key, item in reference.items())
            or value.get("process_closed") is not True or value.get("outcome") not in ("completed", "abandoned_unknown")
            or not isinstance(value.get("terminal_proof_id"), str)
            or re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", value["terminal_proof_id"]) is None):
        return False
    try:
        return isinstance(value.get("observed_at"), str) and datetime.fromisoformat(value["observed_at"]).tzinfo is not None
    except ValueError:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", required=True)
    parser.add_argument("--historical-helper", type=Path, required=True)
    parser.add_argument("--native-harness", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--resume-attempt-report", type=Path)
    parser.add_argument("--literal-entities", action="store_true",
        help="Control literal HTML entity preservation; no attachment capability is enabled.")
    args = parser.parse_args()
    if args.resume_attempt_report and args.literal_entities:
        parser.error("resume preserves the prior oracle; do not request a new control")
    if args.output.exists():
        parser.error("output already exists; preserve prior evidence")
    helper = load_module("ai32_private_configuration", args.historical_helper)
    native = load_module("ai32_r03_safe_diagnostics", args.native_harness)
    config = helper.configuration()
    selection_keys = ("model_id", "effort_id", "configuration_generation")
    observation = {} if args.resume_attempt_report else {key: config["selections"]["web"][key] for key in selection_keys}
    report = {"stage": "AI-32-R03", "scope": "real_gemini_web_text_control_no_attachments",
        "status": "running", "observed_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "harness_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "native_harness_sha256": hashlib.sha256(args.native_harness.read_bytes()).hexdigest(),
        "generation_requests": 0, "maximum_generations": 1, "automatic_inference_retries": 0,
        "attachment_modalities_proved": False, "credentials_logged": False,
        "provider_response_text_stored": False, "provider_configuration_modified": False,
        "configured_database_modified": False}

    def save():
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    def post(route, payload):
        request = urllib.request.Request(config["url"].rstrip("/") + route,
            data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-Nodia-Service-Token": config["token"]}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=150) as response:
                raw = response.read(131073)
                if len(raw) > 131072:
                    raise ValueError("response_exceeds_bound")
                value = json.loads(raw, object_pairs_hook=unique_pairs,
                    parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite_json")))
                if not isinstance(value, dict):
                    raise ValueError("response_shape")
                return response.status, value
        except urllib.error.HTTPError as error:
            return error.code, {"code": "private_http_error"}

    proof = None
    if args.resume_attempt_report:
        previous = json.loads(args.resume_attempt_report.read_text(encoding="utf-8"))
        if previous.get("scope") != report["scope"]:
            parser.error("only this text-control report can be reconciled")
        report["probe"] = dict(previous["probe"])
        report["probe"]["native_acknowledged"] = False
        report["maximum_generations"] = 0
        report["literal_entities_control"] = previous.get("literal_entities_control") is True
        observation = {key: report["probe"][key] for key in selection_keys}
    else:
        status, before = post("/nodia-ai/web/observe", observation)
        if status != 200 or before.get("available") is not True:
            report.update(status="runtime_unavailable", observation_http_status=status)
            save()
            return
        resource, session = before.get("resource_key"), before.get("session_generation")
        if (not isinstance(resource, str) or re.fullmatch(r"gemini-profile:[0-9a-f]{64}", resource) is None
                or not isinstance(session, str) or re.fullmatch(r"[0-9a-f]{32}", session) is None):
            raise ValueError("invalid_observation_identity")
        attempt = str(uuid4())
        reference = {"resource_key": resource, "session_generation": session, "operation_ref": attempt}
        nonce = "NODIA_TEXT_CONTROL_" + secrets.token_hex(16)
        if args.literal_entities:
            nonce += " &quot; &amp; &#10;"
        report["literal_entities_control"] = args.literal_entities
        report["probe"] = {"engine": "web", **observation, "reference": reference, "attempt_id": attempt,
            "expected_answer_sha256": hashlib.sha256(nonce.encode()).hexdigest(),
            "native_acknowledged": False, "semantic_control_matches": False}
        save()
        started = time.monotonic()
        try:
            report["generation_requests"] = 1
            save()  # The only inference is durably declared before dispatch.
            status, result = post("/nodia-ai/web/turn", {**observation, "attempt_id": attempt,
                "resource_key": resource, "session_generation": session, "timeout_seconds": 120,
                "canonical_prompt": 'Control sintético de conversación sin archivos ni herramientas. Conserva literalmente todos los caracteres, incluidas entidades HTML sin decodificarlas. Devuelve exactamente este objeto JSON: '
                    + json.dumps({"kind": "answer", "text": nonce}, separators=(",", ":"))})
            report["probe"]["http_status"] = status
            reply = result.get("reply")
            if status == 200 and set(result) == {"reply", "terminal_proof"}:
                proof = result.get("terminal_proof")
                if isinstance(reply, dict) and set(reply) == {"kind", "text"} and reply.get("kind") == "answer" and isinstance(reply.get("text"), str):
                    digest = hashlib.sha256(reply["text"].encode("utf-8")).hexdigest()
                    report["probe"].update(answer_sha256=digest,
                        semantic_control_matches=digest == report["probe"]["expected_answer_sha256"])
        except Exception as error:
            report["probe"].update(transport_result_uncertain=True, safe_error_type=type(error).__name__)
        finally:
            report["probe"]["elapsed_seconds"] = round(time.monotonic() - started, 2)
            save()
    item = report["probe"]
    reference, attempt = item["reference"], item["attempt_id"]
    try:
        if not valid_proof(proof, reference, attempt):
            proof = None
            deadline = time.monotonic() + 45
            while True:
                status, result = post("/nodia-ai/web/attempts/" + attempt + "/reconcile", reference)
                item["reconciliation_http_status"] = status
                if status == 200 and valid_proof(result, reference, attempt):
                    proof = result
                    break
                if status != 409 or time.monotonic() >= deadline:
                    break
                time.sleep(2)
        if proof is not None:
            item["native_outcome"] = proof["outcome"]
            status, value = post("/nodia-ai/web/attempts/" + attempt + "/acknowledge",
                {**reference, "terminal_proof_id": proof["terminal_proof_id"]})
            item["native_acknowledged"] = status == 200 and value == {"acknowledged": True}
        status, after = post("/nodia-ai/web/observe", observation)
        item["same_session_available_after"] = status == 200 and after.get("available") is True and all(after.get(key) == reference[key] for key in ("resource_key", "session_generation"))
        report["observation_after"] = {key: after.get(key) for key in ("available", "reason", "resource_key", "session_generation")}
        report["observation_after"]["http_status"] = status
    except Exception as error:
        report["reconciliation_safe_error_type"] = type(error).__name__
    finally:
        for key, action in (("diagnostics", lambda: native.diagnostics(attempt)), ("quiet_after", lambda: helper.configuration()["quiet"])):
            try:
                report[key] = action()
            except Exception as error:
                report[key + "_safe_error_type"] = type(error).__name__
        report["status"] = "passed" if (item.get("http_status") == 200 and item.get("semantic_control_matches") is True
            and item.get("native_acknowledged") is True and item.get("native_outcome") == "completed"
            and item.get("same_session_available_after") is True) else "gates_open"
        report["completed_at_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save()
    print(json.dumps({"status": report["status"], "generation_requests": report["generation_requests"],
        "attempt_id": attempt, "native_acknowledged": item["native_acknowledged"], "attachment_modalities_proved": False}))


if __name__ == "__main__":
    main()
