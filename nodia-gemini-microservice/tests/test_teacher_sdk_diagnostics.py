"""Private metadata journal with synthetic bytes; no SDK, profile, auth or network."""
import test_support
import asyncio
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import importlib
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import teacher_sdk_diagnostics as diagnostics_module
from teacher_sdk_diagnostics import SDKDiagnosticContext, TeacherSDKDiagnostics, terminal_diagnostic
from teacher_sdk_policy import TeacherSDKHostRequest
from teacher_sdk_runtime import _Terminal, TeacherSDKTransport, TeacherSDKRuntimeConfig
from teacher_runtime_backend import TeacherRuntimeIdentity
from teacher_text_contract import TeacherStart
from teacher_text_execution import TeacherExecutionError
from service_errors import ServiceError
from test_teacher_text_contract import start_payload

ASSETS, POLICY = "a" * 64, "b" * 64


def request():
    return TeacherSDKHostRequest(contract="teacher-sdk-host/1", operation_id=str(uuid4()), request_hash="c" * 64,
        host_nonce="d" * 32, model_id="synthetic/exact", effort_id="high", prompt="Synthetic private prompt",
        deadline_at=(datetime.now(timezone.utc)+timedelta(seconds=30)).isoformat())


def terminal(command, **changes):
    return {**command.binding(), "assets_hash": ASSETS, "policy_hash": POLICY, "event": "terminal", "status": "unknown",
        "text": None, "response_hash": None, "code": "reply_invalid", "provider_dispatches": 1,
        "sdk_stop_reason": "MAX_MODEL_CALLS_EXCEEDED", "finish_done": False, "known_child_closed": True,
        "source_proof": {"local_attempts": 1, "upstream_status": 200, "first_reply_sha256": "e" * 64,
            "finish_structured_hash": None, "prompt_sha256": "f" * 64}, **changes}


def encoded(value):
    return json.dumps(value, ensure_ascii=False).encode()


def validate(value):
    return _Terminal.model_validate(value).model_dump()


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.journal = TeacherSDKDiagnostics(self.root / "teacher_sdk_diagnostics")
        self.command = request()
        self.binding = {**self.command.binding(), "assets_hash": ASSETS, "policy_hash": POLICY}
        self.context = SDKDiagnosticContext(operation_id=self.command.operation_id, request_hash=self.command.request_hash,
            assets_hash=ASSETS, policy_hash=POLICY)

    @unittest.skipUnless(os.name == "posix", "Actual POSIX ownership and permission boundary")
    def test_shared_owned_parent_0755_retains_mode_with_private_journal_and_record(self):
        os.chmod(self.root, 0o755)
        self.journal.reserve(self.context)
        self.assertEqual(self.root.stat().st_mode & 0o777, 0o755)
        self.assertEqual(self.journal.directory.stat().st_mode & 0o777, 0o700)
        self.assertEqual(self.journal._path(self.context).stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.journal.read(self.context).phase, "reserved")

    @unittest.skipUnless(os.name == "posix", "Actual POSIX ownership and permission boundary")
    def test_shared_writable_parent_is_rejected_before_journal_creation(self):
        os.chmod(self.root, 0o777)
        with self.assertRaises(ServiceError):
            self.journal.reserve(self.context)
        self.assertFalse(self.journal.directory.exists())
        self.assertEqual(self.root.stat().st_mode & 0o777, 0o777)

    @unittest.skipUnless(os.name == "posix", "Actual POSIX ownership and permission boundary")
    def test_relaxed_shared_parent_does_not_relax_private_subdirectory_or_file(self):
        os.chmod(self.root, 0o755)
        self.journal.directory.mkdir(mode=0o755)
        with self.assertRaises(ServiceError):
            self.journal.reserve(self.context)
        self.assertFalse(self.journal._path(self.context).exists())
        os.chmod(self.journal.directory, 0o700)
        self.journal.reserve(self.context)
        record = self.journal._path(self.context)
        before = record.read_bytes()
        os.chmod(record, 0o640)
        with self.assertRaises(ServiceError):
            self.journal.read(self.context)
        self.assertEqual(record.read_bytes(), before)
        self.assertEqual(record.stat().st_mode & 0o777, 0o640)

    def test_unknown_captures_typed_bound_metadata_without_private_content(self):
        self.journal.reserve(self.context)
        data = terminal(self.command, text="Private provider text must never be retained")
        raw = encoded(data)
        self.journal.capture(self.context, raw, 0, self.binding, validate)
        record = self.journal.read(self.context)
        self.assertEqual(record.bound_terminal.code, "reply_invalid")
        self.assertEqual(record.bound_terminal.status, "unknown")
        self.assertEqual(record.bound_terminal.source_proof.upstream_status, 200)
        self.assertEqual(record.stdout_sha256, sha256(raw).hexdigest())
        self.assertEqual(record.frame_count, 1)
        persisted = self.journal._path(self.context).read_bytes()
        for private in (b"Private provider text", self.command.prompt.encode(), self.command.host_nonce.encode(),
                        b'"text"', b'"response_hash"', b'"host_nonce"', b'"prompt"'):
            self.assertNotIn(private, persisted)

    def test_every_foreign_binding_and_started_frame_is_unverified(self):
        for key in self.binding:
            with self.subTest(key=key):
                value = terminal(self.command, **{key: "foreign"})
                self.assertIsNone(terminal_diagnostic(encoded(value), self.binding, validate))
        started = {**self.binding, "event": "started", "untrusted": "secret"}
        self.assertIsNone(terminal_diagnostic(encoded(started)+b"\n"+encoded(terminal(self.command)), self.binding, validate))

    def test_malformed_json_duplicate_fields_and_unknown_payload_are_not_projected(self):
        for raw in (b"\xff\n", b'{"event":"terminal","event":"secret"}',
                    encoded(terminal(self.command, extra="secret raw data")), encoded(terminal(self.command))+b"\n{}\n{}"):
            self.assertIsNone(terminal_diagnostic(raw, self.binding, validate))
        self.journal.reserve(self.context)
        self.journal.capture(self.context, b"unparseable secret\n", -9, self.binding, validate)
        record = self.journal.read(self.context)
        self.assertIsNone(record.bound_terminal)
        self.assertEqual(record.exit_code, -9)
        self.assertNotIn(b"unparseable secret", self.journal._path(self.context).read_bytes())

    def test_repeat_id_cannot_replace_captured_unknown(self):
        self.journal.reserve(self.context)
        self.journal.capture(self.context, encoded(terminal(self.command)), 0, self.binding, validate)
        before = self.journal._path(self.context).read_bytes()
        with self.assertRaises(ServiceError): self.journal.reserve(self.context)
        with self.assertRaises(ServiceError):
            self.journal.capture(self.context, encoded(terminal(self.command, status="completed")), 0, self.binding, validate)
        self.assertEqual(self.journal._path(self.context).read_bytes(), before)

    def test_wrong_request_context_cannot_read_or_finalize_reservation(self):
        self.journal.reserve(self.context)
        foreign = self.context.model_copy(update={"request_hash": "9" * 64})
        with self.assertRaises(ServiceError): self.journal.read(foreign)
        with self.assertRaises(ServiceError):
            self.journal.capture(self.context, b"{}", 0, {**self.binding, "request_hash": "9" * 64}, validate)
        self.assertEqual(self.journal.read(self.context).phase, "reserved")

    def test_hardlinked_private_record_is_rejected_and_unknown_not_removed(self):
        self.journal.reserve(self.context)
        os.link(self.journal._path(self.context), self.root / "synthetic-hardlink.json")
        with self.assertRaises(ServiceError): self.journal.read(self.context)
        other = self.context.model_copy(update={"operation_id": str(uuid4())})
        with self.assertRaises(ServiceError): self.journal.reserve(other)
        self.assertTrue(self.journal._path(self.context).exists())

    def test_capacity_is_checked_before_creating_another_diagnostic_id(self):
        with patch.object(diagnostics_module, "MAX_RECORDS", 1):
            self.journal.reserve(self.context)
            other = self.context.model_copy(update={"operation_id": str(uuid4())})
            with self.assertRaises(ServiceError) as error: self.journal.reserve(other)
            self.assertEqual(error.exception.code, "teacher_sdk_diagnostic_capacity")
            self.assertFalse(self.journal._path(other).exists())

    def test_capture_io_failure_preserves_reserved_unknown(self):
        self.journal.reserve(self.context)
        with patch.object(self.journal, "_fresh", side_effect=OSError("Synthetic disk failure")):
            with self.assertRaises(ServiceError):
                self.journal.capture(self.context, encoded(terminal(self.command)), 0, self.binding, validate)
        self.assertEqual(self.journal.read(self.context).phase, "reserved")

    def test_structural_reply_codes_are_projected_without_raw_or_unknown_names(self):
        codes = ("reply_framing", "reply_json", "reply_envelope", "reply_candidates", "reply_parts",
            "reply_finish_missing", "reply_finish_multiple", "reply_reason", "reply_answer_invalid",
            "reply_parts_text", "reply_parts_metadata", "reply_parts_unsupported", "reply_parts_limit")
        for code in codes:
            with self.subTest(code=code):
                journal = TeacherSDKDiagnostics(self.root / code)
                journal.reserve(self.context)
                raw = encoded(terminal(self.command, code=code, text="secret-provider-text"))
                journal.capture(self.context, raw, 0, self.binding, validate)
                self.assertEqual(journal.read(self.context).bound_terminal.code, code)
                saved = journal._path(self.context).read_bytes()
                for forbidden in (b"secret-provider-text", self.command.host_nonce.encode(), b'"text"', b'"prompt"'):
                    self.assertNotIn(forbidden, saved)
        value = terminal(self.command, code="reply_untrusted_provider_detail")
        self.assertIsNone(terminal_diagnostic(encoded(value), self.binding, validate))


class RuntimeCaptureTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.command = TeacherStart.model_validate(start_payload())
        self.config = TeacherSDKRuntimeConfig(self.root / "sdk", ASSETS, self.root / "profile",
            self.root / "teacher_sdk_owners", self.root / "work")
        self.identity = TeacherRuntimeIdentity(None, self.command.runtime_hash, POLICY)
        self.backend = SimpleNamespace(config=self.config, session_generation=self.command.session_generation,
            identity=AsyncMock(return_value=self.identity), process_closed=lambda: True,
            _arguments=lambda _action: ["synthetic-command"], runner=SimpleNamespace(run=AsyncMock(side_effect=self.run_child)))

    async def run_child(self, *_args, **kwargs):
        command = TeacherSDKHostRequest.model_validate_json(kwargs["stdin"])
        return encoded(terminal(command)), 0

    async def test_host_failure_metadata_is_durable_before_existing_decoder_raises(self):
        with self.assertRaises(TeacherExecutionError):
            await TeacherSDKTransport(self.backend).execute(self.command, 2)
        context = SDKDiagnosticContext(operation_id=self.command.operation_id, request_hash=self.command.request_hash,
            assets_hash=ASSETS, policy_hash=POLICY)
        record = TeacherSDKDiagnostics(self.root / "teacher_sdk_diagnostics").read(context)
        self.assertEqual(record.bound_terminal.code, "reply_invalid")
        self.assertEqual(record.bound_terminal.provider_dispatches, 1)
        self.backend.runner.run.assert_awaited_once()

    async def test_full_diagnostic_capacity_never_starts_child(self):
        with patch.object(diagnostics_module, "MAX_RECORDS", 0), self.assertRaises(ServiceError):
            await TeacherSDKTransport(self.backend).execute(self.command, 2)
        self.backend.runner.run.assert_not_awaited()
