"""Structured chat text through the pinned SDK parser and Candidate validator."""
import test_support
import asyncio
import hashlib
import json
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from gemini_webapi import GeminiClient
from curl_cffi.requests import AsyncSession
from gemini_webapi.types import Candidate, ModelOutput
from gemini_service import GeminiWebService
from nodia_ai_chat import parse_reply
from web_generation_diagnostics import (
    DiagnosticWebClient, WebGenerationDiagnostics, _structured_owner,
    observe_generation, preserve_structured_output,
)


def candidate_data(text, *, complete=True, rcid="synthetic-rcid"):
    value = [None] * 9
    value[0], value[1], value[8] = rcid, [text], [2 if complete else 1]
    return value


def frame(candidate):
    body = [None] * 26
    body[1], body[4] = ["synthetic-cid", "synthetic-rid"], [candidate]
    payload = json.dumps([["wrb.fr", None, json.dumps(body)]], ensure_ascii=False)
    # The pinned SDK protocol counts the frame's surrounding newlines as units.
    return (")]}'\n" + str(len(payload.encode("utf-16-le")) // 2 + 2) + "\n" + payload + "\n").encode()


class StructuredWebTextTests(unittest.IsolatedAsyncioTestCase):
    def client(self):
        client = DiagnosticWebClient("synthetic", "synthetic")
        client._running = True
        return client

    async def generate(self, source, *, enabled=True, trace=None, client=None, complete=True, recovery_source=None):
        client = client or self.client()
        data = frame(candidate_data(source, complete=complete))
        requests = []
        class Response:
            status_code = 200
            async def aiter_content(self):
                # Split multibyte and JSON boundaries: use the actual SDK stream
                # parser/decoder and Candidate rather than recreating their logic.
                for index in range(0, len(data), 17):
                    yield data[index:index + 17]
        @asynccontextmanager
        async def stream(*args, **kwargs):
            requests.append((args, kwargs))
            yield Response()
        client.client = SimpleNamespace(stream=stream)
        service = GeminiWebService()
        service.client = client
        patches = [patch.object(GeminiClient, "_sync_activity", AsyncMock()),
                   patch.object(GeminiClient, "_fetch_usage_info", AsyncMock())]
        for entry in patches:
            entry.start()
            self.addCleanup(entry.stop)
        if recovery_source is not None:
            history_candidate = candidate_data(recovery_source, rcid="synthetic-recovered")
            turn = [None] * 4
            turn[0], turn[3] = [None, "synthetic-rid"], [[history_candidate]]
            history = [["wrb.fr", None, json.dumps([[turn]])]]
            client._batch_execute = AsyncMock(return_value=SimpleNamespace(text=json.dumps(history)))
        result = await service._generate_content("synthetic prompt", diagnostics=trace,
            preserve_structured_text=enabled)
        self.assertEqual(len(requests), 1)
        return result, client

    async def test_actual_sdk_preserves_all_entities_and_nested_entities_byte_for_byte(self):
        for text in ("Dice &quot;hola&quot;.", "Dice &#34;hola&#34;.", "Línea&#10;dos",
                     "&amp; &amp;quot; &lt;tag&gt; &copy;", "emoji 🧪 y acento á"):
            with self.subTest(text=text):
                source = json.dumps({"kind": "answer", "text": text}, ensure_ascii=False)
                trace = WebGenerationDiagnostics("synthetic")
                result, _ = await self.generate(source, trace=trace)
                self.assertIs(type(result), ModelOutput)
                self.assertIs(type(result.candidates[0]), Candidate)
                self.assertEqual(result.text.encode(), source.encode())
                self.assertEqual(parse_reply(result.text, "web").text, text)
                state = trace.snapshot()["structured_text"]
                self.assertTrue(state["applied"])
                self.assertTrue(state["last_equal"])
                self.assertEqual(state["last_source"], state["last_output"])
                self.assertEqual(state["last_source"]["sha256"], hashlib.sha256(source.encode()).hexdigest())
                self.assertEqual(state["last_source"]["text_bytes"], len(source.encode()))
                self.assertEqual(state["unprotected_html_would_change_outputs"], int("&" in source))

    async def test_real_sdk_file_upload_and_structured_generation_share_one_observed_transport(self):
        source = '{"kind":"answer","text":"File says &quot;hello&quot;."}'
        data = frame(candidate_data(source))
        client = self.client()
        service = GeminiWebService()
        service.client = client
        session = AsyncSession()
        client.client = session
        trace = WebGenerationDiagnostics("synthetic")
        class Response:
            status_code = 200
            async def aiter_content(self):
                yield data
        @asynccontextmanager
        async def stream(*args, **kwargs):
            yield Response()
        upload = SimpleNamespace(status_code=200, text="/contrib_service/ttl_1d/synthetic-reference", raise_for_status=lambda: None)
        try:
            with tempfile.TemporaryDirectory() as directory:
                file = Path(directory) / "synthetic.png"
                file.write_bytes(b"synthetic-file-bytes")
                with patch.object(session, "post", AsyncMock(return_value=upload)) as post, patch.object(session, "stream", stream), patch.object(GeminiClient, "_sync_activity", AsyncMock()), patch.object(GeminiClient, "_fetch_usage_info", AsyncMock()):
                    result = await service._generate_content("synthetic", diagnostics=trace,
                        preserve_structured_text=True, files=[file])
                post.assert_awaited_once()
            self.assertEqual(result.text, source)
            snapshot = trace.snapshot()
            self.assertEqual(snapshot["uploads"]["requests"], 1)
            self.assertEqual(snapshot["uploads"]["roundtrips_completed"], 1)
            self.assertEqual(snapshot["uploads"]["records"][0]["http_status"], 200)
            self.assertTrue(snapshot["uploads"]["records"][0]["reference_prefix_matches"])
            self.assertTrue(snapshot["structured_text"]["last_equal"])
            self.assertTrue(snapshot["upstream_eof_seen"])
            self.assertEqual(snapshot["body_bytes"], len(data))
            self.assertIsNotNone(snapshot["body_pacing"]["first_chunk_elapsed_ms"])
            self.assertIsNone(snapshot["body_pacing"]["max_inter_chunk_gap_ms"])
            self.assertNotIn("synthetic-reference", json.dumps(snapshot))
        finally:
            await session.close()

    async def test_without_explicit_chat_scope_original_sdk_ocr_semantics_remain(self):
        source = '{"kind":"answer","text":"Dice &quot;hola&quot;."}'
        json.loads(source)
        trace = WebGenerationDiagnostics("synthetic")
        result, client = await self.generate(source, enabled=False, trace=trace)
        self.assertEqual(result.text, Candidate(rcid="synthetic", text=source).text)
        with self.assertRaises(json.JSONDecodeError):
            json.loads(result.text)
        self.assertFalse(trace.snapshot()["structured_text"]["applied"])
        self.assertIsNone(_structured_owner.get())
        self.assertIsNone(client._nodia_generation_trace)

    async def test_invalid_upstream_remains_invalid_and_no_previous_candidate_is_selected(self):
        source = '{"kind":"answer","text":"bad" "still bad &quot;"}'
        trace = WebGenerationDiagnostics("synthetic")
        result, _ = await self.generate(source, trace=trace)
        self.assertEqual(result.text, source)
        self.assertFalse(trace.snapshot()["structured_text"]["last_source"]["json_parseable"])
        state = trace.snapshot()["structured_text"]
        self.assertFalse(state["last_preparser"]["selected_payload"]["json_parseable"])
        self.assertTrue(state["preparser_equal_to_source"])
        with self.assertRaises(json.JSONDecodeError):
            parse_reply(result.text, "web")

    async def test_preparser_diagnostic_binds_chosen_candidate_not_last_alternative(self):
        client = self.client()
        trace = WebGenerationDiagnostics("synthetic")
        source = '{"kind":"answer","text":"http://googleusercontent.com/generated_image/123"}'
        alternative = '{"kind":"answer","text":"PRIVATE_ALTERNATIVE"}'
        with observe_generation(client, trace), preserve_structured_output(client, True) as scope:
            first = client._parse_candidate(candidate_data(source, rcid="first"), "c", "r", "first")[0]
            last = client._parse_candidate(candidate_data(alternative, rcid="last"), "c", "r", "last")[0]
            output = ModelOutput(metadata=[], chosen=0, candidates=[
                Candidate(rcid="first", text=first), Candidate(rcid="last", text=last)])
            scope.verify(output)
        state = trace.snapshot()["structured_text"]
        self.assertEqual(output.text, '{"kind":"answer","text":""}')
        self.assertEqual(state["last_preparser"]["selected_payload"]["sha256"], hashlib.sha256(source.encode()).hexdigest())
        self.assertFalse(state["preparser_equal_to_source"])
        self.assertEqual(state["last_source"], state["last_output"])
        self.assertNotIn("PRIVATE_ALTERNATIVE", json.dumps(trace.snapshot()))
        self.assertNotIn("googleusercontent", json.dumps(trace.snapshot()))

    async def test_preparser_card_selection_matches_actual_sdk_and_invalid_text_is_unchanged(self):
        client = self.client()
        trace = WebGenerationDiagnostics("synthetic")
        source = '{"kind":"answer","text":"bad"["unchanged"]}'
        data = candidate_data("https://googleusercontent.com/card_content/123")
        data.extend([None] * (23 - len(data)))
        data[22] = [source]
        with observe_generation(client, trace), preserve_structured_output(client, True) as scope:
            text = client._parse_candidate(data, "c", "r", "card")[0]
            output = ModelOutput(metadata=[], candidates=[Candidate(rcid="card", text=text)])
            scope.verify(output)
        state = trace.snapshot()["structured_text"]
        self.assertEqual(output.text, source)
        self.assertEqual(state["last_preparser"]["selection_source"], "card")
        self.assertFalse(state["last_preparser"]["selected_payload"]["json_parseable"])
        self.assertTrue(state["preparser_equal_to_source"])
        with self.assertRaises(json.JSONDecodeError):
            parse_reply(output.text, "web")

    async def test_fences_and_native_citations_still_use_strict_chat_parser(self):
        source = '```json\n{"kind":"answer","text":"literal &quot;"}\n```'
        result, _ = await self.generate(source)
        self.assertEqual(parse_reply(result.text, "web").text, "literal &quot;")
        source = '{"kind":"answer","text":"literal &quot;"}[cite: 1]'
        result, _ = await self.generate(source)
        self.assertEqual(parse_reply(result.text, "web").text, "literal &quot;")
        with self.assertRaises(json.JSONDecodeError):
            parse_reply(result.text, "agentic")

    async def test_recovery_uses_actual_sdk_read_chat_and_matches_recovered_candidate(self):
        source = '{"kind":"answer","text":"partial"}'
        recovered = '{"kind":"answer","text":"Recovered &quot;quote&quot;."}'
        trace = WebGenerationDiagnostics("synthetic")
        result, client = await self.generate(source, complete=False, recovery_source=recovered, trace=trace)
        self.assertEqual(result.text, recovered)
        self.assertEqual(parse_reply(result.text, "web").text, "Recovered &quot;quote&quot;.")
        client._batch_execute.assert_awaited_once()
        self.assertEqual(trace.snapshot()["recovery_calls"], 1)
        self.assertEqual(trace.snapshot()["structured_text"]["candidate_checks"], 2)

    async def test_unbound_or_changed_candidate_fails_closed(self):
        for mode in ("unbound", "changed"):
            with self.subTest(mode=mode):
                client = self.client()
                async def generation(instance, **kwargs):
                    source = '{"kind":"answer","text":"original &quot;"}'
                    if mode == "changed":
                        instance._parse_candidate(candidate_data(source), "synthetic-cid", "synthetic-rid", "synthetic-rcid")
                    yield ModelOutput(metadata=[], candidates=[Candidate(rcid="synthetic-rcid", text="changed")])
                with patch.object(GeminiClient, "_generate", generation), preserve_structured_output(client, True):
                    with self.assertRaises(ValueError):
                        _ = [output async for output in client._generate(prompt="synthetic")]
                self.assertIsNone(_structured_owner.get())

    async def test_public_sdk_result_must_still_match_scoped_source_before_return(self):
        client = self.client()
        service = GeminiWebService()
        service.client = client
        async def changed_final(*args, **kwargs):
            source = '{"kind":"answer","text":"original"}'
            client._parse_candidate(candidate_data(source), "synthetic-cid", "synthetic-rid", "synthetic-rcid")
            return ModelOutput(metadata=[], candidates=[Candidate(rcid="synthetic-rcid", text="changed")])
        with patch.object(GeminiClient, "generate_content", changed_final):
            with self.assertRaises(ValueError):
                await service._generate_content("synthetic", preserve_structured_text=True)
        self.assertIsNone(_structured_owner.get())

    async def test_cancelled_generation_cleans_scope_and_next_ocr_consumer(self):
        client = self.client()
        service = GeminiWebService()
        service.client = client
        reached = asyncio.Event()
        async def generation(instance, **kwargs):
            source = '{"kind":"answer","text":"&quot;"}'
            text, *_ = instance._parse_candidate(candidate_data(source), "synthetic-cid", "synthetic-rid", "synthetic-rcid")
            self.assertIn("&amp;quot;", text)
            reached.set()
            await asyncio.Event().wait()
            yield
        with patch.object(GeminiClient, "_generate", generation), patch.object(GeminiClient, "_sync_activity", AsyncMock()), patch.object(GeminiClient, "close", AsyncMock()):
            task = asyncio.create_task(service._generate_content("synthetic", preserve_structured_text=True))
            await reached.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertIsNone(_structured_owner.get())
        source = '{"kind":"answer","text":"&quot;"}'
        result, _ = await self.generate(source, enabled=False, client=client)
        self.assertEqual(result.text, Candidate(rcid="synthetic", text=source).text)

    async def test_scope_is_not_inherited_by_unrelated_client_or_background_task(self):
        owner, other = self.client(), self.client()
        source = '{"kind":"answer","text":"&quot;"}'
        with preserve_structured_output(owner, True):
            self.assertEqual(other._parse_candidate(candidate_data(source), "c", "r", "synthetic-rcid")[0], source)
            async def background():
                return owner._parse_candidate(candidate_data(source), "c", "r", "synthetic-rcid")[0]
            self.assertEqual(await asyncio.create_task(background()), source)
        self.assertIsNone(_structured_owner.get())

    async def test_diagnostics_only_export_fingerprints_counts_and_detached_maps(self):
        source = '{"kind":"answer","text":"PRIVATE_PROVIDER_MARKER &quot;"}'
        trace = WebGenerationDiagnostics("synthetic")
        await self.generate(source, trace=trace)
        snapshot = trace.snapshot()
        encoded = json.dumps(snapshot)
        for marker in (source, "PRIVATE_PROVIDER_MARKER", "synthetic-rcid", "synthetic-cid", "&quot;"):
            self.assertNotIn(marker, encoded)
        snapshot["structured_text"]["last_source"]["sha256"] = "changed"
        snapshot["structured_text"]["last_preparser"]["selected_payload"]["sha256"] = "changed"
        self.assertEqual(trace.snapshot()["structured_text"]["last_source"]["sha256"], hashlib.sha256(source.encode()).hexdigest())
        self.assertEqual(trace.snapshot()["structured_text"]["last_preparser"]["selected_payload"]["sha256"], hashlib.sha256(source.encode()).hexdigest())
