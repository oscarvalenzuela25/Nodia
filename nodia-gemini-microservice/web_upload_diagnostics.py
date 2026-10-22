"""Content-free observation of the SDK's existing upload HTTP roundtrip.

This proxy neither uploads again nor interprets success as file readiness. The
SDK retains response validation, MIME construction, retries and cleanup.
"""
from __future__ import annotations

import asyncio
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from time import monotonic
from typing import Any

from gemini_webapi.constants import Endpoint

_upload_owner: ContextVar[object | None] = ContextVar("nodia_web_upload_owner", default=None)
_MAX_COUNT = 2147483647
_MAX_MS = 86400000
_MAX_RECORDS = 4


class UploadDiagnostics:
    def __init__(self, attempt_id: str, sink: Callable[[dict[str, object]], None] | None = None):
        self.attempt_id, self.sink = attempt_id, sink
        self.started = monotonic()
        self.counts = {"requests": 0, "roundtrips_completed": 0, "failed": 0,
                       "cancelled": 0, "sink_errors": 0, "metadata_errors": 0}
        self.records: list[dict[str, object]] = []

    def elapsed_ms(self) -> int:
        return min(_MAX_MS, max(0, round((monotonic() - self.started) * 1000)))

    def increment(self, key: str) -> None:
        self.counts[key] = min(_MAX_COUNT, self.counts[key] + 1)

    def note(self, phase: str, record: dict[str, object]) -> None:
        if self.sink is not None and record["ordinal"] <= _MAX_RECORDS:
            try:
                self.sink({"attempt_id": self.attempt_id, "phase": phase,
                           "upload": dict(record)})
            except Exception:
                self.increment("sink_errors")

    def begin(self) -> dict[str, object]:
        self.increment("requests")
        record: dict[str, object] = {"ordinal": self.counts["requests"],
                                    "started_elapsed_ms": self.elapsed_ms(),
                                    "completed_elapsed_ms": None, "duration_ms": None,
                                    "outcome": "pending", "http_status": None,
                                    "reference_chars": None, "reference_nonempty": None,
                                    "reference_prefix_matches": None}
        if len(self.records) < _MAX_RECORDS:
            self.records.append(record)
        self.note("upload_started", record)
        return record

    def finish(self, record: dict[str, object], started: float, outcome: str,
               response: object | None = None) -> None:
        self.increment({"http_completed": "roundtrips_completed", "failed": "failed",
                        "cancelled": "cancelled"}[outcome])
        record.update(outcome=outcome, completed_elapsed_ms=self.elapsed_ms(),
                      duration_ms=min(_MAX_MS, max(0, round((monotonic() - started) * 1000))))
        if response is not None:
            try:
                status = getattr(response, "status_code", None)
                record["http_status"] = status if type(status) is int and 100 <= status <= 599 else None
                text = getattr(response, "text", None)
                if type(text) is str:
                    record.update(reference_chars=min(_MAX_COUNT, len(text)),
                                  reference_nonempty=bool(text),
                                  reference_prefix_matches=text.startswith("/contrib_service/ttl_1d/"))
            except Exception:
                # Missing or evolving SDK metadata cannot replace a response.
                self.increment("metadata_errors")
        self.note("upload_" + outcome, record)

    def snapshot(self) -> dict[str, object]:
        return {**self.counts, "records": [dict(record) for record in self.records]}


@contextmanager
def upload_observation(trace: UploadDiagnostics) -> Iterator[None]:
    token = _upload_owner.set(trace)
    try:
        yield
    finally:
        _upload_owner.reset(token)


def upload_observation_active(trace: UploadDiagnostics) -> bool:
    return _upload_owner.get() is trace


class BodyPacingDiagnostics:
    """Byte-chunk cadence, deliberately unaware of content and SDK frames."""

    def __init__(self, elapsed_ms: Callable[[], int]):
        self.elapsed_ms = elapsed_ms
        self.first_chunk_elapsed_ms: int | None = None
        self.last_chunk_elapsed_ms: int | None = None
        self.max_inter_chunk_gap_ms: int | None = None

    def chunk(self) -> None:
        elapsed = min(_MAX_MS, max(0, self.elapsed_ms()))
        if self.first_chunk_elapsed_ms is None:
            self.first_chunk_elapsed_ms = elapsed
        elif self.last_chunk_elapsed_ms is not None:
            self.max_inter_chunk_gap_ms = max(self.max_inter_chunk_gap_ms or 0,
                                              max(0, elapsed - self.last_chunk_elapsed_ms))
        self.last_chunk_elapsed_ms = elapsed

    def snapshot(self) -> dict[str, int | None]:
        return {"first_chunk_elapsed_ms": self.first_chunk_elapsed_ms,
                "last_chunk_elapsed_ms": self.last_chunk_elapsed_ms,
                "max_inter_chunk_gap_ms": self.max_inter_chunk_gap_ms}


class ObservedUploadTransport:
    def __init__(self, session: Any, trace: UploadDiagnostics):
        self.session, self.trace = session, trace

    @property
    def __class__(self) -> type:
        # The installed SDK validates its public upload_file(client=...) as an
        # AsyncSession before calling post. Preserve the wrapped object's
        # isinstance contract without creating a second HTTP session.
        return type(self.session)

    def __getattr__(self, name: str) -> Any:
        return getattr(self.session, name)

    async def post(self, *args: Any, **kwargs: Any) -> Any:
        url = kwargs.get("url", args[0] if args else None)
        if not upload_observation_active(self.trace) or url != Endpoint.UPLOAD:
            return await self.session.post(*args, **kwargs)
        started = monotonic()
        record = self.trace.begin()
        try:
            response = await self.session.post(*args, **kwargs)
        except BaseException as error:
            self.trace.finish(record, started,
                              "cancelled" if isinstance(error, asyncio.CancelledError) else "failed")
            raise
        self.trace.finish(record, started, "http_completed", response)
        return response
