import test_support
import asyncio
import os
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from main import create_app
from schemas import RuntimeLimits
from service_errors import ServiceError
from test_support import AppTestCase, HEADERS, fake_agentic


class ServiceAuthenticationTest(AppTestCase):

    def test_sensitive_routes_reject_missing_and_wrong_caller(self):
        for path in ("/", "/models", "/auth/status", "/auth/login/start", "/analyze-invoice",
                     "/docs", "/redoc", "/openapi.json", "/engines/status", "/agentic/status", "/web/status"):
            for headers in ({}, {"X-Nodia-Service-Token": "wrong"}):
                self.assertEqual(self.client.get(path, headers=headers).status_code, 401, path)

    def test_missing_configuration_fails_closed(self):
        with patch.dict(os.environ, {"GEMINI_SERVICE_TOKEN": ""}):
            self.assertEqual(self.client.get("/models").status_code, 503)
            self.assertEqual(self.client.get("/health").json(), {"status": "ok"})
            with self.assertRaisesRegex(RuntimeError, "GEMINI_SERVICE_TOKEN"):
                with TestClient(create_app(load_environment=False)):
                    pass



    def test_file_signature_and_size_and_cleanup(self):
        for content, expected in ((b"not-pdf", 415), (b"%PDF-123456789", 413)):
            self.app.state.limits = RuntimeLimits(file_bytes=8)
            response = self.client.post("/analyze-invoice", headers=HEADERS, data={"model": "model"},
                                        files={"file": ("invoice.pdf", content, "application/pdf")})
            self.assertEqual(response.status_code, expected)
            self.assertEqual(list(Path(self.directory).iterdir()), [])
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_capacity_is_checked_before_temporaries(self):
        self.app.state.analysis_slots = asyncio.Semaphore(0)
        response = self.analyze()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "5")
        self.assertEqual(list(Path(self.directory).iterdir()), [])
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_error_semantics_and_retry_after_are_preserved(self):
        self.agentic.analyze_invoice.side_effect = ServiceError("quota_exhausted", "Cuota agotada.", 429, 30)
        response = self.analyze()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "30")
        self.assertEqual(response.json()["request_id"], response.headers["X-Request-ID"])
        self.assertEqual(list(Path(self.directory).iterdir()), [])

    def test_invalid_extraction_does_not_look_successful(self):
        self.agentic.analyze_invoice.return_value = {"data": {"items": [{"name": "X", "quantity": float("inf")}]}}
        self.assertEqual(self.analyze().status_code, 502)

    def test_timeout_releases_slot_and_files(self):
        async def slow(**kwargs):
            await asyncio.sleep(1)
        self.agentic.analyze_invoice.side_effect = slow
        self.app.state.limits = RuntimeLimits(analysis_timeout=0.01)
        response = self.analyze()
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.headers["X-Nodia-Error-Code"], "analysis_timeout")
        self.assertEqual(response.json()["code"], "analysis_timeout")
        self.assertEqual(self.app.state.analysis_slots._value, 2)
        self.assertEqual(list(Path(self.directory).iterdir()), [])

    def test_only_known_operational_categories_receive_diagnostic_header(self):
        for code, status, expected in (("provider_timeout", 504, "provider_timeout"),
                                       ("agentic_timeout", 504, "agentic_timeout"),
                                       ("provider_response_error", 502, "provider_response_error"),
                                       ("private-output", 504, None), ("analysis_timeout", 503, None)):
            self.agentic.analyze_invoice.side_effect = ServiceError(code, "Safe message", status)
            response = self.analyze()
            self.assertEqual(response.status_code, status)
            self.assertEqual(response.headers.get("X-Nodia-Error-Code"), expected)
            self.assertEqual(list(Path(self.directory).iterdir()), [])


    def test_duplicate_fields_and_multiple_files_are_rejected(self):
        response = self.client.post("/analyze-invoice", headers=HEADERS, data={"model": ["a", "b"]},
                                    files={"file": ("invoice.pdf", b"%PDF-1.4")})
        self.assertEqual(response.status_code, 422)
        response = self.client.post("/analyze-invoice", headers=HEADERS, data={"model": "a"}, files=[
            ("file", ("invoice.pdf", b"%PDF-1.4")), ("file", ("other.pdf", b"%PDF-1.4")),
        ])
        self.assertEqual(response.status_code, 400)
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_importing_application_has_no_operational_effects(self):
        import importlib
        import main
        import dotenv
        with patch.object(dotenv, "load_dotenv", side_effect=AssertionError("Must not load .env")), \
             patch.object(main.AntigravityAgentService, "__init__", side_effect=AssertionError("Must not construct service")), \
             patch.object(Path, "mkdir", side_effect=AssertionError("Must not create directories")):
            importlib.reload(main)

    def test_readiness_is_private_and_does_not_assume_session(self):
        response = self.client.get("/ready")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "service_unauthorized")
        self.assertEqual(response.json()["request_id"], response.headers["X-Request-ID"])
        self.assertEqual(self.client.get("/ready", headers=HEADERS).status_code, 503)

    def test_openapi_describes_required_multipart_model_and_file(self):
        response = self.client.get("/openapi.json", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        for path in ("/analyze-invoice", "/agentic/analyze-invoice"):
            body = response.json()["paths"][path]["post"]["requestBody"]
            self.assertTrue(body["required"])
            schema = body["content"]["multipart/form-data"]["schema"]
            self.assertEqual(set(schema["required"]), {"model", "file"})
            self.assertEqual(schema["properties"]["file"]["format"], "binary")
