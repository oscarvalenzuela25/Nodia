"""AI-02 synthetic protocol only. Never imported by the HTTP application."""
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import date
import json
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator


class Closed(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class AvailabilityArgs(Closed):
    property_id: Literal["fixture-house"]
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")

    @model_validator(mode="after")
    def ordered_dates(self) -> Self:
        if date.fromisoformat(self.start_date) >= date.fromisoformat(self.end_date):
            raise ValueError("Invalid fixture interval")
        return self


class ExpenseArgs(Closed):
    name: str = Field(min_length=1, max_length=120, pattern=r"\S")
    amount: str = Field(pattern=r"^[1-9][0-9]{0,8}$")
    category_id: Literal["fixture-food"]
    status: Literal["paid", "pending"]


class ReadRequest(Closed):
    kind: Literal["tool_request"]
    call_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,40}$")
    tool: Literal["fixture.availability.read"]
    arguments: AvailabilityArgs


class PrepareRequest(Closed):
    kind: Literal["tool_request"]
    call_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,40}$")
    tool: Literal["fixture.expense.prepare"]
    arguments: ExpenseArgs


class Answer(Closed):
    kind: Literal["answer"]
    text: str = Field(min_length=1, max_length=4096, pattern=r"\S")


Envelope = ReadRequest | PrepareRequest | Answer
ADAPTER = TypeAdapter(Envelope)
MAX_REPLY_BYTES = 16384  # Harness budget, not a provider context/quota claim.


def _unique_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def parse_reply(text: str) -> Envelope:
    if not isinstance(text, str) or len(text.encode("utf-8")) > MAX_REPLY_BYTES:
        raise ValueError("Reply exceeds harness budget")
    # One complete JSON object, optionally one JSON Markdown fence; no salvage.
    document = text.strip()
    if document.startswith("```json\n") and document.endswith("\n```"):
        document = document[8:-4]
    value = json.loads(document, object_pairs_hook=_unique_pairs,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Non-finite JSON")))
    return ADAPTER.validate_python(value)


class FixtureGateway:
    """Closed fixture dispatch: no DB, HTTP, confirmation token or executor."""

    def __init__(self, marker: str) -> None:
        self.marker = marker
        self.receipts: dict[str, tuple[str, dict[str, object]]] = {}

    def dispatch(self, request: ReadRequest | PrepareRequest) -> dict[str, object]:
        if not isinstance(request, (ReadRequest, PrepareRequest)):
            raise ValueError("Only registered fixture requests can dispatch")
        canonical = request.model_dump_json()
        previous = self.receipts.get(request.call_id)
        if previous:
            if previous[0] != canonical:
                raise ValueError("Call identity reused with different intent")
            return json.loads(json.dumps(previous[1]))
        if isinstance(request, ReadRequest):
            result: dict[str, object] = {"call_id": request.call_id, "available": True,
                                         "source": "synthetic_fixture", "marker": self.marker}
        elif isinstance(request, PrepareRequest):
            result = {"call_id": request.call_id, "proposal_id": "fixture-preview",
                      "state": "awaiting_human_confirmation", "preview": request.arguments.model_dump(),
                      "marker": self.marker, "executed": False}
        else:
            raise ValueError("Only registered fixture requests can dispatch")
        self.receipts[request.call_id] = (canonical, result)
        return json.loads(json.dumps(result))


class ProbeTurn:
    """A lost reply is terminal unknown here, never an implicit resend."""

    def __init__(self, send: Callable[[str], Awaitable[str]], timeout: float = 120) -> None:
        self.send = send
        self.timeout = timeout
        self.state = "ready"
        self.sends = 0

    async def run(self, prompt: str) -> Envelope:
        if self.state != "ready":
            raise ValueError("Turn is already dispatched")
        self.state = "dispatched"
        self.sends += 1
        try:
            async with asyncio.timeout(self.timeout):
                reply = await self.send(prompt)
        except BaseException:
            self.state = "unknown"
            raise
        self.state = "response_received"
        try:
            parsed = parse_reply(reply)
        except (ValueError, TypeError):
            self.state = "invalid_response"
            raise
        self.state = "completed"
        return parsed


def instructions() -> str:
    return ("NODIA_AI02: ensayo sintético. Responde exclusivamente un objeto JSON según el schema "
            + json.dumps(ADAPTER.json_schema(), ensure_ascii=False)
            + ". Dos herramientas de ensayo: fixture.availability.read consulta disponibilidad; "
            "fixture.expense.prepare sólo propone gasto. Nunca ejecutes ni confirmes. No existen otras "
            "herramientas, SQL, HTTP, tokens ni acceso a datos reales. Cuando recibas TOOL_RESULT, "
            "responde kind=answer incluyendo literalmente su marker para probar que recibiste el resultado. "
            "No inventes resultados ni markers. importes son strings enteros. Pregunta si faltan campos.")
