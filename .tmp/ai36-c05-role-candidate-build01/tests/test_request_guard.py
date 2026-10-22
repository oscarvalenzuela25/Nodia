import test_support
import asyncio
import os
import unittest
from types import SimpleNamespace

from request_guard import PrivateRequestGuard
from schemas import RuntimeLimits
from test_support import TOKEN
from unittest.mock import patch


class RequestGuardTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.enterContext(patch.dict(os.environ, {"GEMINI_SERVICE_TOKEN": TOKEN}))

    async def exercise(self, messages, *, timeout=1, admission=True, fail=False):
        state = SimpleNamespace(limits=RuntimeLimits(file_bytes=1, upload_timeout=timeout),
                                analysis_slots=asyncio.Semaphore(1 if admission else 0))
        scope = {"type": "http", "method": "POST", "path": "/analyze-invoice", "query_string": b"",
                 "headers": [(b"x-nodia-service-token", TOKEN.encode())], "app": SimpleNamespace(state=state)}
        sent = []
        called = []
        iterator = iter(messages)

        async def receive():
            try:
                return next(iterator)
            except StopIteration:
                await asyncio.sleep(1)
                return {"type": "http.disconnect"}

        async def downstream(scope, receive, send):
            called.append(True)
            if fail:
                raise RuntimeError("secret provider output")
            await receive()
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

        async def send(message):
            sent.append(message)

        await PrivateRequestGuard(downstream)(scope, receive, send)
        return state, sent, called

    async def test_chunked_body_without_content_length_is_limited_before_parser(self):
        state, sent, called = await self.exercise([
            {"type": "http.request", "body": b"x" * 20000, "more_body": True},
            {"type": "http.request", "body": b"x" * 20000, "more_body": False},
        ])
        self.assertEqual(sent[0]["status"], 413)
        self.assertFalse(called)
        self.assertEqual(state.analysis_slots._value, 1)

    async def test_disconnect_and_upload_timeout_release_admission(self):
        state, sent, called = await self.exercise([{"type": "http.disconnect"}])
        self.assertEqual(state.analysis_slots._value, 1)
        self.assertFalse(called)
        state, sent, called = await self.exercise([], timeout=0.01)
        self.assertEqual(sent[0]["status"], 408)
        self.assertEqual(state.analysis_slots._value, 1)

    async def test_saturation_does_not_read_body(self):
        state, sent, called = await self.exercise([], admission=False)
        self.assertEqual(sent[0]["status"], 429)
        self.assertFalse(called)

    async def test_unexpected_failure_has_safe_body_and_request_id(self):
        state, sent, called = await self.exercise([{"type": "http.request", "body": b"x"}], fail=True)
        self.assertEqual(sent[0]["status"], 500)
        self.assertNotIn(b"secret", sent[1]["body"])
        self.assertTrue(any(key == b"x-request-id" for key, _ in sent[0]["headers"]))
        self.assertEqual(state.analysis_slots._value, 1)

    async def test_disconnect_cancels_in_flight_processing_and_releases_slot(self):
        started = asyncio.Event()
        cleaned = asyncio.Event()
        slots = asyncio.Semaphore(1)
        scope = {"type": "http", "method": "POST", "path": "/analyze-invoice", "query_string": b"",
                 "headers": [(b"x-nodia-service-token", TOKEN.encode())],
                 "app": SimpleNamespace(state=SimpleNamespace(limits=RuntimeLimits(), analysis_slots=slots))}
        reads = 0

        async def receive():
            nonlocal reads
            reads += 1
            if reads == 1:
                return {"type": "http.request", "body": b"bounded upload", "more_body": False}
            await started.wait()
            return {"type": "http.disconnect"}

        async def downstream(scope, receive, send):
            await receive()
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                cleaned.set()

        async def send(message):
            self.fail("No response after disconnect")

        await PrivateRequestGuard(downstream)(scope, receive, send)
        self.assertTrue(cleaned.is_set())
        self.assertEqual(slots._value, 1)
