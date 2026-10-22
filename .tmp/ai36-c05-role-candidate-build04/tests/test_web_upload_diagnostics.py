"""Upload observation uses the real SDK with isolated synthetic HTTP only."""
import test_support
import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from curl_cffi.requests import AsyncSession
from gemini_webapi.constants import Endpoint
from gemini_webapi.utils.upload_file import upload_file
from web_upload_diagnostics import (BodyPacingDiagnostics, ObservedUploadTransport, UploadDiagnostics,
                                    upload_observation, upload_observation_active)


class WebUploadDiagnosticsTests(unittest.IsolatedAsyncioTestCase):
    def test_byte_pacing_records_only_bounded_monotonic_timing_and_unknown_absence(self):
        clock = Mock(side_effect=[10, 13, 200, 203, 86400100])
        trace = BodyPacingDiagnostics(clock)
        self.assertEqual(trace.snapshot(), {"first_chunk_elapsed_ms": None,
                                            "last_chunk_elapsed_ms": None,
                                            "max_inter_chunk_gap_ms": None})
        trace.chunk()
        self.assertIsNone(trace.snapshot()["max_inter_chunk_gap_ms"])
        for _ in range(3):
            trace.chunk()
        self.assertEqual(trace.snapshot(), {"first_chunk_elapsed_ms": 10,
                                            "last_chunk_elapsed_ms": 203,
                                            "max_inter_chunk_gap_ms": 187})
        trace.chunk()
        self.assertEqual(trace.snapshot()["last_chunk_elapsed_ms"], 86400000)

    async def test_real_sdk_upload_keeps_reference_bytes_and_session_without_replay(self):
        response = SimpleNamespace(status_code=200,
                                   text="/contrib_service/ttl_1d/private-reference",
                                   raise_for_status=Mock())
        async with AsyncSession() as session:
            session.post = AsyncMock(return_value=response)
            trace = UploadDiagnostics("synthetic-attempt")
            proxy = ObservedUploadTransport(session, trace)
            self.assertIsInstance(proxy, AsyncSession)
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "private-filename.wav"
                path.write_bytes(b"private-synthetic-file-bytes")
                with upload_observation(trace):
                    result = await upload_file(path, proxy, "private-push-id")
            self.assertEqual(result, response.text)
            session.post.assert_awaited_once()
            response.raise_for_status.assert_called_once()
        snapshot = trace.snapshot()
        self.assertEqual(snapshot["requests"], 1)
        self.assertEqual(snapshot["roundtrips_completed"], 1)
        self.assertTrue(snapshot["records"][0]["reference_prefix_matches"])
        self.assertEqual(snapshot["records"][0]["http_status"], 200)
        self.assertNotIn("private", json.dumps(snapshot))

    async def test_unowned_or_other_url_delegates_exactly_without_observation(self):
        response = object()
        session = SimpleNamespace(post=AsyncMock(return_value=response), other=object())
        trace = UploadDiagnostics("synthetic")
        proxy = ObservedUploadTransport(session, trace)
        self.assertIs(await proxy.post(Endpoint.UPLOAD, headers={"private": "secret"}), response)
        with upload_observation(trace):
            self.assertIs(await proxy.post("https://synthetic.invalid/other", data="private"), response)
        self.assertEqual(trace.snapshot()["requests"], 0)
        self.assertEqual(session.post.await_count, 2)
        self.assertIs(proxy.other, session.other)
        self.assertFalse(upload_observation_active(trace))

    async def test_gather_inherits_owner_and_preexisting_background_task_does_not(self):
        session = SimpleNamespace(post=AsyncMock(return_value=SimpleNamespace(status_code=200, text="")))
        trace = UploadDiagnostics("synthetic")
        proxy = ObservedUploadTransport(session, trace)
        ready = asyncio.Event()
        async def background():
            await ready.wait()
            return await proxy.post(Endpoint.UPLOAD)
        task = asyncio.create_task(background())
        with upload_observation(trace):
            ready.set()
            await asyncio.gather(proxy.post(Endpoint.UPLOAD), proxy.post(url=Endpoint.UPLOAD), task)
        self.assertEqual(trace.snapshot()["requests"], 2)
        self.assertEqual(session.post.await_count, 3)

    async def test_error_and_cancellation_propagate_original_without_retry(self):
        for error, field in ((RuntimeError("private-error"), "failed"),
                             (asyncio.CancelledError("private-cancel"), "cancelled")):
            with self.subTest(field=field):
                session = SimpleNamespace(post=AsyncMock(side_effect=error))
                trace = UploadDiagnostics("synthetic", Mock(side_effect=ValueError("private-sink")))
                with upload_observation(trace):
                    with self.assertRaises(type(error)) as caught:
                        await ObservedUploadTransport(session, trace).post(Endpoint.UPLOAD)
                self.assertIs(caught.exception, error)
                self.assertEqual(trace.snapshot()[field], 1)
                self.assertEqual(trace.snapshot()["roundtrips_completed"], 0)
                self.assertGreater(trace.snapshot()["sink_errors"], 0)
                session.post.assert_awaited_once()
                self.assertNotIn("private", json.dumps(trace.snapshot()))

    async def test_cancellation_of_pending_http_upload_keeps_same_deadline_and_owner_cleanup(self):
        entered, released = asyncio.Event(), asyncio.Event()
        async def pending(*args, **kwargs):
            entered.set()
            try:
                await asyncio.Event().wait()
            finally:
                released.set()
        session = SimpleNamespace(post=AsyncMock(side_effect=pending))
        trace = UploadDiagnostics("synthetic")
        async def run():
            with upload_observation(trace):
                await ObservedUploadTransport(session, trace).post(Endpoint.UPLOAD)
        task = asyncio.create_task(run())
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(released.is_set())
        self.assertEqual(trace.snapshot()["cancelled"], 1)
        self.assertIsNotNone(trace.snapshot()["records"][0]["duration_ms"])
        self.assertFalse(upload_observation_active(trace))
        session.post.assert_awaited_once()

    async def test_absent_invalid_or_throwing_metadata_never_changes_response(self):
        class BadMetadata:
            @property
            def status_code(self):
                raise ValueError("private-metadata")
        for response in (object(), SimpleNamespace(status_code=True, text=[]), BadMetadata()):
            with self.subTest(response_type=type(response).__name__):
                session = SimpleNamespace(post=AsyncMock(return_value=response))
                trace = UploadDiagnostics("synthetic", Mock(side_effect=RuntimeError("private-sink")))
                with upload_observation(trace):
                    observed = await ObservedUploadTransport(session, trace).post(Endpoint.UPLOAD)
                self.assertIs(observed, response)
                self.assertIsNone(trace.snapshot()["records"][0]["http_status"])
                self.assertEqual(trace.snapshot()["roundtrips_completed"], 1)
                self.assertNotIn("private", json.dumps(trace.snapshot()))

    async def test_non_2xx_roundtrip_is_not_claimed_as_accepted_sdk_upload(self):
        response = SimpleNamespace(status_code=403, text="private-rejection")
        trace = UploadDiagnostics("synthetic")
        with upload_observation(trace):
            result = await ObservedUploadTransport(SimpleNamespace(post=AsyncMock(return_value=response)), trace).post(Endpoint.UPLOAD)
        self.assertIs(result, response)
        self.assertEqual(trace.snapshot()["records"][0]["outcome"], "http_completed")
        self.assertEqual(trace.snapshot()["records"][0]["http_status"], 403)
        self.assertFalse(trace.snapshot()["records"][0]["reference_prefix_matches"])

    async def test_records_and_events_stay_bounded_and_nested_scope_restores_owner(self):
        events = []
        trace, other = UploadDiagnostics("synthetic", events.append), UploadDiagnostics("other")
        session = SimpleNamespace(post=AsyncMock(return_value=SimpleNamespace(status_code=200, text="")))
        proxy = ObservedUploadTransport(session, trace)
        with upload_observation(trace):
            with upload_observation(other):
                self.assertFalse(upload_observation_active(trace))
            await asyncio.gather(*(proxy.post(Endpoint.UPLOAD) for _ in range(9)))
        snapshot = trace.snapshot()
        self.assertEqual(snapshot["requests"], 9)
        self.assertEqual(len(snapshot["records"]), 4)
        self.assertEqual(len(events), 8)
        self.assertIsNot(snapshot["records"][0], trace.records[0])
