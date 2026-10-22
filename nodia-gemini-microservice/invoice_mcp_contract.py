"""Pure invoice instructions/normalization for the active Agentic generation.

This port never starts OCR, accesses an attachment, or reserves a native profile.
Server owns attachment authority, generation identity and durable MCP receipts.
"""
from __future__ import annotations

from typing import Literal

from fastapi import FastAPI, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from invoice_parser import build_invoice_prompt, clean_and_parse_invoice_json
from native_mcp_stdio import bounded_json
from schemas import InvoiceAnalysisResponse, InvoiceData, InvoiceItem
from service_errors import InvalidExtraction, ServiceError

INVOICE_MCP_CONTRACT_VERSION = "nodia-ai-invoice-analysis/1"
INVOICE_MCP_CONTRACT_PATH = "/nodia-ai/invoice-analysis/contract"
MAX_INVOICE_MCP_BYTES = 64 * 1024
MAX_INVOICE_MCP_ITEMS = 100


class ClosedContract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class InvoiceFieldMapping(ClosedContract):
    value: str | None = None
    instructions: str | None = None


class InvoiceProviderFields(ClosedContract):
    code: str | InvoiceFieldMapping | None = None
    cost_price: str | InvoiceFieldMapping | None = None
    cost_price_tax: str | InvoiceFieldMapping | None = None
    packages: str | InvoiceFieldMapping | None = None
    units_per_package: str | InvoiceFieldMapping | None = None


class McpInvoiceData(InvoiceData):
    items: list[InvoiceItem] = Field(min_length=1, max_length=MAX_INVOICE_MCP_ITEMS)


class McpInvoiceExtraction(InvoiceAnalysisResponse):
    data: McpInvoiceData


class InvoiceMcpContractRequest(ClosedContract):
    action: Literal["prepare", "normalize"]
    provider_fields: InvoiceProviderFields | None
    tax: float | None = Field(ge=0, le=100, allow_inf_nan=False)
    extraction: McpInvoiceExtraction | None = None

    @model_validator(mode="after")
    def action_payload(self) -> InvoiceMcpContractRequest:
        supplied = "extraction" in self.model_fields_set
        if self.action == "prepare" and supplied:
            raise ValueError("Prepare does not accept an extraction")
        if self.action == "normalize" and (not supplied or self.extraction is None):
            raise ValueError("Normalize requires an extraction")
        return self


class InvoiceMcpInstructions(ClosedContract):
    contract_version: Literal["nodia-ai-invoice-analysis/1"] = INVOICE_MCP_CONTRACT_VERSION
    instructions: str


class InvoiceMcpNormalized(ClosedContract):
    contract_version: Literal["nodia-ai-invoice-analysis/1"] = INVOICE_MCP_CONTRACT_VERSION
    extraction: McpInvoiceExtraction


def invoice_mcp_contract(payload: InvoiceMcpContractRequest) -> InvoiceMcpInstructions | InvoiceMcpNormalized:
    fields = payload.provider_fields.model_dump(exclude_unset=True) if payload.provider_fields is not None else None
    prompt, configured, code, net, gross, tax = build_invoice_prompt(
        fields, payload.tax, structured_output=True,
    )
    if payload.action == "prepare":
        result = InvoiceMcpInstructions(instructions=prompt)
    else:
        if payload.extraction is None:
            raise ServiceError("invalid_invoice_contract", "Contrato de análisis de factura inválido.", 422)
        normalized = clean_and_parse_invoice_json(
            payload.extraction.model_dump_json(), configured, code, net, gross, tax, fields,
        )
        result = InvoiceMcpNormalized(extraction=McpInvoiceExtraction.model_validate(normalized))
    # The pure response remains bounded too; no truncation or salvage of items.
    if len(result.model_dump_json().encode("utf-8")) > MAX_INVOICE_MCP_BYTES:
        raise ServiceError("invoice_contract_too_large", "El contrato de factura supera el tamaño permitido.", 413)
    return result


def parse_invoice_mcp_contract(raw: bytes) -> InvoiceMcpContractRequest:
    if len(raw) > MAX_INVOICE_MCP_BYTES:
        raise ServiceError("invoice_contract_too_large", "El contrato de factura supera el tamaño permitido.", 413)
    try:
        return InvoiceMcpContractRequest.model_validate(bounded_json(raw, MAX_INVOICE_MCP_BYTES))
    except (ValueError, TypeError, RecursionError, OverflowError) as error:
        raise ServiceError("invalid_invoice_contract", "Contrato de análisis de factura inválido.", 422) from error


def register_invoice_mcp_contract_routes(application: FastAPI) -> None:
    @application.post(
        INVOICE_MCP_CONTRACT_PATH,
        response_model=InvoiceMcpInstructions | InvoiceMcpNormalized,
        openapi_extra={"requestBody": {"required": True, "content": {
            "application/json": {"schema": InvoiceMcpContractRequest.model_json_schema()},
        }}},
    )
    async def contract(request: Request) -> InvoiceMcpInstructions | InvoiceMcpNormalized:
        # PrivateRequestGuard authenticates and limits actual bytes before parsing.
        payload = parse_invoice_mcp_contract(await request.body())
        try:
            return invoice_mcp_contract(payload)
        except (InvalidExtraction, ValidationError, ValueError, TypeError, OverflowError) as error:
            raise ServiceError("invalid_invoice_extraction", "Extracción de factura inválida.", 422) from error
