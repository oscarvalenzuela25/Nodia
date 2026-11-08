"""Backend ownership boundaries with synthetic identity/transport, no SDK/profile."""
import test_support
import asyncio
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock

from native_teacher_text import TeacherNativeText
from profile_admission import ProfileAdmission
from service_errors import ServiceError
from teacher_runtime_backend import LegacyTeacherBackend, TeacherRuntimeIdentity
from teacher_text_contract import TeacherAck, TeacherAnswer, TeacherObserve, TeacherStart
from test_teacher_text_contract import start_payload


class PoisonLegacy:
    @property
    def runner(self):
        raise AssertionError("Explicit backend must not inspect legacy Agentic")


class SyntheticBackend:
    catalog_supported = False
    timeout_seconds = 5.0

    def __init__(self):
        self.runner = object()  # No CLI config/handles; no fake process evidence.
        self.session_generation = "a" * 32
        self.closed = True
        self.recovered = False
        self.recoveries = []
        self.cleanup = []
        self.identities = 0
        self.selection = AsyncMock()

    def unverified_identity(self):
        return TeacherRuntimeIdentity(None, "d" * 64, "e" * 64)

    async def identity(self):
        self.identities += 1
        return self.unverified_identity()

    async def validate_selection(self, command):
        await self.selection(command)

    async def prepare_admission(self):
        return None

    def process_closed(self):
        return self.closed

    def recover_local_closure(self, reference):
        self.recoveries.append(reference)
        return self.recovered

    def cleanup_owned(self, reference):
        self.cleanup.append(reference)


class SyntheticTransport:
    def __init__(self):
        self.calls = 0
        self.cleaned = []
        self.action = None

    async def execute(self, command, timeout):
        self.calls += 1
        if self.action is not None:
            await self.action()
        return TeacherAnswer(text="Synthetic bounded response")

    def cleanup(self, operation_id):
        self.cleaned.append(operation_id)


class BackendOwnershipTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profiles = ProfileAdmission(self.root / "synthetic-physical-profile", self.root / "state")
        self.backend, self.transport = SyntheticBackend(), SyntheticTransport()
        self.adapter = self.make_adapter(self.backend, self.transport)

    def make_adapter(self, backend, transport):
        adapter = TeacherNativeText(PoisonLegacy(), self.profiles, backend=backend, transport=transport)
        self.addAsyncCleanup(adapter.close)
        return adapter

    def command(self):
        return TeacherStart.model_validate(start_payload(model_id="synthetic-model",
            effort_id="synthetic-effort", configuration_generation="b" * 64,
            resource_key=self.profiles.identity("agentic"), session_generation=self.backend.session_generation,
            runtime_hash="d" * 64, policy_hash="e" * 64))

    async def settle(self):
        await asyncio.gather(*list(self.adapter.tasks.values()), return_exceptions=True)

    async def test_explicit_backend_observation_and_stale_selection_never_read_legacy(self):
        command = TeacherObserve.model_validate(self.command().model_dump(include={
            "contract", "model_id", "effort_id", "configuration_generation"}))
        seen = await self.adapter.observe(command)
        self.assertTrue(seen.available)
        self.assertIsNone(seen.binary_sha512, "SDK identity must not invent a CLI binary")
        self.assertEqual((seen.runtime_hash, seen.policy_hash), ("d" * 64, "e" * 64))
        async def replace_epoch(_command):
            self.backend.session_generation = "f" * 32
        self.backend.selection.side_effect = replace_epoch
        stale = await self.adapter.observe(command)
        self.assertFalse(stale.available)
        self.assertEqual(stale.reason, "runtime_generation_changed")
        self.assertEqual(self.transport.calls, 0)

    async def test_sdk_catalog_is_explicitly_unsupported_without_a_cli_inspection(self):
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.inspect_catalog(self.command())
        self.assertEqual((caught.exception.code, caught.exception.status),
                         ("teacher_catalog_inspection_unsupported", 422))
        self.assertEqual(self.backend.identities, 0)
        self.assertFalse(self.adapter.inspections)

    async def test_missing_injected_transport_never_falls_back_or_arms(self):
        adapter = self.make_adapter(self.backend, None)
        command = self.command()
        seen = await adapter.observe(command)
        self.assertFalse(seen.available)
        with self.assertRaises(ServiceError) as caught:
            await adapter.start(command)
        self.assertEqual(caught.exception.code, "teacher_runtime_unconfigured")
        self.assertFalse(adapter.records)
        self.assertIsNone(adapter.ledger.read(command.attempt_id))
        self.backend.selection.assert_not_awaited()

    async def test_epoch_replaced_during_execution_can_only_publish_closed_unknown(self):
        command = self.command()
        async def replace_epoch():
            self.backend.session_generation = "f" * 32
        self.transport.action = replace_epoch
        await self.adapter.start(command)
        await self.settle()
        result = self.adapter.status(command.reference())
        self.assertEqual(result.state, "unknown")
        self.assertIsNone(result.text)
        self.assertIsNone(result.terminal_proof.response_hash)
        self.assertEqual(result.terminal_proof.remote_outcome, "unknown")
        self.assertEqual((await self.adapter.start(command)).state, "unknown")
        self.assertEqual(self.transport.calls, 1)

    async def test_no_certified_closure_retains_armed_fence_and_workspace(self):
        command = self.command()
        self.backend.closed = False
        await self.adapter.start(command)
        await self.settle()
        self.assertIsNone(self.adapter.status(command.reference()).terminal_proof)
        self.assertEqual(self.adapter.ledger.read(command.attempt_id).state, "dispatch_armed")
        self.assertFalse(self.transport.cleaned)
        with self.assertRaises(ServiceError):
            self.profiles.reserve("agentic", purpose="legacy")
        self.backend.closed = "truthy-is-not-a-proof"
        with self.assertRaises(ServiceError):
            self.adapter.reconcile(command.reference())
        self.assertIsNone(self.adapter.status(command.reference()).terminal_proof)
        self.backend.closed = True
        result = self.adapter.reconcile(command.reference())
        self.assertEqual(result.terminal_proof.remote_outcome, "unknown")
        self.assertEqual(self.transport.calls, 1)

    async def test_replacement_needs_exact_recovery_proof_and_can_only_close_unknown(self):
        command = self.command()
        self.backend.closed = False
        await self.adapter.start(command)
        await self.settle()
        replacement_backend = SyntheticBackend()
        replacement = self.make_adapter(replacement_backend, self.transport)
        for proof in (False, "truthy-is-not-a-proof"):
            replacement_backend.recovered = proof
            with self.assertRaises(ServiceError) as caught:
                replacement.reconcile(command.reference())
            self.assertEqual(caught.exception.code, "teacher_original_owner_closure_required")
            self.assertIsNone(replacement.status(command.reference()).terminal_proof)
        replacement_backend.recovered = True
        replacement_backend.closed = False  # Exact journal proof, not empty handles.
        result = replacement.reconcile(command.reference())
        self.assertEqual(result.state, "unknown")
        self.assertIsNone(result.text)
        self.assertIsNone(result.terminal_proof.response_hash)
        self.assertEqual(replacement_backend.recoveries[-1], command.reference())
        self.assertEqual((await replacement.start(command)).state, "unknown")
        self.assertEqual(self.transport.calls, 1)

    async def test_live_task_and_forged_reference_cannot_use_recovery_hook(self):
        command = self.command()
        entered, finish = asyncio.Event(), asyncio.Event()
        async def held():
            entered.set()
            await finish.wait()
        self.transport.action = held
        await self.adapter.start(command)
        await entered.wait()
        self.backend.recovered = True
        with self.assertRaises(ServiceError):
            self.adapter.reconcile(command.reference())
        self.assertFalse(self.backend.recoveries)
        finish.set()
        await self.settle()
        with self.assertRaises(ServiceError):
            self.adapter.reconcile(command.reference().model_copy(update={"actor_id": "2"}))
        self.assertFalse(self.backend.recoveries)

    async def test_ack_cleanup_is_after_durable_fence_and_retries_without_replay(self):
        command = self.command()
        await self.adapter.start(command)
        await self.settle()
        proof = self.adapter.status(command.reference()).terminal_proof
        ack = TeacherAck(**command.reference().model_dump(), terminal_proof_id=proof.terminal_proof_id,
                         response_hash=proof.response_hash)
        calls = []
        def cleanup(reference):
            self.assertTrue((self.root / "state/teacher_retired" / (command.operation_id + ".json")).is_file())
            self.assertIsNone(self.adapter.ledger.read(command.attempt_id))
            calls.append(reference)
            if len(calls) == 1:
                raise ServiceError("teacher_cleanup_pending", "Synthetic pending cleanup", 409)
        self.backend.cleanup_owned = cleanup
        with self.assertRaises(ServiceError):
            self.adapter.acknowledge(ack)
        self.assertTrue(self.adapter.acknowledge(ack)["acknowledged"])
        self.assertEqual(calls, [command.reference(), command.reference()])
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.start(command)
        self.assertEqual(caught.exception.code, "teacher_operation_acknowledged")
        self.assertEqual(self.transport.calls, 1)


class LegacyBackendTests(unittest.IsolatedAsyncioTestCase):
    async def test_selection_rejects_ambiguous_models_and_unverified_options(self):
        from types import SimpleNamespace
        source = SimpleNamespace(runner=object(), is_available=lambda: True,
            get_status=AsyncMock(), validate_model_option=AsyncMock(return_value=True))
        backend = LegacyTeacherBackend(source)
        command = TeacherObserve(contract="teacher-agentic-text/1", model_id="synthetic-model",
            effort_id=None, configuration_generation="b" * 64)
        for models in ([], [{"id": command.model_id}, {"id": command.model_id}], "not-a-catalog"):
            source.get_status.return_value = {"available": True, "has_active_session": True, "models": models}
            with self.assertRaises(ServiceError) as caught:
                await backend.validate_selection(command)
            self.assertEqual(caught.exception.code, "model_unavailable")
        source.get_status.return_value["models"] = [{"id": command.model_id}]
        source.validate_model_option.return_value = False
        with self.assertRaises(ServiceError) as caught:
            await backend.validate_selection(command)
        self.assertEqual(caught.exception.code, "model_option_mismatch")

    def test_cold_import_never_loads_sdk_or_starts_operational_resources(self):
        source = """
import builtins, pathlib, subprocess, socket
original = builtins.__import__
def guarded(name, *args, **kwargs):
    if name.startswith(('google3', 'google.antigravity')):
        raise AssertionError('SDK import forbidden')
    return original(name, *args, **kwargs)
builtins.__import__ = guarded
def forbidden(*args, **kwargs):
    raise AssertionError('Operational resource forbidden on import')
pathlib.Path.mkdir = forbidden
subprocess.Popen.__init__ = forbidden
socket.socket.connect = forbidden
import teacher_runtime_backend
"""
        result = subprocess.run([sys.executable, "-c", source], cwd=Path(__file__).resolve().parents[1],
                                capture_output=True, timeout=10, check=False)
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
