"""Synthetic local files and fake CLI only; no account, network or generation."""
import test_support
import asyncio
import base64
from hashlib import sha256, sha512
import io
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from PIL import Image
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from attachment_inspector import AttachmentInspector
from native_attempts import AcknowledgeAttempt, ReconcileAttempt
from agentic_cli import CliConfig
from agentic_service import AntigravityAgentService
from native_image_generation import (AGENT, ImageAnswer, ImageTurnRequest, NativeImageGeneration,
    ImageCliDiagnostics, collect_image, generate_core, image_hook, register_native_image_routes)
from nodia_ai_chat import ChatAdapter, ObserveRequest
from profile_admission import ProfileAdmission
from request_guard import PrivateRequestGuard
from service_errors import ServiceError


class ImageFileTests(unittest.TestCase):
    def test_diagnostics_are_closed_and_do_not_retain_payload_or_paths(self):
        trace = ImageCliDiagnostics("fixture-discovered")
        events = [
            {"event": "init", "init": {"model": "fixture-discovered", "agent": AGENT, "secret": "PRIVATE"}},
            {"event": "step_update", "step_update": {"tool_name": "generate_image", "args": "PRIVATE"}},
            {"event": "result", "result": {"status": "ERROR", "error": "PRIVATE permission denied /private/file"}},
        ]
        raw = b"not-json\n" + b"\n".join(json.dumps(item).encode() for item in events) + b"\n"
        trace.feed(raw[:20]); trace.feed(raw[20:])
        self.assertEqual(trace.values["init_count"], 1)
        self.assertEqual(trace.values["result_count"], 1)
        self.assertEqual(trace.values["result_status"], "ERROR")
        self.assertTrue(trace.values["model_matches"] and trace.values["agent_matches"])
        self.assertTrue(trace.values["generate_image_seen"])
        self.assertEqual(trace.values["result_error_categories"], ["permission"])
        self.assertNotIn("PRIVATE", json.dumps(trace.values))
        self.assertNotIn("/private", json.dumps(trace.values))

    def test_diagnostic_oversized_lines_and_unknown_status_fail_closed(self):
        trace = ImageCliDiagnostics("fixture")
        trace.feed(b"x" * 65537)
        trace.feed(b'\n{"event":"result","result":{"status":{"private":"value"}}}\n')
        self.assertEqual(trace.values["result_status"], "other")
        self.assertEqual(trace.values["result_count"], 1)
        self.assertIsNone(trace.values["model_matches"])

    def test_private_route_auth_and_body_limit_before_provider_work(self):
        application = FastAPI()
        application.add_middleware(PrivateRequestGuard)
        register_native_image_routes(application)
        core = AsyncMock()
        application.state.image_generation = SimpleNamespace(execute=core)
        with patch.dict(os.environ, {"GEMINI_SERVICE_TOKEN": "ab" * 32}), TestClient(application) as client:
            self.assertEqual(client.post("/nodia-ai/agentic/image/turn", json={}).status_code, 401)
            self.assertEqual(client.post("/nodia-ai/agentic/image/turn", json={},
                headers={"X-Nodia-Service-Token": "bad"}).status_code, 401)
            self.assertEqual(client.post("/nodia-ai/agentic/attempts/" + str(uuid4()) + "/image/cancel",
                json={}).status_code, 401)
            response = client.post("/nodia-ai/agentic/image/turn", content=b"x" * 65537,
                headers={"X-Nodia-Service-Token": "ab" * 32})
            self.assertEqual(response.status_code, 413)
            self.assertEqual(client.post("/nodia-ai/agentic/image/turn", json={},
                headers={"X-Nodia-Service-Token": "ab" * 32}).status_code, 422)
        core.assert_not_awaited()

    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.home = self.root / "profile"
        self.receipts = self.root / "receipts"
        self.receipts.mkdir()
        self.conversation = str(uuid4())
        self.directory = self.home / ".gemini/antigravity-cli/brain" / self.conversation
        self.directory.mkdir(parents=True)
        self.name = "nodia_generated_" + uuid4().hex
        self.payload = {"conversationId": self.conversation, "artifactDirectoryPath": str(self.directory),
            "toolCall": {"name": "generate_image", "args": {"Prompt": "Synthetic blue square", "ImageName": self.name}}}

    def generate(self):
        self.assertTrue(image_hook(self.payload, self.home, self.receipts, self.name, "pre"))
        self.assertTrue(image_hook(self.payload, self.home, self.receipts, self.name, "post"))
        stream = io.BytesIO()
        Image.new("RGB", (2, 2), "blue").save(stream, format="PNG")
        path = self.directory / (self.name + "_1.png")
        path.write_bytes(stream.getvalue())
        return path

    def test_one_verified_image_and_no_prompt_in_receipts(self):
        path = self.generate()
        result = collect_image(self.home, self.receipts, self.name)
        self.assertEqual(base64.b64decode(result.content_base64), path.read_bytes())
        self.assertEqual(result.sha256, sha256(path.read_bytes()).hexdigest())
        self.assertEqual(result.media_type, "image/png")
        self.assertNotIn("Synthetic", "".join(p.read_text() for p in self.receipts.iterdir()))
        with self.assertRaises(FileExistsError):
            image_hook(self.payload, self.home, self.receipts, self.name, "pre")

    def test_other_tools_imagepaths_wrong_name_and_outside_home_rejected(self):
        for change in ({"name": "command", "args": {}},
                       {"name": "generate_image", "args": {**self.payload["toolCall"]["args"], "ImagePaths": ["private-reference"]}},
                       {"name": "generate_image", "args": {"Prompt": "x", "ImageName": "other"}}):
            self.assertFalse(image_hook({**self.payload, "toolCall": change}, self.home, self.receipts, self.name, "pre"))
        with self.assertRaises(ValueError):
            image_hook({**self.payload, "artifactDirectoryPath": str(self.root)}, self.home, self.receipts, self.name, "pre")

    def test_first_hook_denial_is_exclusive_closed_and_references_rejected(self):
        changed = {**self.payload, "toolCall": {"name": "generate_image", "args": {
            **self.payload["toolCall"]["args"], "ImagePaths": ["private-reference"]}}}
        self.assertFalse(image_hook(changed, self.home, self.receipts, self.name, "pre"))
        first = (self.receipts / "first-denial.json").read_bytes()
        self.assertEqual(json.loads(first), {"reason": "references", "phase": "pre"})
        self.assertFalse(image_hook({"toolCall": {"name": "private_untrusted_tool"}}, self.home, self.receipts, self.name, "pre"))
        self.assertEqual((self.receipts / "first-denial.json").read_bytes(), first)
        self.assertNotIn(b"private", first)
        self.assertFalse((self.receipts / "generation.json").exists())

    def test_omitted_and_empty_imagepaths_both_allow_one_real_image_and_finish(self):
        for index, extra in enumerate(({}, {"ImagePaths": []})):
            with self.subTest(extra=extra):
                receipts = self.root / ("receipt-case-" + str(index)); receipts.mkdir()
                payload = {**self.payload, "toolCall": {"name": "generate_image", "args": {
                    **self.payload["toolCall"]["args"], **extra}}}
                self.assertTrue(image_hook(payload, self.home, receipts, self.name, "pre"))
                Image.new("RGB", (2, 2)).save(self.directory / (self.name + ".png"))
                self.assertTrue(image_hook(payload, self.home, receipts, self.name, "post"))
                self.assertTrue(image_hook({"toolCall": {"name": "finish"}}, self.home, receipts, self.name, "pre"))
                result = collect_image(self.home, receipts, self.name)
                self.assertEqual(result.media_type, "image/png")
                self.assertFalse((receipts / "first-denial.json").exists())

    def test_argument_denial_subtypes_never_retain_values_or_allow_references(self):
        cases = [({"Extra": "private-value"}, "args_keys"), ({"Prompt": " "}, "prompt"),
            ({"Prompt": "😀" * 2001}, "prompt"), ({"ImageName": "private-name"}, "image_name")]
        cases += [({"ImagePaths": value}, "references") for value in
            (["private-path"], [None], None, "private-url", {}, False, 0)]
        for index, (change, expected) in enumerate(cases):
            with self.subTest(expected=expected, index=index):
                receipts = self.root / ("denial-case-" + str(index)); receipts.mkdir()
                payload = {**self.payload, "toolCall": {"name": "generate_image", "args": {
                    **self.payload["toolCall"]["args"], **change}}}
                self.assertFalse(image_hook(payload, self.home, receipts, self.name, "pre"))
                receipt = (receipts / "first-denial.json").read_text()
                self.assertEqual(json.loads(receipt), {"reason": expected, "phase": "pre"})
                self.assertNotIn("private", receipt)
                self.assertFalse((receipts / "generation.json").exists())

    def test_sdk_annotations_are_bounded_inert_and_do_not_expand_image_authority(self):
        annotations = ({}, {"toolAction": None, "toolSummary": None},
            {"toolAction": "private action", "toolSummary": "😀" * 512})
        for index, annotation in enumerate(annotations):
            with self.subTest(index=index):
                receipts = self.root / ("annotations-" + str(index)); receipts.mkdir()
                payload = {**self.payload, "toolCall": {"name": "generate_image", "args": {
                    **self.payload["toolCall"]["args"], "ImagePaths": [], **annotation}}}
                self.assertTrue(image_hook(payload, self.home, receipts, self.name, "pre"))
                self.assertTrue(image_hook(payload, self.home, receipts, self.name, "post"))
                self.assertNotIn("private action", "".join(p.read_text() for p in receipts.iterdir()))
                binding = json.loads((receipts / "generation.json").read_text())
                self.assertEqual(binding["image_name"], self.name)
                self.assertNotIn("toolAction", binding)
        for index, value in enumerate((["private"], {}, 0, False, "x" * 2049, "😀" * 513)):
            receipts = self.root / ("bad-annotation-" + str(index)); receipts.mkdir()
            payload = {**self.payload, "toolCall": {"name": "generate_image", "args": {
                **self.payload["toolCall"]["args"], "toolAction": value}}}
            self.assertFalse(image_hook(payload, self.home, receipts, self.name, "pre"))
            self.assertEqual(json.loads((receipts / "first-denial.json").read_text())["reason"], "annotations")
            self.assertFalse((receipts / "generation.json").exists())

    def test_sdk_aspect_ratio_is_optional_or_bounded_geometry_with_real_image_collection(self):
        for index, extra in enumerate(({}, {"AspectRatio": ""}, {"AspectRatio": "1:1"},
                                       {"AspectRatio": "16:9"}, {"AspectRatio": "9:16"})):
            with self.subTest(index=index):
                receipts = self.root / ("ratio-" + str(index)); receipts.mkdir()
                payload = {**self.payload, "toolCall": {"name": "generate_image", "args": {
                    **self.payload["toolCall"]["args"], "ImagePaths": [], "toolSummary": "Synthetic", **extra}}}
                self.assertTrue(image_hook(payload, self.home, receipts, self.name, "pre"))
                Image.new("RGB", (2, 2)).save(self.directory / (self.name + ".png"))
                self.assertTrue(image_hook(payload, self.home, receipts, self.name, "post"))
                self.assertTrue(image_hook({"toolCall": {"name": "finish"}}, self.home, receipts, self.name, "pre"))
                self.assertEqual(collect_image(self.home, receipts, self.name).media_type, "image/png")
                shape = json.loads((receipts / "first-argument-shape.json").read_text())
                self.assertEqual(shape["known_key_presence"]["AspectRatio"], "AspectRatio" in extra)
                self.assertEqual(shape["unknown_key_count"], 0)

    def test_bad_aspect_ratios_and_other_unknown_fields_do_not_arm_generation(self):
        for index, value in enumerate((None, 1, False, [], {}, "0:1", "1:0", "01:1", "16/9",
                                       "16:9 ", "10000:1", "https://private.invalid", "1:1\n")):
            receipts = self.root / ("bad-ratio-" + str(index)); receipts.mkdir()
            payload = {**self.payload, "toolCall": {"name": "generate_image", "args": {
                **self.payload["toolCall"]["args"], "AspectRatio": value}}}
            self.assertFalse(image_hook(payload, self.home, receipts, self.name, "pre"))
            self.assertEqual(json.loads((receipts / "first-denial.json").read_text())["reason"], "aspect_ratio")
            self.assertFalse((receipts / "generation.json").exists())
        payload = {**self.payload, "toolCall": {"name": "generate_image", "args": {
            **self.payload["toolCall"]["args"], "AspectRatio": "1:1", "ModelName": "private-model"}}}
        self.assertFalse(image_hook(payload, self.home, self.receipts, self.name, "pre"))
        self.assertEqual(json.loads((self.receipts / "first-denial.json").read_text())["reason"], "args_keys")

    def test_first_argument_shape_exposes_only_known_presence_and_unknown_count(self):
        args = {**self.payload["toolCall"]["args"], "ImagePaths": [], "toolAction": "private annotation",
                "private_unknown_name": "private secret", "prompt": "private alias"}
        payload = {**self.payload, "toolCall": {"name": "generate_image", "args": args}}
        self.assertFalse(image_hook(payload, self.home, self.receipts, self.name, "pre"))
        path = self.receipts / "first-argument-shape.json"
        original = path.read_bytes(); shape = json.loads(original)
        self.assertTrue(shape["arguments_object"])
        self.assertEqual(shape["unknown_key_count"], 1)
        self.assertTrue(shape["known_key_presence"]["toolAction"])
        self.assertTrue(shape["known_key_presence"]["prompt"])
        self.assertFalse(shape["known_key_presence"]["toolSummary"])
        self.assertNotIn(b"private", original)
        image_hook(self.payload, self.home, self.receipts, self.name, "pre")
        self.assertEqual(path.read_bytes(), original)

    def test_invalid_conversation_is_classified_without_retaining_its_value(self):
        self.assertFalse(image_hook({**self.payload, "conversationId": "private-not-a-uuid"}, self.home, self.receipts, self.name, "pre"))
        self.assertEqual(json.loads((self.receipts / "first-denial.json").read_bytes()), {"reason": "conversation", "phase": "pre"})

    def test_finish_requires_generation_success_and_is_single_use(self):
        finish = {"toolCall": {"name": "finish"}}
        self.assertFalse(image_hook(finish, self.home, self.receipts, self.name, "pre"))
        self.generate()
        self.assertTrue(image_hook(finish, self.home, self.receipts, self.name, "pre"))
        with self.assertRaises(FileExistsError):
            image_hook(finish, self.home, self.receipts, self.name, "pre")

    def test_error_not_a_generated_image(self):
        image_hook(self.payload, self.home, self.receipts, self.name, "pre")
        image_hook({**self.payload, "error": "private error must not be copied"}, self.home, self.receipts, self.name, "post")
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name)
        self.assertNotIn("private", (self.receipts / "generated.json").read_text())

    def test_post_error_absent_null_and_exact_empty_string_allow_finish_and_real_image(self):
        for index, (extra, expected) in enumerate((({}, "absent"), ({"error": None}, "null"),
                                                  ({"error": ""}, "empty_string"))):
            with self.subTest(expected=expected):
                receipts = self.root / ("post-success-" + str(index)); receipts.mkdir()
                self.assertTrue(image_hook(self.payload, self.home, receipts, self.name, "pre"))
                Image.new("RGB", (2, 2)).save(self.directory / (self.name + ".png"))
                self.assertTrue(image_hook({**self.payload, **extra}, self.home, receipts, self.name, "post"))
                post = json.loads((receipts / "generated.json").read_text())
                self.assertFalse(post["error_present"])
                self.assertEqual(post["error_kind"], expected)
                self.assertTrue(image_hook({"toolCall": {"name": "finish"}}, self.home, receipts, self.name, "pre"))
                self.assertEqual(collect_image(self.home, receipts, self.name).media_type, "image/png")

    def test_post_nonempty_error_and_every_other_type_still_deny_finish_and_collection(self):
        for index, value in enumerate(("private failure", " ", {}, [], False, 0)):
            receipts = self.root / ("post-error-" + str(index)); receipts.mkdir()
            image_hook(self.payload, self.home, receipts, self.name, "pre")
            Image.new("RGB", (2, 2)).save(self.directory / (self.name + ".png"))
            image_hook({**self.payload, "error": value}, self.home, receipts, self.name, "post")
            post = json.loads((receipts / "generated.json").read_text())
            self.assertTrue(post["error_present"])
            self.assertEqual(post["error_kind"], "nonempty_string" if isinstance(value, str) else "other")
            self.assertNotIn("private", json.dumps(post))
            self.assertFalse(image_hook({"toolCall": {"name": "finish"}}, self.home, receipts, self.name, "pre"))
            with self.assertRaises(ValueError):
                collect_image(self.home, receipts, self.name)

    def test_multiple_corrupt_or_nonimage_outputs_rejected(self):
        path = self.generate()
        second = path.with_name(self.name + "_2.png")
        second.write_bytes(path.read_bytes())
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name)
        second.unlink()
        path.write_bytes(b"https://not-an-image.invalid/result")
        with self.assertRaises((ValueError, OSError)):
            collect_image(self.home, self.receipts, self.name)

    def test_metadata_companion_is_not_an_image_candidate_and_diagnostics_are_closed(self):
        image = self.generate()
        companion = self.directory / (self.name + "_1.png.metadata.json")
        companion.write_text('{"private": "not an image"}')
        diagnostic = {}
        result = collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(base64.b64decode(result.content_base64), image.read_bytes())
        self.assertEqual(diagnostic["directory_entries_count"], 2)
        self.assertEqual(diagnostic["prefix_file_count"], 2)
        self.assertEqual(diagnostic["exact_prefix_candidate_count"], 1)
        self.assertEqual(diagnostic["image_type_count"], 1)
        self.assertEqual(diagnostic["filename_relation"], "owned_prefix")
        self.assertEqual(diagnostic["candidate_nlink"], 1)
        self.assertEqual(diagnostic["bounded_bytes"], image.stat().st_size)
        self.assertIsNone(diagnostic["collect_error"])
        self.assertNotIn(self.name, json.dumps(diagnostic))
        self.assertNotIn("metadata.json", json.dumps(diagnostic))
        self.assertNotIn("private", json.dumps(diagnostic))

    def test_second_image_even_other_name_and_corrupt_image_are_never_ignored(self):
        image = self.generate()
        second = self.directory / "private-other-name.png"
        second.write_bytes(image.read_bytes())
        diagnostic = {}
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(diagnostic["collect_error"], "image_count")
        self.assertEqual(diagnostic["image_type_count"], 2)
        second.unlink()
        image.write_bytes(b"not image bytes")
        with self.assertRaises((OSError, ValueError)):
            collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(diagnostic["collect_error"], "image_decode")

    def test_extensionless_image_is_not_silently_accepted_as_documented_output(self):
        image = self.generate(); image.rename(self.directory / self.name)
        diagnostic = {}
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(diagnostic["prefix_file_count"], 1)
        self.assertEqual(diagnostic["exact_prefix_candidate_count"], 0)
        self.assertEqual(diagnostic["collect_error"], "image_count")

    def test_actual_gif_or_multiframe_png_never_passes_by_filename_extension(self):
        path = self.generate()
        Image.new("RGB", (2, 2)).save(path, format="GIF")
        diagnostic = {}
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(diagnostic["collect_error"], "image_format")
        Image.new("RGB", (2, 2), "blue").save(path, format="PNG", save_all=True,
            append_images=[Image.new("RGB", (2, 2), "red")], duration=1)
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(diagnostic["collect_error"], "image_frames")

    def test_output_above_byte_limit_is_rejected_before_image_decode(self):
        path = self.generate()
        with path.open("wb") as output:
            output.truncate(16 * 1024 * 1024 + 1)
        diagnostic = {}
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(diagnostic["collect_error"], "file_size")
        self.assertIsNone(diagnostic["bounded_bytes"])

    def test_root_image_with_sdk_metadata_deeper_than_read_scope_passes(self):
        image = self.generate()
        deep = self.directory / "metadata/a/b/c/d/e/f"
        deep.mkdir(parents=True)
        (deep / "private-sdk-metadata.json").write_text('{"private":"not read"}')
        diagnostic = {}
        result = collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(base64.b64decode(result.content_base64), image.read_bytes())
        self.assertEqual(diagnostic["exact_prefix_candidate_count"], 1)
        self.assertEqual(diagnostic["image_type_count"], 1)
        self.assertIsNone(diagnostic["collect_error"])
        self.assertLessEqual(diagnostic["directory_entries_count"], 256)

    def test_image_outside_depth4_is_not_read_or_accepted(self):
        image = self.generate()
        deep = self.directory / "a/b/c/d"
        deep.mkdir(parents=True)
        image.rename(deep / image.name)  # five components from artifact root.
        diagnostic = {}
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(diagnostic["image_type_count"], 0)
        self.assertEqual(diagnostic["exact_prefix_candidate_count"], 0)
        self.assertIsNone(diagnostic["bounded_bytes"])
        self.assertEqual(diagnostic["collect_error"], "image_count")

    def test_second_image_at_depth4_is_still_rejected(self):
        image = self.generate()
        edge = self.directory / "a/b/c"
        edge.mkdir(parents=True)
        (edge / "second.png").write_bytes(image.read_bytes())
        diagnostic = {}
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name, diagnostic)
        self.assertEqual(diagnostic["image_type_count"], 2)
        self.assertEqual(diagnostic["collect_error"], "image_count")

    @unittest.skipIf(os.name == "nt", "POSIX hardlink/symlink security exercised on Linux")
    def test_symlink_and_hardlink_rejected(self):
        path = self.generate()
        outside = self.root / "outside.png"
        path.rename(outside)
        path.symlink_to(outside)
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name)
        path.unlink()
        os.link(outside, path)
        with self.assertRaises(ValueError):
            collect_image(self.home, self.receipts, self.name)


class ImageLifecycleTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        profiles = ProfileAdmission(self.root / "account", self.root / "state")
        self.agentic = SimpleNamespace(session_generation="b" * 32,
            runner=SimpleNamespace(_processes=set(), _spawns=set()))
        self.chat = ChatAdapter(self.agentic, profiles, AttachmentInspector(self.root / "files"))
        self.service = NativeImageGeneration(self.chat)
        self.payload = ImageTurnRequest(model_id="fixture-discovered", effort_id=None,
            configuration_generation="c" * 64, attempt_id=str(uuid4()), resource_key=profiles.identity("agentic"),
            session_generation="b" * 32, timeout_seconds=2, prompt="Synthetic image")
        self.answer = ImageAnswer(kind="answer", text="Synthetic finish", generated_image={
            "content_base64": "YQ==", "sha256": sha256(b"a").hexdigest(), "media_type": "image/png"})

    async def test_one_core_call_receipt_and_common_reconcile_ack(self):
        async def core(*args):
            self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "dispatch_armed")
            return self.answer
        with patch("native_image_generation.generate_core", side_effect=core) as execute:
            result = await self.service.execute(self.payload)
        self.assertEqual(execute.call_count, 1)
        reference = ReconcileAttempt(resource_key=self.payload.resource_key,
            session_generation=self.payload.session_generation, operation_ref=self.payload.attempt_id)
        self.assertEqual(self.chat.reconcile("agentic", self.payload.attempt_id, reference), result.terminal_proof.model_dump())
        self.chat.acknowledge("agentic", self.payload.attempt_id, AcknowledgeAttempt(
            **reference.model_dump(), terminal_proof_id=result.terminal_proof.terminal_proof_id))
        with self.assertRaises(ServiceError):
            await self.service.execute(self.payload)

    async def test_nested_profile_has_zero_receipt_and_zero_core_calls(self):
        with patch("native_image_generation.generate_core", new_callable=AsyncMock) as core:
            async with self.chat.profiles.operation("agentic", purpose="eligibility"):
                with self.assertRaises(ServiceError) as caught:
                    await self.service.execute(self.payload)
        self.assertEqual(caught.exception.code, "runtime_busy")
        core.assert_not_awaited()
        self.assertIsNone(self.chat.ledger.read(self.payload.attempt_id))

    async def test_preflight_failure_is_receipted_unknown_without_replay(self):
        with patch("native_image_generation.generate_core", side_effect=ValueError("private")):
            with self.assertRaises(ServiceError) as caught:
                await self.service.execute(self.payload)
        self.assertEqual(caught.exception.code, "image_result_unknown")
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")
        self.assertNotIn("private", next((self.root / "state/attempts").glob("*.json")).read_text())

    async def test_cancellation_propagates_and_closed_process_has_unknown_proof(self):
        with patch("native_image_generation.generate_core", side_effect=asyncio.CancelledError):
            with self.assertRaises(asyncio.CancelledError):
                await self.service.execute(self.payload)
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")

    async def test_exact_cancel_waits_for_owned_cleanup_then_reconcile_and_ack_without_replay(self):
        entered, cleaning, release = asyncio.Event(), asyncio.Event(), asyncio.Event()
        process = object()
        async def core(*args):
            self.agentic.runner._processes.add(process); entered.set()
            try:
                await asyncio.Event().wait()
            finally:
                cleaning.set(); await release.wait()
                self.agentic.runner._processes.remove(process)
        reference = ReconcileAttempt(resource_key=self.payload.resource_key,
            session_generation=self.payload.session_generation, operation_ref=self.payload.attempt_id)
        with patch("native_image_generation.generate_core", side_effect=core) as execute:
            owner = asyncio.create_task(self.service.execute(self.payload))
            await asyncio.wait_for(entered.wait(), 2)
            cancel = asyncio.create_task(self.service.cancel(self.payload.attempt_id, reference))
            await asyncio.wait_for(cleaning.wait(), 2)
            self.assertFalse(cancel.done())
            self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "dispatch_armed")
            with self.assertRaises(ServiceError):
                self.chat.reconcile("agentic", self.payload.attempt_id, reference)
            repeated = asyncio.create_task(self.service.cancel(self.payload.attempt_id, reference))
            await asyncio.sleep(0)
            self.assertFalse(repeated.done())
            release.set()
            result = await asyncio.wait_for(cancel, 2)
            self.assertEqual(await asyncio.wait_for(repeated, 2), result)
            with self.assertRaises(asyncio.CancelledError):
                await owner
        self.assertEqual(execute.call_count, 1)
        self.assertEqual(result, {"attempt_id": self.payload.attempt_id, "state": "abandoned_unknown"})
        self.assertEqual(await self.service.cancel(self.payload.attempt_id, reference), result)
        self.assertIsNone(self.service._image_tasks[self.payload.attempt_id])
        self.assertFalse(self.agentic.runner._processes)
        proof = self.chat.reconcile("agentic", self.payload.attempt_id, reference)
        self.chat.acknowledge("agentic", self.payload.attempt_id, AcknowledgeAttempt(
            **reference.model_dump(), terminal_proof_id=proof["terminal_proof_id"]))
        self.assertIsNone(self.chat.ledger.read(self.payload.attempt_id))
        with self.assertRaises(ServiceError):
            await self.service.execute(self.payload)

    async def test_cancel_wrong_identity_never_cancels_an_owned_operation(self):
        entered, release = asyncio.Event(), asyncio.Event()
        async def core(*args):
            entered.set(); await release.wait(); return self.answer
        with patch("native_image_generation.generate_core", side_effect=core):
            owner = asyncio.create_task(self.service.execute(self.payload))
            await asyncio.wait_for(entered.wait(), 2)
            bad = ReconcileAttempt(resource_key=self.payload.resource_key,
                session_generation="f" * 32, operation_ref=self.payload.attempt_id)
            with self.assertRaises(ServiceError) as caught:
                await self.service.cancel(self.payload.attempt_id, bad)
            self.assertEqual(caught.exception.code, "native_proof_mismatch")
            self.assertFalse(owner.done())
            release.set(); result = await owner
        self.assertEqual(result.terminal_proof.outcome, "completed")

    async def test_cancel_never_certifies_an_unclosed_native_process(self):
        entered = asyncio.Event()
        async def core(*args):
            self.agentic.runner._processes.add(object()); entered.set()
            await asyncio.Event().wait()
        reference = ReconcileAttempt(resource_key=self.payload.resource_key,
            session_generation=self.payload.session_generation, operation_ref=self.payload.attempt_id)
        with patch("native_image_generation.generate_core", side_effect=core):
            owner = asyncio.create_task(self.service.execute(self.payload))
            await asyncio.wait_for(entered.wait(), 2)
            with self.assertRaises(ServiceError) as caught:
                await self.service.cancel(self.payload.attempt_id, reference)
            self.assertEqual(caught.exception.code, "native_operation_active_or_unverified")
            with self.assertRaises(asyncio.CancelledError):
                await owner
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "dispatch_armed")
        self.agentic.runner._processes.clear()

    async def test_cancel_missing_or_invalid_attempt_has_no_generation_or_receipt(self):
        reference = ReconcileAttempt(resource_key=self.payload.resource_key,
            session_generation=self.payload.session_generation, operation_ref=self.payload.attempt_id)
        with self.assertRaises(ServiceError) as caught:
            await self.service.cancel("not-a-uuid", reference)
        self.assertEqual(caught.exception.code, "invalid_attempt")
        with self.assertRaises(ServiceError) as caught:
            await self.service.cancel(self.payload.attempt_id, reference)
        self.assertEqual(caught.exception.code, "image_attempt_missing")
        self.assertIsNone(self.chat.ledger.read(self.payload.attempt_id))
        self.assertFalse(self.chat.active_attempts)

    def test_prompt_utf8_and_no_attachment_or_fallback_fields(self):
        for changes in ({"prompt": "😀" * 2001}, {"model_id": ""}, {"ImagePaths": []}):
            with self.assertRaises(ValidationError):
                ImageTurnRequest.model_validate({**self.payload.model_dump(), **changes})

    async def test_fake_cli_owned_role_single_call_and_collected_bytes(self):
        account = self.root / "account"
        account.mkdir(exist_ok=True)
        binary = self.root / "synthetic-cli-not-executable"
        binary.write_bytes(b"synthetic test boundary")
        calls = []
        async def run(args, **options):
            calls.append((args, options))
            if "/usage" in args:
                return json.dumps({"status": "SUCCESS", "num_turns": 0, "usage": {"total_tokens": 0},
                    "command": {"name": "usage", "data": {"groups": [{"name": "Synthetic", "buckets": [
                        {"id": "window", "remaining_fraction": 1}]}]}}}), 0
            if args == ["models"]:
                return self.payload.model_id + "\tSynthetic discovered model\n", 0
            if "/model" in args:
                return json.dumps({"status": "SUCCESS", "num_turns": 0, "usage": {"total_tokens": 0},
                    "command": {"name": "model", "data": {"id": self.payload.model_id}}}), 0
            home, workspace = options["home"], options["cwd"]
            role = workspace / ".agents/agents" / AGENT / "agent.md"
            self.assertNotIn("view_file", role.read_text())
            hooks = json.loads((home / ".gemini/config/hooks.json").read_text())
            self.assertEqual(set(hooks["nodia-image-only"]), {"PreToolUse", "PostToolUse"})
            image_name = "nodia_generated_" + self.payload.attempt_id.replace("-", "")
            receipt_dir = home.parent / "receipts"
            conversation = str(uuid4())
            directory = home / ".gemini/antigravity-cli/brain" / conversation
            directory.mkdir(parents=True)
            hook = {"conversationId": conversation, "artifactDirectoryPath": str(directory),
                "toolCall": {"name": "generate_image", "args": {"Prompt": "Synthetic", "ImageName": image_name}}}
            image_hook(hook, home, receipt_dir, image_name, "pre")
            Image.new("RGB", (1, 1)).save(directory / (image_name + ".png"))
            image_hook(hook, home, receipt_dir, image_name, "post")
            image_hook({"toolCall": {"name": "finish"}}, home, receipt_dir, image_name, "pre")
            output = "\n".join(json.dumps(item) for item in [
                {"event": "init", "init": {"model": self.payload.model_id, "agent": AGENT}},
                {"event": "result", "result": {"status": "SUCCESS", "structured_output": {"kind": "answer", "text": "Done"}}}])
            options["stdout_observer"]((output + "\n").encode())
            return output, 0
        service = AntigravityAgentService(SimpleNamespace(
            config=CliConfig(binary, sha512(binary.read_bytes()).hexdigest(), account), run=run))
        service._available = True
        payload = self.payload.model_copy(update={"session_generation": service.session_generation})
        profiles = ProfileAdmission(account, self.root / "real-state")
        observed = await ChatAdapter(service, profiles).observe("agentic", ObserveRequest(
            model_id=payload.model_id, effort_id=payload.effort_id,
            configuration_generation=payload.configuration_generation))
        self.assertTrue(observed["available"])
        self.assertEqual(len(calls), 3)  # real status + catalog + exact option proof.
        result = await generate_core(service, payload)
        self.assertEqual(result.generated_image.media_type, "image/png")
        self.assertEqual(len(calls), 4)  # native image reuses proof: generation only.
        self.assertEqual(sum("/model" in args for args, _ in calls), 1)
        self.assertEqual(list(account.iterdir()), [])

    async def test_negative_option_proof_stops_before_image_generation(self):
        service = SimpleNamespace(runner=SimpleNamespace(config=SimpleNamespace(version="1.3.1"), run=AsyncMock()),
            get_status=AsyncMock(return_value={"available": True, "has_active_session": True,
                "models": [{"id": self.payload.model_id}]}), validate_model_option=AsyncMock(return_value=False))
        with self.assertRaises(ServiceError) as caught:
            await generate_core(service, self.payload)
        self.assertEqual(caught.exception.code, "model_unavailable")
        service.validate_model_option.assert_awaited_once_with(self.payload.model_id, None,
                                                            self.payload.configuration_generation)
        service.runner.run.assert_not_awaited()

    async def test_failed_diagnostic_publisher_does_not_change_answer_or_exception(self):
        with patch("native_image_generation._generate_core", new_callable=AsyncMock, return_value=self.answer), \
                patch("native_image_generation.logger.info", side_effect=OSError("private logger failure")):
            self.assertEqual(await generate_core(self.agentic, self.payload), self.answer)
        original = ValueError("private provider detail")
        with patch("native_image_generation._generate_core", new_callable=AsyncMock, side_effect=original), \
                patch("native_image_generation.logger.info", side_effect=OSError("private logger failure")):
            with self.assertRaises(ValueError) as caught:
                await generate_core(self.agentic, self.payload)
        self.assertIs(caught.exception, original)


if __name__ == "__main__":
    unittest.main()
