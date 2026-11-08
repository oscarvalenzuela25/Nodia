"""One physical profile owner across chat, OCR, login and discovery.

The process is deliberately single-worker. PostgreSQL worker leases/fences are
owned by Nodia Server; this gate also covers legacy consumers that lack a job.
No caller-supplied connection ID can create additional capacity.
"""
from contextlib import asynccontextmanager
from hashlib import sha256
from pathlib import Path
import asyncio
import math
import os
import json
import stat
from collections.abc import AsyncIterator
from dataclasses import dataclass
from time import monotonic
from typing import Literal, get_args
from uuid import uuid4

from loguru import logger

from service_errors import ServiceError
from private_state_json import read_private_json


ProfilePurpose = Literal["legacy", "health_status", "eligibility", "login", "execution",
                         "mcp_execution", "discovery", "startup", "logout", "refresh"]
_PURPOSES = frozenset(get_args(ProfilePurpose))
# Nodia's bounded observational admission policy (ADR-071), not provider quota.
MAX_PROFILE_OBSERVATION_WAITERS = 4


@dataclass(frozen=True)
class _ProfileOwner:
    engine: str
    purpose: ProfilePurpose
    nonce: str
    acquired_at: float
    observational: bool = False


class ProfileReservation:
    def __init__(self, gate: "ProfileAdmission", identity: str, owner: _ProfileOwner):
        self.gate = gate
        self.identity = identity
        self._owner = owner
        self.released = False

    def release(self) -> None:
        if not self.released:
            self.released = True
            if (self.gate._owners.get(self.identity) is self._owner
                    and self.identity not in self.gate._quarantined):
                self.gate._held.discard(self.identity)
                self.gate._owners.pop(self.identity, None)
            self.gate._diagnostic("release", self._owner.engine, self._owner.purpose,
                                  self._owner, self.identity in self.gate._quarantined)


class ProfileAdmission:
    def __init__(self, agentic_profile: Path | None, state_dir: Path | None = None):
        self._identities: dict[str, str] = {}
        if agentic_profile is not None:
            self._identities["agentic"] = self._identity(agentic_profile)
        self._held: set[str] = set()
        self._quarantined: set[str] = set()
        # At most one current diagnostic owner per configured physical profile;
        # no history, request payload, path, account or session is retained here.
        self._owners: dict[str, _ProfileOwner] = {}
        # Only this explicit context coordinates metadata. Log labels never grant
        # access; legacy/execution/login reservations remain fail-fast.
        identities = set(self._identities.values())
        self._observation_locks = {identity: asyncio.Lock() for identity in identities}
        self._observation_admitted = {identity: 0 for identity in identities}
        # One Teacher admission turn; pending observations cannot overtake it.
        self._teacher_execution_pending: set[str] = set()
        self._state_dir = state_dir
        self._operations: dict[str, dict[str, str]] = {}
        if state_dir is not None:
            for identity in self._identities.values():
                if (state_dir / (identity.split(":", 1)[1] + ".unknown")).exists():
                    self._quarantined.add(identity)
                    self._held.add(identity)

    @staticmethod
    def _identity(profile: Path) -> str:
        return "gemini-profile:" + sha256(os.path.normcase(str(profile.resolve())).encode()).hexdigest()

    def identity(self, engine: str) -> str | None:
        return self._identities.get(engine)

    def read_dispatch_marker(self, engine: str) -> dict | None:
        """Read metadata without following links or admitting an operation."""
        identity = self.identity(engine)
        if self._state_dir is None or identity is None:
            return None
        try:
            return read_private_json(self._state_dir, identity.split(":", 1)[1] + ".unknown")
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ServiceError("native_proof_missing", "El marcador anterior requiere conciliación verificable.", 409) from None
        except (OSError, ValueError, RecursionError, OverflowError):
            raise ServiceError("native_proof_mismatch", "El marcador nativo no es verificable.", 409) from None

    def recovery_permitted(self, engine: str) -> bool:
        """Recovery cannot interfere with a current, unquarantined reservation."""
        identity = self.identity(engine)
        return identity is not None and (identity not in self._held or identity in self._quarantined)

    @staticmethod
    def _diagnostic(event: Literal["acquire", "release", "reject", "wait"], engine: str,
                    purpose: ProfilePurpose, owner: _ProfileOwner | None,
                    quarantined: bool = False, reason: str | None = None) -> None:
        value = {"event": event, "engine": engine if engine == "agentic" else "unknown",
                 "purpose": purpose, "reservation_nonce": owner.nonce if owner else None,
                 "owner_engine": owner.engine if owner else None,
                 "owner_purpose": owner.purpose if owner else None,
                 "elapsed_ms": max(0, round((monotonic() - owner.acquired_at) * 1000)) if owner else None,
                 "quarantined": quarantined, "reason": reason}
        try:
            logger.info("nodia_ai_profile_reservation {}", json.dumps(value, separators=(",", ":")))
        except Exception:
            # Diagnostics cannot change admission or turn completed work unknown.
            pass

    def reserve(self, engine: str, *, purpose: ProfilePurpose = "legacy") -> ProfileReservation:
        return self._reserve(engine, purpose=purpose)

    def _reserve(self, engine: str, *, purpose: ProfilePurpose,
                 observational: bool = False, teacher_turn: bool = False) -> ProfileReservation:
        if purpose not in _PURPOSES:
            raise ValueError("Invalid profile reservation purpose")
        identity = self.identity(engine)
        if identity is None:
            self._diagnostic("reject", engine, purpose, None, reason="runtime_unconfigured")
            raise ServiceError("runtime_unconfigured", "El perfil del motor no está configurado.", 503)
        if identity in self._held or (identity in self._teacher_execution_pending and not teacher_turn):
            self._diagnostic("reject", engine, purpose, self._owners.get(identity),
                             identity in self._quarantined, "runtime_busy")
            raise ServiceError("runtime_busy", "El perfil está ocupado por otra operación.", 409)
        # No await between check and acquisition: one process/event loop owner.
        self._held.add(identity)
        owner = _ProfileOwner(engine, purpose, uuid4().hex, monotonic(), observational)
        self._owners[identity] = owner
        self._diagnostic("acquire", engine, purpose, owner)
        return ProfileReservation(self, identity, owner)

    async def reserve_teacher_execution(self, engine: str, *, timeout_seconds: float) -> ProfileReservation:
        """Wait only for a real observational lease, within the caller's deadline.

        The Teacher preflight scope remains the outer bound. Other writers keep
        their synchronous fail-fast API; a diagnostic purpose never grants wait.
        """
        if (type(timeout_seconds) not in (int, float)
                or not math.isfinite(timeout_seconds) or timeout_seconds <= 0):
            raise ValueError("Invalid Teacher admission timeout")
        identity = self.identity(engine)
        if identity is None:
            raise ServiceError("runtime_unconfigured", "El perfil del motor no está configurado.", 503)
        owner = self._owners.get(identity)
        if (identity in self._teacher_execution_pending or identity in self._quarantined
                or (identity in self._held and (owner is None or not owner.observational))):
            self._diagnostic("reject", engine, "execution", owner, identity in self._quarantined, "runtime_busy")
            raise ServiceError("runtime_busy", "El perfil está ocupado por otra operación.", 409)
        lock = self._observation_locks[identity]
        self._teacher_execution_pending.add(identity)
        acquired = False
        try:
            async with asyncio.timeout(timeout_seconds):
                if lock.locked():
                    self._diagnostic("wait", engine, "execution", owner)
                await lock.acquire()
                acquired = True
                # Quarantine/exclusive ownership may have changed during cleanup.
                if identity in self._quarantined or self.identity(engine) != identity:
                    raise ServiceError("runtime_busy", "El perfil está ocupado por otra operación.", 409)
                return self._reserve(engine, purpose="execution", teacher_turn=True)
        finally:
            self._teacher_execution_pending.discard(identity)
            if acquired:
                lock.release()

    def _observation_owner_available(self, identity: str, engine: str,
                                     purpose: ProfilePurpose) -> None:
        owner = self._owners.get(identity)
        if (identity in self._quarantined or identity in self._teacher_execution_pending
                or (identity in self._held and (owner is None or not owner.observational))):
            self._diagnostic("reject", engine, purpose, owner,
                             identity in self._quarantined, "runtime_busy")
            raise ServiceError("runtime_busy", "El perfil está ocupado por otra operación.", 409)

    @asynccontextmanager
    async def observation(self, engine: str, *, purpose: ProfilePurpose,
                          timeout_seconds: float) -> AsyncIterator[None]:
        """Serialize bounded metadata work; timeout includes waiting and body.

        The caller owns real CLI cleanup. Cancellation does not release capacity
        until that body unwinds; cleanup can therefore exceed the work deadline.
        """
        if purpose not in _PURPOSES:
            raise ValueError("Invalid profile reservation purpose")
        if (type(timeout_seconds) not in (int, float)
                or not math.isfinite(timeout_seconds) or timeout_seconds <= 0):
            raise ValueError("Invalid profile observation timeout")
        identity = self.identity(engine)
        if identity is None:
            self._diagnostic("reject", engine, purpose, None, reason="runtime_unconfigured")
            raise ServiceError("runtime_unconfigured", "El perfil del motor no está configurado.", 503)
        self._observation_owner_available(identity, engine, purpose)
        if self._observation_admitted[identity] >= MAX_PROFILE_OBSERVATION_WAITERS + 1:
            self._diagnostic("reject", engine, purpose, self._owners.get(identity),
                             identity in self._quarantined, "runtime_busy")
            raise ServiceError("runtime_busy", "El perfil está ocupado por otra operación.", 409)
        # Count before awaiting, including FIFO handoff gaps; never inspect the
        # private queue of asyncio.Lock. There are at most one owner + 4 waiters.
        self._observation_admitted[identity] += 1
        lock = self._observation_locks[identity]
        acquired = False
        reservation = None
        deadline = asyncio.timeout(timeout_seconds)
        try:
            async with deadline:
                if self._observation_admitted[identity] > 1:
                    self._diagnostic("wait", engine, purpose, self._owners.get(identity))
                await lock.acquire()
                acquired = True
                # An exclusive owner may arrive during a FIFO handoff; its real
                # ownership/quarantine still wins over an observational waiter.
                self._observation_owner_available(identity, engine, purpose)
                reservation = self._reserve(engine, purpose=purpose, observational=True)
                yield
        except TimeoutError:
            if deadline.expired():
                raise ServiceError("agentic_timeout", "Tiempo de observación agéntica agotado.", 504) from None
            raise
        finally:
            if reservation is not None:
                reservation.release()
            if acquired:
                lock.release()
            self._observation_admitted[identity] -= 1

    def arm_dispatch(self, engine: str, operation: dict[str, str] | None = None) -> None:
        identity = self.identity(engine)
        if identity is None or identity not in self._held:
            raise ServiceError("runtime_unconfigured", "El perfil no está reservado.", 503)
        if operation is not None:
            self._operations[engine] = operation.copy()
        if self._state_dir is not None:
            self._state_dir.mkdir(parents=True, exist_ok=True)
            target = self._state_dir / (identity.split(":", 1)[1] + ".unknown")
            temporary = self._state_dir / (uuid4().hex + ".tmp")
            try:
                descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
                    output.write(json.dumps(operation, sort_keys=True) if operation is not None else "unknown\n")
                    output.flush()
                    os.fsync(output.fileno())
                os.replace(temporary, target)
                if os.name != "nt":
                    descriptor = os.open(self._state_dir, os.O_RDONLY | os.O_DIRECTORY)
                    try:
                        os.fsync(descriptor)
                    finally:
                        os.close(descriptor)
            finally:
                temporary.unlink(missing_ok=True)

    def resolve_dispatch(self, engine: str) -> None:
        self._operations.pop(engine, None)
        identity = self.identity(engine)
        if self._state_dir is not None and identity is not None:
            (self._state_dir / (identity.split(":", 1)[1] + ".unknown")).unlink(missing_ok=True)
            self._sync_state()

    def _sync_state(self) -> None:
        if os.name != "nt" and self._state_dir is not None and self._state_dir.exists():
            descriptor = os.open(self._state_dir, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)

    def resolve_current_dispatch(self, engine: str, operation: dict[str, str]) -> None:
        """Close an exact nested metadata fence, preserving its caller's owner.

        Reconciliation releases quarantined capacity. Live metadata instead
        borrows a current observation/execution reservation and must retain it.
        The caller supplies positive process-closure evidence before this call.
        """
        identity = self.identity(engine)
        owner = self._owners.get(identity)
        if (identity is None or identity not in self._held or identity in self._quarantined
                or owner is None or owner.engine != engine or operation.get("resource_key") != identity
                or self._operations.get(engine) != operation):
            raise ServiceError("native_proof_mismatch", "La reserva no pertenece a esta operación.", 409)
        if self._state_dir is not None:
            path = self._state_dir / (identity.split(":", 1)[1] + ".unknown")
            try:
                descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
                with os.fdopen(descriptor, "rb") as source:
                    info = os.fstat(source.fileno())
                    if (not stat.S_ISREG(info.st_mode) or info.st_size > 4096
                            or (os.name != "nt" and (info.st_uid != os.getuid() or info.st_mode & 0o077))):
                        raise ValueError()
                    raw = source.read(4097)
                def unique(pairs):
                    result = {}
                    for key, value in pairs:
                        if key in result:
                            raise ValueError()
                        result[key] = value
                    return result
                if json.loads(raw, object_pairs_hook=unique) != operation:
                    raise ValueError()
            except (OSError, ValueError):
                raise ServiceError("native_proof_mismatch", "El marcador pertenece a otra operación.", 409) from None
        self.resolve_dispatch(engine)

    def validate_reconcile_dispatch(self, engine: str, operation: dict[str, str]) -> None:
        """Validate ownership without clearing a marker, quarantine or owner."""
        identity = self.identity(engine)
        if identity != operation.get("resource_key"):
            raise ServiceError("native_proof_mismatch", "El recurso no corresponde al perfil.", 409)
        if identity in self._held and identity not in self._quarantined:
            raise ServiceError("runtime_busy", "El perfil tiene una operación activa.", 409)
        owner = self._owners.get(identity)
        if owner is not None and owner.engine != engine:
            raise ServiceError("native_proof_mismatch", "El perfil pertenece a otra operación.", 409)
        owned = False
        for owner_engine, current in self._operations.items():
            if self.identity(owner_engine) == identity:
                if current != operation:
                    raise ServiceError("native_proof_mismatch", "El perfil pertenece a otra operación.", 409)
                owned = True
        current = self.read_dispatch_marker(engine)
        if current is not None:
            if current != operation:
                raise ServiceError("native_proof_mismatch", "El marcador pertenece a otra operación.", 409)
            owned = True
        if identity in self._quarantined and not owned:
            raise ServiceError("native_proof_missing", "El perfil requiere conciliación verificable.", 409)

    def reconcile_dispatch(self, engine: str, operation: dict[str, str]) -> None:
        self.validate_reconcile_dispatch(engine, operation)
        identity = self.identity(engine)
        if self._state_dir is not None and identity is not None:
            (self._state_dir / (identity.split(":", 1)[1] + ".unknown")).unlink(missing_ok=True)
            self._sync_state()
        self._operations.pop(engine, None)
        if identity is not None:
            self._quarantined.discard(identity)
            self._held.discard(identity)
            self._owners.pop(identity, None)

    def quarantine(self, engine: str) -> None:
        identity = self.identity(engine)
        if identity is not None:
            self._quarantined.add(identity)
            self._held.add(identity)

    @asynccontextmanager
    async def operation(self, engine: str, *, purpose: ProfilePurpose = "legacy") -> AsyncIterator[None]:
        reservation = self.reserve(engine, purpose=purpose)
        try:
            yield
        finally:
            reservation.release()
