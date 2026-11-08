"""Ephemeral validated native files and exact-session modality proofs."""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import tempfile
import re
import unicodedata
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from attachment_inspector import AttachmentInspector
from service_errors import ServiceError
from native_execution_agents import (NATIVE_READER_AGENT, NATIVE_READER_AGENT_DOCUMENT,
    prepare_native_reader_agent, verify_native_reader_agent)

NATIVE_ATTACHMENT_MEDIA_TYPES: dict[str, tuple[str, ...]] = {
    "image": ("image/png", "image/jpeg", "image/webp"),
    "pdf": ("application/pdf",),
    "audio": ("audio/wav", "audio/ogg", "audio/webm", "audio/mpeg", "audio/mp4"),
}

class NativeAttachment(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    kind: Literal["image", "pdf", "audio"]
    media_type: Literal["image/png", "image/jpeg", "image/webp", "application/pdf", "audio/wav", "audio/ogg", "audio/webm", "audio/mpeg", "audio/mp4"]
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    content_base64: str = Field(min_length=4, max_length=27962028)

    @field_validator("content_base64")
    @classmethod
    def valid_encoding(cls, value: str) -> str:
        # Exact decoded size/hash is checked incrementally at materialization.
        if len(value) % 4 or not value.isascii():
            raise ValueError("Invalid base64")
        return value


def probe_answer_hash(text: str, normalization: str) -> str:
    value = text.strip()
    if normalization == "speech_words_v1":
        value = " ".join(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFC", value).casefold()))
    return hashlib.sha256(value.encode()).hexdigest()


def attachment_digest(attachments: list[NativeAttachment]) -> str | None:
    if not attachments:
        return None
    return hashlib.sha256(json.dumps([
        {"kind": item.kind, "media_type": item.media_type, "sha256": item.sha256}
        for item in attachments], sort_keys=True, separators=(",", ":")).encode()).hexdigest()




@asynccontextmanager
async def materialize(attachments: list[NativeAttachment], inspector: AttachmentInspector | None):
    if not attachments:
        yield []
        return
    if inspector is None:
        raise ServiceError("parser_isolation_unavailable", "El parser no está disponible.", 503)
    decoded_bytes = sum(len(item.content_base64) // 4 * 3 - (2 if item.content_base64.endswith("==") else 1 if item.content_base64.endswith("=") else 0) for item in attachments)
    if decoded_bytes > 40 * 1024 * 1024:
        raise ServiceError("attachment_too_large", "Los adjuntos superan el límite por mensaje.", 413)
    inspector.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    with inspector.reserve_native_bytes(decoded_bytes), tempfile.TemporaryDirectory(prefix="native-attachment-", dir=inspector.directory) as directory:
        paths: list[Path] = []
        total = 0
        for index, item in enumerate(attachments):
            suffix = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "application/pdf": ".pdf", "audio/wav": ".wav", "audio/ogg": ".ogg", "audio/webm": ".webm", "audio/mpeg": ".mp3", "audio/mp4": ".m4a"}[item.media_type]
            path = Path(directory) / (str(index) + suffix)
            digest = hashlib.sha256()
            size = 0
            try:
                with path.open("xb") as target:
                    path.chmod(0o600)
                    # 64KiB character chunks stay aligned to 4-byte base64 units.
                    for offset in range(0, len(item.content_base64), 65536):
                        encoded = item.content_base64[offset:offset + 65536]
                        if "=" in encoded and offset + len(encoded) != len(item.content_base64):
                            raise ValueError("Invalid padding")
                        decoded = base64.b64decode(encoded, validate=True)
                        if base64.b64encode(decoded).decode() != encoded:
                            raise ValueError("Noncanonical encoding")
                        size += len(decoded)
                        total += len(decoded)
                        if size > 20 * 1024 * 1024 or total > 40 * 1024 * 1024:
                            raise ValueError("Size limit")
                        digest.update(decoded)
                        target.write(decoded)
                if not size or digest.hexdigest() != item.sha256:
                    raise ValueError("Hash mismatch")
            except (ValueError, binascii.Error):
                raise ServiceError("attachment_invalid", "El adjunto no coincide con el archivo validado.", 422) from None
            if inspector.slots.locked():
                raise ServiceError("service_busy", "El parser está ocupado.", 429, retry_after=1)
            async with inspector.slots:
                observed = await inspector.decode(path, item.kind)
            if observed.media_type != item.media_type:
                raise ServiceError("attachment_invalid", "El contenido no coincide con su formato.", 422)
            paths.append(path)
        try:
            for path in paths:
                path.chmod(0o400)
            yield paths
        finally:
            for path in paths:
                path.chmod(0o600)


def require_completed_attachment_reads(events: list[object], documents: list[Path]) -> None:
    """A PreToolUse grant is not evidence that the CLI read a native file.

    Match the CLI's completed tool events to the supervisor-owned copies. Keep
    paths and tool responses out of errors; the independent gate still proves
    that every attempted tool was authorized.
    """
    required = {document.resolve() for document in documents}
    if not required:
        return
    completed: set[Path] = set()
    for event in events:
        if not isinstance(event, dict) or event.get("event") != "step_update":
            continue
        step = event.get("step_update")
        if not isinstance(step, dict) or step.get("tool_name") != "view_file" or step.get("state") != "DONE":
            continue
        info = step.get("tool_info")
        if not isinstance(info, dict) or info.get("error") is not None:
            continue
        parameters = info.get("parameters")
        target = parameters.get("AbsolutePath") if isinstance(parameters, dict) else None
        if not isinstance(target, str):
            continue
        try:
            path = Path(target)
            if path.is_absolute() and not path.is_symlink() and path.is_file() and path.resolve() in required:
                completed.add(path.resolve())
        except (ValueError, OSError):
            continue
    if completed != required:
        raise ServiceError("attachment_cli_file_read_missing", "No se comprobó la lectura completa de los adjuntos.", 502)


class NativeAttachmentProofs:
    def __init__(self):
        self.verified: set[tuple[object, ...]] = set()

    @staticmethod
    def key(engine, resource, session, model, effort, configuration, kind, media_type):
        return (engine, resource, session, model, effort, configuration, kind, media_type, "antigravity-cli/1.3.1", "nodia-ai-native-attachments/4")

    def supports(self, engine, request, kind, media_type: str | None = None) -> bool:
        # A kind-only query is a display summary. Admission always supplies the
        # inspected MIME: a WAV/PNG canary cannot authorize WebM/JPEG input.
        types = NATIVE_ATTACHMENT_MEDIA_TYPES.get(kind, ())
        if media_type is None:
            return any(self.supports(engine, request, kind, candidate) for candidate in types)
        return media_type in types and self.key(engine, request.resource_key, request.session_generation, request.model_id, request.effort_id, request.configuration_generation, kind, media_type) in self.verified

    def media_types(self, engine, request) -> list[str]:
        return [media_type for kind, types in NATIVE_ATTACHMENT_MEDIA_TYPES.items()
            for media_type in types if self.supports(engine, request, kind, media_type)]

    def mark(self, engine, request, kind, media_type: str) -> None:
        if media_type not in NATIVE_ATTACHMENT_MEDIA_TYPES.get(kind, ()):
            raise ServiceError("attachment_adapter_unverified", "La prueba no corresponde al formato del adjunto.", 409)
        if len(self.verified) >= 1000:
            raise ServiceError("adapter_admission_capacity", "Se requiere drenar el adaptador.", 503)
        self.verified.add(self.key(engine, request.resource_key, request.session_generation, request.model_id, request.effort_id, request.configuration_generation, kind, media_type))
