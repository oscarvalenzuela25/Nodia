import test_support
import asyncio
import os
from pathlib import Path
from unittest.mock import patch

from agentic_service import AntigravityAgentService
from service_errors import ServiceError
from test_support import AppTestCase, HEADERS


class DualEngineTest(AppTestCase):
    def test_web_sdk_options_are_exposed_without_inventing_model_capabilities(self):
        self.web.get_status.return_value["supported_options"] = {"extended_thinking": True}
        response = self.client.get("/engines/status", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["web"]["supported_options"]["extended_thinking"])
        self.assertFalse(response.json()["web"]["authenticated"])

    def test_engine_status_reports_independent_unknown_agentic_quota(self):
        response = self.client.get("/engines/status", headers=HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["agentic"]["available"])
        self.assertIsNone(response.json()["agentic"]["quota"])
        self.assertIsNone(response.json()["agentic"]["model"])

    def test_agentic_models_do_not_invent_catalogue(self):
        response = self.client.get("/agentic/models", headers=HEADERS)
        self.assertFalse(response.json()["authenticated"])
        self.assertEqual(response.json()["models"], [])
        self.web.get_quota_summary.assert_not_awaited()

    def test_environment_markers_never_authenticate_agentic(self):
        with patch.dict(os.environ, {"ANTIGRAVITY_AGENT": "1", "ANTIGRAVITY_API_KEY": "fake"}):
            service = AntigravityAgentService()
            self.assertFalse(service.is_available())
            with self.assertRaises(ServiceError):
                asyncio.run(service.analyze_invoice(Path("unused.pdf")))

    def test_agentic_analysis_does_not_fall_back_to_web(self):
        response = self.analyze(engine="agentic")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["code"], "agentic_unavailable")
        self.web.analyze_invoice.assert_not_awaited()

    def test_invalid_engine_is_rejected(self):
        self.assertEqual(self.analyze(engine="invalid").status_code, 422)

    def test_web_dispatch_preserves_zero_quantity(self):
        response = self.analyze(engine="web")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["items"][0]["quantity"], 0)
        self.web.analyze_invoice.assert_awaited_once()

    def test_no_model_is_rejected_before_invocation(self):
        self.assertEqual(self.analyze(model="").status_code, 422)
        self.web.analyze_invoice.assert_not_awaited()

    def test_observed_web_metrics_stay_associated_with_web(self):
        self.web.get_status.return_value["initialized"] = True
        self.web.get_quota_summary.return_value = {
            "source": "web", "observed_at": 1234,
            "usage_info": {"weekly": {"usage_percentage": 0}},
            "quotas": {"reported-category": {"remaining": 2, "total": 5, "usage_percentage": 60}},
        }
        response = self.client.get("/engines/status", headers=HEADERS)
        self.assertEqual(response.json()["web"]["quota"]["reported-category"]["remaining"], 2)
        self.assertEqual(response.json()["web"]["quota_observed_at"], 1234)
        self.assertIsNone(response.json()["agentic"]["quota"])
