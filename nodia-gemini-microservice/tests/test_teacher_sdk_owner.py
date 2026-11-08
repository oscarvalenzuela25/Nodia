"""Synthetic kernel/spawn boundaries. Never executes SDKs, profiles or cgroups."""
import test_support
import asyncio
import json
import os
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from uuid import uuid4

from service_errors import ServiceError
from teacher_sdk_launch import await_gate
from teacher_sdk_owner import (TeacherSDKOwner, TeacherSDKOwnerRecord, SupervisorProof, ContainmentProof,
    TeacherSDKParentRootProof)
from teacher_text_contract import TeacherStart
from test_teacher_text_contract import start_payload

BOOT = str(uuid4())
OTHER_BOOT = str(uuid4())
MANIFEST = "c" * 64


def certificate(pid):
    return {"boot": BOOT, "namespace": "pid:[1234]", "uid": 10001, "pid": pid, "birth": 456}


def parent_scope():
    return TeacherSDKParentRootProof(boot=BOOT, device=1, parent_inode=3)


class FakeKernel:
    def __init__(self):
        self.events, self.groups = [], {}
        self.closes = True
        self.closed_root = False
        self.available = True
        self.process = None

    def _root(self):
        if not self.available:
            raise ServiceError("login_containment_unavailable", "Synthetic unavailable")
        return SimpleNamespace(st_dev=1, st_ino=3)

    def create(self, key):
        self._root()
        self.events.append("create")
        proof = dict(kind="cgroup_v2", name=key, boot=BOOT, device=1, inode=2, parent_inode=3)
        self.groups[key] = [proof, False]
        return proof

    def attach(self, proof, pid):
        self.events.append("attach")
        self.groups[proof["name"]][1] = True

    def populated(self, proof):
        if self.groups[proof["name"]][0] != proof:
            raise ServiceError("login_containment_unknown", "Synthetic inode mismatch")
        return self.groups[proof["name"]][1]

    async def close(self, proof, **_kwargs):
        self.events.append("kernel_close")
        self.populated(proof)
        if self.closes:
            self.groups[proof["name"]][1] = False
            if self.process is not None:
                self.process.stopped.set()
        return self.closes

    def known_closed(self, proof):
        return self.closed_root and proof == parent_scope().model_dump()

    def remove(self, proof):
        self.events.append("remove")
        self.groups.pop(proof["name"], None)


class FakeStream:
    def __init__(self, value=b"", wait=None):
        self.value, self.wait = value, wait

    async def read(self, _size):
        if self.wait is not None:
            await self.wait.wait()
        value, self.value = self.value, b""
        return value


class FakeInput:
    def __init__(self, kernel):
        self.kernel, self.value = kernel, b""

    def write(self, value):
        self.kernel.events.append("input")
        self.value += value

    async def drain(self):
        return None

    def close(self):
        return None


class FakeProcess:
    pid = 4321

    def __init__(self, kernel, *, held=False):
        self.returncode = None
        self.stopped = asyncio.Event()
        self.stdout = FakeStream(b'{"event":"synthetic"}\n', self.stopped if held else None)
        self.stderr = FakeStream()
        self.stdin = FakeInput(kernel)
        self.held = held
        kernel.process = self

    async def wait(self):
        if self.held:
            await self.stopped.wait()
        self.returncode = 0
        return 0


class OwnerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.state, self.work = self.root / "state", self.root / "work"
        self.state.mkdir(mode=0o700); self.work.mkdir(mode=0o700)
        self.kernel = FakeKernel()
        self.owner = TeacherSDKOwner(self.state / "teacher_sdk_owners", self.work, containment=self.kernel)
        self.enterContext(patch("teacher_sdk_owner.sys.platform", "linux"))
        self.enterContext(patch("teacher_sdk_owner.supervisor_certificate", side_effect=certificate))
        self.enterContext(patch("teacher_sdk_owner.boot_id", return_value=BOOT))
        self.enterContext(patch("teacher_sdk_owner.supervisor_alive", return_value=False))
        self.spawn = self.enterContext(patch("owned_process.asyncio.create_subprocess_exec", side_effect=self.spawned))
        self.process = FakeProcess(self.kernel)
        self.command = [str(self.root / "venv-python"), "-I", str(self.root / "host.py"), "--execute",
            "--profile", str(self.root / "synthetic-profile"), "--manifest", str(self.root / "manifest.json"),
            "--manifest-sha256", MANIFEST]
        self.reference = TeacherStart.model_validate(start_payload()).reference()
        self.addAsyncCleanup(self.finish)

    async def finish(self):
        try:
            await self.owner.close()
        except ServiceError:
            pass  # Expected retained synthetic uncertainty; no real process exists.

    async def spawned(self, *command, **options):
        self.kernel.events.append("spawn")
        self.assertEqual(command[1], "-I")
        self.assertEqual(Path(command[2]).name, "teacher_sdk_launch.py")
        self.assertEqual(options["pass_fds"], (int(command[3]),))
        record = self.owner.read(self.reference.operation_id)
        self.assertEqual(record.reference, self.reference)
        self.assertFalse(record.release_intent)
        self.assertIsNotNone(record.containment)
        return self.process

    async def run_owner(self, **updates):
        options = dict(operation_id=self.reference.operation_id, action="execute", manifest_sha256=MANIFEST,
            reference=self.reference, stdin=b"Synthetic input never journaled", env={}, timeout=2)
        options.update(updates)
        return await self.owner.run(self.command, **options)

    async def test_gate_is_released_only_after_durable_binding_and_kernel_attach(self):
        original = os.write
        def released(fd, value):
            record = self.owner.read(self.reference.operation_id)
            self.assertTrue(record.release_intent)
            self.assertEqual(record.supervisor.pid, self.process.pid)
            self.assertEqual(self.kernel.events, ["create", "spawn", "attach"])
            self.kernel.events.append("gate")
            return original(fd, value)
        with patch("teacher_sdk_owner.os.write", side_effect=released):
            output, code = await self.run_owner()
        self.assertEqual((output, code), (b'{"event":"synthetic"}\n', 0))
        self.assertEqual(self.kernel.events, ["create", "spawn", "attach", "gate", "input", "kernel_close"])
        self.assertTrue(self.owner.process_closed())
        record = self.owner.read(self.reference.operation_id)
        self.assertTrue(record.process_closed)
        self.assertEqual(record.closure_kind, "kernel_empty")
        raw = self.owner._path(self.reference.operation_id).read_bytes()
        self.assertNotIn(b"Synthetic input", raw)
        self.assertNotIn(output, raw)
        self.assertNotIn(b"synthetic-profile", raw)
        with self.assertRaises(ServiceError):
            await self.run_owner()
        self.assertEqual(self.spawn.await_count, 1)

    async def test_spawn_home_and_temporary_directory_are_owned_per_operation(self):
        caller = {"HOME": "caller-home", "USERPROFILE": "caller-profile", "TMPDIR": "caller-temp",
            "PATH": "synthetic-path"}
        before = dict(caller)
        await self.run_owner(env=caller)
        args, options = self.spawn.await_args
        cwd = self.work / self.owner._key(self.reference.operation_id)
        self.assertEqual(options["cwd"], cwd)
        self.assertEqual({key: options["env"][key] for key in ("HOME", "USERPROFILE", "TMPDIR")},
            {key: str(cwd) for key in ("HOME", "USERPROFILE", "TMPDIR")})
        self.assertEqual(options["env"]["PATH"], "synthetic-path")
        self.assertEqual(caller, before, "Caller configuration is never mutated")
        self.assertEqual(list(args[4:]), self.command, "Explicit OAuth profile argument is preserved")
        self.assertEqual(self.owner.workdir, self.work)
        self.assertTrue(self.owner.read(self.reference.operation_id).process_closed)

    async def test_parent_write_failure_keeps_gate_closed_and_still_closes_owned_group(self):
        original = self.owner._write
        def unavailable(record, previous=None):
            if record.release_intent and not record.process_closed:
                raise OSError("Synthetic fsync failure")
            original(record, previous)
        with patch.object(self.owner, "_write", side_effect=unavailable), \
                patch("teacher_sdk_owner.os.write", side_effect=AssertionError("No gate release permitted")):
            with self.assertRaises(OSError):
                await self.run_owner()
        self.assertNotIn("input", self.kernel.events)
        self.assertIn("kernel_close", self.kernel.events)
        self.assertTrue(self.owner.read(self.reference.operation_id).process_closed)

    async def test_sdk_exit_without_kernel_closure_never_returns_output(self):
        self.kernel.closes = False
        with self.assertRaises(ServiceError):
            await self.run_owner()
        self.assertFalse(self.owner.process_closed())
        self.assertFalse(self.owner.read(self.reference.operation_id).process_closed)
        self.assertTrue(self.owner.unclosed_records())
        self.assertTrue(self.owner._processes)

    async def test_cancel_waits_for_kernel_closure_and_keeps_no_replay_record(self):
        self.process = FakeProcess(self.kernel, held=True)
        task = asyncio.create_task(self.run_owner())
        while "input" not in self.kernel.events:
            await asyncio.sleep(0)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(self.owner.read(self.reference.operation_id).process_closed)
        self.assertTrue(self.owner.process_closed())
        self.assertEqual(self.kernel.events.count("kernel_close"), 1)

    async def test_close_cancels_owned_run_and_awaits_shared_kernel_shutdown_once(self):
        self.process = FakeProcess(self.kernel, held=True)
        task = asyncio.create_task(self.run_owner())
        while "input" not in self.kernel.events:
            await asyncio.sleep(0)
        await self.owner.close()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(self.owner.process_closed())
        self.assertEqual(self.kernel.events.count("kernel_close"), 1)
        self.assertFalse(self.owner._processes)

    async def test_uncertain_late_spawn_is_not_adopted_from_empty_handles_or_pid(self):
        self.owner._SPAWN_SECONDS = 0.01
        release = asyncio.Event()
        async def late(*_args, **_kwargs):
            await release.wait()
            return self.process
        self.spawn.side_effect = late
        with self.assertRaises(ServiceError):
            await self.run_owner()
        self.assertFalse(self.owner.process_closed())
        release.set()
        while not self.owner._shutdowns:
            await asyncio.sleep(0)
        await asyncio.gather(*self.owner._shutdowns.values())
        self.assertNotIn("attach", self.kernel.events)
        self.assertNotIn("kernel_close", self.kernel.events)
        self.assertFalse(self.owner.process_closed())
        self.assertFalse(self.owner.recover_local_closure(self.reference))

    async def test_ack_cleanup_requires_private_native_retired_fence_and_does_not_allow_replay(self):
        await self.run_owner()
        with self.assertRaises(ServiceError):
            self.owner.cleanup_owned(self.reference)
        self.assertIsNotNone(self.owner.read(self.reference.operation_id))
        directory = self.state / "teacher_retired"
        directory.mkdir(mode=0o700)
        path = directory / (self.reference.operation_id + ".json")
        raw = json.dumps({"operation_id": self.reference.operation_id, "attempt_id": self.reference.attempt_id,
                          "request_hash": self.reference.request_hash, "ack_digest": "f" * 64}).encode()
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            output.write(raw); output.flush(); os.fsync(output.fileno())
        self.owner.cleanup_owned(self.reference)
        self.assertIsNone(self.owner.read(self.reference.operation_id))
        self.assertEqual(self.kernel.events[-1], "remove")
        self.owner.cleanup_owned(self.reference)  # Exact repeat ACK is harmless.
        with self.assertRaises(ServiceError) as caught:
            await self.run_owner()
        self.assertEqual(caught.exception.code, "teacher_sdk_operation_acknowledged")
        self.assertEqual(self.spawn.await_count, 1)

    def stored(self, *, attached=True):
        proof = self.kernel.create(self.owner._key(self.reference.operation_id))
        record = TeacherSDKOwnerRecord(operation_id=self.reference.operation_id, action="execute",
            manifest_sha256=MANIFEST, stdin_sha256="a" * 64, reference=self.reference,
            owner=SupervisorProof.model_validate(certificate(9876)), root_scope=parent_scope(),
            containment=ContainmentProof.model_validate(proof),
            supervisor=SupervisorProof.model_validate(certificate(4321)) if attached else None,
            release_intent=attached)
        self.owner._write(record)
        return record

    def test_recovery_is_exact_read_only_kernel_evidence_never_remote_completion(self):
        self.stored()
        wrong = self.reference.model_copy(update={"actor_id": "2"})
        self.assertFalse(self.owner.recover_local_closure(wrong))
        with patch("teacher_sdk_owner.supervisor_alive", return_value=True):
            self.assertFalse(self.owner.recover_local_closure(self.reference))
        self.kernel.groups[self.owner._key(self.reference.operation_id)][1] = True
        self.assertFalse(self.owner.recover_local_closure(self.reference))
        self.kernel.groups[self.owner._key(self.reference.operation_id)][1] = False
        self.assertTrue(self.owner.recover_local_closure(self.reference))
        self.assertTrue(self.owner.read(self.reference.operation_id).process_closed)
        self.assertNotIn("kernel_close", self.kernel.events, "Sync recovery never kills")

    def test_empty_group_without_attachment_requires_old_boot_or_exact_closed_root(self):
        self.stored(attached=False)
        self.assertFalse(self.owner.recover_local_closure(self.reference))
        self.kernel.closed_root = True
        self.assertTrue(self.owner.recover_local_closure(self.reference))
        self.assertEqual(self.owner.read(self.reference.operation_id).closure_kind, "attested_root")

    def test_old_boot_proves_closure_even_before_containment_was_persisted(self):
        record = TeacherSDKOwnerRecord(operation_id=self.reference.operation_id, action="execute",
            manifest_sha256=MANIFEST, stdin_sha256="a" * 64, reference=self.reference,
            owner=SupervisorProof.model_validate(certificate(9876)), root_scope=parent_scope())
        self.owner._write(record)
        with patch("teacher_sdk_owner.boot_id", return_value=OTHER_BOOT):
            self.assertTrue(self.owner.recover_local_closure(self.reference))
        self.assertEqual(self.owner.read(self.reference.operation_id).closure_kind, "old_boot")

    def test_old_boot_metadata_without_containment_cleans_exact_record_and_workdir(self):
        operation = str(uuid4())
        record = TeacherSDKOwnerRecord(operation_id=operation, action="observe",
            manifest_sha256=MANIFEST, stdin_sha256="a" * 64, reference=None,
            owner=SupervisorProof.model_validate(certificate(9876)), root_scope=parent_scope())
        self.owner._write(record)
        cwd = self.work / self.owner._key(operation)
        cwd.mkdir(mode=0o700)
        (cwd / "synthetic-only.txt").write_text("fixture", encoding="utf-8")
        with patch("teacher_sdk_owner.boot_id", return_value=OTHER_BOOT):
            self.assertTrue(self.owner.recover_metadata(operation, MANIFEST))
        recovered = self.owner.read(operation)
        self.assertIsNone(recovered.containment)
        self.assertEqual(recovered.closure_kind, "old_boot")
        with patch.object(self.kernel, "remove", side_effect=AssertionError("No group was created")) as remove:
            self.owner.cleanup_metadata(operation, MANIFEST)
        remove.assert_not_called()
        self.assertIsNone(self.owner.read(operation))
        self.assertFalse(cwd.exists())
        self.assertEqual(self.owner.metadata_records(), ())

    async def test_crash_before_group_creation_has_durable_root_and_exact_attested_recovery(self):
        operation = str(uuid4())
        command = list(self.command)
        command[3] = "--observe"
        def crash_before_group(_key):
            record = self.owner.read(operation)
            self.assertEqual(record.root_scope, parent_scope())
            self.assertIsNone(record.containment)
            self.assertIsNone(record.supervisor)
            self.assertFalse(record.release_intent)
            raise ServiceError("login_containment_unavailable", "Synthetic crash before group")
        with patch.object(self.kernel, "create", side_effect=crash_before_group):
            with self.assertRaises(ServiceError):
                await self.owner.run(command, operation_id=operation, action="observe", manifest_sha256=MANIFEST,
                    reference=None, stdin=b"{}", env={}, timeout=2)
        self.spawn.assert_not_awaited()
        fresh_kernel = FakeKernel()
        fresh = TeacherSDKOwner(self.owner.directory, self.work, containment=fresh_kernel)
        with patch.object(fresh_kernel, "_root", return_value=SimpleNamespace(st_dev=1, st_ino=4)):
            self.assertFalse(fresh.recover_metadata(operation, MANIFEST), "Same boot alone proves no closure")
            fresh_kernel.closed_root = True
            self.assertTrue(fresh.recover_metadata(operation, MANIFEST))
            recovered = fresh.read(operation)
            self.assertEqual(recovered.closure_kind, "attested_root")
            self.assertIsNone(recovered.containment)
            self.assertFalse(fresh.recover_metadata(operation, "f" * 64))
            with patch.object(fresh_kernel, "remove", side_effect=AssertionError("No group was created")):
                fresh.cleanup_metadata(operation, MANIFEST)
            self.assertIsNone(fresh.read(operation))
        self.assertNotIn("kernel_close", fresh_kernel.events, "Sync recovery never kills")

    def test_parent_scope_requires_owner_boot_and_exact_containment_binding(self):
        record = self.stored()
        for changes in ({"boot": OTHER_BOOT}, {"device": 2}, {"parent_inode": 4}):
            with self.subTest(changes=changes):
                scope = record.root_scope.model_copy(update=changes)
                with self.assertRaises(ValueError):
                    self.owner._write(record.model_copy(update={"root_scope": scope}), record)
        legacy = record.model_dump()
        del legacy["root_scope"]
        with self.assertRaises(ValueError):
            TeacherSDKOwnerRecord.model_validate(legacy)
        self.assertEqual(self.owner.read(record.operation_id).reference, self.reference)

    async def test_unverified_parent_root_never_arms_journal_or_spawns(self):
        self.kernel.available = False
        with self.assertRaises(ServiceError):
            await self.run_owner()
        self.spawn.assert_not_awaited()
        self.assertIsNone(self.owner.read(self.reference.operation_id))
        self.assertEqual(self.kernel.events, [])

    async def test_root_changes_during_create_never_releases_or_spawns(self):
        create = self.kernel.create
        def changed_root(key):
            proof = create(key)
            return {**proof, "parent_inode": 4}
        with patch.object(self.kernel, "create", side_effect=changed_root):
            with self.assertRaises(ValueError):
                await self.run_owner()
        self.spawn.assert_not_awaited()
        record = self.owner.read(self.reference.operation_id)
        self.assertEqual(record.root_scope, parent_scope())
        self.assertIsNone(record.containment)
        self.assertEqual(record.reference, self.reference)
        self.assertFalse(record.release_intent)
        self.assertFalse(record.process_closed)

    def test_invalid_internal_copy_is_rejected_before_overwriting_durable_record(self):
        record = self.stored(attached=False)
        before = self.owner._path(self.reference.operation_id).read_bytes()
        invalid = record.model_copy(update={"process_closed": True, "closure_kind": "kernel_empty"})
        with self.assertRaises(ValueError):
            self.owner._write(invalid, record)
        self.assertEqual(self.owner._path(self.reference.operation_id).read_bytes(), before)
        self.assertFalse(self.owner.read(self.reference.operation_id).process_closed)

    async def test_metadata_inventory_and_cleanup_are_closed_and_manifest_scoped(self):
        operation = str(uuid4())
        command = list(self.command)
        command[3] = "--observe"
        async def metadata_spawn(*_command, **_options):
            self.kernel.events.append("spawn")
            record = self.owner.read(operation)
            self.assertIsNone(record.reference)
            self.assertEqual(record.action, "observe")
            return self.process
        self.spawn.side_effect = metadata_spawn
        await self.owner.run(command, operation_id=operation, action="observe", manifest_sha256=MANIFEST,
                             reference=None, stdin=b"{}", env={}, timeout=2)
        self.assertEqual(len(self.owner.metadata_records()), 1)
        self.assertFalse(self.owner.unclosed_records())
        with self.assertRaises(ServiceError):
            self.owner.cleanup_metadata(operation, "f" * 64)
        self.assertIsNotNone(self.owner.read(operation))
        self.owner.cleanup_metadata(operation, MANIFEST)
        self.assertEqual(self.owner.metadata_records(), ())
        self.assertTrue(self.owner.process_closed())

    async def test_unknown_inventory_blocks_new_metadata_and_foreign_manifest_cleanup(self):
        self.stored(attached=False)
        self.assertEqual(len(self.owner.unclosed_records()), 1)
        operation = str(uuid4())
        self.command[3] = "--observe"
        with self.assertRaises(ServiceError):
            await self.owner.run(self.command, operation_id=operation, action="observe", manifest_sha256=MANIFEST,
                reference=None, stdin=b"{}", env={}, timeout=2)
        self.spawn.assert_not_awaited()
        with self.assertRaises(ServiceError):
            self.owner.cleanup_metadata(self.reference.operation_id, MANIFEST)

    async def test_login_and_inconsistent_reference_are_rejected_without_spawn(self):
        self.command[3] = "--login"
        with self.assertRaises(ServiceError):
            await self.run_owner()
        self.spawn.assert_not_awaited()
        self.assertFalse(self.owner.directory.exists())


class GateTests(unittest.TestCase):
    def test_cold_import_has_no_sdk_or_operational_effects(self):
        source = """
import builtins, pathlib, subprocess, socket
original = builtins.__import__
def guarded(name, *args, **kwargs):
    if name.startswith(('google3', 'google.antigravity')):
        raise AssertionError('SDK import forbidden')
    return original(name, *args, **kwargs)
builtins.__import__ = guarded
def forbidden(*args, **kwargs):
    raise AssertionError('Operational resource forbidden')
pathlib.Path.mkdir = forbidden
subprocess.Popen.__init__ = forbidden
socket.socket.connect = forbidden
import teacher_sdk_owner, teacher_sdk_launch
"""
        result = subprocess.run([sys.executable, "-c", source], cwd=Path(__file__).resolve().parents[1],
                                capture_output=True, timeout=10, check=False)
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))

    def test_gate_requires_exact_byte_and_eof_with_finite_wait(self):
        for parts, accepted in (([b"1", b""], True), ([b""], False), ([b"11"], False), ([b"0", b""], False)):
            with self.subTest(parts=parts), patch("teacher_sdk_launch.select.select", return_value=([7], [], [])), \
                    patch("teacher_sdk_launch.os.read", side_effect=parts), patch("teacher_sdk_launch.os.close") as close:
                self.assertIs(await_gate(7, timeout=1), accepted)
                close.assert_called_once_with(7)
        with patch("teacher_sdk_launch.select.select", return_value=([], [], [])), \
                patch("teacher_sdk_launch.os.read", side_effect=AssertionError("Timeout cannot release gate")), \
                patch("teacher_sdk_launch.os.close"):
            self.assertFalse(await_gate(7, timeout=0.01))
