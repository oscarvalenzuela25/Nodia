"""Neutral Teacher ownership over the existing physical profile and native ledger.

Only identity/hashes/closure receipts persist. Prompts and answers never enter the
journal. An armed receipt from another process epoch cannot certify old closure.
"""
import asyncio
from datetime import datetime, timezone
from hashlib import sha256
import json
import math
import os
from pathlib import Path
import stat
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import Field

from native_attempts import NativeAttemptLedger, ReconcileAttempt, AcknowledgeAttempt
from service_errors import ServiceError
from teacher_text_contract import (Closed, Hex64, UuidString, TeacherObserve, TeacherReference, TeacherStart,
    TeacherAck, TeacherAnswer, TeacherObservation, TeacherTerminalProof, TeacherSnapshot, TeacherDispatchExclusion, TeacherCatalogInspection, canonical_hash)
from teacher_text_execution import TeacherCliTransport, unique_pairs, TeacherFailure, classify_failure
from teacher_runtime_backend import TeacherRuntimeBackend, LegacyTeacherBackend


class TeacherAdmission(Closed):
    reference: TeacherReference
    owner_generation: str = Field(pattern=r"^[0-9a-f]{32}$")
    response_hash: Hex64 | None = None
    failure: TeacherFailure | None = None


class TeacherRetired(Closed):
    operation_id: UuidString
    attempt_id: UuidString
    request_hash: Hex64
    ack_digest: Hex64
    failure: TeacherFailure | None = None


class TeacherDispatchExcluded(ServiceError):
    def __init__(self, error: ServiceError, command: TeacherStart):
        super().__init__(error.code, error.message, error.status, error.retry_after)
        self.proof = TeacherDispatchExclusion(operation_id=command.operation_id,
            request_hash=command.request_hash, session_generation=command.session_generation,
            runtime_hash=command.runtime_hash, observed_at=datetime.now(timezone.utc).isoformat())


def fail(code: str, status: int = 409) -> ServiceError:
    return ServiceError(code, "La operación Teacher requiere verificación de identidad y cierre.", status)


class _UnavailableTransport:
    async def execute(self, command: TeacherStart, timeout: float) -> TeacherAnswer:
        raise fail("teacher_runtime_unconfigured", 503)

    def cleanup(self, operation_id: str) -> None:
        return None


class TeacherNativeText:
    def __init__(self, agentic, profiles, *, backend: TeacherRuntimeBackend | None = None, transport=None):
        self.agentic = agentic
        self.profiles = profiles
        self.generation = uuid4().hex
        self.instance_generation = uuid4().hex
        self.backend = backend if backend is not None else LegacyTeacherBackend(agentic, generation=self.generation)
        self.ledger = NativeAttemptLedger(profiles._state_dir / "teacher_attempts"
            if profiles._state_dir is not None else None)
        self.directory = profiles._state_dir / "teacher_owners" if profiles._state_dir is not None else None
        self.retired_directory = profiles._state_dir / "teacher_retired" if profiles._state_dir is not None else None
        self.records: dict[str, TeacherAdmission] = {}
        self.texts: dict[str, str] = {}
        self.tasks: dict[str, asyncio.Task] = {}
        self.retired: dict[str, TeacherRetired] = {}
        self.retired_attempts: set[str] = set()
        # The operational composition must inject its SDK transport. An explicit
        # non-CLI backend never gains a CLI fallback merely by omitting it.
        self.transport = transport if transport is not None else (
            TeacherCliTransport(self.backend.runner) if self.backend.catalog_supported else _UnavailableTransport())
        self.closed = False
        self.admission_lock = asyncio.Lock()
        self.admission_waiters = 0
        self.admitting: dict[str, int] = {}
        self.admitting_attempts: dict[str, int] = {}
        self.inspections: set[asyncio.Task] = set()

    def session_generation(self) -> str:
        return self.backend.session_generation

    def _bind_transport_runner(self) -> None:
        if isinstance(self.transport, TeacherCliTransport):
            self.transport.runner = self.backend.runner

    def _process_closed(self) -> bool:
        return self.backend.process_closed() is True

    def _read(self, operation_id: str) -> TeacherAdmission | None:
        if operation_id in self.records:
            return self.records[operation_id]
        if self.directory is None:
            return None
        path = self.directory / (operation_id + ".json")
        if not path.exists():
            return None
        try:
            fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
            with os.fdopen(fd, "rb") as stream:
                info = os.fstat(stream.fileno())
                if not stat.S_ISREG(info.st_mode) or info.st_size > 8192 or path.is_symlink():
                    raise ValueError("Invalid receipt")
                record = TeacherAdmission.model_validate(json.loads(stream.read(8193), object_pairs_hook=unique_pairs))
            if record.reference.operation_id != operation_id:
                raise ValueError("Owner mismatch")
            self.records[operation_id] = record
            return record
        except (ValueError, OSError):
            raise fail("teacher_owner_receipt_invalid") from None

    def _persist(self, directory: Path, name: str, raw: bytes) -> None:
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        if directory.is_symlink() or directory.resolve() != directory:
            raise fail("teacher_owner_receipt_invalid")
        target = directory / (name + ".json")
        if target.is_symlink():
            raise fail("teacher_owner_receipt_invalid")
        temporary = directory / (uuid4().hex + ".tmp")
        try:
            descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(descriptor, "wb") as stream:
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
            self._sync(directory)
        finally:
            temporary.unlink(missing_ok=True)

    def _write(self, record: TeacherAdmission) -> None:
        operation_id = record.reference.operation_id
        if self.directory is not None:
            self._persist(self.directory, operation_id, record.model_dump_json().encode("utf-8"))
        self.records[operation_id] = record

    def _sync(self, directory: Path | None = None) -> None:
        directory = directory if directory is not None else self.directory
        if directory is not None and os.name != "nt":
            descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)

    def _read_retired(self, operation_id: str) -> TeacherRetired | None:
        if operation_id in self.retired:
            return self.retired[operation_id]
        if self.retired_directory is None:
            return None
        path = self.retired_directory / (operation_id + ".json")
        if not path.exists():
            return None
        try:
            descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
            with os.fdopen(descriptor, "rb") as stream:
                info = os.fstat(stream.fileno())
                if not stat.S_ISREG(info.st_mode) or path.is_symlink() or info.st_size > 8192:
                    raise ValueError("Invalid tombstone")
                record = TeacherRetired.model_validate(json.loads(stream.read(8193), object_pairs_hook=unique_pairs))
            if record.operation_id != operation_id:
                raise ValueError("Invalid tombstone identity")
            self.retired[operation_id] = record
            return record
        except (ValueError, OSError):
            raise fail("teacher_retired_receipt_invalid") from None

    def _exclusion(self, command: TeacherStart) -> bool:
        try:
            return (self._read(command.operation_id) is None and self._read_retired(command.operation_id) is None
                and self.ledger.read(command.attempt_id) is None and command.operation_id not in self.tasks
                and command.attempt_id not in self.retired_attempts
                and not self.admitting.get(command.operation_id) and not self.admitting_attempts.get(command.attempt_id))
        except (OSError, ValueError, ServiceError):
            return False

    async def observe(self, command: TeacherObserve) -> TeacherObservation:
        identity = self.backend.unverified_identity()
        observation = dict(available=False, reason="runtime_unconfigured",
            observed_at=datetime.now(timezone.utc).isoformat(), resource_key=self.profiles.identity("agentic"),
            session_generation=self.session_generation(), runtime_hash=identity.runtime_hash,
            binary_sha512=identity.binary_sha512, policy_hash=identity.policy_hash)
        if observation["resource_key"] is None or isinstance(self.transport, _UnavailableTransport):
            return TeacherObservation(**observation)
        try:
            await self.backend.prepare_admission()
            async with self.profiles.observation("agentic", purpose="eligibility", timeout_seconds=18):
                identity = await self.backend.identity()
                observation.update(binary_sha512=identity.binary_sha512, runtime_hash=identity.runtime_hash,
                                   policy_hash=identity.policy_hash)
                await self._selection(command)
                observation.update(available=True, reason=None)
        except ServiceError as error:
            observation["reason"] = error.code
        except (OSError, ValueError, AttributeError):
            observation["reason"] = "teacher_runtime_unverified"
        # Session replacement during an observation must not publish stale data.
        if observation["session_generation"] != self.session_generation():
            observation.update(available=False, reason="runtime_generation_changed")
        return TeacherObservation(**observation)

    async def _selection(self, command: TeacherObserve) -> None:
        await self.backend.validate_selection(command)

    async def inspect_catalog(self, command: TeacherObserve) -> TeacherCatalogInspection:
        if not self.backend.catalog_supported:
            raise fail("teacher_catalog_inspection_unsupported", 422)
        if self.closed or self.admission_waiters >= 5:
            raise fail("runtime_busy")
        task = asyncio.current_task()
        self.inspections.add(task)
        self.admission_waiters += 1
        try:
            async with asyncio.timeout(18):
                async with self.admission_lock:
                    if self.closed:
                        raise fail("runtime_busy")
                    async with self.profiles.observation("agentic", purpose="discovery", timeout_seconds=18):
                        generation = self.session_generation()
                        identity = await self.backend.identity()
                        if identity.binary_sha512 is None:
                            raise fail("teacher_runtime_unverified", 503)
                        await self._selection(command)
                        if generation != self.session_generation():
                            raise fail("runtime_generation_changed")
                        self._bind_transport_runner()
                        inspection_id = str(uuid4())  # Native workspace identity only; never a Teacher SQL owner.
                        metadata = dict(resource_key=self.profiles.identity("agentic"), session_generation=generation,
                            runtime_hash=identity.runtime_hash, policy_hash=identity.policy_hash,
                            binary_sha512=identity.binary_sha512)
                        try:
                            result = await self.transport.inspect_catalog(inspection_id, command)
                            if generation != self.session_generation():
                                result.update(status="rejected", reason="generation_changed")
                            if not self._process_closed():
                                result.update(status="inconclusive", reason="cli_unavailable")
                            return TeacherCatalogInspection(**result, local_closed=self._process_closed(), **metadata)
                        except (ServiceError, OSError, ValueError):
                            return TeacherCatalogInspection(status="inconclusive", reason="cli_unavailable",
                                local_closed=self._process_closed(), **metadata)
                        finally:
                            if not self._process_closed():
                                self.profiles.quarantine("agentic")
                            else:
                                try:
                                    self.transport.cleanup(inspection_id)
                                except (OSError, ValueError):
                                    self.profiles.quarantine("agentic")
                                    raise fail("teacher_inspection_cleanup_unverified") from None
        except TimeoutError:
            raise fail("teacher_preflight_timeout", 503) from None
        finally:
            self.admission_waiters -= 1
            self.inspections.discard(task)

    @staticmethod
    def _native_reference(reference: TeacherReference) -> ReconcileAttempt:
        return ReconcileAttempt(resource_key=reference.resource_key,
            session_generation=reference.session_generation, operation_ref=reference.operation_id)

    def _marker(self, reference: TeacherReference) -> dict[str, str]:
        return {"attempt_id": reference.attempt_id, **self._native_reference(reference).model_dump()}

    def _assert_reference(self, reference: TeacherReference) -> TeacherAdmission:
        record = self._read(reference.operation_id)
        if record is None:
            raise fail("teacher_operation_missing", 404)
        if record.reference != reference:
            raise fail("teacher_operation_mismatch")
        return record

    def status(self, reference: TeacherReference) -> TeacherSnapshot:
        record = self._assert_reference(reference)
        native = self.ledger.read(reference.attempt_id)
        terminal = None
        state = "running" if reference.operation_id in self.tasks else "unknown"
        if native is not None:
            if (not self.ledger.matches(native, "agentic", self._native_reference(reference))
                    or native.input_digest != reference.request_hash):
                raise fail("teacher_operation_mismatch")
            if native.process_closed and native.state != "dispatch_armed":
                state = "completed" if native.state == "completed" else "unknown"
                terminal = TeacherTerminalProof(**reference.model_dump(), terminal_proof_id=native.terminal_proof_id,
                    process_closed=True, remote_outcome=state, response_hash=record.response_hash,
                    observed_at=native.observed_at)
                if len(terminal.model_dump_json().encode("utf-8")) > 8192:
                    raise fail("teacher_terminal_proof_limit")
        return TeacherSnapshot(operation_id=reference.operation_id, state=state,
            text=self.texts.get(reference.operation_id) if state == "completed" else None, terminal_proof=terminal)

    async def start(self, command: TeacherStart) -> TeacherSnapshot:
        try:
            return await self._start_bound(command)
        except ServiceError as error:
            if 400 <= error.status < 500 and self._exclusion(command):
                raise TeacherDispatchExcluded(error, command) from None
            raise

    async def _start_bound(self, command: TeacherStart) -> TeacherSnapshot:
        if self.admission_waiters >= 5:
            raise fail("runtime_busy")
        self.admission_waiters += 1
        self.admitting[command.operation_id] = self.admitting.get(command.operation_id, 0) + 1
        self.admitting_attempts[command.attempt_id] = self.admitting_attempts.get(command.attempt_id, 0) + 1
        try:
            async with asyncio.timeout(18):
                async with self.admission_lock:
                    return await self._start_locked(command)
        except TimeoutError:
            raise fail("teacher_preflight_timeout", 503) from None
        finally:
            self.admission_waiters -= 1
            for owners, key in ((self.admitting, command.operation_id), (self.admitting_attempts, command.attempt_id)):
                owners[key] -= 1
                if not owners[key]:
                    owners.pop(key)

    async def _start_locked(self, command: TeacherStart) -> TeacherSnapshot:
        reference = command.reference()
        if self._read_retired(command.operation_id) is not None:
            raise fail("teacher_operation_acknowledged")
        if self._read(command.operation_id) is not None:
            self._assert_reference(reference)
            return self.status(reference)
        if command.attempt_id in self.retired_attempts or self.ledger.read(command.attempt_id) is not None:
            raise fail("teacher_attempt_already_owned")
        if self.closed or len(self.retired) >= 10000 or len(self.records) >= 64:
            raise fail("teacher_admission_capacity", 503)
        if self.retired_directory is None:
            raise fail("teacher_persistence_required", 503)
        if sum(1 for _ in self.retired_directory.glob("*.json")) >= 10000:
            raise fail("teacher_admission_capacity", 503)
        if self.directory is not None and len(list(self.directory.glob("*.json"))) >= 64:
            raise fail("teacher_admission_capacity", 503)
        deadline = datetime.fromisoformat(command.deadline_at.replace("Z", "+00:00"))
        if (deadline - datetime.now(timezone.utc)).total_seconds() <= 0:
            raise fail("teacher_deadline_expired", 422)
        if isinstance(self.transport, _UnavailableTransport):
            raise fail("teacher_runtime_unconfigured", 503)
        await self.backend.prepare_admission()
        remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            raise fail("teacher_deadline_expired", 422)
        try:
            reservation = await self.profiles.reserve_teacher_execution("agentic", timeout_seconds=remaining)
        except TimeoutError:
            raise fail("teacher_deadline_expired", 422) from None
        admitted = False
        try:
            identity = await self.backend.identity()
            if (command.resource_key != self.profiles.identity("agentic")
                    or command.session_generation != self.session_generation()
                    or command.policy_hash != identity.policy_hash
                    or command.runtime_hash != identity.runtime_hash):
                raise fail("runtime_generation_changed")
            await self._selection(command)
            if command.session_generation != self.session_generation():
                raise fail("runtime_generation_changed")
            runtime_timeout = self.backend.timeout_seconds
            if (isinstance(runtime_timeout, bool) or not isinstance(runtime_timeout, (int, float))
                    or not math.isfinite(runtime_timeout) or runtime_timeout <= 0):
                raise fail("teacher_runtime_unverified", 503)
            # Server chooses the purpose budget; its signed absolute deadline
            # remains authoritative, including the shorter 120-second purposes.
            timeout = min(300.0, float(runtime_timeout),
                (deadline - datetime.now(timezone.utc)).total_seconds())
            if timeout <= 0:
                raise fail("teacher_deadline_expired", 422)
            record = TeacherAdmission(reference=reference, owner_generation=self.instance_generation)
            self._write(record)
            try:
                self.ledger.arm(command.attempt_id, "agentic", self._native_reference(reference), command.request_hash)
                self.profiles.arm_dispatch("agentic", self._marker(reference))
            except BaseException:
                # A partial durable admission is never treated as permission to replay.
                self.profiles.quarantine("agentic")
                raise
            self._bind_transport_runner()
            task = asyncio.create_task(self._run(command, record, reservation, timeout))
            self.tasks[command.operation_id] = task
            task.add_done_callback(self._task_done)
            admitted = True
            return self.status(reference)
        finally:
            if not admitted:
                reservation.release()

    @staticmethod
    def _task_done(task: asyncio.Task) -> None:
        if not task.cancelled():
            task.exception()  # Observe without logging private prompts/provider output.

    async def _run(self, command: TeacherStart, record: TeacherAdmission, reservation, timeout: float) -> None:
        reference = record.reference
        native = self.ledger.read(reference.attempt_id)
        cleanup_allowed = False
        try:
            # Scheduling and filesystem preparation never extend the caller's deadline.
            timeout = min(timeout, (datetime.fromisoformat(command.deadline_at.replace("Z", "+00:00"))
                - datetime.now(timezone.utc)).total_seconds())
            if timeout <= 0:
                raise fail("teacher_deadline_expired", 422)
            async with asyncio.timeout(timeout):
                answer = await self.transport.execute(command, timeout)
            if not self._process_closed():
                raise fail("native_operation_active_or_unverified")
            if reference.session_generation != self.session_generation():
                raise fail("runtime_generation_changed")
            self._write(record.model_copy(update={"response_hash": sha256(answer.text.encode("utf-8")).hexdigest()}))
            self.ledger.close(native, "completed")
            cleanup_allowed = True
            self.texts[reference.operation_id] = answer.text
            self.profiles.resolve_dispatch("agentic")
        except (Exception, asyncio.CancelledError) as error:
            cleanup_allowed = False
            self.profiles.quarantine("agentic")
            # Fixed enum only; no exception message, prompt, stderr or provider output.
            # If this write fails, retain the workspace and armed fence for review.
            self._write(record.model_copy(update={"failure": classify_failure(error)}))
            cleanup_allowed = True
            if native is not None and self._process_closed():
                # Local process termination does not claim remote cancellation/success.
                try:
                    self.ledger.close(native, "abandoned_unknown")
                except (OSError, ValueError, ServiceError):
                    pass
            if isinstance(error, asyncio.CancelledError):
                raise
        finally:
            try:
                if cleanup_allowed and self._process_closed():
                    self.transport.cleanup(reference.operation_id)
            finally:
                self.tasks.pop(reference.operation_id, None)
                reservation.release()

    def reconcile(self, reference: TeacherReference) -> TeacherSnapshot:
        record = self._assert_reference(reference)
        native = self.ledger.read(reference.attempt_id)
        if reference.operation_id in self.tasks:
            raise fail("native_operation_active_or_unverified")
        if (native is None or not self.ledger.matches(native, "agentic", self._native_reference(reference))
                or native.input_digest != reference.request_hash):
            raise fail("teacher_operation_mismatch")
        recovered = False
        same_owner = (record.owner_generation == self.instance_generation
                      and reference.session_generation == self.session_generation())
        if native.state == "dispatch_armed" and not same_owner:
            recovered = self.backend.recover_local_closure(reference) is True
            if not recovered:
                raise fail("teacher_original_owner_closure_required")
        if not recovered and not self._process_closed():
            if native.state == "dispatch_armed":
                recovered = self.backend.recover_local_closure(reference) is True
            if not recovered:
                raise fail("native_operation_active_or_unverified")
        if native.state == "dispatch_armed":
            # A replacement runtime needs an exact durable local-closure proof;
            # it can only retire uncertainty, never recover text or replay.
            self.profiles.validate_reconcile_dispatch("agentic", self._marker(reference))
            if record.failure is None:
                record = record.model_copy(update={"failure": TeacherFailure(
                    stage="closure", code="reconciled_without_diagnostic")})
                self._write(record)
            self.ledger.close(native, "abandoned_unknown")
        snapshot = self.status(reference)
        if snapshot.terminal_proof is None:
            raise fail("native_proof_missing")
        self.profiles.reconcile_dispatch("agentic", self._marker(reference))
        self.transport.cleanup(reference.operation_id)
        return snapshot

    def acknowledge(self, command: TeacherAck) -> dict[str, bool]:
        previous = self._read_retired(command.operation_id)
        if previous is not None:
            if previous.ack_digest != canonical_hash(command.model_dump()):
                raise fail("teacher_terminal_proof_mismatch")
            self._ack_cleanup(command)
            return {"acknowledged": True}
        reference = TeacherReference.model_validate(command.model_dump(exclude={"terminal_proof_id", "response_hash"}))
        snapshot = self.status(reference)
        terminal = snapshot.terminal_proof
        if (terminal is None or terminal.terminal_proof_id != command.terminal_proof_id
                or terminal.response_hash != command.response_hash):
            raise fail("teacher_terminal_proof_mismatch")
        self.reconcile(reference)
        retired = TeacherRetired(operation_id=command.operation_id, attempt_id=command.attempt_id,
            request_hash=command.request_hash, ack_digest=canonical_hash(command.model_dump()),
            failure=self._assert_reference(reference).failure)
        if self.retired_directory is None:
            raise fail("teacher_persistence_required", 503)
        # A durable minimal no-replay fence precedes deletion of terminal receipts.
        self._persist(self.retired_directory, command.operation_id, retired.model_dump_json(exclude_none=True).encode("utf-8"))
        self.retired[command.operation_id] = retired
        self._ack_cleanup(command)
        return {"acknowledged": True}

    def _ack_cleanup(self, command: TeacherAck) -> None:
        reference = TeacherReference.model_validate(command.model_dump(exclude={"terminal_proof_id", "response_hash"}))
        self.ledger.acknowledge(reference.attempt_id, "agentic", AcknowledgeAttempt(
            **self._native_reference(reference).model_dump(), terminal_proof_id=command.terminal_proof_id))
        self.backend.cleanup_owned(reference)
        if self.directory is not None:
            (self.directory / (reference.operation_id + ".json")).unlink(missing_ok=True)
            self._sync()
        self.records.pop(reference.operation_id, None)
        self.texts.pop(reference.operation_id, None)
        self.retired_attempts.add(reference.attempt_id)

    async def close(self) -> None:
        self.closed = True
        tasks = list(self.tasks.values()) + list(self.inspections)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


def register_teacher_text_routes(application: FastAPI) -> None:
    @application.post("/teacher/agentic-text/inspect-catalog", response_model=TeacherCatalogInspection)
    async def inspect_catalog(command: TeacherObserve, request: Request) -> TeacherCatalogInspection:
        return await request.app.state.teacher_text.inspect_catalog(command)

    @application.post("/teacher/agentic-text/observe", response_model=TeacherObservation)
    async def observe(command: TeacherObserve, request: Request) -> TeacherObservation:
        return await request.app.state.teacher_text.observe(command)

    @application.post("/teacher/agentic-text/start", response_model=TeacherSnapshot, status_code=202)
    async def start(command: TeacherStart, request: Request) -> TeacherSnapshot | JSONResponse:
        try:
            return await request.app.state.teacher_text.start(command)
        except TeacherDispatchExcluded as error:
            request.state.error_code = error.code
            return JSONResponse({"code": error.code, "detail": error.message,
                "dispatch_exclusion_proof": error.proof.model_dump()}, status_code=error.status)

    @application.post("/teacher/agentic-text/status", response_model=TeacherSnapshot)
    async def status(command: TeacherReference, request: Request) -> TeacherSnapshot:
        return request.app.state.teacher_text.status(command)

    @application.post("/teacher/agentic-text/reconcile", response_model=TeacherSnapshot)
    async def reconcile(command: TeacherReference, request: Request) -> TeacherSnapshot:
        return request.app.state.teacher_text.reconcile(command)

    @application.post("/teacher/agentic-text/ack")
    async def acknowledge(command: TeacherAck, request: Request) -> dict[str, bool]:
        return request.app.state.teacher_text.acknowledge(command)
