"""Teacher runtime boundary; importing it never loads an SDK or credentials.

Legacy support is explicit compatibility for the historical CLI diagnostics and
tests. The application composition selects the operational backend separately.
"""
from dataclasses import dataclass
import math
from typing import Protocol
from uuid import uuid4

from service_errors import ServiceError
from teacher_text_contract import TeacherObserve, TeacherReference
from teacher_text_execution import policy_hash, runtime_hash, verified_binary, process_closed


@dataclass(frozen=True)
class TeacherRuntimeIdentity:
    binary_sha512: str | None
    runtime_hash: str
    policy_hash: str


class TeacherRuntimeBackend(Protocol):
    async def prepare_admission(self) -> None: ...
    @property
    def runner(self) -> object | None: ...

    @property
    def session_generation(self) -> str: ...

    @property
    def timeout_seconds(self) -> float: ...

    @property
    def catalog_supported(self) -> bool: ...

    async def identity(self) -> TeacherRuntimeIdentity: ...

    def unverified_identity(self) -> TeacherRuntimeIdentity: ...

    async def validate_selection(self, command: TeacherObserve) -> None: ...

    def process_closed(self) -> bool: ...

    def recover_local_closure(self, reference: TeacherReference) -> bool: ...

    def cleanup_owned(self, reference: TeacherReference) -> None: ...


class LegacyAgenticSource(Protocol):
    runner: object | None
    session_generation: str

    def is_available(self) -> bool: ...

    async def get_status(self) -> dict[str, object]: ...

    async def validate_model_option(self, model_id: str, effort_id: str | None,
                                    configuration_generation: str) -> bool: ...


def _unavailable(code: str, status: int = 503) -> ServiceError:
    return ServiceError(code, "El motor Teacher requiere una selección y una identidad verificadas.", status)


class LegacyTeacherBackend:
    """Adapter for the original CLI identity/selection/closure semantics only."""

    catalog_supported = True

    def __init__(self, agentic: LegacyAgenticSource, *, generation: str | None = None):
        self._agentic = agentic
        self._generation = generation if generation is not None else uuid4().hex

    async def prepare_admission(self) -> None:
        return None

    @property
    def runner(self) -> object | None:
        return getattr(self._agentic, "runner", None)

    @property
    def session_generation(self) -> str:
        return getattr(self._agentic, "session_generation", self._generation)

    @property
    def timeout_seconds(self) -> float:
        value = getattr(getattr(self.runner, "config", None), "timeout", None)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise _unavailable("teacher_runtime_unverified")
        return float(value)

    def _version(self) -> str | None:
        version = getattr(getattr(self.runner, "config", None), "version", None)
        return version if isinstance(version, str) else None

    def unverified_identity(self) -> TeacherRuntimeIdentity:
        return TeacherRuntimeIdentity(None, runtime_hash(None, self._version()), policy_hash())

    async def identity(self) -> TeacherRuntimeIdentity:
        binary = await verified_binary(self.runner)
        return TeacherRuntimeIdentity(binary, runtime_hash(binary, self._version()), policy_hash())

    async def validate_selection(self, command: TeacherObserve) -> None:
        if not self._agentic.is_available() or self.runner is None:
            raise _unavailable("agentic_unavailable")
        status = await self._agentic.get_status()
        if (not isinstance(status, dict) or status.get("available") is not True
                or status.get("has_active_session") is not True):
            raise _unavailable("session_required")
        models = status.get("models")
        if (not isinstance(models, list)
                or len([model for model in models if isinstance(model, dict)
                        and model.get("id") == command.model_id]) != 1):
            raise _unavailable("model_unavailable", 422)
        if await self._agentic.validate_model_option(command.model_id, command.effort_id,
                                                     command.configuration_generation) is not True:
            raise _unavailable("model_option_mismatch", 422)

    def process_closed(self) -> bool:
        return process_closed(self.runner)

    def recover_local_closure(self, reference: TeacherReference) -> bool:
        # Empty handles in a replacement process never attest an old owner.
        return False

    def cleanup_owned(self, reference: TeacherReference) -> None:
        # The historical CLI has no separate durable owned-process journal.
        return None
