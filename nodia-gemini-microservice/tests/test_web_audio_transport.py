"""Exact native audio metadata through the actual installed SDK with fake HTTP."""
import test_support
import asyncio
import importlib
import json
import tempfile
import unittest
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from curl_cffi.requests import AsyncSession
from gemini_webapi import GeminiClient
from gemini_service import GeminiWebService
from native_attachments import prepare_web_native_names
from test_web_structured_text import candidate_data, frame
from web_audio_transport import (adapt_req_file_data, native_audio_scope_active,
    native_audio_transport, new_audio_transport_diagnostic)
from web_generation_diagnostics import DiagnosticWebClient, WebGenerationDiagnostics


class WebAudioTransportTests(unittest.IsolatedAsyncioTestCase):
    async def generate(self, specs, media_types):
        prepare_web_native_names()
        sdk_upload = importlib.import_module("gemini_webapi.utils.upload_file")
        client = DiagnosticWebClient("synthetic", "synthetic")
        client._running = True
        service = GeminiWebService()
        service.client = client
        session = AsyncSession()
        client.client = session
        trace = WebGenerationDiagnostics("synthetic")
        uploads, requests = [], []
        source = '{"kind":"answer","text":"synthetic response"}'
        wire = frame(candidate_data(source))
        class Mime:
            def addpart(self, **kwargs):
                uploads.append(kwargs)
            def close(self):
                pass
        async def post(*args, **kwargs):
            reference = "/contrib_service/ttl_1d/synthetic-" + str(len(uploads))
            return SimpleNamespace(status_code=200, text=reference, raise_for_status=lambda: None)
        class Response:
            status_code = 200
            async def aiter_content(self):
                yield wire
        @asynccontextmanager
        async def stream(*args, **kwargs):
            requests.append(json.loads(json.loads(kwargs["data"]["f.req"])[1]))
            yield Response()
        try:
            with tempfile.TemporaryDirectory() as directory:
                files = []
                for name, content in specs:
                    file = Path(directory) / name
                    file.write_bytes(content)
                    files.append(file)
                with patch.object(sdk_upload, "CurlMime", Mime), patch.object(session, "post", side_effect=post) as posted, patch.object(session, "stream", stream), patch.object(GeminiClient, "_sync_activity", AsyncMock()), patch.object(GeminiClient, "_fetch_usage_info", AsyncMock()):
                    result = await service._generate_content("synthetic", diagnostics=trace,
                        preserve_structured_text=True, files=files,
                        native_attachment_media_types=media_types)
                self.assertEqual(posted.await_count, len(specs))
            self.assertEqual(result.text, source)
            self.assertEqual(len(requests), 1)
            self.assertFalse(native_audio_scope_active(client))
            return requests[0][0][3], uploads, trace.snapshot()
        finally:
            await session.close()

    async def test_webm_and_ogg_use_explicit_audio_metadata_with_one_upload_and_generation(self):
        for name, media in (("0.weba", "audio/webm"), ("0.ogg", "audio/ogg"), ("0.wav", "audio/wav")):
            with self.subTest(media=media):
                content = b"synthetic audio original bytes"
                data, uploads, snapshot = await self.generate([(name, content)], [media])
                self.assertEqual(data, [[["/contrib_service/ttl_1d/synthetic-1", 4, None, media], name]])
                self.assertEqual(uploads[0]["data"], content)
                self.assertEqual(uploads[0]["filename"], name)
                if media == "audio/wav":
                    # The SDK uses the host MIME registry: Linux commonly
                    # reports audio/x-wav. The explicit descriptor above must
                    # still retain the inspector's exact canonical audio/wav.
                    self.assertIn(uploads[0]["content_type"], ("audio/wav", "audio/x-wav"))
                else:
                    self.assertEqual(uploads[0]["content_type"], media)
                self.assertEqual(snapshot["audio_transport"], {"scoped":True, "applied":True,
                    "input_files":1, "audio_files":1, "audio_media_types":[media], "descriptor_version":"explicit-audio/1"})

    async def test_multifile_order_names_and_non_audio_descriptors_are_preserved(self):
        specs = [("0.png", b"image bytes"), ("1.weba", b"WebM bytes"),
                 ("2.pdf", b"pdf bytes"), ("3.ogg", b"Ogg bytes")]
        media = ["image/png", "audio/webm", "application/pdf", "audio/ogg"]
        data, uploads, snapshot = await self.generate(specs, media)
        for index, ((name, content), descriptor, upload) in enumerate(zip(specs, data, uploads), 1):
            reference = "/contrib_service/ttl_1d/synthetic-" + str(index)
            self.assertEqual(descriptor, [[reference, 4, None, media[index-1]], name]
                if media[index-1].startswith("audio/") else [[reference], name])
            self.assertEqual((upload["filename"], upload["data"]), (name, content))
        self.assertEqual(snapshot["audio_transport"]["audio_files"], 2)

    async def test_ocr_without_explicit_scope_and_image_pdf_keep_original_sdk_payload(self):
        for specs, media in (([("0.weba", b"audio bytes")], None),
                            ([("0.png", b"image bytes"), ("1.pdf", b"pdf bytes")], ["image/png", "application/pdf"])):
            data, _, snapshot = await self.generate(specs, media)
            self.assertEqual(data, [[["/contrib_service/ttl_1d/synthetic-" + str(index)], name]
                for index, (name, _) in enumerate(specs, 1)])
            self.assertEqual(snapshot["audio_transport"], new_audio_transport_diagnostic())

    async def test_scope_rejects_unknown_mime_cardinality_and_non_path_files(self):
        client = object()
        for files, media in (([Path("0.weba")], ["audio/unknown"]),
                ([Path("0.weba")], []), ([Path("0.weba")], ["audio/webm", "audio/ogg"]),
                (["0.weba"], ["audio/webm"]), ([Path("0.weba")] * 5, ["audio/webm"] * 5)):
            with self.subTest(media=media), self.assertRaises(ValueError):
                with native_audio_transport(client, files, media):
                    self.fail("Unverified metadata entered native scope")
        self.assertFalse(native_audio_scope_active(client))

    async def test_descriptor_alignment_extras_and_duplicate_expansion_fail_before_stream(self):
        client = DiagnosticWebClient("synthetic", "synthetic")
        client._running = True
        stream = AsyncMock(side_effect=AssertionError("must not open stream"))
        client.client = SimpleNamespace(stream=stream)
        reference = "/contrib_service/ttl_1d/synthetic"
        malformed = [None, [], [[[reference], "different.weba"]],
            [[[reference, 4, None, "audio/webm"], "0.weba"]],
            [[[reference], "0.weba", "extra"]], [[[""], "0.weba"]],
            [[[reference + "\n"], "0.weba"]]]
        for data in malformed:
            with self.subTest(data=data), native_audio_transport(client, [Path("0.weba")], ["audio/webm"]):
                with self.assertRaises(ValueError):
                    _ = [output async for output in client._generate(prompt="synthetic", req_file_data=data)]
        stream.assert_not_called()

    async def test_scoped_positional_generate_is_rejected_before_sdk(self):
        client = DiagnosticWebClient("synthetic", "synthetic")
        with native_audio_transport(client, [Path("0.weba")], ["audio/webm"]):
            with self.assertRaises(ValueError):
                _ = [output async for output in client._generate("synthetic")]

    async def test_scope_does_not_affect_unrelated_client_or_inherited_background_task(self):
        client, unrelated = object(), object()
        data = [[["/contrib_service/ttl_1d/synthetic"], "0.weba"]]
        with native_audio_transport(client, [Path("0.weba")], ["audio/webm"]):
            self.assertIs(adapt_req_file_data(unrelated, data), data)
            async def background():
                return adapt_req_file_data(client, data)
            self.assertIs(await asyncio.create_task(background()), data)
        self.assertIs(adapt_req_file_data(client, data), data)

    async def test_cancellation_releases_owner_before_next_consumer(self):
        client = object()
        entered = asyncio.Event()
        cleaned = []
        async def work():
            try:
                with native_audio_transport(client, [Path("0.weba")], ["audio/webm"]):
                    entered.set()
                    self.assertTrue(native_audio_scope_active(client))
                    await asyncio.Event().wait()
            finally:
                cleaned.append(not native_audio_scope_active(client))
        task = asyncio.create_task(work())
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(cleaned, [True])
        self.assertFalse(native_audio_scope_active(client))

    async def test_rewrite_is_nonmutating_and_diagnostics_never_export_file_identifiers(self):
        client = object()
        name = "PRIVATE_NAME.weba"
        data = [[["/contrib_service/ttl_1d/PRIVATE_REFERENCE"], name]]
        baseline = json.dumps(data)
        trace = SimpleNamespace(audio_transport=new_audio_transport_diagnostic())
        with native_audio_transport(client, [Path(name)], ["audio/webm"]):
            transformed = adapt_req_file_data(client, data, trace)
        self.assertEqual(json.dumps(data), baseline)
        self.assertIsNot(transformed, data)
        self.assertNotIn("PRIVATE", json.dumps(trace.audio_transport))

    async def test_future_opaque_reference_is_preserved_without_namespace_assumption(self):
        client = object()
        data = [[["future-opaque-upload-reference"], "0.weba"]]
        with native_audio_transport(client, [Path("0.weba")], ["audio/webm"]):
            transformed = adapt_req_file_data(client, data)
        self.assertEqual(transformed, [[["future-opaque-upload-reference", 4, None, "audio/webm"], "0.weba"]])
