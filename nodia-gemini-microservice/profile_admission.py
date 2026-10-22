"""One physical profile owner across chat, OCR, login and discovery.

The process is deliberately single-worker. PostgreSQL worker leases/fences are
owned by Nodia Server; this gate also covers legacy consumers that lack a job.
No caller-supplied connection ID can create additional capacity.
"""
from contextlib import asynccontextmanager
from hashlib import sha256
from pathlib import Path
import os
import json
from collections.abc import AsyncIterator
from uuid import uuid4

from service_errors import ServiceError


class ProfileReservation:
    def __init__(self, gate: "ProfileAdmission", identity: str):
        self.gate = gate
        self.identity = identity
        self.released = False

    def release(self) -> None:
        if not self.released:
            self.released = True
            if self.identity not in self.gate._quarantined:
                self.gate._held.discard(self.identity)


class ProfileAdmission:
    def __init__(self, web_profile: Path, agentic_profile: Path | None, state_dir: Path | None = None):
        self._identities = {"web": self._identity(web_profile)}
        if agentic_profile is not None:
            self._identities["agentic"] = self._identity(agentic_profile)
        self._held: set[str] = set()
        self._quarantined: set[str] = set()
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

    def reserve(self, engine: str) -> ProfileReservation:
        identity = self.identity(engine)
        if identity is None:
            raise ServiceError("runtime_unconfigured", "El perfil del motor no está configurado.", 503)
        if identity in self._held:
            raise ServiceError("runtime_busy", "El perfil está ocupado por otra operación.", 409)
        # No await between check and acquisition: one process/event loop owner.
        self._held.add(identity)
        return ProfileReservation(self, identity)

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

    def quarantine(self, engine: str) -> None:
        identity = self.identity(engine)
        if identity is not None:
            self._quarantined.add(identity)
            self._held.add(identity)

    @asynccontextmanager
    async def operation(self, engine: str) -> AsyncIterator[None]:
        reservation = self.reserve(engine)
        try:
            yield
        finally:
            reservation.release()
