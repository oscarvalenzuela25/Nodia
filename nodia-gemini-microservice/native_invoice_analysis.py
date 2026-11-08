"""One durable OCR operation over the unchanged Products invoice cores.

No MCP callback, HTTP recursion, native-modality proof or business write lives here.
The caller must commit the extraction before acknowledging the shared native receipt.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from fastapi import FastAPI, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from invoice_mcp_contract import InvoiceProviderFields
from native_attachments import NativeAttachment, materialize
from native_attempts import NativeTerminalReply, ReconcileAttempt
from native_mcp_stdio import bounded_json
from schemas import InvoiceAnalysisResponse
from service_errors import ServiceError

if TYPE_CHECKING:
    from nodia_ai_chat import ChatAdapter

MAX_INVOICE_BYTES = 10 * 1024 * 1024
MAX_METADATA_BYTES = 64 * 1024
MAX_REQUEST_BYTES = ((MAX_INVOICE_BYTES + 2) // 3) * 4 + MAX_METADATA_BYTES
MAX_REPLY_BYTES = 64 * 1024


class InvoiceTurnRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    model_id: str = Field(min_length=1, max_length=128)
    effort_id: str | None = Field(max_length=128)
    configuration_generation: str = Field(pattern=r"^[0-9a-f]{64}$")
    attempt_id: str
    resource_key: str = Field(pattern=r"^gemini-profile:[0-9a-f]{64}$")
    session_generation: str = Field(pattern=r"^[0-9a-f]{32}$")
    timeout_seconds: int = Field(ge=1, le=120)
    attachment: NativeAttachment
    provider_fields: InvoiceProviderFields | None
    tax: float | None = Field(ge=0, le=100, allow_inf_nan=False)

    @field_validator("attempt_id")
    @classmethod
    def canonical_attempt(cls, value: str) -> str:
        if str(UUID(value)) != value:
            raise ValueError("Canonical UUID required")
        return value

    @model_validator(mode="after")
    def bounded_document(self) -> InvoiceTurnRequest:
        item = self.attachment
        if (item.kind not in {"image", "pdf"}
                or item.media_type not in ({"application/pdf"} if item.kind == "pdf"
                    else {"image/png", "image/jpeg", "image/webp"})):
            raise ValueError("Invoice requires one image or PDF")
        encoded = item.content_base64
        size = len(encoded) // 4 * 3 - (2 if encoded.endswith("==") else 1 if encoded.endswith("=") else 0)
        if not 0 < size <= MAX_INVOICE_BYTES:
            raise ValueError("Invoice size limit")
        if len(json.dumps(self.model_dump(exclude={"attachment"}), ensure_ascii=False,
                          allow_nan=False).encode("utf-8")) > MAX_METADATA_BYTES - 1024:
            raise ValueError("Invoice metadata size limit")
        return self


class InvoiceTurnReply(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    extraction: InvoiceAnalysisResponse
    native: NativeTerminalReply


def parse_invoice_turn(raw: bytes) -> InvoiceTurnRequest:
    if len(raw) > MAX_REQUEST_BYTES:
        raise ServiceError("body_too_large", "La factura supera el tamaño permitido.", 413)
    try:
        return InvoiceTurnRequest.model_validate(bounded_json(raw, MAX_REQUEST_BYTES))
    except (ValueError, TypeError, RecursionError, OverflowError):
        raise ServiceError("invalid_invoice_request", "Solicitud de factura inválida.", 422) from None


def _bounded_reply(reply: InvoiceTurnReply) -> InvoiceTurnReply:
    if len(reply.model_dump_json().encode("utf-8")) > MAX_REPLY_BYTES:
        raise ServiceError("invoice_result_too_large", "La extracción supera el tamaño permitido.", 502)
    return reply


class NativeInvoiceAnalysis:
    def __init__(self, chat: ChatAdapter):
        self.chat = chat

    def _identity(self, engine: str, payload: InvoiceTurnRequest) -> None:
        if (self.chat.profiles.identity(engine) != payload.resource_key
                or self.chat.session_generation(engine) != payload.session_generation):
            raise ServiceError("runtime_generation_changed", "El perfil o sesión cambió; vuelve a comprobarlo.", 409)

    async def execute(self, engine: Literal["agentic"], payload: InvoiceTurnRequest) -> InvoiceTurnReply:
        chat = self.chat
        self._identity(engine, payload)
        if payload.attempt_id in chat.attempts or chat.ledger.read(payload.attempt_id) is not None:
            raise ServiceError("attempt_already_dispatched", "El intento ya fue admitido; no se reenviará.", 409)
        if len(chat.attempts) >= chat.maximum_attempts:
            raise ServiceError("adapter_admission_capacity", "Se requiere drenar y reiniciar el adaptador.", 503)
        reference = ReconcileAttempt(resource_key=payload.resource_key,
            session_generation=payload.session_generation, operation_ref=payload.attempt_id)
        digest_input = payload.model_dump(exclude={"attachment"})
        digest_input["attachment"] = payload.attachment.model_dump(exclude={"content_base64"})
        digest = sha256(json.dumps(digest_input, sort_keys=True, separators=(",", ":"),
                                  ensure_ascii=False, allow_nan=False).encode()).hexdigest()
        proof = None
        submitted = False
        accepted = False

        def progress(phase: str) -> None:
            nonlocal submitted
            if phase != "provider_request_started":
                return
            # A second generation is forbidden for this durable operation.
            if submitted:
                raise ServiceError("attempt_already_dispatched", "El intento no se reenviará.", 409)
            self._identity(engine, payload)
            submitted = True

        async with chat.profiles.operation(engine, purpose="execution"):
            try:
                accepted = True
                chat.attempts.add(payload.attempt_id)
                chat.active_attempts[payload.attempt_id] = engine
                # Fence first: if ledger replace succeeds but its fsync fails,
                # even a restart must retain this exact identity in quarantine.
                chat.profiles.arm_dispatch(engine, {"attempt_id": payload.attempt_id, **reference.model_dump()})
                proof = chat.ledger.arm(payload.attempt_id, engine, reference, digest)
                async with asyncio.timeout(payload.timeout_seconds):
                    async with materialize([payload.attachment], chat.attachment_inspector) as paths:
                        service = chat.agentic
                        fields = (payload.provider_fields.model_dump(exclude_unset=True)
                                  if payload.provider_fields is not None else None)
                        result = await service.analyze_invoice(paths[0], provider_fields=fields,
                            provider_tax=payload.tax, model=payload.model_id,
                            thinking_level=payload.effort_id, progress_callback=progress)
                        extraction = InvoiceAnalysisResponse.model_validate(result)
                if not submitted:
                    raise ServiceError("native_proof_missing", "El núcleo no acreditó el envío.", 502)
                if not chat.native_operation_closed(engine):
                    raise ServiceError("native_operation_active_or_unverified", "La terminación nativa aún no está verificada.", 409)
                # Validate the entire envelope before committing a completed
                # receipt. Placeholder values have the exact terminal widths.
                _bounded_reply(InvoiceTurnReply(extraction=extraction, native=NativeTerminalReply(
                    attempt_id=payload.attempt_id, **reference.model_dump(),
                    terminal_proof_id="00000000-0000-0000-0000-000000000000",
                    process_closed=True, outcome="completed", observed_at=datetime.now(timezone.utc).isoformat())))
                final = chat.ledger.close(proof, "completed")
                reply = _bounded_reply(InvoiceTurnReply(extraction=extraction, native=chat.ledger.project(final)))
                chat.profiles.resolve_dispatch(engine)
                return reply
            except BaseException as error:
                if accepted:
                    chat.profiles.quarantine(engine)
                    if proof is not None and chat.native_operation_closed(engine):
                        try:
                            chat.ledger.close(proof, "abandoned_unknown")
                        except Exception:
                            # A failed durable write leaves admission quarantined.
                            # It must not replace cancellation or expose IO details.
                            pass
                    if not isinstance(error, (asyncio.CancelledError, KeyboardInterrupt, SystemExit)):
                        raise ServiceError("invoice_result_unknown", "El resultado del intento es incierto; no se reenviará.", 502) from None
                raise
            finally:
                chat.active_attempts.pop(payload.attempt_id, None)


def register_native_invoice_routes(application: FastAPI) -> None:
    @application.post("/nodia-ai/{engine}/invoice/turn", response_model=InvoiceTurnReply,
        openapi_extra={"requestBody": {"required": True, "content": {
            "application/json": {"schema": InvoiceTurnRequest.model_json_schema()}}}})
    async def invoice_turn(engine: Literal["agentic"], request: Request) -> InvoiceTurnReply:
        payload = parse_invoice_turn(await request.body())
        return await application.state.invoice_analysis.execute(engine, payload)
