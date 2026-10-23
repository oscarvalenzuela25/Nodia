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
from collections.abc import AsyncIterator
from dataclasses import dataclass
from time import monotonic
from typing import Literal, get_args
from uuid import uuid4

from loguru import logger

from service_errors import ServiceError


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
    def __init__(self, web_profile: Path, agentic_profile: Path | None, state_dir: Path | None = None):
        self._identities = {"web": self._identity(web_profile)}
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

    @staticmethod
    def _diagnostic(event: Literal["acquire", "release", "reject", "wait"], engine: str,
                    purpose: ProfilePurpose, owner: _ProfileOwner | None,
                    quarantined: bool = False, reason: str | None = None) -> None:
        value = {"event": event, "engine": engine if engine in ("web", "agentic") else "unknown",
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
                 observational: bool = False) -> ProfileReservation:
        if purpose not in _PURPOSES:
            raise ValueError("Invalid profile reservation purpose")
        identity = self.identity(engine)
        if identity is None:
            self._diagnostic("reject", engine, purpose, None, reason="runtime_unconfigured")
            raise ServiceError("runtime_unconfigured", "El perfil del motor no está configurado.", 503)
        if identity in self._held:
            self._diagnostic("reject", engine, purpose, self._owners.get(identity),
                             identity in self._quarantined, "runtime_busy")
            raise ServiceError("runtime_busy", "El perfil está ocupado por otra operación.", 409)
        # No await between check and acquisition: one process/event loop owner.
        self._held.add(identity)
        owner = _ProfileOwner(engine, purpose, uuid4().hex, monotonic(), observational)
        self._owners[identity] = owner
        self._diagnostic("acquire", engine, purpose, owner)
        return ProfileReservation(self, identity, owner)

    def _observation_owner_available(self, identity: str, engine: str,
                                     purpose: ProfilePurpose) -> None:
        owner = self._owners.get(identity)
        if (identity in self._quarantined
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
                with temporary.open("x", encoding="utf-8") as output:
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

    def reconcile_dispatch(self, engine: str, operation: dict[str, str]) -> None:
        identity = self.identity(engine)
        if identity != operation.get("resource_key"):
            raise ServiceError("native_proof_mismatch", "El recurso no corresponde al perfil.", 409)
        if identity in self._held and identity not in self._quarantined:
            raise ServiceError("runtime_busy", "El perfil tiene una operación activa.", 409)
        current = self._operations.get(engine)
        if self._state_dir is not None and identity is not None:
            marker = self._state_dir / (identity.split(":", 1)[1] + ".unknown")
            if marker.exists():
                if marker.is_symlink() or marker.stat().st_size > 4096:
                    raise ServiceError("native_proof_mismatch", "Marcador nativo no verificable.", 409)
                try:
                    current = json.loads(marker.read_text(encoding="utf-8"))
                except ValueError:
                    raise ServiceError("native_proof_missing", "El marcador histórico requiere conciliación manual.", 409) from None
                if current != operation:
                    raise ServiceError("native_proof_mismatch", "El marcador pertenece a otra operación.", 409)
                marker.unlink()
        if current is not None and current != operation:
            raise ServiceError("native_proof_mismatch", "El perfil pertenece a otra operación.", 409)
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
