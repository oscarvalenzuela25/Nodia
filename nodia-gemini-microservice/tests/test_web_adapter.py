import test_support
import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import MethodType, SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from gemini_service import GeminiWebService
from gemini_webapi.client import GeminiClient as SdkGeminiClient
from gemini_webapi.utils.decorators import running
from gemini_webapi.exceptions import APIError, AuthError, ModelInvalidError, UsageLimitExceededError, TimeoutError as ProviderTimeout
from service_errors import ServiceError
from test_support import RESULT


class WebAdapterTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.service = GeminiWebService()
        self.service.init_client = AsyncMock()
        self.service.supported_options = Mock(return_value={"extended_thinking": True})
        self.service._persist_live_cookies = Mock()
        self.model = SimpleNamespace(model_id="live-id", model_name="live-name", is_available=True)
        self.client = SimpleNamespace(
            close=AsyncMock(),
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

    async def test_shared_sdk_never_overlaps_inferences_and_cancel_releases_admission(self):
        started = asyncio.Event()
        async def pending(*args, **kwargs):
            started.set()
            await asyncio.Event().wait()
        self.client.generate_content.side_effect = pending
        task = asyncio.create_task(self.service.analyze_invoice(Path("unused.pdf"), model="live-id"))
        await started.wait()
        with self.assertRaises(ServiceError) as busy:
            await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
        self.assertEqual(busy.exception.code, "web_busy")
        self.client.generate_content.assert_awaited_once()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.client.generate_content.side_effect = None
        self.service.is_initialized = True  # Explicitly simulate authenticated reconnection.
        await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
        self.assertEqual(self.client.generate_content.await_count, 2)

    async def test_sdk_generation_budget_is_not_the_startup_deadline(self):
        candidate = SimpleNamespace(init=AsyncMock(), close=AsyncMock(),
                                    account_status=SimpleNamespace(name="AVAILABLE"))
        service = GeminiWebService(generation_timeout=210)
        service._persist_live_cookies = Mock()
        with patch("gemini_service.GeminiClient", return_value=candidate):
            try:
                await service._connect("synthetic", "synthetic")
                self.assertEqual(candidate.init.call_args.kwargs["timeout"], 210)
                self.assertEqual(candidate.init.call_args.kwargs["watchdog_timeout"], 120)
            finally:
                await service.close()

    async def test_quota_refresh_does_not_touch_the_shared_transport_during_analysis(self):
        async with self.service._analysis_lock:
            result = await self.service.get_quota_summary()
            self.assertIsNone(result["quotas"])
            self.assertIsNone(result["observed_at"])
            self.client._fetch_quota.assert_not_awaited()
            self.client._fetch_usage_info.assert_not_awaited()
        await self.service.get_quota_summary()
        self.client._fetch_quota.assert_awaited_once()

    async def test_timeout_closes_transport_before_stream_cleanup_and_never_resends(self):
        started, closed = asyncio.Event(), asyncio.Event()
        async def stalled(*args, **kwargs):
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                await closed.wait()  # Model curl_cffi Response.aclose waiting for transfer.
        self.client.generate_content.side_effect = stalled
        self.client.close.side_effect = closed.set
        task = asyncio.create_task(self.service.analyze_invoice(Path("unused.pdf"), model="live-id"))
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await asyncio.wait_for(task, 0.5)
        self.client.close.assert_awaited_once()
        self.client.generate_content.assert_awaited_once()
        self.assertFalse(self.service._analysis_lock.locked())
        self.assertFalse(self.service.is_initialized)

    async def test_quota_timeout_and_model_error_do_not_retry(self):
        for error, status in ((UsageLimitExceededError("private"), 429), (ProviderTimeout("private"), 504),
                              (ModelInvalidError("private"), 422), (APIError("private"), 502),
                              (RuntimeError("private"), 503)):
            self.client.generate_content.reset_mock()
            self.client.generate_content.side_effect = error
            with self.assertRaises(ServiceError) as caught:
                await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
            self.assertEqual(caught.exception.status, status)
            self.assertNotIn("private", caught.exception.message)
            self.client.generate_content.assert_awaited_once()

    async def test_pinned_sdk_does_not_resend_uncertain_generation(self):
        attempts = 0

        @running(retry=5)
        async def failing_generation(client, **kwargs):
            nonlocal attempts
            attempts += 1
            raise APIError("private provider output")
            yield  # Preserve the SDK's async-generator decorator path.

        self.client.auto_close = False
        self.client._running = True
        self.client.verbose = False
        self.client.push_id = "synthetic-push"
        self.client._live_client = object()
        self.client._check_account_status = Mock(return_value=True)
        self.client._sync_activity = AsyncMock()
        self.client.close = AsyncMock()
        self.client._generate = MethodType(failing_generation, self.client)
        # Exercise the installed SDK's public kwargs forwarding and retry wrapper.
        self.client.generate_content = MethodType(SdkGeminiClient.generate_content, self.client)
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "synthetic.pdf"
            file.write_bytes(b"%PDF-1.4")
            with patch("gemini_webapi.client.upload_file", AsyncMock(return_value="synthetic-upload")), \
                 patch("gemini_webapi.utils.decorators.asyncio.sleep", AsyncMock(side_effect=AssertionError("Unexpected SDK retry"))):
                with self.assertRaises(ServiceError) as caught:
                    await self.service.analyze_invoice(file, model="live-id")
        self.assertEqual(caught.exception.code, "provider_response_error")
        self.assertNotIn("private", caught.exception.message)
        self.assertEqual(attempts, 1)
        self.client.close.assert_awaited_once()

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
        self.assertTrue(models["supported_options"]["extended_thinking"])
        await self.service.analyze_invoice(Path("unused.pdf"), model="live-id", extended_thinking=True)
        self.assertTrue(self.client.generate_content.call_args.kwargs["extended_thinking"])
        self.assertIs(self.client.generate_content.call_args.kwargs["model"], self.model)

    async def test_sdk_without_thinking_option_rejects_request_before_generation(self):
        self.service.supported_options.return_value = {"extended_thinking": False}
        with self.assertRaises(ServiceError) as caught:
            await self.service.analyze_invoice(Path("unused.pdf"), model="live-id", extended_thinking=True)
        self.assertEqual(caught.exception.code, "thinking_unsupported")
        self.client.generate_content.assert_not_awaited()
        await self.service.analyze_invoice(Path("unused.pdf"), model="live-id")
        self.assertNotIn("extended_thinking", self.client.generate_content.call_args.kwargs)

    async def test_web_rejects_low_medium_high_without_ignoring_them(self):
        for level in ("low", "medium", "high"):
            with self.assertRaises(ServiceError) as caught:
                await self.service.analyze_invoice(Path("unused.pdf"), model="live-id", thinking_level=level)
            self.assertEqual(caught.exception.code, "thinking_level_unsupported")
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
