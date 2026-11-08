"""Real private ASGI routes preserve only exact safe admission-error categories."""
import test_support
from pathlib import Path

from service_errors import ServiceError
from test_support import AppTestCase, HEADERS


class ManualInvoiceErrorHeaderTests(AppTestCase):
    def test_real_busy_get_models_and_manual_post_keep_exact_conflict_header(self):
        lease = self.app.state.profiles.reserve("agentic", purpose="execution")
        try:
            responses = [self.client.get("/agentic/models", headers=HEADERS), self.analyze()]
        finally:
            lease.release()
        for response in responses:
            self.assertEqual(response.status_code, 409)
            self.assertEqual(response.json()["code"], "runtime_busy")
            self.assertEqual(response.headers.get("X-Nodia-Error-Code"), "runtime_busy")
        self.agentic.get_status.assert_not_awaited()
        self.agentic.analyze_invoice.assert_not_awaited()

    def marker(self, raw):
        gate = self.app.state.profiles
        lease = gate.reserve("agentic", purpose="execution")
        try:
            gate.arm_dispatch("agentic")
            gate.quarantine("agentic")
        finally:
            lease.release()
        path = Path(self.state_directory) / "runtime_admission" / (gate.identity("agentic").split(":", 1)[1] + ".unknown")
        path.write_bytes(raw)
        path.chmod(0o600)
        return path

    def test_manual_legacy_marker_preserves_missing_proof_category(self):
        path = self.marker(b"unknown\n")
        response = self.analyze()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.headers.get("X-Nodia-Error-Code"), "native_proof_missing")
        self.assertEqual(path.read_bytes(), b"unknown\n")
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_manual_invalid_marker_preserves_mismatched_proof_category(self):
        raw = b'{"kind":"manual_invoice","kind":"foreign"}'
        path = self.marker(raw)
        response = self.analyze()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.headers.get("X-Nodia-Error-Code"), "native_proof_mismatch")
        self.assertEqual(path.read_bytes(), raw)
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_get_and_post_do_not_export_unknown_codes_or_allowed_codes_with_wrong_status(self):
        for code, status in (("unlisted_native_code", 409), ("runtime_busy", 503),
                             ("native_proof_missing", 500), ("native_proof_mismatch", 502)):
            with self.subTest(code=code, status=status):
                self.agentic.get_status.side_effect = ServiceError(code, "Synthetic safe message", status)
                self.agentic.analyze_invoice.side_effect = ServiceError(code, "Synthetic safe message", status)
                for response in (self.client.get("/agentic/models", headers=HEADERS), self.analyze()):
                    self.assertEqual(response.status_code, status)
                    self.assertIsNone(response.headers.get("X-Nodia-Error-Code"))
