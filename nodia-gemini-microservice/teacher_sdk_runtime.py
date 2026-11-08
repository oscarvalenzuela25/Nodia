"""Native composition of the bounded Teacher SDK child. No SDK or IO on import."""
import asyncio
from dataclasses import dataclass
from hashlib import sha256, sha512
import json
import os
from pathlib import Path
import re
import stat
import sys
import sysconfig
from typing import Literal, Mapping
from uuid import uuid4

from pydantic import Field

from service_errors import ServiceError
from teacher_runtime_backend import TeacherRuntimeIdentity
from teacher_sdk_policy import (CONTRACT, Closed, TeacherSDKAnswer, TeacherSDKHostRequest,
    TeacherSDKObserveRequest, canonical_hash, strict_json)
from teacher_text_contract import TeacherObserve, TeacherReference, TeacherStart, TeacherAnswer
from teacher_text_execution import TeacherExecutionError
from teacher_sdk_diagnostics import SDKDiagnosticContext, TeacherSDKDiagnostics

_HEX = re.compile(r"^[0-9a-f]{64}$")
_EPOCH = re.compile(r"^[0-9a-f]{32}$")
_SOURCE_FILES = ("teacher_sdk_runtime.py", "teacher_sdk_owner.py", "teacher_sdk_launch.py", "teacher_sdk_diagnostics.py",
    "teacher_runtime_backend.py", "native_teacher_text.py", "teacher_text_contract.py",
    "teacher_text_execution.py", "owned_process.py", "login_cgroups.py", "native_attempts.py", "profile_admission.py")


def _fail(code: str, status: int = 503) -> ServiceError:
    return ServiceError(code, "El motor Teacher requiere configuración, sesión e identidad verificadas.", status)


def _digest_file(path: Path, algorithm: str = "sha256") -> str:
    digest = sha256() if algorithm == "sha256" else sha512()
    with path.open("rb") as source:
        while chunk := source.read(262144):
            digest.update(chunk)
    return digest.hexdigest()


def _public_file(path: Path, maximum: int) -> bytes:
    if not path.is_absolute() or path.is_symlink() or path.resolve() != path:
        raise _fail("teacher_runtime_unverified")
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(descriptor, "rb") as source:
        info = os.fstat(source.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022
                or info.st_size > maximum):
            raise _fail("teacher_runtime_unverified")
        return source.read(maximum + 1)


@dataclass(frozen=True)
class TeacherSDKRuntimeConfig:
    root: Path
    manifest_sha256: str
    physical_home: Path
    owner_directory: Path
    workdir: Path

    @property
    def manifest(self) -> Path:
        return self.root / "runtime-manifest.json"

    @property
    def python(self) -> Path:
        return self.root / "venv/bin/python3"

    @property
    def host(self) -> Path:
        return self.root / "host/teacher_sdk_host.py"

    @property
    def profile(self) -> Path:
        # A separate credential namespace; it never reads the CLI token file.
        # The enclosing physical-profile reservation conservatively serializes
        # Teacher, chat, OCR and authentication for this provider installation.
        return self.physical_home / "teacher_sdk"


class _BoundEvent(Closed):
    contract: Literal["teacher-sdk-host/1"]
    operation_id: str
    request_hash: str
    host_nonce: str
    binding_hash: str
    assets_hash: str
    policy_hash: str


class _Started(_BoundEvent):
    event: Literal["started"]


class _SourceProof(Closed):
    local_attempts: int = Field(ge=0, le=64)
    upstream_status: int | None = Field(ge=100, le=599)
    first_reply_sha256: str | None = Field(pattern=r"^[0-9a-f]{64}$")
    finish_structured_hash: str | None = Field(pattern=r"^[0-9a-f]{64}$")
    prompt_sha256: str | None = Field(pattern=r"^[0-9a-f]{64}$")


class _Terminal(_BoundEvent):
    event: Literal["terminal"]
    status: Literal["completed", "unknown", "not_dispatched"]
    text: str | None
    response_hash: str | None
    code: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    provider_dispatches: int = Field(ge=0, le=1)
    sdk_stop_reason: str | None
    finish_done: bool
    known_child_closed: bool
    source_proof: _SourceProof | None = None


class _Observation(Closed):
    contract: Literal["teacher-sdk-host/1"]
    event: Literal["observation"]
    authenticated: bool | None
    model_present: bool | None
    effort_serializable: bool
    reason: Literal["observed", "session_required", "auth_unavailable", "catalog_unavailable", "unsupported_effort"]
    generative: Literal[False]
    assets_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    policy_hash: str = Field(pattern=r"^[0-9a-f]{64}$")


def validate_sdk_observation(raw: bytes, code: int, assets_hash: str, policy_hash: str) -> None:
    try:
        rows = [strict_json(line) for line in raw.splitlines() if line.strip()] if len(raw) <= 4096 else []
        if code != 0 or len(rows) != 1:
            raise ValueError()
        row = _Observation.model_validate(rows[0])
        if row.assets_hash != assets_hash or row.policy_hash != policy_hash:
            raise ValueError()
        if row.effort_serializable is not True:
            raise _fail("model_option_mismatch", 422)
        if row.authenticated is False:
            raise _fail("teacher_sdk_session_required")
        if row.authenticated is not True:
            raise _fail("teacher_sdk_session_unverified")
        if row.model_present is False:
            raise _fail("model_unavailable", 422)
        if row.model_present is not True:
            raise _fail("teacher_sdk_catalog_unavailable")
        if row.reason != "observed":
            raise ValueError()
    except (ValueError, TypeError, RecursionError):
        raise _fail("teacher_runtime_unverified") from None


def parse_sdk_answer(raw: bytes, code: int, command: TeacherSDKHostRequest,
                     assets_hash: str, policy_hash: str) -> TeacherAnswer:
    """A payload or a budget-stop label alone never proves a completed reply."""
    try:
        if len(raw) > 524288:
            raise ValueError()
        events = [strict_json(line) for line in raw.splitlines() if line.strip()]
        if len(events) not in (1, 2):
            raise ValueError()
        expected = {**command.binding(), "assets_hash": assets_hash, "policy_hash": policy_hash}
        if len(events) == 2:
            started = _Started.model_validate(events[0])
            if started.event != "started" or started.model_dump(exclude={"event"}) != expected:
                raise ValueError()
        terminal = _Terminal.model_validate(events[-1])
        if (terminal.event != "terminal"
                or terminal.model_dump(include=set(expected)) != expected):
            raise ValueError()
        if terminal.status != "completed":
            if terminal.text is not None or terminal.response_hash is not None:
                raise ValueError()
            if terminal.code == "session_required":
                raise _fail("teacher_sdk_session_required")
            raise TeacherExecutionError("terminal", "runtime_failed")
        answer = TeacherSDKAnswer.model_validate({"text": terminal.text})
        proof = terminal.source_proof
        if (code != 0 or len(events) != 2 or terminal.code != "completed"
                or terminal.provider_dispatches != 1 or terminal.finish_done is not True
                or terminal.known_child_closed is not True
                or terminal.sdk_stop_reason not in ("UNSPECIFIED", "MAX_MODEL_CALLS_EXCEEDED")
                or terminal.response_hash != sha256(answer.text.encode("utf-8")).hexdigest()
                or proof is None or proof.local_attempts != 1 or proof.upstream_status != 200
                or proof.first_reply_sha256 is None
                or proof.finish_structured_hash != canonical_hash(answer.model_dump())
                or proof.prompt_sha256 != sha256(command.prompt.encode("utf-8")).hexdigest()):
            raise ValueError()
        return TeacherAnswer(text=answer.text)
    except (ServiceError, TeacherExecutionError):
        raise
    except (ValueError, TypeError, KeyError, RecursionError):
        raise TeacherExecutionError("terminal", "runtime_failed") from None


def sdk_environment(home: Path, source: Mapping[str, str]) -> dict[str, str]:
    """No database, API key, service token, proxy or real HOME reaches the child."""
    result = {key: value for key, value in source.items() if key in ("PATH", "LANG", "LC_ALL")}
    result.update(HOME=str(home), USERPROFILE=str(home), PYTHONDONTWRITEBYTECODE="1")
    return result


class TeacherSDKBackend:
    catalog_supported = False
    # Capacity ceiling only: Native and the owned runner still take the minimum
    # of this ceiling and the Server-authorized absolute execution deadline.
    timeout_seconds = 300.0

    def __init__(self, config: TeacherSDKRuntimeConfig | None, *, resource_key: str | None,
                 unavailable_reason: str = "teacher_runtime_unconfigured"):
        self.config, self.resource_key = config, resource_key
        self.unavailable_reason = unavailable_reason
        self.generation = uuid4().hex
        self._identity: TeacherRuntimeIdentity | None = None
        self._manifest_data: dict | None = None
        self._owner = None
        self._initializing = asyncio.Lock()
        self._closed = False
        self.profiles = None
        self._owner_directory: Path | None = config.owner_directory if config else None
        self._workdir: Path | None = config.workdir if config else None

    def _make_owner(self):
        if self._owner is None and self._owner_directory is not None and self._workdir is not None:
            from teacher_sdk_owner import TeacherSDKOwner
            self._owner = TeacherSDKOwner(self._owner_directory, self._workdir)
        return self._owner

    def _marker(self) -> dict | None:
        if self.profiles is None or self.profiles._state_dir is None or self.resource_key is None:
            return None
        path = self.profiles._state_dir / (self.resource_key.split(":", 1)[1] + ".unknown")
        try:
            descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
            with os.fdopen(descriptor, "rb") as source:
                info = os.fstat(source.fileno())
                if (not stat.S_ISREG(info.st_mode) or info.st_size > 4096
                        or (os.name != "nt" and (info.st_uid != os.getuid() or info.st_mode & 0o077))):
                    raise ValueError()
                value = strict_json(source.read(4097))
            if not isinstance(value, dict):
                raise ValueError()
            return value
        except FileNotFoundError:
            return None

    async def initialize_safety(self) -> None:
        """Inspect old owners before any consumer can enter the physical profile."""
        if self.profiles is None or self._owner_directory is None or not self._owner_directory.exists():
            return
        owner = self._make_owner()
        try:
            marker = self._marker()
            if (marker is not None and set(marker) == {"kind", "operation_id", "manifest_sha256", "resource_key"}
                    and marker["kind"] == "teacher_sdk_metadata" and marker["resource_key"] == self.resource_key
                    and owner.recover_metadata(marker["operation_id"], marker["manifest_sha256"])):
                self.profiles.quarantine("agentic")
                self.profiles.reconcile_dispatch("agentic", marker)
                # The durable record already certifies closure. A new container
                # may not have its host-mounted kernel root yet; defer removal
                # without recreating a fence for a process proven closed.
                try:
                    owner.cleanup_metadata(marker["operation_id"], marker["manifest_sha256"])
                except (OSError, ValueError, ServiceError):
                    pass
            self._retire_closed_metadata(strict=False)
            pending = owner.unclosed_records()
            if pending:
                self.profiles.quarantine("agentic")
                # Never overwrite an existing chat, login or Teacher fence.
                if self._marker() is None:
                    self.profiles.arm_dispatch("agentic", {"kind": "teacher_sdk_unresolved",
                        "operation_id": pending[0].operation_id, "resource_key": self.resource_key})
        except (OSError, ValueError, ServiceError, TypeError, KeyError):
            self.profiles.quarantine("agentic")

    async def prepare_admission(self) -> None:
        # ExecStartPost attaches the kernel root after ASGI starts. A first live
        # observation must retry exact metadata recovery once that proof exists.
        # Never quarantine or reconcile another currently active reservation.
        if self.profiles is not None and self.profiles.recovery_permitted("agentic"):
            await self.initialize_safety()

    def _retire_closed_metadata(self, *, strict: bool = True) -> None:
        # A crash after clearing its exact physical marker but before deleting
        # a closed owner must not slowly exhaust the bounded journal capacity.
        marker = self._marker()
        for record in self._owner.metadata_records():
            if record.process_closed and (marker is None or marker.get("operation_id") != record.operation_id):
                try:
                    self._owner.cleanup_metadata(record.operation_id, record.manifest_sha256)
                except (OSError, ValueError, ServiceError):
                    if strict:
                        raise _fail("teacher_sdk_cleanup_pending") from None

    def _finish_metadata(self, operation_id: str, marker: dict) -> None:
        if self.profiles is None:
            raise _fail("teacher_runtime_unconfigured")
        try:
            record = self._owner.read(operation_id)
            # Owner journals are durable before spawn. No record is therefore
            # a pre-spawn rejection; a record requires positive kernel closure.
            closed = (record is None or (record.action == "observe" and record.process_closed))
            if not closed or self._owner.unclosed_records():
                raise _fail("teacher_sdk_cleanup_unknown")
            self.profiles.resolve_current_dispatch("agentic", marker)
            # Keep the closure record until the physical fence is reconciled.
        except (OSError, ValueError, ServiceError):
            self.profiles.quarantine("agentic")
            raise _fail("teacher_sdk_cleanup_unknown") from None
        # Failure to retire a closed record is observable, but is not evidence
        # of a live process and must not release or quarantine the caller's lock.
        self._owner.cleanup_metadata(operation_id, marker["manifest_sha256"])

    @property
    def runner(self):
        return self._owner

    def _epoch(self) -> str | None:
        if self.config is None or os.name != "posix":
            return None
        path = self.config.profile / "session_epoch"
        try:
            profile = self.config.profile.lstat()
            if (not stat.S_ISDIR(profile.st_mode) or self.config.profile.resolve() != self.config.profile
                    or profile.st_uid != os.getuid() or profile.st_mode & 0o077):
                return None
            before = path.lstat()
            if not stat.S_ISREG(before.st_mode):
                return None
            descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            with os.fdopen(descriptor, "rb") as source:
                info = os.fstat(source.fileno())
                if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                        or info.st_mode & 0o077 or info.st_size > 64 or info.st_nlink != 1
                        or (info.st_dev, info.st_ino) != (before.st_dev, before.st_ino)):
                    return None
                raw = source.read(65).decode("ascii").strip()
            return raw if _EPOCH.fullmatch(raw) else None
        except (OSError, ValueError, UnicodeError):
            return None

    @property
    def session_generation(self) -> str:
        return sha256((self.generation + ":" + (self._epoch() or "unverified")).encode()).hexdigest()[:32]

    def unverified_identity(self) -> TeacherRuntimeIdentity:
        if self._identity is not None:
            return self._identity
        marker = canonical_hash({"kind": "teacher-sdk-unverified/1",
            "manifest": self.config.manifest_sha256 if self.config else None})
        return TeacherRuntimeIdentity(None, marker, marker)

    def _load_material(self) -> tuple[dict, TeacherRuntimeIdentity]:
        config = self.config
        if config is None or os.name != "posix" or not Path("/proc/self").exists():
            raise _fail(self.unavailable_reason)
        if (not config.root.is_absolute() or config.root.resolve() != config.root
                or config.root.is_symlink() or config.root.stat().st_uid != 0
                or config.root.stat().st_mode & 0o022 or not _HEX.fullmatch(config.manifest_sha256)):
            raise _fail("teacher_runtime_unverified")
        raw = _public_file(config.manifest, 65536)
        if sha256(raw).hexdigest() != config.manifest_sha256:
            raise _fail("teacher_runtime_unverified")
        data = strict_json(raw)
        if not isinstance(data, dict) or data.get("schema") != "teacher-sdk-runtime/1":
            raise _fail("teacher_runtime_unverified")
        pins = data.get("host_source_pins")
        if not isinstance(pins, dict) or set(pins) != {"teacher_sdk_host.py", "teacher_sdk_policy.py", "teacher_sdk_guard.py"}:
            raise _fail("teacher_runtime_unverified")
        for name, digest in pins.items():
            if not isinstance(digest, str) or not _HEX.fullmatch(digest):
                raise _fail("teacher_runtime_unverified")
            if sha256(_public_file(config.host.parent / name, 262144)).hexdigest() != digest:
                raise _fail("teacher_runtime_unverified")
            if sha256(_public_file(Path(__file__).with_name(name), 262144)).hexdigest() != digest:
                raise _fail("teacher_runtime_unverified")
        # The installer uses --copies; a redirector or a user-writable Python
        # executable must never bypass the pinned child entry point.
        _public_file(config.python, 33554432)
        native_python = Path(sys.executable).resolve()
        python_hash = _digest_file(config.python, "sha512")
        if python_hash != _digest_file(native_python, "sha512"):
            raise _fail("teacher_runtime_unverified")
        library = (Path(sysconfig.get_config_var("LIBDIR")) / sysconfig.get_config_var("LDLIBRARY")).resolve()
        _public_file(library, 67108864)
        relative = data.get("harness_relative_to_prefix")
        if not isinstance(relative, str) or Path(relative).is_absolute() or ".." in Path(relative).parts:
            raise _fail("teacher_runtime_unverified")
        engine = config.root / "venv" / relative
        if engine.is_symlink() or engine.resolve() != engine:
            raise _fail("teacher_runtime_unverified")
        info = engine.stat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022 or info.st_size > 160000000:
            raise _fail("teacher_runtime_unverified")
        if _digest_file(engine) != data.get("harness_sha256"):
            raise _fail("teacher_runtime_unverified")
        sources = {name: _digest_file(Path(__file__).with_name(name)) for name in _SOURCE_FILES}
        runtime = canonical_hash({"contract": "teacher-sdk-native/1", "manifest": config.manifest_sha256,
            "native_sources": sources, "python_sha512": python_hash,
            "libpython_sha512": _digest_file(library, "sha512"), "python_version": sys.version})
        return data, TeacherRuntimeIdentity(_digest_file(engine, "sha512"), runtime, canonical_hash(pins))

    async def identity(self) -> TeacherRuntimeIdentity:
        if self._closed or self.config is None or self.resource_key is None:
            raise _fail(self.unavailable_reason)
        async with self._initializing:
            # Root-owned assets are immutable; verify again on observations so
            # an in-place installation change cannot inherit a qualification.
            data, identity = await asyncio.to_thread(self._load_material)
            if self._identity is not None and identity != self._identity:
                raise _fail("runtime_generation_changed", 409)
            self._identity, self._manifest_data = identity, data
            self.config.workdir.mkdir(mode=0o700, exist_ok=True, parents=True)
            info = self.config.workdir.lstat()
            if (not stat.S_ISDIR(info.st_mode) or self.config.workdir.resolve() != self.config.workdir
                    or info.st_uid != os.getuid() or info.st_mode & 0o077):
                raise _fail("teacher_runtime_unverified")
            self._make_owner()
            return identity

    def _arguments(self, action: str) -> list[str]:
        if self.config is None or action not in ("observe", "execute"):
            raise _fail("teacher_runtime_unconfigured")
        return [str(self.config.python), "-I", str(self.config.host), "--" + action,
            "--profile", str(self.config.profile), "--manifest", str(self.config.manifest),
            "--manifest-sha256", self.config.manifest_sha256]

    def _profile(self) -> None:
        config = self.config
        if config is None or config.physical_home.resolve() != config.physical_home or config.physical_home.is_symlink():
            raise _fail("teacher_runtime_unverified")
        parent = config.physical_home.stat()
        if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.getuid() or parent.st_mode & 0o077:
            raise _fail("teacher_runtime_unverified")
        config.profile.mkdir(mode=0o700, exist_ok=True)
        info = config.profile.lstat()
        if config.profile.is_symlink() or not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise _fail("teacher_runtime_unverified")

    async def validate_selection(self, command: TeacherObserve) -> None:
        await self.identity()
        self._profile()
        if self._epoch() is None:
            raise _fail("teacher_sdk_session_required")
        selection = TeacherSDKObserveRequest(contract=CONTRACT, model_id=command.model_id, effort_id=command.effort_id)
        if self.profiles is None:
            raise _fail("teacher_runtime_unconfigured")
        self._retire_closed_metadata()
        operation_id = str(uuid4())
        marker = {"kind": "teacher_sdk_metadata", "operation_id": operation_id,
            "manifest_sha256": self.config.manifest_sha256, "resource_key": self.resource_key}
        self.profiles.arm_dispatch("agentic", marker)
        try:
            raw, code = await self._owner.run(self._arguments("observe"), operation_id=operation_id, action="observe",
                manifest_sha256=self.config.manifest_sha256, reference=None,
                stdin=selection.model_dump_json().encode(), env=sdk_environment(self.config.workdir, os.environ), timeout=15)
            validate_sdk_observation(raw, code, self.config.manifest_sha256, self._identity.policy_hash)
        finally:
            self._finish_metadata(operation_id, marker)

    def process_closed(self) -> bool:
        return self._owner is not None and self._owner.process_closed() is True

    def recover_local_closure(self, reference: TeacherReference) -> bool:
        return self._owner is not None and self._owner.recover_local_closure(reference) is True

    def cleanup_owned(self, reference: TeacherReference) -> None:
        if self._owner is not None:
            self._owner.cleanup_owned(reference)

    async def close(self) -> None:
        self._closed = True
        if self._owner is not None:
            await self._owner.close()


class TeacherSDKTransport:
    def __init__(self, backend: TeacherSDKBackend):
        self.backend = backend

    @property
    def runner(self):
        return self.backend.runner

    async def execute(self, command: TeacherStart, timeout: float) -> TeacherAnswer:
        identity = await self.backend.identity()
        if command.session_generation != self.backend.session_generation:
            raise _fail("runtime_generation_changed", 409)
        request = TeacherSDKHostRequest(contract=CONTRACT, operation_id=command.operation_id,
            request_hash=command.request_hash, host_nonce=uuid4().hex, model_id=command.model_id,
            effort_id=command.effort_id, prompt=command.prompt, deadline_at=command.deadline_at)
        config = self.backend.config
        diagnostics = TeacherSDKDiagnostics(config.owner_directory.parent / "teacher_sdk_diagnostics")
        diagnostic_context = SDKDiagnosticContext(operation_id=request.operation_id, request_hash=request.request_hash,
            assets_hash=config.manifest_sha256, policy_hash=identity.policy_hash)
        # Capacity and durable operation ownership precede any SDK process.
        diagnostics.reserve(diagnostic_context)
        raw, code = await self.backend.runner.run(self.backend._arguments("execute"),
            operation_id=command.operation_id, action="execute", manifest_sha256=config.manifest_sha256,
            reference=command.reference(), stdin=request.model_dump_json().encode("utf-8"),
            env=sdk_environment(config.workdir, os.environ), timeout=min(timeout, request.remaining()))
        # The existing decoder may discard detailed host failure categories.
        # Retain only bound, typed metadata first; this never certifies success,
        # local kernel closure, remote cancellation or permission to replay.
        diagnostics.capture(diagnostic_context, raw, code,
            {**request.binding(), "assets_hash": config.manifest_sha256, "policy_hash": identity.policy_hash},
            lambda event: _Terminal.model_validate(event).model_dump())
        if (not self.backend.process_closed() or command.session_generation != self.backend.session_generation
                or await self.backend.identity() != identity):
            raise _fail("runtime_generation_changed", 409)
        return parse_sdk_answer(raw, code, request, config.manifest_sha256, identity.policy_hash)

    def cleanup(self, operation_id: str) -> None:
        # The kernel owner removes only its verified temporary workspaces.
        # Durable owner records remain until Native has written its ACK fence.
        return None


def create_teacher_sdk_runtime(physical_home: Path | None, state_dir: Path | None,
                               workdir: Path, environment: Mapping[str, str], *, profiles=None):
    """Explicit lifecycle factory; unavailable never falls back to the CLI."""
    root, digest = environment.get("NODIA_TEACHER_SDK_ROOT"), environment.get("NODIA_TEACHER_SDK_MANIFEST_SHA256")
    config = None
    reason = "teacher_runtime_unconfigured"
    if root or digest:
        if (physical_home is not None and state_dir is not None and isinstance(root, str)
                and Path(root).is_absolute() and isinstance(digest, str) and _HEX.fullmatch(digest)):
            config = TeacherSDKRuntimeConfig(Path(root), digest, physical_home,
                state_dir / "teacher_sdk_owners", workdir)
        else:
            reason = "teacher_runtime_unverified"
    resource = ("gemini-profile:" + sha256(os.path.normcase(str(physical_home.resolve())).encode()).hexdigest()
        if physical_home is not None else None)
    backend = TeacherSDKBackend(config, resource_key=resource, unavailable_reason=reason)
    backend.profiles = profiles
    backend._owner_directory = state_dir / "teacher_sdk_owners" if state_dir is not None else None
    backend._workdir = workdir
    return backend, TeacherSDKTransport(backend)
