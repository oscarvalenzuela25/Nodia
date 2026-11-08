"""Durable, gated SDK process ownership. No SDK/authentication imports or startup IO."""
import asyncio
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import sys
from typing import Literal
from uuid import UUID, uuid4

from pydantic import Field, model_validator

from login_cgroups import LoginCgroups, boot_id, supervisor_certificate, supervisor_alive
from owned_process import OwnedProcessOwner
from service_errors import ServiceError
from teacher_text_contract import Closed, Hex64, UuidString, TeacherReference

RECORD_LIMIT = 8192
STDOUT_LIMIT = 2 * 1024 * 1024


def fail(code: str = "teacher_sdk_cleanup_unknown", status: int = 409) -> ServiceError:
    return ServiceError(code, "La propiedad y el cierre del proceso Teacher requieren verificación.", status)


class SupervisorProof(Closed):
    boot: UuidString
    namespace: str = Field(pattern=r"^pid:\[[1-9][0-9]{0,19}\]$")
    uid: int = Field(ge=0)
    pid: int = Field(ge=1)
    birth: int = Field(ge=1)


class ContainmentProof(Closed):
    kind: Literal["cgroup_v2"]
    name: str = Field(pattern=r"^[0-9a-f]{32}$")
    boot: UuidString
    device: int = Field(gt=0, lt=2**64)
    inode: int = Field(gt=0, lt=2**64)
    parent_inode: int = Field(gt=0, lt=2**64)


class TeacherSDKParentRootProof(Closed):
    boot: UuidString
    device: int = Field(gt=0, lt=2**64)
    parent_inode: int = Field(gt=0, lt=2**64)


class TeacherSDKOwnerRecord(Closed):
    version: Literal[1] = 1
    operation_id: UuidString
    action: Literal["observe", "execute"]
    manifest_sha256: Hex64
    stdin_sha256: Hex64
    reference: TeacherReference | None
    owner: SupervisorProof
    root_scope: TeacherSDKParentRootProof
    containment: ContainmentProof | None = None
    supervisor: SupervisorProof | None = None
    release_intent: bool = False
    process_closed: bool = False
    closure_kind: Literal["kernel_empty", "old_boot", "attested_root"] | None = None

    @model_validator(mode="after")
    def binding(self):
        operation = UUID(self.operation_id)
        if not operation.int or str(operation) != self.operation_id:
            raise ValueError("Canonical nonzero operation required")
        if ((self.action == "execute" and (self.reference is None or self.reference.operation_id != self.operation_id))
                or (self.action == "observe" and self.reference is not None)):
            raise ValueError("Action/reference mismatch")
        if self.containment is not None and self.containment.name != operation.hex:
            raise ValueError("Containment/operation mismatch")
        if self.root_scope.boot != self.owner.boot:
            raise ValueError("Root/owner boot mismatch")
        if self.containment is not None and any(getattr(self.containment, key) != getattr(self.root_scope, key)
                for key in ("boot", "device", "parent_inode")):
            raise ValueError("Containment/root scope mismatch")
        if self.supervisor is not None and (self.supervisor.boot != self.owner.boot
                or self.supervisor.uid != self.owner.uid or self.supervisor.namespace != self.owner.namespace):
            raise ValueError("Supervisor/owner scope mismatch")
        if self.release_intent and (self.containment is None or self.supervisor is None):
            raise ValueError("Release requires durable attachment")
        if self.process_closed != (self.closure_kind is not None):
            raise ValueError("Closure requires kernel evidence")
        if self.process_closed and self.containment is None and self.closure_kind not in ("old_boot", "attested_root"):
            raise ValueError("Closure requires bound containment")
        if self.closure_kind == "kernel_empty" and self.supervisor is None:
            raise ValueError("Empty unbound group is not closure")
        return self


def _unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate key")
        result[key] = value
    return result


def _private_directory(directory: Path, *, private: bool = True) -> None:
    if not directory.is_absolute() or directory.resolve() != directory:
        raise ValueError("Private absolute directory required")
    for parent in (directory, *directory.parents):
        info = parent.lstat()
        if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
            raise ValueError("Private directory required")
        if os.name != "nt" and (info.st_uid not in (0, os.getuid()) or info.st_mode & 0o022):
            if parent != Path("/tmp") or not info.st_mode & stat.S_ISVTX:
                raise ValueError("Unsafe directory ancestor")
    info = directory.stat()
    if os.name != "nt" and (info.st_uid != os.getuid() or (private and stat.S_IMODE(info.st_mode) != 0o700)):
        raise ValueError("Private owned directory required")


def _private_json(path: Path) -> dict:
    _private_directory(path.parent)
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode):
        raise ValueError("Private regular record required")
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
    with os.fdopen(descriptor, "rb") as stream:
        info = os.fstat(stream.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or not 0 < info.st_size <= RECORD_LIMIT
                or (info.st_dev, info.st_ino) != (before.st_dev, before.st_ino)
                or (os.name != "nt" and (info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600))):
            raise ValueError("Invalid private record")
        raw = stream.read(RECORD_LIMIT + 1)
    if len(raw) != info.st_size:
        raise ValueError("Record changed during read")
    result = json.loads(raw, object_pairs_hook=_unique)
    if not isinstance(result, dict):
        raise ValueError("Closed object required")
    return result


class TeacherSDKOwner(OwnedProcessOwner):
    def __init__(self, directory: Path, workdir: Path, *, containment: LoginCgroups | None = None,
                 native_python: Path | None = None):
        super().__init__()
        self.directory, self.workdir = directory, workdir
        self.containment = containment if containment is not None else LoginCgroups()
        self.native_python = native_python if native_python is not None else Path(sys.executable)
        self.launcher = Path(__file__).with_name("teacher_sdk_launch.py")
        self._bindings: dict[asyncio.subprocess.Process, str] = {}
        self._attached: dict[asyncio.subprocess.Process, SupervisorProof] = {}
        self._pending_operation: str | None = None
        self._active: set[str] = set()
        self._runs: set[asyncio.Task] = set()
        self._admission = asyncio.Lock()

    @staticmethod
    def _key(operation_id: str) -> str:
        try:
            parsed = UUID(operation_id)
            if not parsed.int or str(parsed) != operation_id:
                raise ValueError()
            return parsed.hex
        except (ValueError, TypeError, AttributeError):
            raise fail("teacher_sdk_invalid_operation", 422) from None

    def _path(self, operation_id: str) -> Path:
        return self.directory / (self._key(operation_id) + ".json")

    @staticmethod
    def _sync(directory: Path) -> None:
        if os.name != "nt":
            descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)

    def _prepare_directory(self) -> None:
        if not self.directory.is_absolute() or self.directory.parent.resolve() != self.directory.parent:
            raise ValueError("Private journal required")
        self.directory.mkdir(mode=0o700, exist_ok=True)
        _private_directory(self.directory)

    def read(self, operation_id: str) -> TeacherSDKOwnerRecord | None:
        path = self._path(operation_id)
        try:
            value = _private_json(path)
            record = TeacherSDKOwnerRecord.model_validate(value)
            if record.operation_id != operation_id:
                raise ValueError("Filename scope mismatch")
            return record
        except FileNotFoundError:
            return None
        except (ValueError, OSError):
            raise fail("teacher_sdk_owner_invalid") from None

    def _write(self, record: TeacherSDKOwnerRecord, previous: TeacherSDKOwnerRecord | None = None) -> None:
        # model_copy(update=...) bypasses Pydantic validation; never persist an
        # internally inconsistent proof that a restart could not read back.
        record = TeacherSDKOwnerRecord.model_validate(record.model_dump())
        self._prepare_directory()
        raw = record.model_dump_json().encode("utf-8")
        if len(raw) > RECORD_LIMIT:
            raise fail("teacher_sdk_owner_invalid")
        target = self._path(record.operation_id)
        if previous is None:
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(raw); stream.flush(); os.fsync(stream.fileno())
        else:
            if self.read(record.operation_id) != previous:
                raise fail("teacher_sdk_owner_changed")
            temporary = self.directory / (uuid4().hex + ".tmp")
            try:
                descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, "wb") as stream:
                    stream.write(raw); stream.flush(); os.fsync(stream.fileno())
                os.replace(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)
        self._sync(self.directory)

    def _spawn_finished(self, task) -> None:
        if task in self._spawns and task.done() and not task.cancelled() and task.exception() is None:
            process = task.result()
            if self._pending_operation is not None:
                self._bindings[process] = self._pending_operation
        super()._spawn_finished(task)

    @staticmethod
    def _command(command: list[str], action: str, manifest_sha256: str) -> None:
        if (not isinstance(command, list) or not isinstance(manifest_sha256, str)
                or len(command) != 10 or command[1] != "-I" or command[3] != "--" + action
                or command[4] != "--profile" or command[6] != "--manifest"
                or command[8] != "--manifest-sha256" or command[9] != manifest_sha256
                or re.fullmatch(r"[0-9a-f]{64}", manifest_sha256) is None
                or any(not isinstance(value, str) or "\x00" in value for value in command)
                or any(not Path(command[index]).is_absolute() for index in (0, 2, 5, 7))):
            raise fail("teacher_sdk_invalid_command", 422)

    async def run(self, sdk_command: list[str], *, operation_id: str, action: Literal["observe", "execute"],
                  manifest_sha256: str, reference: TeacherReference | None, stdin: bytes,
                  env: dict[str, str], timeout: float) -> tuple[bytes, int]:
        if (sys.platform != "linux" or self._closed or self._admission.locked()
                or not isinstance(stdin, bytes) or len(stdin) > (16384 if action == "observe" else 800000)
                or isinstance(timeout, bool) or not isinstance(timeout, (float, int))
                or not math.isfinite(timeout) or timeout <= 0):
            raise fail("teacher_sdk_runtime_unavailable", 503)
        if action not in ("observe", "execute"):
            raise fail("teacher_sdk_invalid_command", 422)
        self._command(sdk_command, action, manifest_sha256)
        key = self._key(operation_id)
        async with self._admission:
            self._prepare_directory()
            _private_directory(self.workdir, private=False)
            retired = self.directory.parent / "teacher_retired" / (operation_id + ".json")
            try:
                retired.lstat()
            except FileNotFoundError:
                pass
            else:
                raise fail("teacher_sdk_operation_acknowledged")
            if self.read(operation_id) is not None:
                raise fail("teacher_sdk_operation_already_owned")
            if any(not record.process_closed for record in self._records()):
                raise fail("teacher_sdk_cleanup_unknown")
            if len(list(self.directory.glob("*.json"))) >= 64:
                raise fail("teacher_sdk_owner_capacity", 503)
            # Pin the attested delegated root before group creation can become
            # uncertain. A restart can then retain/prove that exact old root.
            parent = self.containment._root()
            root_scope = TeacherSDKParentRootProof(boot=boot_id(), device=parent.st_dev, parent_inode=parent.st_ino)
            record = TeacherSDKOwnerRecord(operation_id=operation_id, action=action,
                manifest_sha256=manifest_sha256, stdin_sha256=sha256(stdin).hexdigest(), reference=reference,
                owner=SupervisorProof.model_validate(supervisor_certificate(os.getpid())), root_scope=root_scope)
            self._write(record)  # An uncertain create/spawn can never be replayed.
            self._active.add(operation_id)
            self._runs.add(asyncio.current_task())
            self._pending_operation = operation_id
            process, read_fd, write_fd, tasks = None, None, None, []
            deadline = asyncio.get_running_loop().time() + timeout
            try:
                proof = ContainmentProof.model_validate(self.containment.create(key))
                updated = record.model_copy(update={"containment": proof})
                self._write(updated, record); record = updated
                cwd = self.workdir / key
                cwd.mkdir(mode=0o700)
                _private_directory(cwd)
                read_fd, write_fd = os.pipe()
                command = [str(self.native_python), "-I", str(self.launcher), str(read_fd), *sdk_command]
                child_env = dict(env)
                child_env.update(HOME=str(cwd), USERPROFILE=str(cwd), TMPDIR=str(cwd))
                process, cancelled = await self._spawn_owned(command, dict(cwd=cwd, env=child_env,
                    stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                    start_new_session=True, pass_fds=(read_fd,)), timeout)
                if cancelled or self._closed:
                    raise asyncio.CancelledError()
                self.containment.attach(proof.model_dump(), process.pid)
                certificate = SupervisorProof.model_validate(supervisor_certificate(process.pid))
                self._attached[process] = certificate
                updated = record.model_copy(update={"supervisor": certificate, "release_intent": True})
                self._write(updated, record); record = updated
                os.write(write_fd, b"1")
                os.close(write_fd); write_fd = None
                os.close(read_fd); read_fd = None

                async def read(stream, *, limit: int, keep: bool) -> bytes:
                    parts, size = [], 0
                    while part := await stream.read(32768):
                        size += len(part)
                        if size > limit:
                            raise fail("teacher_sdk_output_limit", 502)
                        if keep:
                            parts.append(part)
                    return b"".join(parts)

                async def write() -> None:
                    try:
                        process.stdin.write(stdin)
                        await process.stdin.drain()
                    finally:
                        process.stdin.close()

                tasks = [asyncio.create_task(read(process.stdout, limit=STDOUT_LIMIT, keep=True)),
                         asyncio.create_task(read(process.stderr, limit=16384, keep=False)),
                         asyncio.create_task(write()), asyncio.create_task(process.wait())]
                self._io_tasks[process] = tuple(tasks)
                remaining = deadline - asyncio.get_running_loop().time()
                if remaining <= 0:
                    raise TimeoutError()
                output, _discarded, _written, code = await asyncio.wait_for(asyncio.gather(*tasks), remaining)
                return output, code
            finally:
                for descriptor in (write_fd, read_fd):
                    if descriptor is not None:
                        os.close(descriptor)
                try:
                    if process is not None:
                        await self._finish_process(process, tasks)
                finally:
                    self._active.discard(operation_id)
                    self._runs.discard(asyncio.current_task())
                    if not self._spawns and not self._processes and not self._shutdowns:
                        self._pending_operation = None

    async def _shutdown_owned(self, process: asyncio.subprocess.Process) -> bool:
        operation_id = self._bindings.get(process)
        if operation_id is None:
            return False
        record = self.read(operation_id)
        certificate = self._attached.get(process)
        if record is None or record.containment is None or certificate is None:
            # A late gated spawn outside the group has no durable attach proof.
            # EOF stops its launcher; no PID-only kill/absence becomes closure.
            return False
        if not await self.containment.close(record.containment.model_dump(), timeout=2):
            return False
        try:
            await asyncio.wait_for(process.wait(), 0.5)
        except (TimeoutError, OSError):
            return False
        tasks = self._io_tasks.get(process, ())
        if tasks:
            _done, pending = await asyncio.wait(tasks, timeout=self._DRAIN_SECONDS)
            for task in pending:
                task.cancel()
            if pending:
                _done, pending = await asyncio.wait(pending, timeout=0.1)
            if pending:
                return False
            for task in tasks:
                self._observe_task(task)
        updated = record.model_copy(update={"supervisor": certificate, "process_closed": True,
                                            "closure_kind": "kernel_empty"})
        try:
            self._write(updated, record)
        except (ValueError, OSError, ServiceError):
            return False
        self._io_tasks.pop(process, None)
        self._processes.discard(process)
        self._bindings.pop(process, None)
        self._attached.pop(process, None)
        return True

    def _records(self) -> list[TeacherSDKOwnerRecord]:
        try:
            self.directory.lstat()
        except FileNotFoundError:
            return []
        _private_directory(self.directory)
        paths = list(self.directory.glob("*.json"))
        if len(paths) > 64:
            raise fail("teacher_sdk_owner_capacity", 503)
        records = []
        for path in paths:
            if not re.fullmatch(r"[0-9a-f]{32}\.json", path.name):
                raise fail("teacher_sdk_owner_invalid")
            record = self.read(str(UUID(path.stem)))
            if record is None:
                raise fail("teacher_sdk_owner_changed")
            records.append(record)
        return records

    def process_closed(self) -> bool:
        if self._active or self._spawns or self._processes or self._shutdowns or self._io_tasks:
            return False
        try:
            records = self._records()
            if any(not record.process_closed for record in records):
                return False
            if not records:
                # Durable journal precedes every spawn. With none remaining,
                # still verify the real delegated kernel root, not empty handles.
                self.containment._root()
            return True
        except (OSError, ValueError, ServiceError):
            return False

    def unclosed_records(self) -> tuple[TeacherSDKOwnerRecord, ...]:
        """Read-only startup inventory; caller must preserve foreign fences."""
        try:
            return tuple(record for record in self._records() if not record.process_closed)
        except (OSError, ValueError):
            raise fail("teacher_sdk_owner_invalid") from None

    def metadata_records(self) -> tuple[TeacherSDKOwnerRecord, ...]:
        """Bounded startup cleanup inventory, never profile/authentication data."""
        try:
            return tuple(record for record in self._records() if record.action == "observe")
        except (OSError, ValueError):
            raise fail("teacher_sdk_owner_invalid") from None

    def _recover_record(self, record: TeacherSDKOwnerRecord) -> bool:
        operation_id = record.operation_id
        if operation_id in self._active or operation_id in self._bindings.values() or (
                self._pending_operation == operation_id and self._spawns):
            return False
        try:
            if record.process_closed:
                return True
            proof = record.containment
            kind = None
            current_boot = boot_id()
            if str(UUID(current_boot)) != current_boot:
                return False
            if record.owner.boot != current_boot and (proof is None or proof.boot != current_boot):
                kind = "old_boot"  # All kernel processes of that boot are gone.
            elif self.containment.known_closed(record.root_scope.model_dump()):
                kind = "attested_root"
            elif proof is not None and supervisor_alive(record.owner.model_dump()) is False and record.supervisor is not None:
                if self.containment.populated(proof.model_dump()) is False:
                    kind = "kernel_empty"
            if kind is None:
                return False
            self._write(record.model_copy(update={"process_closed": True, "closure_kind": kind}), record)
            return True
        except (OSError, ValueError, ServiceError):
            return False

    def recover_local_closure(self, reference: TeacherReference) -> bool:
        record = self.read(reference.operation_id)
        if record is None or record.action != "execute" or record.reference != reference:
            return False
        return self._recover_record(record)

    def recover_metadata(self, operation_id: str, manifest_sha256: str) -> bool:
        record = self.read(operation_id)
        if (record is None or record.action != "observe" or record.reference is not None
                or record.manifest_sha256 != manifest_sha256):
            return False
        return self._recover_record(record)

    def _cleanup(self, record: TeacherSDKOwnerRecord) -> None:
        if (not record.process_closed or record.operation_id in self._active
                or record.operation_id in self._bindings.values()):
            raise fail()
        key = self._key(record.operation_id)
        cwd = self.workdir / key
        if cwd.exists() or cwd.is_symlink():
            _private_directory(self.workdir, private=False)
            _private_directory(cwd)
            if cwd.parent != self.workdir:
                raise fail("teacher_sdk_owner_invalid")
            shutil.rmtree(cwd)
        if record.containment is not None:
            self.containment.remove(record.containment.model_dump())
        if self.read(record.operation_id) != record:
            raise fail("teacher_sdk_owner_changed")
        self._path(record.operation_id).unlink()
        self._sync(self.directory)

    def cleanup_owned(self, reference: TeacherReference) -> None:
        try:
            record = self.read(reference.operation_id)
            if record is None:
                return
            if record.reference != reference or record.action != "execute":
                raise ValueError()
            retired = _private_json(self.directory.parent / "teacher_retired" / (reference.operation_id + ".json"))
            if (not {"operation_id", "attempt_id", "request_hash", "ack_digest"} <= retired.keys()
                    or retired.keys() - {"operation_id", "attempt_id", "request_hash", "ack_digest", "failure"}
                    or any(retired[key] != getattr(reference, key) for key in ("operation_id", "attempt_id", "request_hash"))
                    or not isinstance(retired["ack_digest"], str) or re.fullmatch(r"[0-9a-f]{64}", retired["ack_digest"]) is None):
                raise ValueError()
            self._cleanup(record)
        except (OSError, ValueError):
            raise fail("teacher_sdk_cleanup_pending") from None

    def cleanup_metadata(self, operation_id: str, manifest_sha256: str) -> None:
        record = self.read(operation_id)
        if record is None:
            return
        if record.action != "observe" or record.reference is not None or record.manifest_sha256 != manifest_sha256:
            raise fail("teacher_sdk_owner_mismatch")
        self._cleanup(record)

    async def close(self) -> None:
        self._closed = True
        current = asyncio.current_task()
        for task in tuple(self._runs):
            if task is not current:
                task.cancel()
        deadline = asyncio.get_running_loop().time() + self._SPAWN_SECONDS
        for spawn in tuple(self._spawns):
            self._spawns[spawn] = True
            await self._wait_owned(spawn, deadline)
        results = await asyncio.gather(*(self._finish_process(process) for process in tuple(self._processes)),
                                       return_exceptions=True)
        runs = {task for task in self._runs if task is not current}
        if runs:
            await asyncio.wait(runs, timeout=self._TERMINATE_SECONDS + self._DRAIN_SECONDS)
        if self._spawns or self._processes or self._shutdowns or self._io_tasks or any(isinstance(x, BaseException) for x in results):
            raise fail()
