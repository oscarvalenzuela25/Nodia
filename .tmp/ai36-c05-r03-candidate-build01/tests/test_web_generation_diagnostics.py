"""Actual SDK lifecycle seams with synthetic HTTP and no account/network access."""
import test_support
import asyncio
import json
import unittest
from contextlib import aclosing, asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from gemini_webapi import GeminiClient
from gemini_webapi.constants import Endpoint
from gemini_webapi.types import Candidate, ModelOutput
from gemini_service import GeminiWebService
from web_generation_diagnostics import DiagnosticWebClient, WebGenerationDiagnostics, _Response, observe_generation
from web_reasoning_adapter import ReasoningWebClient, ObservedProfile


class WebGenerationDiagnosticsTests(unittest.IsolatedAsyncioTestCase):
    def output(self, text="", *, delta=None, thoughts=None):
        return ModelOutput(metadata=["private-cid"], candidates=[
            Candidate(rcid="private-rcid", text=text, text_delta=delta, thoughts=thoughts)])

    def client(self):
        client = DiagnosticWebClient("synthetic", "synthetic")
        client._running = True
        return client

    async def test_native_generate_keeps_output_options_transport_and_private_content_unchanged(self):
        client = self.client()
        output = SimpleNamespace(text="private-provider-answer")
        chunks = [b"private-byte-marker", b"more"]
        class Response:
            status_code = 200
            async def aiter_content(self):
                for chunk in chunks:
                    yield chunk
        @asynccontextmanager
        async def stream(*args, **kwargs):
            self.assertEqual(kwargs, {"headers": {"secret-header": "private-header-marker"}})
            yield Response()
        session = SimpleNamespace(stream=Mock(side_effect=stream))
        client.client = session
        received = []
        async def generation(instance, *args, **kwargs):
            self.assertEqual(kwargs["current_retry"], 0)
            async with instance._live_client.stream("POST", Endpoint.GENERATE, headers={"secret-header": "private-header-marker"}) as response:
                async for chunk in response.aiter_content():
                    received.append(chunk)
                yield output
        events = []
        trace = WebGenerationDiagnostics("synthetic-attempt", events.append)
        with patch.object(GeminiClient, "_sync_activity", AsyncMock()), patch.object(GeminiClient, "_generate", generation):
            with observe_generation(client, trace):
                trace.generation_task = asyncio.current_task()
                result = await client.generate_content("private-prompt-marker", current_retry=0)
        self.assertIs(result, output)
        self.assertEqual(received, chunks)
        self.assertIs(client._live_client, session)
        snapshot = trace.snapshot()
        self.assertEqual(snapshot["http_status"], 200)
        self.assertEqual(snapshot["body_bytes"], sum(map(len, chunks)))
        self.assertEqual(snapshot["byte_chunks"], 2)
        self.assertEqual(snapshot["candidate_outputs"], 1)
        self.assertTrue(snapshot["attached"])
        self.assertTrue(snapshot["upstream_eof_seen"])
        self.assertIsNotNone(snapshot["upstream_eof_elapsed_ms"])
        encoded = json.dumps({"events": events, "snapshot": snapshot})
        for marker in ("private-provider-answer", "private-byte-marker", "private-header-marker", "private-prompt-marker", "google.com"):
            self.assertNotIn(marker, encoded)
        self.assertIsNone(client._nodia_generation_trace)
        self.assertIsNone(trace.generation_task)

    async def test_no_observer_preserves_original_session_identity(self):
        client = self.client()
        session = object()
        client.client = session
        async def generation(instance, **kwargs):
            self.assertIs(instance._live_client, session)
            yield SimpleNamespace(text="synthetic")
        with patch.object(GeminiClient, "_generate", generation):
            outputs = [value async for value in client._generate()]
        self.assertEqual(len(outputs), 1)
        self.assertIs(client._live_client, session)

    async def test_sink_failure_never_replaces_native_error_or_cleanup(self):
        client = self.client()
        error = RuntimeError("private-native-error")
        sink = Mock(side_effect=ValueError("private-sink-error"))
        trace = WebGenerationDiagnostics("synthetic-attempt", sink)
        async def generation(instance, **kwargs):
            raise error
            yield
        with patch.object(GeminiClient, "_generate", generation), observe_generation(client, trace):
            with self.assertRaises(RuntimeError) as caught:
                _ = [value async for value in client._generate()]
        self.assertIs(caught.exception, error)
        self.assertGreater(trace.snapshot()["sink_errors"], 0)
        self.assertIsNone(client._nodia_generation_trace)
        self.assertNotIn("private", json.dumps(trace.snapshot()))

    async def test_stream_exit_is_not_marked_complete_before_underlying_cleanup(self):
        client = self.client()
        entered, exiting, release = asyncio.Event(), asyncio.Event(), asyncio.Event()
        class Context:
            async def __aenter__(self):
                entered.set()
                return SimpleNamespace(status_code=200)
            async def __aexit__(self, *exception):
                exiting.set()
                await release.wait()
                return False
        client.client = SimpleNamespace(stream=lambda *args, **kwargs: Context())
        async def generation(instance, **kwargs):
            async with instance._live_client.stream("POST", Endpoint.GENERATE):
                await asyncio.Event().wait()
                yield
        trace = WebGenerationDiagnostics("synthetic-attempt")
        async def consume():
            with observe_generation(client, trace):
                trace.generation_task = asyncio.current_task()
                return [value async for value in client._generate()]
        with patch.object(GeminiClient, "_generate", generation):
            task = asyncio.create_task(consume())
            await entered.wait()
            task.cancel()
            await exiting.wait()
            self.assertNotIn("stream_exit_completed", [event["phase"] for event in trace.events])
            self.assertFalse(task.done())
            release.set()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertIn("stream_exit_completed", [event["phase"] for event in trace.events])
        self.assertIn("generation_cancelled", [event["phase"] for event in trace.events])
        self.assertFalse(trace.snapshot()["upstream_eof_seen"])
        self.assertIsNone(client._nodia_generation_trace)

    async def test_background_activity_and_refresh_closures_are_distinguished_from_foreground(self):
        client = self.client()
        trace = WebGenerationDiagnostics("synthetic-attempt")
        with patch.object(GeminiClient, "close", AsyncMock()), observe_generation(client, trace):
            trace.generation_task = asyncio.current_task()
            await client.close()
            background = asyncio.create_task(client.close())
            client.activity_task = background
            await background
            refreshing = asyncio.create_task(client.close())
            client.refresh_task = refreshing
            await refreshing
        started = [event["task_role"] for event in trace.events if event["phase"] == "client_close_started"]
        self.assertEqual(started, ["generation", "background_activity", "background_refresh"])

    async def test_activity_recovery_and_diagnostic_event_budget_are_bounded(self):
        client = self.client()
        trace = WebGenerationDiagnostics("synthetic-attempt")
        result = object()
        with patch.object(GeminiClient, "_sync_activity", AsyncMock()), patch.object(GeminiClient, "read_chat", AsyncMock(return_value=result)), observe_generation(client, trace):
            await client._sync_activity()
            self.assertIs(await client.read_chat("private-conversation-id"), result)
            for _ in range(30):
                await client._sync_activity()
        self.assertEqual(len(trace.events), 16)
        self.assertEqual(trace.snapshot()["activity_calls"], 31)
        self.assertEqual(trace.snapshot()["recovery_calls"], 1)
        self.assertNotIn("private-conversation-id", json.dumps(trace.snapshot()))

    async def test_background_close_retains_its_role_when_sdk_clears_task_handle(self):
        client = self.client()
        trace = WebGenerationDiagnostics("synthetic-attempt")
        with patch.object(GeminiClient, "close", AsyncMock(side_effect=lambda: setattr(client, "activity_task", None))), observe_generation(client, trace):
            trace.generation_task = asyncio.current_task()
            trace.note("request_started", "generation")
            task = asyncio.create_task(client.close())
            client.activity_task = task
            await task
            self.assertEqual(trace.last_phase, "request_started")
            trace.cancelling()
        self.assertEqual(trace.cancelled_at_phase, "request_started")
        closures = [event for event in trace.events if event["phase"].startswith("client_close_")]
        self.assertEqual([event["task_role"] for event in closures], ["background_activity", "background_activity"])

    async def test_service_consumes_diagnostics_locally_without_forwarding_to_sdk(self):
        service = GeminiWebService()
        client = self.client()
        result = object()
        service.client = client
        trace = WebGenerationDiagnostics("synthetic-attempt")
        native = AsyncMock(return_value=result)
        with patch.object(GeminiClient, "generate_content", native):
            self.assertIs(await service._generate_content("synthetic", diagnostics=trace, model="synthetic-model"), result)
        self.assertEqual(native.call_args.kwargs, {"current_retry": 0, "model": "synthetic-model"})
        self.assertIsNone(client._nodia_generation_trace)

    async def test_reasoning_adapter_preserves_native_two_field_rewrite_with_diagnostics(self):
        model = "a" * 16
        client = ReasoningWebClient("synthetic", "synthetic", observed_profile=ObservedProfile(model, (3, 4, 5), 1))
        client._running = True
        captured = []
        @asynccontextmanager
        async def stream(method, url, **kwargs):
            body = json.loads(json.loads(kwargs["data"]["f.req"])[1])
            captured.append(body[80])
            yield SimpleNamespace(status_code=200)
        client.client = SimpleNamespace(stream=stream)
        async def generation(instance, **kwargs):
            from gemini_webapi.constants import MODEL_HEADER_KEY
            body = [None] * 81
            body[79], body[80] = 1, 1
            header = [None] * 17
            header[4], header[14], header[15] = model, 1, 1
            async with instance._live_client.stream("POST", Endpoint.GENERATE,
                headers={MODEL_HEADER_KEY: json.dumps(header)}, data={"f.req": json.dumps([None, json.dumps(body)])}):
                yield SimpleNamespace(text="synthetic")
        trace = WebGenerationDiagnostics("synthetic-attempt")
        with patch.object(GeminiClient, "_sync_activity", AsyncMock()), patch.object(GeminiClient, "_generate", generation), observe_generation(client, trace):
            await client.generate_content("synthetic", model=model, thinking_level="medium", current_retry=0)
        self.assertEqual(captured, [4])
        self.assertEqual(trace.snapshot()["candidate_outputs"], 1)
        self.assertIsNone(client._nodia_generation_trace)
        self.assertFalse(client._experiment_lock.locked())

    async def test_thoughts_only_and_empty_outputs_are_distinct_without_private_content(self):
        trace = WebGenerationDiagnostics("synthetic-attempt")
        trace.output(self.output(thoughts="private-reasoning"))
        shape = trace.snapshot()["output_shape"]
        self.assertEqual((shape["text_nonempty"], shape["text_delta_nonempty"]), (False, False))
        self.assertEqual((shape["thoughts_present"], shape["thoughts_empty"]), (True, False))
        self.assertEqual(shape["thoughts_only_outputs"], 1)
        trace.output(self.output(thoughts=""))
        shape = trace.snapshot()["output_shape"]
        self.assertEqual((shape["thoughts_present"], shape["thoughts_empty"]), (True, True))
        self.assertEqual(shape["empty_outputs"], 1)
        trace.output(self.output())
        shape = trace.snapshot()["output_shape"]
        self.assertEqual((shape["thoughts_present"], shape["thoughts_empty"]), (False, None))
        self.assertEqual(shape["empty_outputs"], 2)
        self.assertIsNone(shape["first_text_elapsed_ms"])
        self.assertNotIn("private-", json.dumps(trace.snapshot()))

    async def test_partial_text_observation_never_short_circuits_native_generation(self):
        client = self.client()
        outputs = [self.output(thoughts="private-thought"), self.output("partial", delta="partial"),
                   self.output("private-complete", delta="-complete")]
        yielded = []
        clock = Mock(return_value=1)
        async def generation(instance, **kwargs):
            for index, output in enumerate(outputs, 1):
                clock.return_value = 1 + index / 100
                yielded.append(output)
                yield output
        with patch("web_generation_diagnostics.monotonic", clock):
            trace = WebGenerationDiagnostics("synthetic-attempt")
            with patch.object(GeminiClient, "_sync_activity", AsyncMock()), patch.object(GeminiClient, "_generate", generation), observe_generation(client, trace):
                result = await client.generate_content("synthetic", current_retry=0)
        self.assertIs(result, outputs[-1])
        self.assertEqual(yielded, outputs)
        shape = trace.snapshot()["output_shape"]
        self.assertEqual((shape["first_yield_elapsed_ms"], shape["last_yield_elapsed_ms"], shape["first_text_elapsed_ms"]), (10, 30, 20))
        self.assertTrue(shape["text_nonempty"])
        self.assertTrue(shape["text_delta_nonempty"])
        self.assertEqual(shape["text_outputs"], 2)
        self.assertEqual(shape["thoughts_only_outputs"], 1)
        self.assertFalse(trace.snapshot()["upstream_eof_seen"])

    async def test_shape_counts_only_chosen_candidate_media_without_reading_items(self):
        class PrivateItem:
            def __repr__(self):
                raise AssertionError("must not inspect media")
        chosen = Candidate.model_construct(rcid="private", text="", text_delta=None, thoughts=None,
            web_images=[PrivateItem()], generated_images=[PrivateItem()], generated_videos=[PrivateItem()], generated_media=[PrivateItem()])
        output = ModelOutput.model_construct(metadata=["private"], candidates=[self.output("other").candidates[0], chosen], chosen=1)
        trace = WebGenerationDiagnostics("synthetic-attempt")
        trace.output(output)
        shape = trace.snapshot()["output_shape"]
        self.assertEqual((shape["candidates_count"], shape["media_count"]), (2, 4))
        self.assertFalse(shape["text_nonempty"])
        self.assertEqual(shape["empty_outputs"], 0)
        self.assertNotIn("private", json.dumps(trace.snapshot()))

    async def test_malformed_outputs_are_unknown_without_getters_stringification_or_failure(self):
        class Hostile:
            def __getattribute__(self, name):
                raise AssertionError("private-access")
            def __repr__(self):
                raise AssertionError("private-repr")
        trace = WebGenerationDiagnostics("synthetic-attempt")
        trace.output(Hostile())
        self.assertIsNone(trace.snapshot()["output_shape"]["candidates_count"])
        trace.output(ModelOutput.model_construct(metadata=[], candidates=[], chosen=0))
        self.assertEqual(trace.snapshot()["output_shape"]["candidates_count"], 0)
        malformed = Candidate.model_construct(rcid="private", text=Hostile(), thoughts="private")
        trace.output(ModelOutput.model_construct(metadata=[], candidates=[malformed], chosen=0))
        trace.output(ModelOutput.model_construct(metadata=[], candidates=[malformed], chosen=True))
        shape = trace.snapshot()["output_shape"]
        self.assertIsNone(shape["text_nonempty"])
        self.assertIsNone(shape["media_count"])
        self.assertIsNone(shape["first_text_elapsed_ms"])
        self.assertEqual(shape["unclassified_outputs"], 4)
        self.assertEqual(trace.snapshot()["candidate_outputs"], 4)
        self.assertNotIn("private", json.dumps(trace.snapshot()))

    async def test_snapshot_shape_is_closed_and_detached_from_internal_state(self):
        trace = WebGenerationDiagnostics("synthetic-attempt")
        snapshot = trace.snapshot()
        self.assertEqual(set(snapshot["output_shape"]), {
            "text_nonempty", "text_delta_nonempty", "thoughts_present", "thoughts_empty",
            "candidates_count", "media_count", "first_yield_elapsed_ms", "last_yield_elapsed_ms",
            "first_text_elapsed_ms", "text_outputs", "thoughts_only_outputs", "empty_outputs", "unclassified_outputs"})
        snapshot["output_shape"]["text_nonempty"] = "private"
        self.assertIsNone(trace.snapshot()["output_shape"]["text_nonempty"])

    async def test_upstream_eof_only_after_normal_iterator_exhaustion(self):
        trace = WebGenerationDiagnostics("synthetic-attempt")
        class Response:
            async def aiter_content(self):
                yield b"private-chunk"
        response = _Response(Response(), self.client(), trace)
        iterator = response.aiter_content()
        self.assertEqual(await anext(iterator), b"private-chunk")
        self.assertFalse(trace.upstream_eof_seen)
        with self.assertRaises(StopAsyncIteration):
            await anext(iterator)
        self.assertTrue(trace.upstream_eof_seen)
        self.assertIsNotNone(trace.upstream_eof_elapsed_ms)

    async def test_upstream_cancellation_and_consumer_close_never_claim_eof(self):
        for cancel in (False, True):
            with self.subTest(cancel=cancel):
                trace = WebGenerationDiagnostics("synthetic-attempt")
                waiting = asyncio.Event()
                class Response:
                    async def aiter_content(self):
                        yield b"private-chunk"
                        waiting.set()
                        await asyncio.Event().wait()
                response = _Response(Response(), self.client(), trace)
                async with aclosing(response.aiter_content()) as iterator:
                    await anext(iterator)
                    if cancel:
                        task = asyncio.create_task(anext(iterator))
                        await waiting.wait()
                        task.cancel()
                        with self.assertRaises(asyncio.CancelledError):
                            await task
                self.assertFalse(trace.upstream_eof_seen)
                self.assertIsNone(trace.upstream_eof_elapsed_ms)

    async def test_upstream_error_never_claims_eof_or_exports_error_payload(self):
        trace = WebGenerationDiagnostics("synthetic-attempt")
        error = RuntimeError("private-provider-error")
        class Response:
            async def aiter_content(self):
                yield b"private-chunk"
                raise error
        response = _Response(Response(), self.client(), trace)
        with self.assertRaises(RuntimeError) as caught:
            _ = [chunk async for chunk in response.aiter_content()]
        self.assertIs(caught.exception, error)
        self.assertFalse(trace.upstream_eof_seen)
        self.assertNotIn("private", json.dumps(trace.snapshot()))
