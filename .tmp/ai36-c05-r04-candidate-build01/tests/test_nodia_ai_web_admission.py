"""AI-02 adapter admission diagnostics; runner installs synthetic session roots."""
import test_support
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

from gemini_service import GeminiWebService
from service_errors import ServiceError


class AdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_chat_slot_excludes_ocr_before_sdk_or_file_access(self):
        service = GeminiWebService()
        service.init_client = AsyncMock()
        async with service._analysis_lock:
            with self.assertRaises(ServiceError) as caught:
                await service.analyze_invoice(Path("unused-fixture.png"), model="synthetic-id")
            self.assertEqual(caught.exception.code, "web_busy")
        service.init_client.assert_not_awaited()
        self.assertFalse(service._analysis_lock.locked())

    async def test_chat_slot_excludes_logout_without_mutating_session(self):
        service = GeminiWebService()
        async with service._analysis_lock:
            with self.assertRaises(ServiceError) as caught:
                await service.disconnect()
            self.assertEqual(caught.exception.code, "web_session_busy")
        self.assertFalse(service._session_resetting)
        self.assertFalse(service._analysis_lock.locked())
