"""Offline receipt-identity and exact-format gates for the standalone R03 probe."""
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

PATH = Path(__file__).with_name("nodia-ai-ai32-r04-mcp-file-probe.py")
SPEC = importlib.util.spec_from_file_location("ai32_r04_mcp_probe", PATH)
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


class McpProbeIdentityTests(unittest.TestCase):
    def proof(self, reference, attempt):
        return {**reference, "attempt_id": attempt,
                "terminal_proof_id": "12345678-1234-1234-1234-123456789abc",
                "process_closed": True, "outcome": "completed", "observed_at": "2026-10-18T05:00:00Z"}

    def test_proof_requires_exact_identity_closed_process_and_closed_schema(self):
        reference = {"resource_key": "gemini-profile:" + "a" * 64,
                     "session_generation": "b" * 32,
                     "operation_ref": "12345678-1234-1234-1234-123456789abc"}
        valid = self.proof(reference, reference["operation_ref"])
        self.assertTrue(probe.valid_proof(valid, reference, reference["operation_ref"]))
        for field, wrong in (("attempt_id", "wrong"), ("resource_key", "wrong"),
                ("session_generation", "c" * 32), ("operation_ref", "wrong"),
                ("process_closed", 1), ("outcome", "dispatch_armed"),
                ("terminal_proof_id", "invalid"), ("observed_at", "2026-10-18T05:00:00"),
                ("observed_at", None), ("extra", "unexpected")):
            with self.subTest(field=field, wrong=wrong):
                self.assertFalse(probe.valid_proof({**valid, field: wrong}, reference, reference["operation_ref"]))
        for field in valid:
            malformed = {key: value for key, value in valid.items() if key != field}
            self.assertFalse(probe.valid_proof(malformed, reference, reference["operation_ref"]))

    def run_probe(self, *, invalid_receipt=False, exact_mime=True, private_transport_error=False):
        calls = []
        nonce = None
        reference = None
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            helper = root / "synthetic_helper.py"
            helper.write_text('''def configuration():
    return {"url":"http://127.0.0.1:9", "token":"synthetic-token", "selections":{"agentic":{"model_id":"synthetic-model", "effort_id":None, "configuration_generation":"d"*64}}, "quiet":{"pending_jobs":0,"open_attempts":0,"held_or_unknown_slots":0}}
def fixtures(path):
    return {"image":(b"synthetic-file", "image/png", "synthetic marker")}
''', encoding="utf-8")
            output = root / "report.json"
            class Response:
                status = 200
                def __init__(self, value):
                    self.value = value
                def __enter__(self):
                    return self
                def __exit__(self, *args):
                    return False
                def read(self, limit):
                    return json.dumps(self.value).encode()
            def request(request, **kwargs):
                nonlocal nonce, reference
                path = request.full_url.removeprefix("http://127.0.0.1:9")
                body = json.loads(request.data)
                calls.append(path)
                if path.endswith("/observe"):
                    return Response({"available":True, "verified_modalities":["image"],
                        "verified_attachment_media_types":["image/png" if exact_mime else "image/jpeg"],
                        "resource_key":"gemini-profile:" + "a"*64, "session_generation":"b"*32})
                if path.endswith("/mcp/start"):
                    reference = {key:body[key] for key in ("resource_key", "session_generation")}
                    reference["operation_ref"] = body["attempt_id"]
                    if private_transport_error:
                        raise RuntimeError("private-marker")
                    return Response({})
                if path.endswith("/mcp/events"):
                    if nonce is None:
                        return Response({"events":[{"seq":1,"kind":"tool_request","name":"nodia_ai_canary_read","arguments":{},"call_id":"synthetic-call"}]})
                    proof = self.proof(reference, reference["operation_ref"])
                    if invalid_receipt:
                        proof["session_generation"] = "c" * 32
                    return Response({"events":[{"seq":2,"kind":"answer","text":"synthetic marker\n" + nonce,"terminal_proof":proof}]})
                if path.endswith("/mcp/results"):
                    nonce = body["result"]["nonce"]
                    return Response({"accepted":True})
                if path.endswith("/mcp/attest"):
                    return Response({"verified":True})
                if path.endswith("/mcp/cancel"):
                    return Response({"state":"closed"})
                if path.endswith("/reconcile"):
                    proof = self.proof(reference, reference["operation_ref"])
                    proof["session_generation"] = "c" * 32
                    return Response(proof)
                if path.endswith("/acknowledge"):
                    self.assertEqual(body, {**reference, "terminal_proof_id":"12345678-1234-1234-1234-123456789abc"})
                    return Response({"acknowledged":True})
                raise AssertionError("Unexpected offline route")
            args = [str(PATH), "--live", "--historical-helper", str(helper), "--output", str(output),
                    "--kind", "image", "--synthetic-speech", str(root / "unused.wav")]
            with patch.object(sys, "argv", args), patch.object(probe.urllib.request, "urlopen", request), patch.object(probe.time, "sleep"), redirect_stdout(io.StringIO()):
                probe.main()
            return json.loads(output.read_text(encoding="utf-8")), calls

    def test_exact_receipt_is_acknowledged_once_after_callback_and_attestation(self):
        report, calls = self.run_probe()
        self.assertEqual(report["status"], "passed")
        self.assertTrue(report["terminal_identity_verified"])
        self.assertEqual(report["callbacks"], 1)
        self.assertEqual(report["generation_requests"], 1)
        self.assertEqual(sum(path.endswith("/acknowledge") for path in calls), 1)

    def test_wrong_session_in_answer_and_reconcile_never_sends_ack(self):
        report, calls = self.run_probe(invalid_receipt=True)
        self.assertEqual(report["status"], "gates_open")
        self.assertFalse(report["native_acknowledged"])
        self.assertFalse(report["terminal_identity_verified"])
        self.assertTrue(any(path.endswith("/reconcile") for path in calls))
        self.assertFalse(any(path.endswith("/acknowledge") for path in calls))

    def test_category_only_or_different_mime_never_dispatches_generation(self):
        report, calls = self.run_probe(exact_mime=False)
        self.assertEqual(report["status"], "exact_agentic_modality_unverified")
        self.assertEqual(report["generation_requests"], 0)
        self.assertFalse(any(path.endswith("/mcp/start") for path in calls))

    def test_private_transport_runtime_error_is_never_exported(self):
        report, calls = self.run_probe(private_transport_error=True)
        self.assertEqual(report["safe_error_category"], "transport_error")
        self.assertNotIn("private-marker", json.dumps(report))
        self.assertEqual(report["status"], "gates_open")
        self.assertFalse(report["native_acknowledged"])


if __name__ == "__main__":
    unittest.main()
