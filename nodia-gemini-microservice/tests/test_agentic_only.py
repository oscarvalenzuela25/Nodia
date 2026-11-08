"""Private Agentic transport and retirement barriers; no provider requests."""
import test_support
import os
import asyncio
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from agentic_service import AntigravityAgentService
from native_attempts import NativeAttemptLedger, ReconcileAttempt
from native_context_budget import ContextMeasureRequest, measure_context
from nodia_ai_chat import Answer, parse_reply
from schemas import AnalysisOptions
from service_errors import ServiceError
from test_support import AppTestCase, HEADERS


class AgenticOnlyHttpTests(AppTestCase):
    def test_engine_status_has_only_agentic_and_preserves_unknown_quota(self):
        self.agentic.get_status.return_value.update(available=False, has_active_session=False, models=[])
        response = self.client.get("/engines/status", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {"status", "default_engine", "agentic"})
        self.assertEqual(response.json()["default_engine"], "agentic")
        self.assertFalse(response.json()["agentic"]["available"])
        self.assertIsNone(response.json()["agentic"]["quota"])
        self.assertIsNone(response.json()["agentic"]["model"])
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_catalog_empty_and_unauthenticated_never_invents_models(self):
        self.agentic.get_status.return_value.update(available=False, has_active_session=False, models=[])
        response = self.client.get("/agentic/models", headers=HEADERS)
        self.assertFalse(response.json()["authenticated"])
        self.assertEqual(response.json()["models"], [])

    def test_environment_markers_never_authenticate_agentic(self):
        with patch.dict(os.environ, {"ANTIGRAVITY_AGENT": "1", "ANTIGRAVITY_API_KEY": "synthetic"}):
            service = AntigravityAgentService()
            self.assertFalse(service.is_available())
            with self.assertRaises(ServiceError):
                asyncio.run(service.analyze_invoice(Path("unused.pdf")))

    def test_unavailable_agentic_fails_without_calling_provider(self):
        self.agentic.is_available = lambda: False
        response = self.analyze()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["code"], "agentic_unavailable")
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_retired_and_invalid_engines_are_rejected_before_generation(self):
        for engine in ("web", "token_plan_web", "token_plan_agentic", "api_key", "invalid"):
            with self.subTest(engine=engine):
                self.assertEqual(self.analyze(engine=engine).status_code, 422)
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_legacy_web_routes_are_absent_from_runtime_and_openapi(self):
        paths = self.client.get("/openapi.json", headers=HEADERS).json()["paths"]
        for route, method in (("/web/status", "get"), ("/models", "get"),
                ("/auth/status", "get"), ("/auth/login/start", "post"),
                ("/auth/refresh", "post"), ("/auth/logout", "post"),
                ("/web/analyze-invoice", "post")):
            with self.subTest(route=route):
                self.assertNotIn(route, paths)
                self.assertEqual(getattr(self.client, method)(route, headers=HEADERS).status_code, 404)
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_agentic_dispatch_preserves_real_zero(self):
        response = self.analyze()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["items"][0]["quantity"], 0)
        self.agentic.analyze_invoice.assert_awaited_once()

    def test_absent_model_is_rejected_without_default(self):
        self.assertEqual(self.analyze(model="").status_code, 422)
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_readiness_requires_observed_agentic_session(self):
        self.assertEqual(self.client.get("/ready", headers=HEADERS).status_code, 503)
        self.agentic.get_status.return_value["has_active_session"] = True
        self.assertEqual(self.client.get("/ready", headers=HEADERS).status_code, 200)
        self.agentic.analyze_invoice.assert_not_awaited()

    def test_new_web_proof_cannot_be_armed_and_old_proof_is_not_modified(self):
        ledger = NativeAttemptLedger(None)
        attempt = str(uuid4())
        reference = ReconcileAttempt(resource_key="gemini-profile:" + "a" * 64,
            session_generation="b" * 32, operation_ref=attempt)
        with self.assertRaises(ServiceError) as caught:
            ledger.arm(attempt, "web", reference)
        self.assertEqual(caught.exception.code, "invalid_engine")
        self.assertEqual(ledger.memory, {})

    def test_web_reply_and_context_cannot_be_used_as_agentic_aliases(self):
        with self.assertRaises(ServiceError):
            parse_reply('{"kind":"answer","text":"synthetic"}', "web")
        request = ContextMeasureRequest(model_id="synthetic", effort_id=None,
            canonical_prompt="synthetic")
        with self.assertRaises(ServiceError):
            measure_context("web", request, Answer.model_json_schema())
