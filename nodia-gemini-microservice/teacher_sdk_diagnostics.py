"""Bounded private SDK error metadata. Never stores raw frames, text or credentials."""
from hashlib import sha256
import io
import json
import os
from pathlib import Path
import re
import stat
from typing import Callable, Literal, Mapping
from uuid import UUID

from pydantic import Field, model_validator

from service_errors import ServiceError
from teacher_sdk_owner import _private_directory, _private_json
from teacher_text_contract import Closed, Hex64, UuidString

MAX_RECORDS = 10000
MAX_RECORD_BYTES = 4096
MAX_STDOUT = 2 * 1024 * 1024
_BINDING_KEYS = {"contract", "operation_id", "request_hash", "host_nonce", "binding_hash", "assets_hash", "policy_hash"}
_STOP_REASONS = {"UNSPECIFIED", "MAX_MODEL_CALLS_EXCEEDED", "MAX_TOOL_CALLS_EXCEEDED",
    "MAX_INPUT_TOKENS_EXCEEDED", "MAX_OUTPUT_TOKENS_EXCEEDED", "MAX_TOTAL_TOKENS_EXCEEDED", "QUOTA_EXHAUSTED"}


def fail(code: str) -> ServiceError:
    return ServiceError(code, "El diagnóstico privado Teacher requiere integridad y capacidad verificadas.", 503)


class SDKDiagnosticContext(Closed):
    operation_id: UuidString
    request_hash: Hex64
    assets_hash: Hex64
    policy_hash: Hex64

    @model_validator(mode="after")
    def canonical_operation(self):
        if str(UUID(self.operation_id)) != self.operation_id or UUID(self.operation_id).int == 0:
            raise ValueError("Canonical nonzero operation required")
        return self


class SDKSourceDiagnostic(Closed):
    local_attempts: int = Field(ge=0, le=64)
    upstream_status: int | None = Field(ge=100, le=599)
    first_reply_sha256: Hex64 | None
    finish_structured_hash: Hex64 | None
    prompt_sha256: Hex64 | None


class SDKTerminalDiagnostic(Closed):
    status: Literal["completed", "unknown", "not_dispatched"]
    code: Literal["completed", "runtime_unavailable", "deadline_expired", "unsupported_effort", "model_mismatch",
        "finish_unverified", "output_limit", "session_required", "second_request", "request_invalid", "request_limit",
        "prompt_mismatch", "effort_mismatch", "context_mismatch", "tools_rejected", "billing_rejected", "reply_invalid",
        "upstream_rejected", "provider_quota", "provider_unavailable", "transport_failed", "cancelled", "runtime_failed",
        "reply_framing", "reply_json", "reply_envelope", "reply_candidates", "reply_parts",
        "reply_finish_missing", "reply_finish_multiple", "reply_reason", "reply_answer_invalid",
        "reply_parts_text", "reply_parts_metadata", "reply_parts_unsupported", "reply_parts_limit"]
    provider_dispatches: int = Field(ge=0, le=1)
    sdk_stop_reason: str | None = Field(max_length=64)
    sdk_stop_reason_recognized: bool
    finish_done: bool
    known_child_closed: bool
    source_proof: SDKSourceDiagnostic | None

    @model_validator(mode="after")
    def enum_reason(self):
        if self.sdk_stop_reason is not None and self.sdk_stop_reason not in _STOP_REASONS:
            raise ValueError("Known SDK enum required")
        return self


class SDKDiagnosticRecord(SDKDiagnosticContext):
    version: Literal[1] = 1
    phase: Literal["reserved", "captured"] = "reserved"
    stdout_sha256: Hex64 | None = None
    exit_code: int | None = Field(default=None, ge=-(2**31), lt=2**31)
    frame_count: int | None = Field(default=None, ge=0, le=MAX_STDOUT)
    bound_terminal: SDKTerminalDiagnostic | None = None

    @model_validator(mode="after")
    def complete_capture(self):
        if self.phase == "reserved":
            if any(value is not None for value in (self.stdout_sha256, self.exit_code, self.frame_count, self.bound_terminal)):
                raise ValueError("Reserved metadata cannot claim a capture")
        elif any(value is None for value in (self.stdout_sha256, self.exit_code, self.frame_count)):
            raise ValueError("Captured metadata requires exact raw frame metrics")
        return self


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _constant(_value):
    raise ValueError("Nonfinite JSON")


def terminal_diagnostic(raw: bytes, binding: Mapping[str, object],
                        validate: Callable[[object], Mapping[str, object]]) -> SDKTerminalDiagnostic | None:
    """Bindings and the existing strict runtime DTO precede any projection."""
    try:
        if set(binding) != _BINDING_KEYS or len(raw) > 524288:
            return None
        lines = [line for line in io.BytesIO(raw) if line.strip()]
        if len(lines) not in (1, 2):
            return None
        events = [json.loads(line.decode("utf-8"), object_pairs_hook=_pairs, parse_constant=_constant) for line in lines]
        if len(events) == 2 and events[0] != {**binding, "event": "started"}:
            return None
        event = events[-1]
        if not isinstance(event, dict) or event.get("event") != "terminal" or any(event.get(key) != value for key, value in binding.items()):
            return None
        value = validate(event)
        reason = value["sdk_stop_reason"]
        return SDKTerminalDiagnostic.model_validate({
            **{key: value[key] for key in ("status", "code", "provider_dispatches", "finish_done", "known_child_closed", "source_proof")},
            "sdk_stop_reason": reason if reason in _STOP_REASONS else None,
            "sdk_stop_reason_recognized": reason is None or reason in _STOP_REASONS})
    except (ValueError, TypeError, KeyError, UnicodeError, RecursionError):
        return None


class TeacherSDKDiagnostics:
    def __init__(self, directory: Path):
        self.directory = directory

    @staticmethod
    def _sync(directory: Path) -> None:
        if os.name != "nt":
            fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)

    def _prepare(self):
        _private_directory(self.directory.parent, private=False)
        self.directory.mkdir(mode=0o700, exist_ok=True)
        _private_directory(self.directory)

    def _path(self, context: SDKDiagnosticContext) -> Path:
        return self.directory / (context.operation_id + ".json")

    def _entries(self):
        with os.scandir(self.directory) as entries:
            names = []
            for entry in entries:
                if len(names) >= MAX_RECORDS or re.fullmatch(r"[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.(?:json|update)", entry.name) is None:
                    raise fail("teacher_sdk_diagnostic_capacity")
                if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                    raise fail("teacher_sdk_diagnostic_invalid")
                # DirEntry's cached Windows stat may omit link counts; use the
                # actual lstat boundary, also rejecting a concurrent link swap.
                info = os.lstat(entry.path)
                if (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MAX_RECORD_BYTES
                        or (os.name != "nt" and (info.st_uid != os.getuid() or info.st_mode & 0o777 != 0o600))):
                    raise fail("teacher_sdk_diagnostic_invalid")
                names.append(entry.name)
            return names

    def read(self, context: SDKDiagnosticContext) -> SDKDiagnosticRecord:
        try:
            if self._path(context).lstat().st_size > MAX_RECORD_BYTES:
                raise ValueError()
            record = SDKDiagnosticRecord.model_validate(_private_json(self._path(context)))
            if SDKDiagnosticContext.model_validate(record.model_dump(include=set(SDKDiagnosticContext.model_fields))) != context:
                raise ValueError()
            return record
        except (OSError, ValueError):
            raise fail("teacher_sdk_diagnostic_invalid") from None

    def reserve(self, context: SDKDiagnosticContext) -> None:
        try:
            context = SDKDiagnosticContext.model_validate(context.model_dump())
            self._prepare()
            try:
                self._path(context).lstat()
            except FileNotFoundError:
                pass
            else:
                raise fail("teacher_sdk_diagnostic_exists")
            if len(self._entries()) >= MAX_RECORDS:
                raise fail("teacher_sdk_diagnostic_capacity")
            record = SDKDiagnosticRecord(**context.model_dump())
            self._fresh(self._path(context), record.model_dump_json().encode())
            self._sync(self.directory)
        except (OSError, ValueError):
            raise fail("teacher_sdk_diagnostic_invalid") from None

    @staticmethod
    def _fresh(path: Path, raw: bytes):
        if len(raw) > MAX_RECORD_BYTES:
            raise fail("teacher_sdk_diagnostic_limit")
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
        with os.fdopen(fd, "wb") as file:
            file.write(raw)
            file.flush()
            os.fsync(file.fileno())

    def capture(self, context: SDKDiagnosticContext, raw: bytes, code: int, binding: Mapping[str, object],
                validate: Callable[[object], Mapping[str, object]]) -> None:
        if not isinstance(raw, bytes) or len(raw) > MAX_STDOUT or type(code) is not int:
            raise fail("teacher_sdk_diagnostic_limit")
        # Never accept another operation's verified binding as this reservation.
        if any(binding.get(key) != getattr(context, key) for key in SDKDiagnosticContext.model_fields):
            raise fail("teacher_sdk_diagnostic_mismatch")
        previous = self.read(context)
        if previous.phase != "reserved":
            raise fail("teacher_sdk_diagnostic_exists")
        record = SDKDiagnosticRecord(**context.model_dump(), phase="captured", stdout_sha256=sha256(raw).hexdigest(),
            exit_code=code, frame_count=sum(1 for line in io.BytesIO(raw) if line.strip()),
            bound_terminal=terminal_diagnostic(raw, binding, validate))
        temporary = self.directory / (context.operation_id + ".update")
        try:
            self._fresh(temporary, record.model_dump_json().encode())
            if self.read(context) != previous:
                raise fail("teacher_sdk_diagnostic_changed")
            os.replace(temporary, self._path(context))
            self._sync(self.directory)
        except (OSError, ValueError):
            # Preserve both the reserved record and any durable partial update;
            # never turn diagnostic IO failure into permission to replay.
            raise fail("teacher_sdk_diagnostic_invalid") from None
