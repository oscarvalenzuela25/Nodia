"""Contract/gating/file lifetime regressions, entirely synthetic."""
import base64
import asyncio
import hashlib
import test_support
import mimetypes
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from attachment_inspector import AttachmentInspector, AttachmentInspection
from native_attachments import NativeAttachment, materialize, attachment_digest, probe_answer_hash, NativeAttachmentProofs
from native_mcp_sessions import NativeMcpSessions, McpChatRequest
from nodia_ai_chat import ChatAdapter, ChatRequest, AttachmentProbeRequest, ObserveRequest, parse_reply, Answer
from profile_admission import ProfileAdmission
from service_errors import ServiceError
from nodia_ai_tool_gate import file_decision
from native_mcp_stdio import gate_detail


def file_input(content=b"synthetic file"):
    return {"kind": "image", "media_type": "image/png", "sha256": hashlib.sha256(content).hexdigest(), "content_base64": base64.b64encode(content).decode()}


class NativeAttachmentTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.root = Path(self.directory)
        self.inspector = AttachmentInspector(self.root / "files")
        self.inspector.decode = AsyncMock(return_value=AttachmentInspection(media_type="image/png", page_count=None, duration_seconds=None))
        self.profiles = ProfileAdmission(self.root / "agentic", self.root / "state")
        self.agentic = test_support.fake_agentic()
        self.agentic.get_status.return_value["has_active_session"] = True
        self.adapter = ChatAdapter(self.agentic, self.profiles, self.inspector)
        self.adapter.agentic_answer = AsyncMock(return_value=Answer(kind="answer", text="synthetic marker"))

    def request(self, probe=False, **changes):
        value = {"attempt_id": str(uuid4()), "model_id": "fixture-model", "effort_id": None,
            "canonical_prompt": "Do not copy expected answer from here", "resource_key": self.profiles.identity("agentic"),
            "session_generation": "a" * 32, "configuration_generation": "b" * 64, "timeout_seconds": 5,
            "attachments": [file_input()], **changes}
        if probe:
            value["expected_answer_sha256"] = hashlib.sha256(b"synthetic marker").hexdigest()
        return (AttachmentProbeRequest if probe else ChatRequest).model_validate(value)

    async def test_unverified_mode_kind_never_decodes_or_dispatches(self):
        with self.assertRaises(ServiceError) as raised:
            await self.adapter.execute("agentic", self.request())
        self.assertEqual(raised.exception.code, "attachment_adapter_unverified")
        self.inspector.decode.assert_not_awaited()
        self.adapter.agentic_answer.assert_not_awaited()

    async def test_hash_mismatch_is_before_dispatch_and_files_are_cleaned(self):
        item = NativeAttachment.model_validate({**file_input(), "sha256": "0" * 64})
        with self.assertRaises(ServiceError):
            async with materialize([item], self.inspector):
                self.fail("Invalid hash reached inference")
        self.inspector.decode.assert_not_awaited()
        self.assertEqual(list(self.inspector.directory.iterdir()), [])

    async def test_shared_native_bytes_fail_fast_and_release_after_cancellation(self):
        item = NativeAttachment.model_validate(file_input())
        with self.inspector.reserve_native_bytes(40 * 1024 * 1024):
            with self.assertRaises(ServiceError) as raised:
                async with materialize([item], self.inspector):
                    self.fail("Saturated native staging admitted")
            self.assertEqual(raised.exception.code, "service_busy")
            self.inspector.decode.assert_not_awaited()
            self.assertEqual(list(self.inspector.directory.iterdir()), [])
        self.assertEqual(self.inspector.native_bytes, 0)
        with self.assertRaises(asyncio.CancelledError):
            async with materialize([item], self.inspector):
                self.assertEqual(self.inspector.native_bytes, len(b"synthetic file"))
                raise asyncio.CancelledError()
        self.assertEqual(self.inspector.native_bytes, 0)
        self.assertEqual(list(self.inspector.directory.iterdir()), [])

    async def test_noncanonical_base64_and_kind_mismatch_are_rejected(self):
        for changes in ({"content_base64": "Zg==AAAA"}, {"media_type": "image/jpeg"}):
            item = NativeAttachment.model_validate({**file_input(), **changes})
            with self.assertRaises(ServiceError):
                async with materialize([item], self.inspector):
                    self.fail("Invalid file reached inference")
        self.assertEqual(list(self.inspector.directory.iterdir()), [])




    async def test_probe_verifies_semantics_then_exact_native_channel_works(self):
        probe = self.request(probe=True)
        seen = []
        async def generate(request, prompt, paths, **options):
            self.assertNotIn(probe.canonical_prompt, prompt)
            self.assertNotIn(probe.expected_answer_sha256, prompt)
            path = paths[0]
            self.assertTrue(path.is_file())
            self.assertEqual(path.read_bytes(), b"synthetic file")
            seen.append(path)
            return Answer(kind="answer", text="synthetic marker")
        self.adapter.agentic_answer.side_effect = generate
        await self.adapter.probe_attachments(probe)
        self.assertTrue(self.adapter.attachment_proofs.supports("agentic", probe, "image"))
        self.assertFalse(seen[0].exists())
        proof = self.adapter.ledger.read(probe.attempt_id)
        self.assertEqual(proof.input_digest, hashlib.sha256((attachment_digest(probe.attachments) + ":nodia-ai-native-attachments/4:literal").encode()).hexdigest())
        request = self.request()
        self.adapter.agentic_answer.side_effect = None
        await self.adapter.execute("agentic", request)
        self.assertEqual(self.adapter.agentic_answer.await_count, 2)
        self.assertEqual(list(self.inspector.directory.iterdir()), [])
        for changes in ({"configuration_generation": "c" * 64}, {"model_id": "other-model"}, {"effort_id": "high"}):
            with self.assertRaises(ServiceError):
                await self.adapter.execute("agentic", self.request(**changes))

    async def test_wrong_canary_answer_keeps_receipt_but_never_enables_modality(self):
        probe = self.request(probe=True)
        self.adapter.agentic_answer.return_value = Answer(kind="answer", text="wrong")
        await self.adapter.probe_attachments(probe)
        self.assertFalse(self.adapter.attachment_proofs.supports("agentic", probe, "image"))
        self.assertEqual(self.adapter.ledger.read(probe.attempt_id).state, "completed")

    async def test_wav_success_never_authorizes_webm_or_unproved_image_mime(self):
        for kind, proved, unproved in (("audio", "audio/wav", "audio/webm"),
                ("image", "image/png", "image/jpeg")):
            with self.subTest(kind=kind):
                self.adapter.attachment_proofs = NativeAttachmentProofs()
                self.inspector.decode.return_value = AttachmentInspection(media_type=proved,
                    page_count=None, duration_seconds=1.0 if kind == "audio" else None)
                attachment = {**file_input(), "kind": kind, "media_type": proved}
                probe = self.request(probe=True, attachments=[attachment])
                await self.adapter.probe_attachments(probe)
                observation = await self.adapter.observe("agentic", ObserveRequest(model_id="fixture-model",
                    effort_id=None, configuration_generation="b" * 64))
                self.assertEqual(observation["verified_modalities"], [kind])
                self.assertEqual(observation["verified_attachment_media_types"], [proved])
                self.assertTrue(self.adapter.attachment_proofs.supports("agentic", probe, kind, proved))
                self.assertFalse(self.adapter.attachment_proofs.supports("agentic", probe, kind, unproved))
                self.inspector.decode.reset_mock()
                self.adapter.agentic_answer.reset_mock()
                with self.assertRaises(ServiceError) as raised:
                    await self.adapter.execute("agentic", self.request(attachments=[{**attachment, "media_type": unproved}]))
                self.assertEqual(raised.exception.code, "attachment_adapter_unverified")
                self.inspector.decode.assert_not_awaited()
                self.adapter.agentic_answer.assert_not_awaited()
                await self.adapter.execute("agentic", self.request(attachments=[attachment]))
                self.adapter.agentic_answer.assert_awaited_once()

    async def test_failed_mime_probe_does_not_inherit_another_successful_format(self):
        self.inspector.decode.return_value = AttachmentInspection(media_type="audio/wav", page_count=None, duration_seconds=1.0)
        wav = {**file_input(), "kind": "audio", "media_type": "audio/wav"}
        await self.adapter.probe_attachments(self.request(probe=True, attachments=[wav]))
        self.inspector.decode.return_value = AttachmentInspection(media_type="audio/webm", page_count=None, duration_seconds=1.0)
        self.adapter.agentic_answer.return_value = Answer(kind="answer", text="wrong")
        webm = self.request(probe=True, attachments=[{**wav, "media_type": "audio/webm"}])
        await self.adapter.probe_attachments(webm)
        self.assertEqual(self.adapter.ledger.read(webm.attempt_id).state, "completed")
        self.assertTrue(self.adapter.attachment_proofs.supports("agentic", webm, "audio"))
        self.assertEqual(self.adapter.attachment_proofs.media_types("agentic", webm), ["audio/wav"])
        self.assertFalse(self.adapter.attachment_proofs.supports("agentic", webm, "audio", "audio/webm"))

    async def test_mcp_rejects_unverified_mime_before_reservation_or_dispatch(self):
        request = McpChatRequest.model_validate({**self.request(attachments=[{
            **file_input(), "kind": "audio", "media_type": "audio/webm"}]).model_dump(),
            "tools": [{"name": "fixture_read", "description": "Synthetic read", "input_schema": {
                "type": "object", "properties": {}, "additionalProperties": False}}]})
        self.adapter.verify_attachment_runtime = Mock()
        self.adapter.attachment_proofs.mark("agentic", request, "audio", "audio/wav")
        with self.assertRaises(ServiceError) as raised:
            await NativeMcpSessions(self.adapter).start(request)
        self.assertEqual(raised.exception.code, "attachment_adapter_unverified")
        self.assertEqual(self.adapter.attempts, set())
        self.assertEqual(self.adapter.active_attempts, {})

    def test_modality_proof_never_crosses_mime_kind_or_selection(self):
        proofs = NativeAttachmentProofs()
        request = self.request()
        proofs.mark("agentic", request, "image", "image/png")
        for engine, changes, kind, media_type in (("retired", {}, "image", "image/png"),
                ("agentic", {"resource_key": "gemini-profile:" + "c" * 64}, "image", "image/png"),
                ("agentic", {"session_generation": "c" * 32}, "image", "image/png"),
                ("agentic", {"configuration_generation": "c" * 64}, "image", "image/png"),
                ("agentic", {"model_id": "other-fixture"}, "image", "image/png"),
                ("agentic", {"effort_id": "high"}, "image", "image/png"),
                ("agentic", {}, "image", "image/webp"), ("agentic", {}, "pdf", "image/png")):
            self.assertFalse(proofs.supports(engine, request.model_copy(update=changes), kind, media_type))
        with self.assertRaises(ServiceError):
            proofs.mark("agentic", request, "audio", "image/png")
        self.assertEqual(proofs.media_types("agentic", request), ["image/png"])

    async def test_generation_failure_cleans_files_and_preserves_unknown_no_retry(self):
        probe = self.request(probe=True)
        self.adapter.agentic_answer.side_effect = TimeoutError()
        with self.assertRaises(ServiceError):
            await self.adapter.probe_attachments(probe)
        self.assertEqual(self.adapter.agentic_answer.await_count, 1)
        self.assertEqual(list(self.inspector.directory.iterdir()), [])
        self.assertEqual(self.adapter.ledger.read(probe.attempt_id).state, "abandoned_unknown")
        self.assertFalse(self.adapter.attachment_proofs.verified)

    def test_cli_hooks_allow_only_exact_generated_files_and_no_business_privilege(self):
        document = self.root / "attachment.png"
        document.write_bytes(b"synthetic")
        other = self.root / "unrelated-secret.txt"
        other.write_text("synthetic secret")
        allowed = {"toolCall": {"name": "view_file", "args": {"AbsolutePath": str(document.resolve())}}}
        self.assertEqual(file_decision(allowed, [str(document.resolve())]), ("attachment_0", True))
        self.assertEqual(gate_detail(allowed, {"fixture_read"}, [str(document.resolve())])[:2], ("attachment_0", True))
        for payload in ({"toolCall": {"name": "view_file", "args": {"AbsolutePath": str(other.resolve())}}}, {"toolCall": {"name": "run_command", "args": {"CommandLine": "synthetic"}}}, {"toolCall": {"name": "read_url", "args": {"Url": "https://invalid.example"}}}):
            self.assertFalse(file_decision(payload, [str(document.resolve())])[1])
            self.assertFalse(gate_detail(payload, {"fixture_read"}, [str(document.resolve())])[1])
        # A document-read grant never adds MCP operation names or confirmation.
        self.assertFalse(file_decision({"toolCall": {"name": "call_mcp_tool", "args": {}}}, [str(document.resolve())])[1])
        self.assertFalse(gate_detail({"toolCall": {"name": "confirm", "args": {}}}, {"fixture_read"}, [str(document.resolve())])[1])

    def test_json_presentation_fences_remain_strict_structured_answers(self):
        for prefix, newline in (("json", "\n"), ("JSON", "\r\n"), ("", "\n")):
            raw = '```'+prefix+newline+'{"kind":"answer","text":"synthetic"}'+newline+'```'
            self.assertEqual(parse_reply(raw, "agentic").text, "synthetic")
        for raw in ('synthetic', 'prefix {"kind":"answer","text":"synthetic"}', '```python\n{"kind":"answer","text":"synthetic"}\n```', '{"kind":"answer","text":"synthetic","execute":true}'):
            with self.assertRaises(ValueError):
                parse_reply(raw, "agentic")

    def test_speech_probe_normalization_preserves_every_word_and_number(self):
        expected = probe_answer_hash("The purple lantern is seven.", "speech_words_v1")
        self.assertEqual(expected, probe_answer_hash("THE  purple lantern is seven!", "speech_words_v1"))
        self.assertNotEqual(expected, probe_answer_hash("The purple lantern is six.", "speech_words_v1"))
        self.assertNotEqual(expected, probe_answer_hash("The lantern is seven.", "speech_words_v1"))
        self.assertNotEqual(probe_answer_hash("seven 12", "speech_words_v1"), probe_answer_hash("seven 13", "speech_words_v1"))


if __name__ == "__main__":
    unittest.main()
