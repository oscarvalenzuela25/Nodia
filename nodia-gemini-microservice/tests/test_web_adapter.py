import test_support
import asyncio
import json
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from gemini_service import GeminiWebService
from gemini_webapi.exceptions import AuthError, ModelInvalidError, UsageLimitExceededError, TimeoutError as ProviderTimeout
from service_errors import ServiceError
from test_support import RESULT


class WebAdapterTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.service = GeminiWebService()
        self.service.init_client = AsyncMock()
        self.service._persist_live_cookies = Mock()
        self.model = SimpleNamespace(model_id="live-id", model_name="live-name", is_available=True)
        self.client = SimpleNamespace(
            list_models=Mock(return_value=[self.model]),
            generate_content=AsyncMock(return_value=SimpleNamespace(text=json.dumps(RESULT))),
            account_status=SimpleNamespace(name="AVAILABLE"),
            _fetch_usage_info=AsyncMock(), _fetch_quota=AsyncMock(),
            usage_info={"reported": 1}, quotas={"model_specific": {"remaining": 5}},
        )
        self.service.client = self.client
        self.service.is_initialized = True

    async def test_exact_id_and_name_are_resolved_without_guessing(self):
        for model in ("live-id", "live-name"):
            await self.service.analyze_invoice(Path("unused.pdf"), model=model)
            self.assertIs(self.client.generate_content.call_args.kwargs["model"], self.model)
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(Path("unused.pdf"), model="some-pro-name")
        self.assertEqual(caught.exception.code, "model_unavailable")
        self.assertEqual(self.client.generate_content.await_count, 2)

    async def test_model_missing_or_unavailable_never_generates(self):
        for model in (None, "", "removed"):
            with self.assertRaises(ServiceError):
                await self.service.analyze_invoice(Path("unused.pdf"), model=model)
        self.model.is_available = False
        with self.assertRaises(ServiceError):
            await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
        self.client.generate_content.assert_not_awaited()

    async def test_quota_timeout_and_model_error_do_not_retry(self):
        for error, status in ((UsageLimitExceededError("private"), 429), (ProviderTimeout("private"), 504),
                              (ModelInvalidError("private"), 422), (RuntimeError("private"), 503)):
            self.client.generate_content.reset_mock()
            self.client.generate_content.side_effect = error
            with self.assertRaises(ServiceError) as caught:
                await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
            self.assertEqual(caught.exception.status, status)
            self.assertNotIn("private", caught.exception.message)
            self.client.generate_content.assert_awaited_once()

    async def test_auth_recovers_once_and_keeps_exact_model(self):
        self.service.recover_auth = AsyncMock()
        self.client.generate_content.side_effect = [AuthError("private"), SimpleNamespace(text=json.dumps(RESULT))]
        await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
        self.assertEqual(self.client.generate_content.await_count, 2)
        self.service.recover_auth.assert_awaited_once_with(self.client)
        self.client.generate_content.side_effect = AuthError("private")
        with self.assertRaises(ServiceError):
            await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
        self.assertEqual(self.client.generate_content.await_count, 4)

    async def test_refusal_does_not_trigger_another_analysis(self):
        self.client.generate_content.return_value.text = "I cannot view images. secret OCR"
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
        self.assertEqual(caught.exception.code, "document_rejected")
        self.assertNotIn("secret", caught.exception.message)
        self.client.generate_content.assert_awaited_once()

    async def test_capabilities_are_not_guessed_from_model_name(self):
        self.model.model_name = "future-pro-model"
        models = await self.service.get_models_and_quota()
        self.assertNotIn("capabilities", models["models"][0])
        self.assertNotIn("context_window", models["models"][0])
        with self.assertRaises(ServiceError):
            await self.service.analyze_invoice(Path("unused.pdf"), model="live-id", extended_thinking=True)
        self.client.generate_content.assert_not_awaited()

    async def test_concurrent_quota_queries_share_one_read_and_unknown_stays_unknown(self):
        await asyncio.gather(*(self.service.get_quota_summary() for _ in range(10)))
        self.client._fetch_quota.assert_awaited_once()
        self.client._fetch_usage_info.assert_awaited_once()
        self.service._quota_cache = None
        self.client._fetch_quota.side_effect = RuntimeError("offline")
        self.client._fetch_usage_info.side_effect = RuntimeError("offline")
        result = await self.service.get_quota_summary()
        self.assertIsNone(result["quotas"])
        self.assertIsNone(result["usage_info"])
        self.assertIsNone(result["observed_at"])

    async def test_session_change_discards_quota_in_flight(self):
        async def change():
            self.service.client = None
        self.client._fetch_quota.side_effect = change
        result = await self.service.get_quota_summary()
        self.assertIsNone(result["quotas"])
        self.assertIsNone(self.service._quota_cache)

    async def test_sdk_swallowed_error_cannot_present_previous_quota_as_fresh(self):
        class CachedClient:
            _usage_info = {"old": 1}
            _quotas = {"old": {"remaining": 5}}
            _fetch_usage_info = AsyncMock()
            _fetch_quota = AsyncMock()

            @property
            def usage_info(self):
                return self._usage_info

            @property
            def quotas(self):
                return self._quotas

        self.service.client = CachedClient()
        result = await self.service.get_quota_summary()
        self.assertIsNone(result["usage_info"])
        self.assertIsNone(result["quotas"])
        self.assertIsNone(result["observed_at"])
