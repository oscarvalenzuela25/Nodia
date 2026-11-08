"""Native decoder/fences with synthetic child boundaries; no SDK or accounts."""
import test_support
import asyncio
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from profile_admission import ProfileAdmission
from native_teacher_text import TeacherNativeText
from service_errors import ServiceError
from teacher_runtime_backend import TeacherRuntimeIdentity
from teacher_sdk_policy import TeacherSDKHostRequest, canonical_hash
from teacher_sdk_runtime import (TeacherSDKBackend, TeacherSDKRuntimeConfig,
    create_teacher_sdk_runtime, parse_sdk_answer, sdk_environment, validate_sdk_observation)
from teacher_text_contract import TeacherObserve
from teacher_text_execution import TeacherExecutionError

ASSETS, POLICY = "a" * 64, "b" * 64


def observation(**changes):
    return {"contract": "teacher-sdk-host/1", "event": "observation", "authenticated": True,
        "model_present": True, "effort_serializable": True, "reason": "observed", "generative": False,
        "assets_hash": ASSETS, "policy_hash": POLICY, **changes}


def encoded(value):
    return json.dumps(value, ensure_ascii=False).encode("utf-8")


class SDKDecoderTests(unittest.TestCase):
    def setUp(self):
        self.request = TeacherSDKHostRequest(contract="teacher-sdk-host/1", operation_id=str(uuid4()),
            request_hash="c" * 64, host_nonce="d" * 32, model_id="fixture/exact-model", effort_id="high",
            prompt="Solicitud sintética", deadline_at=(datetime.now(timezone.utc) + timedelta(seconds=30)).isoformat())
        self.binding = {**self.request.binding(), "assets_hash": ASSETS, "policy_hash": POLICY}
        self.terminal = {**self.binding, "event": "terminal", "status": "completed", "text": "Respuesta sintética",
            "response_hash": sha256("Respuesta sintética".encode()).hexdigest(), "code": "completed",
            "provider_dispatches": 1, "sdk_stop_reason": "MAX_MODEL_CALLS_EXCEEDED", "finish_done": True,
            "known_child_closed": True, "source_proof": {"local_attempts": 1, "upstream_status": 200,
                "first_reply_sha256": "e" * 64, "finish_structured_hash": canonical_hash({"text": "Respuesta sintética"}),
                "prompt_sha256": sha256(self.request.prompt.encode()).hexdigest()}}

    def answer(self, terminal=None, *, code=0, started=None):
        raw = encoded(started or {**self.binding, "event": "started"}) + b"\n" + encoded(terminal or self.terminal)
        return parse_sdk_answer(raw, code, self.request, ASSETS, POLICY)

    def test_budget_stop_requires_current_bound_finish_and_successful_wire(self):
        self.assertEqual(self.answer().text, "Respuesta sintética")
        for field, invalid in (("finish_done", False), ("known_child_closed", False), ("provider_dispatches", 0),
                ("sdk_stop_reason", "QUOTA_EXHAUSTED"), ("binding_hash", "f" * 64), ("response_hash", "f" * 64),
                ("status", "invented"), ("source_proof", None)):
            with self.subTest(field=field), self.assertRaises(TeacherExecutionError):
                self.answer({**self.terminal, field: invalid})
        with self.assertRaises(TeacherExecutionError):
            self.answer(code=1)
        for field, invalid in (("local_attempts", 2), ("upstream_status", 503), ("first_reply_sha256", None),
                ("finish_structured_hash", "f" * 64), ("prompt_sha256", "f" * 64)):
            with self.subTest(source=field), self.assertRaises(TeacherExecutionError):
                self.answer({**self.terminal, "source_proof": {**self.terminal["source_proof"], field: invalid}})

    def test_truncated_duplicate_stale_or_incomplete_frames_never_complete(self):
        for raw in (encoded(self.terminal), b'{"event":"terminal","event":"terminal"}', b"{",
                encoded({**self.binding, "event": "started"}) + b"\n" + encoded(self.terminal) + b"\n{}"):
            with self.subTest(raw=raw[:50]), self.assertRaises(TeacherExecutionError):
                parse_sdk_answer(raw, 0, self.request, ASSETS, POLICY)
        with self.assertRaises(TeacherExecutionError):
            self.answer(started={**self.binding, "event": "started", "host_nonce": "f" * 32})

    def test_observation_binds_installed_assets_and_preserves_unknown(self):
        validate_sdk_observation(encoded(observation()), 0, ASSETS, POLICY)
        for changes, expected in (({"authenticated": False}, "teacher_sdk_session_required"),
                ({"authenticated": None}, "teacher_sdk_session_unverified"),
                ({"model_present": None}, "teacher_sdk_catalog_unavailable"),
                ({"model_present": False}, "model_unavailable"),
                ({"effort_serializable": False}, "model_option_mismatch"),
                ({"assets_hash": "f" * 64}, "teacher_runtime_unverified"),
                ({"unexpected": True}, "teacher_runtime_unverified")):
            with self.subTest(changes=changes), self.assertRaises(ServiceError) as caught:
                validate_sdk_observation(encoded(observation(**changes)), 0, ASSETS, POLICY)
            self.assertEqual(caught.exception.code, expected)

    def test_child_environment_has_no_credentials_or_provider_routing(self):
        actual = sdk_environment(Path("/synthetic"), {"PATH": "/usr/bin", "LANG": "C.UTF-8",
            "HOME": "/real-profile", "GEMINI_SERVICE_TOKEN": "fixture-secret", "DATABASE_URL": "fixture",
            "OPENAI_API_KEY": "fixture", "HTTPS_PROXY": "fixture", "PYTHONPATH": "/unsafe"})
        self.assertEqual(actual, {"PATH": "/usr/bin", "LANG": "C.UTF-8", "HOME": str(Path("/synthetic")),
            "USERPROFILE": str(Path("/synthetic")), "PYTHONDONTWRITEBYTECODE": "1"})

    def test_missing_or_partial_config_never_constructs_cli_fallback(self):
        for env in ({}, {"NODIA_TEACHER_SDK_ROOT": "/candidate"},
                {"NODIA_TEACHER_SDK_ROOT": "relative", "NODIA_TEACHER_SDK_MANIFEST_SHA256": ASSETS}):
            backend, transport = create_teacher_sdk_runtime(Path("/profile"), Path("/state"), Path("/work"), env)
            self.assertIsNone(backend.config)
            self.assertFalse(backend.catalog_supported)
            self.assertIs(transport.backend, backend)
            self.assertIsNone(backend.runner)

    def test_sdk_ceiling_accepts_authorized_material_budget_without_selecting_a_model(self):
        backend, _transport = create_teacher_sdk_runtime(None, None, Path("/synthetic"), {})
        self.assertEqual(backend.timeout_seconds, 300.0)
        self.assertIsNone(backend.config)
        self.assertIsNone(backend.runner)


class SyntheticOwner:
    def __init__(self):
        self.records = {}
        self.uncertain = False
        self.cleaned = []

    async def run(self, command, **kwargs):
        operation = kwargs["operation_id"]
        self.records[operation] = SimpleNamespace(operation_id=operation, action="observe", process_closed=not self.uncertain,
            manifest_sha256=kwargs["manifest_sha256"])
        if self.uncertain:
            raise TimeoutError()
        return encoded(observation()), 0

    def read(self, operation):
        return self.records.get(operation)

    def unclosed_records(self):
        return tuple(row for row in self.records.values() if not row.process_closed)

    def metadata_records(self):
        return tuple(self.records.values())

    def recover_metadata(self, operation, manifest):
        record = self.read(operation)
        return record is not None and record.manifest_sha256 == manifest and record.process_closed

    def cleanup_metadata(self, operation, manifest):
        self.cleaned.append(operation)
        self.records.pop(operation, None)


class SDKMetadataFences(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.profiles = ProfileAdmission(self.root / "profile", self.root / "admission")
        self.config = TeacherSDKRuntimeConfig(self.root / "sdk", ASSETS, self.root / "profile",
            self.root / "admission/teacher_sdk_owners", self.root / "work")
        self.backend = TeacherSDKBackend(self.config, resource_key=self.profiles.identity("agentic"))
        self.backend.profiles = self.profiles
        self.backend._identity = TeacherRuntimeIdentity(None, "c" * 64, POLICY)
        self.backend._owner = SyntheticOwner()
        self.backend.identity = AsyncMock(return_value=self.backend._identity)
        self.enterContext(patch.object(self.backend, "_profile"))
        self.enterContext(patch.object(self.backend, "_epoch", return_value="d" * 32))
        self.selection = TeacherObserve(contract="teacher-agentic-text/1", model_id="fixture/exact-model",
            effort_id="high", configuration_generation="e" * 64)

    async def test_nested_observation_preserves_execution_reservation_and_retires_metadata(self):
        async with self.profiles.operation("agentic", purpose="execution"):
            owner = self.profiles._owners[self.backend.resource_key]
            # Repeated reads must not accumulate64 permanent metadata owners.
            for _ in range(70):
                await self.backend.validate_selection(self.selection)
            self.assertIs(self.profiles._owners[self.backend.resource_key], owner)
            self.assertIn(self.backend.resource_key, self.profiles._held)
            self.assertEqual(self.backend._owner.records, {})
            self.assertEqual(len(self.backend._owner.cleaned), 70)
            self.assertIsNone(self.backend._marker())
            self.profiles.arm_dispatch("agentic", {"resource_key": self.backend.resource_key, "kind": "fixture_execution"})
            self.profiles.resolve_dispatch("agentic")
        self.assertNotIn(self.backend.resource_key, self.profiles._held)

    async def test_uncertain_metadata_retains_durable_physical_quarantine(self):
        self.backend._owner.uncertain = True
        async with self.profiles.observation("agentic", purpose="eligibility", timeout_seconds=1):
            with self.assertRaises(ServiceError) as caught:
                await self.backend.validate_selection(self.selection)
            self.assertEqual(caught.exception.code, "teacher_sdk_cleanup_unknown")
        self.assertEqual(self.backend._marker()["kind"], "teacher_sdk_metadata")
        for gate in (self.profiles, ProfileAdmission(self.root / "profile", self.root / "admission")):
            with self.assertRaises(ServiceError):
                gate.reserve("agentic", purpose="legacy")
        self.assertEqual(self.backend._owner.cleaned, [])

    async def test_wrong_nested_fence_does_not_release_or_rewrite_outer_owner(self):
        async with self.profiles.operation("agentic", purpose="execution"):
            own = {"resource_key": self.backend.resource_key, "kind": "fixture_original"}
            self.profiles.arm_dispatch("agentic", own)
            with self.assertRaises(ServiceError):
                self.profiles.resolve_current_dispatch("agentic", {**own, "kind": "fixture_other"})
            self.assertEqual(self.backend._marker(), own)
            self.assertIn(self.backend.resource_key, self.profiles._held)
            self.profiles.resolve_current_dispatch("agentic", own)

    async def test_restart_reconciles_only_exact_closed_metadata_without_inference(self):
        operation = str(uuid4())
        marker = {"kind": "teacher_sdk_metadata", "operation_id": operation,
            "manifest_sha256": ASSETS, "resource_key": self.backend.resource_key}
        async with self.profiles.operation("agentic", purpose="eligibility"):
            self.profiles.arm_dispatch("agentic", marker)
            self.profiles.quarantine("agentic")
        self.backend._owner.records[operation] = SimpleNamespace(operation_id=operation, action="observe",
            process_closed=True, manifest_sha256=ASSETS)
        self.config.owner_directory.mkdir(parents=True)
        self.backend.profiles = ProfileAdmission(self.root / "profile", self.root / "admission")
        await self.backend.initialize_safety()
        self.assertIsNone(self.backend._marker())
        reservation = self.backend.profiles.reserve("agentic", purpose="legacy")
        reservation.release()
        self.assertEqual(self.backend._owner.cleaned, [operation])

    async def test_restart_preserves_foreign_marker_and_quarantines_unclosed_sdk(self):
        operation = str(uuid4())
        marker = {"kind": "fixture_foreign", "resource_key": self.backend.resource_key}
        async with self.profiles.operation("agentic", purpose="execution"):
            self.profiles.arm_dispatch("agentic", marker)
            self.profiles.quarantine("agentic")
        self.backend._owner.records[operation] = SimpleNamespace(operation_id=operation, action="observe",
            process_closed=False, manifest_sha256=ASSETS)
        self.config.owner_directory.mkdir(parents=True)
        self.backend.profiles = ProfileAdmission(self.root / "profile", self.root / "admission")
        await self.backend.initialize_safety()
        self.assertEqual(self.backend._marker(), marker)
        with self.assertRaises(ServiceError):
            self.backend.profiles.reserve("agentic", purpose="legacy")
        self.assertEqual(self.backend._owner.cleaned, [])

    async def test_late_kernel_bootstrap_recovers_metadata_on_next_observation(self):
        operation = str(uuid4())
        marker = {"kind": "teacher_sdk_metadata", "operation_id": operation,
            "manifest_sha256": ASSETS, "resource_key": self.backend.resource_key}
        async with self.profiles.operation("agentic", purpose="eligibility"):
            self.profiles.arm_dispatch("agentic", marker)
            self.profiles.quarantine("agentic")
        record = SimpleNamespace(operation_id=operation, action="observe", process_closed=False, manifest_sha256=ASSETS)
        self.backend._owner.records[operation] = record
        self.config.owner_directory.mkdir(parents=True)
        self.backend.profiles = ProfileAdmission(self.root / "profile", self.root / "admission")
        await self.backend.initialize_safety()
        self.assertIn(self.backend.resource_key, self.backend.profiles._quarantined)
        # Boundary supplies positive closure only after the host attestation.
        record.process_closed = True
        adapter = TeacherNativeText(object(), self.backend.profiles, backend=self.backend, transport=object())
        self.addAsyncCleanup(adapter.close)
        seen = await adapter.observe(self.selection)
        self.assertTrue(seen.available)
        self.assertIsNone(self.backend._marker())
        reservation = self.backend.profiles.reserve("agentic", purpose="legacy")
        reservation.release()
        self.assertEqual(self.backend._owner.cleaned[0], operation)
        self.assertEqual(len(self.backend._owner.cleaned), 2, "Old recovery and new observation both retire safely")

    async def test_recovery_hook_never_quarantines_an_active_metadata_reservation(self):
        operation = str(uuid4())
        marker = {"kind": "teacher_sdk_metadata", "operation_id": operation,
            "manifest_sha256": ASSETS, "resource_key": self.backend.resource_key}
        self.config.owner_directory.mkdir(parents=True)
        self.backend._owner.records[operation] = SimpleNamespace(operation_id=operation, action="observe",
            process_closed=False, manifest_sha256=ASSETS)
        async with self.profiles.operation("agentic", purpose="eligibility"):
            self.profiles.arm_dispatch("agentic", marker)
            owner = self.profiles._owners[self.backend.resource_key]
            await self.backend.prepare_admission()
            self.assertNotIn(self.backend.resource_key, self.profiles._quarantined)
            self.assertIs(self.profiles._owners[self.backend.resource_key], owner)
            self.assertEqual(self.backend._marker(), marker)
            self.profiles.resolve_current_dispatch("agentic", marker)

    async def test_closed_record_cleanup_failure_does_not_create_phantom_quarantine(self):
        operation = str(uuid4())
        self.config.owner_directory.mkdir(parents=True)
        self.backend._owner.records[operation] = SimpleNamespace(operation_id=operation, action="observe",
            process_closed=True, manifest_sha256=ASSETS)
        with patch.object(self.backend._owner, "cleanup_metadata", side_effect=ServiceError("fixture_mount_pending", "fixture", 503)):
            await self.backend.initialize_safety()
        self.assertNotIn(self.backend.resource_key, self.profiles._quarantined)
        await self.backend.prepare_admission()
        self.assertEqual(self.backend._owner.cleaned, [operation])

