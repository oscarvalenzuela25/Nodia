"""Bounded private file inspection, independent of provider sessions/inference."""
from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator

from service_errors import ServiceError

MAX_BYTES = 20 * 1024 * 1024


class AttachmentInspection(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    media_type: Literal["image/png", "image/jpeg", "image/webp", "application/pdf", "audio/wav", "audio/ogg", "audio/webm", "audio/mpeg", "audio/mp4"]
    page_count: int | None = Field(ge=1, le=100)
    duration_seconds: float | None = Field(gt=0, le=300, allow_inf_nan=False)
    extracted_text: str | None = Field(default=None, max_length=32768)

    @model_validator(mode="after")
    def metadata(self) -> "AttachmentInspection":
        if (self.media_type == "application/pdf") != (self.page_count is not None):
            raise ValueError("Invalid pages")
        if self.media_type.startswith("audio/") != (self.duration_seconds is not None):
            raise ValueError("Invalid duration")
        if self.extracted_text is not None and (self.media_type != "application/pdf" or len(self.extracted_text.encode()) > 32768 or not self.extracted_text.strip()):
            raise ValueError("Invalid extraction")
        return self


class AttachmentInspector:
    def __init__(self, directory: Path):
        self.directory = directory
        self.slots = asyncio.Semaphore(2)
        self.native_bytes = 0

    @contextmanager
    def reserve_native_bytes(self, amount: int):
        if amount < 1 or amount > 40 * 1024 * 1024:
            raise ServiceError("attachment_too_large", "Los adjuntos superan el límite por mensaje.", 413)
        if self.native_bytes + amount > 40 * 1024 * 1024:
            raise ServiceError("service_busy", "El canal de adjuntos está ocupado.", 429, retry_after=1)
        # Single-worker event loop; reserve before any await or temp allocation.
        self.native_bytes += amount
        try:
            yield
        finally:
            self.native_bytes -= amount

    async def decode(self, path: Path, kind: str) -> AttachmentInspection:
        if sys.platform != "linux":
            raise ServiceError("parser_isolation_unavailable", "El parser aislado no está disponible en este sistema.", 503)
        # No inherited account/configuration variables. Absolute executable and
        # script paths; -I excludes cwd/user packages. No shell or credentials.
        spawn = asyncio.create_task(asyncio.create_subprocess_exec(
            sys.executable, "-I", str(Path(__file__).with_name("attachment_inspector_worker.py")), str(path.resolve()), kind,
            cwd=path.parent, env={"LANG": "C.UTF-8", "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"},
            stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
            limit=262144,
        ))
        try:
            process = await asyncio.shield(spawn)
        except asyncio.CancelledError:
            # Cancellation while creating the child must not lose its handle.
            process = await spawn
            if process.returncode is None:
                process.kill()
            await process.wait()
            raise
        try:
            async with asyncio.timeout(15):
                output, _ = await process.communicate()
            if len(output) > 200000:
                raise ValueError("Invalid parser output")
            value = json.loads(output)
            if process.returncode != 0:
                if value == {"error": "parser_isolation_unavailable"}:
                    raise ServiceError("parser_isolation_unavailable", "No se pudo aislar el parser.", 503)
                raise ValueError("Invalid content")
            result = AttachmentInspection.model_validate(value)
            if not (result.media_type.startswith(kind + "/") if kind != "pdf" else result.media_type == "application/pdf"):
                raise ValueError("Kind mismatch")
            return result
        except TimeoutError:
            raise ServiceError("attachment_parser_timeout", "El archivo excedió el tiempo de validación.", 422) from None
        except (ValueError, TypeError):
            raise ServiceError("attachment_invalid", "El archivo no es válido o supera los límites de contenido.", 422) from None
        finally:
            if process.returncode is None:
                process.kill()
            await process.wait()

    async def receive(self, request: Request) -> AttachmentInspection:
        kind = request.headers.get("x-nodia-attachment-kind")
        if kind not in {"image", "pdf", "audio"} or request.headers.get("content-type", "").split(";")[0] != "application/octet-stream":
            raise ServiceError("attachment_invalid", "Tipo de adjunto inválido.", 415)
        size_header = request.headers.get("content-length")
        if size_header is not None and (not size_header.isdecimal() or not 0 < int(size_header) <= MAX_BYTES):
            raise ServiceError("attachment_too_large", "El archivo supera el tamaño permitido.", 413)
        # One single-worker runtime owns these two slots; fail immediately and
        # do not receive or allocate temp files when both are occupied.
        if self.slots.locked():
            raise ServiceError("service_busy", "El parser está ocupado.", 429, retry_after=1)
        await self.slots.acquire()
        try:
            self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            with tempfile.TemporaryDirectory(prefix="attachment-", dir=self.directory) as name:
                path = Path(name) / "content"
                count = 0
                async with asyncio.timeout(60):
                    with path.open("xb") as output:
                        os.chmod(path, 0o600)
                        async for chunk in request.stream():
                            count += len(chunk)
                            if count > MAX_BYTES:
                                raise ServiceError("attachment_too_large", "El archivo supera el tamaño permitido.", 413)
                            output.write(chunk)
                if not count or (size_header is not None and count != int(size_header)):
                    raise ServiceError("attachment_invalid", "La carga está incompleta.", 422)
                return await self.decode(path, kind)
        except TimeoutError:
            raise ServiceError("upload_timeout", "Tiempo de carga agotado.", 408) from None
        finally:
            self.slots.release()


def register_attachment_inspector_routes(application: FastAPI) -> None:
    @application.post("/attachments/inspect", response_model=AttachmentInspection,
                      openapi_extra={"requestBody": {"required": True, "content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}}}})
    async def inspect_attachment(request: Request) -> AttachmentInspection:
        return await application.state.attachment_inspector.receive(request)
