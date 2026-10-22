"""Synthetic decoder fixtures; no provider session or external request."""
import asyncio
import io
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from attachment_inspector import AttachmentInspection, AttachmentInspector
from attachment_inspector_worker import InvalidAttachment, inspect
from service_errors import ServiceError
from unittest.mock import AsyncMock
from test_support import AppTestCase, HEADERS


class AttachmentDecoderTests(unittest.TestCase):
    def setUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.path = Path(self.directory) / "content"

    def test_images_are_fully_decoded_and_metadata_stays_unknown(self):
        from PIL import Image
        for fmt, mime in (("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")):
            with self.subTest(format=fmt):
                Image.new("RGB", (4, 4), "blue").save(self.path, format=fmt)
                self.assertEqual(inspect(self.path, "image"), {"media_type": mime, "page_count": None, "duration_seconds": None, "extracted_text": None})

    def test_truncated_image_and_oversized_pixels_are_rejected(self):
        from PIL import Image
        Image.new("RGB", (4001, 3000)).save(self.path, format="PNG")
        with self.assertRaises(InvalidAttachment):
            inspect(self.path, "image")
        Image.new("RGB", (50, 50)).save(self.path, format="JPEG")
        self.path.write_bytes(self.path.read_bytes()[:-30])
        with self.assertRaises(Exception):
            inspect(self.path, "image")

    def test_pdf_pages_encryption_and_active_document_actions(self):
        from pypdf import PdfWriter
        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        writer.write(self.path)
        self.assertEqual(inspect(self.path, "pdf"), {"media_type": "application/pdf", "page_count": 1, "duration_seconds": None, "extracted_text": None})
        writer.encrypt("synthetic-password")
        writer.write(self.path)
        with self.assertRaises(InvalidAttachment):
            inspect(self.path, "pdf")
        writer = PdfWriter()
        for _ in range(101):
            writer.add_blank_page(width=72, height=72)
        writer.write(self.path)
        with self.assertRaises(InvalidAttachment):
            inspect(self.path, "pdf")
        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        writer.add_js("app.alert('ignored synthetic action');")
        writer.write(self.path)
        with self.assertRaises(InvalidAttachment):
            inspect(self.path, "pdf")

    def test_audio_uses_decoded_samples_not_declared_client_duration(self):
        with wave.open(str(self.path), "wb") as output:
            output.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
            output.writeframes(b"\x00\x00" * 8000)
        result = inspect(self.path, "audio")
        self.assertEqual(result, {"media_type": "audio/wav", "page_count": None, "duration_seconds": 1.0, "extracted_text": None})
        with wave.open(str(self.path), "wb") as output:
            output.setparams((1, 1, 8000, 0, "NONE", "not compressed"))
            output.writeframes(b"\x80" * 8000 * 301)
        with self.assertRaises(InvalidAttachment):
            inspect(self.path, "audio")

    def test_fake_audio_and_pdf_are_rejected(self):
        for kind, value in (("audio", b"RIFF\x00\x00\x00\x00WAVEgarbage"), ("pdf", b"%PDF-1.7\ngarbage")):
            self.path.write_bytes(value)
            with self.subTest(kind=kind), self.assertRaises(Exception):
                inspect(self.path, kind)

    def test_invalid_cross_field_metadata_never_looks_successful(self):
        for value in ({"media_type": "audio/wav", "page_count": None, "duration_seconds": None}, {"media_type": "application/pdf", "page_count": None, "duration_seconds": None}, {"media_type": "image/png", "page_count": 1, "duration_seconds": None}):
            with self.assertRaises(ValueError):
                AttachmentInspection.model_validate(value)


class AttachmentReceiverTests(unittest.IsolatedAsyncioTestCase):
    async def test_oversized_chunked_body_cleans_temporary_file_and_slot(self):
        class Request:
            headers = {"x-nodia-attachment-kind": "audio", "content-type": "application/octet-stream"}
            async def stream(self):
                yield b"x" * 10
                yield b"x" * (20 * 1024 * 1024)
        with tempfile.TemporaryDirectory() as name:
            inspector = AttachmentInspector(Path(name))
            with self.assertRaises(ServiceError) as raised:
                await inspector.receive(Request())
            self.assertEqual(raised.exception.code, "attachment_too_large")
            self.assertFalse(inspector.slots.locked())
            self.assertEqual(list(Path(name).iterdir()), [])

    async def test_saturation_does_not_receive_body_or_create_files(self):
        class Request:
            headers = {"x-nodia-attachment-kind": "audio", "content-type": "application/octet-stream"}
            async def stream(self):
                raise AssertionError("body must not be read")
                yield b""
        with tempfile.TemporaryDirectory() as name:
            inspector = AttachmentInspector(Path(name))
            await inspector.slots.acquire()
            await inspector.slots.acquire()
            with self.assertRaises(ServiceError) as raised:
                await inspector.receive(Request())
            self.assertEqual(raised.exception.code, "service_busy")
            self.assertEqual(list(Path(name).iterdir()), [])
            inspector.slots.release()
            inspector.slots.release()

    async def test_unsupported_os_fails_closed_before_subprocess(self):
        inspector = AttachmentInspector(Path("unused"))
        with patch("attachment_inspector.sys.platform", "win32"):
            with self.assertRaises(ServiceError) as raised:
                await inspector.decode(Path("unused"), "audio")
            self.assertEqual(raised.exception.code, "parser_isolation_unavailable")


class AttachmentEndpointTests(AppTestCase):
    def test_service_identity_required_before_decoding_or_body_processing(self):
        decoder = AsyncMock()
        self.app.state.attachment_inspector.decode = decoder
        for headers in ({}, {"X-Nodia-Service-Token": "00" * 32}):
            response = self.client.post("/attachments/inspect", content=b"synthetic", headers={**headers, "X-Nodia-Attachment-Kind": "image", "Content-Type": "application/octet-stream"})
            self.assertEqual(response.status_code, 401)
        decoder.assert_not_awaited()
        self.assertEqual(list(Path(self.directory).iterdir()), [])

    def test_private_endpoint_returns_only_decoded_metadata_and_cleans_temp(self):
        decoder = AsyncMock(return_value=AttachmentInspection(media_type="audio/wav", page_count=None, duration_seconds=1.0))
        self.app.state.attachment_inspector.decode = decoder
        response = self.client.post("/attachments/inspect", content=b"synthetic", headers={**HEADERS, "X-Nodia-Attachment-Kind": "audio", "Content-Type": "application/octet-stream"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"media_type": "audio/wav", "page_count": None, "duration_seconds": 1.0, "extracted_text": None})
        self.assertEqual(decoder.await_count, 1)
        self.assertEqual(list(Path(self.directory).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
