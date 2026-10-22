"""Bounded, content-free observation of the installed SDK's generation lifecycle.

The SDK retains parsing, requests, retries and cleanup. A byte chunk is not a
JSON frame. curl_cffi opens its response after its first body callback, so the
response_opened event does not claim a header-only timestamp.
"""
from __future__ import annotations

import asyncio
import hashlib
import html
import json
from collections.abc import Callable
from contextlib import aclosing, contextmanager
from contextvars import ContextVar
from copy import deepcopy
from time import monotonic
from typing import Any, Literal

from gemini_webapi import GeminiClient
from gemini_webapi.types import Candidate, ModelOutput
from web_audio_transport import (adapt_req_file_data, native_audio_scope_active,
    new_audio_transport_diagnostic)
from web_candidate_diagnostics import describe_preparser
from web_upload_diagnostics import (BodyPacingDiagnostics, ObservedUploadTransport,
    UploadDiagnostics, upload_observation, upload_observation_active)

Phase = Literal[
    "activity_started", "activity_completed", "activity_failed", "activity_cancelled",
    "generation_started", "generation_completed", "generation_failed", "generation_cancelled",
    "request_started", "response_opened", "request_failed", "request_cancelled",
    "first_body_chunk", "candidate_output", "recovery_started", "recovery_completed",
    "recovery_failed", "recovery_cancelled", "stream_exit_started", "stream_exit_completed",
    "stream_exit_failed", "stream_exit_cancelled", "client_close_started", "client_close_completed",
    "client_close_failed", "client_close_cancelled", "cancellation_requested",
]
TaskRole = Literal["generation", "caller", "background_activity", "background_refresh"]
_stream_owner: ContextVar[object | None] = ContextVar("nodia_web_observed_stream", default=None)
_structured_owner: ContextVar[_StructuredText | None] = ContextVar("nodia_web_structured_text", default=None)


def _reject_nonfinite(value: str) -> None:
    raise ValueError("Nonfinite JSON constant")


def _text_fingerprint(text: str) -> dict[str, object]:
    encoded = text.encode("utf-8")
    try:
        json.loads(text, parse_constant=_reject_nonfinite)
    except (ValueError, RecursionError):
        parseable = False
    else:
        parseable = True
    return {"text_bytes": len(encoded), "sha256": hashlib.sha256(encoded).hexdigest(),
            "json_parseable": parseable}


class _StructuredText:
    """One generation's exact pre-Candidate text; never a JSON repair path.

    The pinned SDK decodes HTML entities in Candidate's validator, including
    entities inside JSON strings. Protecting ampersands beforehand makes that
    one decoding step an identity operation. Only hashes and bounded counts
    survive in diagnostics; provider candidate identifiers stay in this scope.
    """
    def __init__(self, client: object, trace: WebGenerationDiagnostics | None):
        self.client, self.trace = client, trace
        self.task = asyncio.current_task()
        self.sources: dict[str, tuple[dict[str, object], int, bool, dict[str, object] | None]] = {}

    def protect(self, rcid: str, text: str, preparser: dict[str, object] | None = None) -> str:
        if type(rcid) is not str or not rcid or type(text) is not str:
            raise ValueError("Unverified structured Web candidate")
        if rcid not in self.sources and len(self.sources) >= 256:
            raise ValueError("Structured Web candidate limit exceeded")
        self.sources[rcid] = (_text_fingerprint(text), text.count("&"), html.unescape(text) != text, preparser)
        return text.replace("&", "&amp;")

    def verify(self, output: object, *, record: bool = True) -> None:
        if type(output) is not ModelOutput:
            raise ValueError("Unverified structured Web output")
        fields = object.__getattribute__(output, "__dict__")
        candidates, chosen = fields.get("candidates"), fields.get("chosen")
        if (type(candidates) is not list or type(chosen) is not int
                or not 0 <= chosen < len(candidates) or type(candidates[chosen]) is not Candidate):
            raise ValueError("Unverified structured Web output")
        candidate = object.__getattribute__(candidates[chosen], "__dict__")
        rcid, text = candidate.get("rcid"), candidate.get("text")
        if type(rcid) is not str or type(text) is not str or rcid not in self.sources:
            raise ValueError("Unbound structured Web candidate")
        source, count, html_changed, preparser = self.sources[rcid]
        observed = _text_fingerprint(text)
        equal = observed == source
        if self.trace is not None and (record or not equal):
            state = self.trace.structured_text
            state["candidate_checks"] = min(2147483647, state["candidate_checks"] + 1)
            state["protected_ampersands_total"] = min(2147483647, state["protected_ampersands_total"] + count)
            state["unprotected_html_would_change_outputs"] = min(2147483647,
                state["unprotected_html_would_change_outputs"] + int(html_changed))
            state.update(last_source=dict(source), last_output=observed, last_equal=equal)
            selected = preparser.get("selected_payload") if type(preparser) is dict else None
            comparable = type(selected) is dict and type(selected.get("sha256")) is str
            state.update(last_preparser=deepcopy(preparser), preparser_equal_to_source=(
                selected["sha256"] == source["sha256"] and selected.get("text_bytes") == source["text_bytes"]
                if comparable else None))
        if not equal:
            raise ValueError("Structured Web candidate text changed")


@contextmanager
def preserve_structured_output(client: object, enabled: bool = False):
    """Explicit chat-only scope, owned by this client and generation task."""
    if not enabled:
        yield
        return
    if not isinstance(client, DiagnosticWebClient) or _structured_owner.get() is not None:
        raise ValueError("Structured Web adapter unavailable")
    scope = _StructuredText(client, client._nodia_generation_trace)
    if scope.trace is not None:
        scope.trace.structured_text["applied"] = True
    token = _structured_owner.set(scope)
    try:
        yield scope
    finally:
        scope.sources.clear()
        _structured_owner.reset(token)


def _structured_scope(client: object) -> _StructuredText | None:
    scope = _structured_owner.get()
    return scope if scope is not None and scope.client is client and scope.task is asyncio.current_task() else None


class WebGenerationDiagnostics:
    def __init__(self, attempt_id: str, sink: Callable[[dict[str, object]], None] | None = None):
        self.attempt_id, self.sink = attempt_id, sink
        self.started = monotonic()
        self.generation_task: asyncio.Task | None = None
        self.attached = False
        self.last_phase: Phase | None = None
        self.cancelled_at_phase: Phase | None = None
        self.events: list[dict[str, object]] = []
        self.counts = {"byte_chunks": 0, "body_bytes": 0, "candidate_outputs": 0,
                       "activity_calls": 0, "recovery_calls": 0, "client_close_calls": 0}
        self.http_status: int | None = None
        self.sink_errors = 0
        # Shape describes the last chosen candidate; counters cover all SDK
        # yields. None means unobservable, not an empty provider response.
        self.output_shape: dict[str, object] = {
            "text_nonempty": None, "text_delta_nonempty": None,
            "thoughts_present": None, "thoughts_empty": None,
            "candidates_count": None, "media_count": None,
            "first_yield_elapsed_ms": None, "last_yield_elapsed_ms": None,
            "first_text_elapsed_ms": None, "text_outputs": 0,
            "thoughts_only_outputs": 0, "empty_outputs": 0,
            "unclassified_outputs": 0,
        }
        self.upstream_eof_seen = False
        self.upstream_eof_elapsed_ms: int | None = None
        self.uploads = UploadDiagnostics(attempt_id, sink)
        self.body_pacing = BodyPacingDiagnostics(self.elapsed_ms)
        self.audio_transport = new_audio_transport_diagnostic()
        self.structured_text: dict[str, Any] = {
            "applied": False, "candidate_checks": 0, "protected_ampersands_total": 0,
            "unprotected_html_would_change_outputs": 0, "last_source": None,
            "last_output": None, "last_equal": None,
            "last_preparser": None, "preparser_equal_to_source": None,
        }

    def elapsed_ms(self) -> int:
        return min(86400000, max(0, round((monotonic() - self.started) * 1000)))

    def output(self, value: object) -> None:
        """Observe installed SDK fields without serialization or property calls.

        Deliberately reject unknown classes, including subclasses with custom
        getters. Diagnostics must not evaluate arbitrary payloads or change the
        result when an SDK shape is absent, malformed or evolves.
        """
        self.increment("candidate_outputs")
        shape = self.output_shape
        elapsed = self.elapsed_ms()
        if shape["first_yield_elapsed_ms"] is None:
            shape["first_yield_elapsed_ms"] = elapsed
        shape["last_yield_elapsed_ms"] = elapsed
        for key in ("text_nonempty", "text_delta_nonempty", "thoughts_present",
                    "thoughts_empty", "candidates_count", "media_count"):
            shape[key] = None
        classified = False
        if type(value) is ModelOutput:
            fields = object.__getattribute__(value, "__dict__")
            candidates, chosen = fields.get("candidates"), fields.get("chosen")
            if type(candidates) is list:
                shape["candidates_count"] = min(2147483647, len(candidates))
                if type(chosen) is int and 0 <= chosen < len(candidates) and type(candidates[chosen]) is Candidate:
                    candidate = object.__getattribute__(candidates[chosen], "__dict__")
                    text, delta, thoughts = (candidate.get(key) for key in ("text", "text_delta", "thoughts"))
                    media = [candidate.get(key) for key in ("web_images", "generated_images", "generated_videos", "generated_media")]
                    if (type(text) is str and (delta is None or type(delta) is str)
                            and (thoughts is None or type(thoughts) is str)
                            and all(type(items) is list for items in media)):
                        media_count = min(2147483647, sum(len(items) for items in media))
                        shape.update(text_nonempty=bool(text), text_delta_nonempty=bool(delta),
                                     thoughts_present=thoughts is not None,
                                     thoughts_empty=None if thoughts is None else not bool(thoughts),
                                     media_count=media_count)
                        if text:
                            shape["text_outputs"] = min(2147483647, shape["text_outputs"] + 1)
                            if shape["first_text_elapsed_ms"] is None:
                                shape["first_text_elapsed_ms"] = elapsed
                        elif thoughts and media_count == 0:
                            shape["thoughts_only_outputs"] = min(2147483647, shape["thoughts_only_outputs"] + 1)
                        elif not delta and not thoughts and media_count == 0:
                            shape["empty_outputs"] = min(2147483647, shape["empty_outputs"] + 1)
                        classified = True
        if not classified:
            shape["unclassified_outputs"] = min(2147483647, shape["unclassified_outputs"] + 1)

    def increment(self, key: str, count: int = 1) -> None:
        self.counts[key] = min(2147483647, self.counts[key] + count)

    def note(self, phase: Phase, role: TaskRole) -> None:
        # Background maintenance must not overwrite where the foreground is
        # blocked. Its lifecycle remains visible in role-labelled events.
        if role in ("generation", "caller"):
            self.last_phase = phase
        if len(self.events) >= 16:
            return
        event: dict[str, object] = {"phase": phase, "task_role": role,
                                    "elapsed_ms": self.elapsed_ms()}
        self.events.append(event)
        if self.sink is not None:
            try:
                self.sink({"attempt_id": self.attempt_id, **event})
            except Exception:
                # Diagnostics must not change the SDK's result or cleanup.
                self.sink_errors = min(2147483647, self.sink_errors + 1)

    def cancelling(self) -> None:
        self.cancelled_at_phase = self.last_phase
        self.note("cancellation_requested", "caller")

    def snapshot(self) -> dict[str, object]:
        return {"attached": self.attached, "last_phase": self.last_phase,
                "cancelled_at_phase": self.cancelled_at_phase,
                "elapsed_ms": self.elapsed_ms(),
                "http_status": self.http_status, **self.counts,
                "events": [dict(event) for event in self.events], "sink_errors": self.sink_errors,
                "output_shape": dict(self.output_shape),
                "upstream_eof_seen": self.upstream_eof_seen,
                "upstream_eof_elapsed_ms": self.upstream_eof_elapsed_ms,
                "uploads": self.uploads.snapshot(), "body_pacing": self.body_pacing.snapshot(),
                "audio_transport": deepcopy(self.audio_transport),
                "structured_text": deepcopy(self.structured_text)}


def _role(client: Any, trace: WebGenerationDiagnostics) -> TaskRole:
    task = asyncio.current_task()
    if task is not None and task is getattr(client, "activity_task", None):
        return "background_activity"
    if task is not None and task is getattr(client, "refresh_task", None):
        return "background_refresh"
    return "generation" if task is trace.generation_task else "caller"


class _Response:
    def __init__(self, response: Any, client: Any, trace: WebGenerationDiagnostics):
        self.response, self.client, self.trace = response, client, trace

    def __getattr__(self, name: str) -> Any:
        return getattr(self.response, name)

    async def aiter_content(self, *args: Any, **kwargs: Any):
        async for chunk in self.response.aiter_content(*args, **kwargs):
            if isinstance(chunk, (bytes, bytearray, memoryview)):
                self.trace.body_pacing.chunk()
                self.trace.increment("byte_chunks")
                self.trace.increment("body_bytes", len(chunk))
                if self.trace.counts["byte_chunks"] == 1:
                    self.trace.note("first_body_chunk", _role(self.client, self.trace))
            yield chunk
        # This line is unreachable on cancellation, errors or consumer aclose.
        # Stream context cleanup alone does not prove upstream EOF.
        self.trace.upstream_eof_seen = True
        self.trace.upstream_eof_elapsed_ms = self.trace.elapsed_ms()


class _StreamContext:
    def __init__(self, context: Any, client: Any, trace: WebGenerationDiagnostics):
        self.context, self.client, self.trace = context, client, trace

    async def __aenter__(self):
        self.trace.note("request_started", _role(self.client, self.trace))
        try:
            response = await self.context.__aenter__()
        except BaseException as error:
            self.trace.note("request_cancelled" if isinstance(error, asyncio.CancelledError) else "request_failed", _role(self.client, self.trace))
            raise
        status = getattr(response, "status_code", None)
        self.trace.http_status = status if type(status) is int and 100 <= status <= 599 else None
        self.trace.note("response_opened", _role(self.client, self.trace))
        return _Response(response, self.client, self.trace)

    async def __aexit__(self, *exception):
        self.trace.note("stream_exit_started", _role(self.client, self.trace))
        try:
            result = await self.context.__aexit__(*exception)
        except BaseException as error:
            self.trace.note("stream_exit_cancelled" if isinstance(error, asyncio.CancelledError) else "stream_exit_failed", _role(self.client, self.trace))
            raise
        self.trace.note("stream_exit_completed", _role(self.client, self.trace))
        return result


class _Transport:
    def __init__(self, session: Any, client: Any, trace: WebGenerationDiagnostics):
        self.session, self.client, self.trace = session, client, trace

    def __getattr__(self, name: str) -> Any:
        return getattr(self.session, name)

    def stream(self, *args: Any, **kwargs: Any):
        return _StreamContext(self.session.stream(*args, **kwargs), self.client, self.trace)


class DiagnosticWebClient(GeminiClient):
    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self._nodia_generation_trace: WebGenerationDiagnostics | None = None

    def _parse_candidate(self, candidate_data, cid: str, rid: str, rcid: str):
        scope = _structured_scope(self)
        preparser = describe_preparser(candidate_data) if scope is not None else None
        parsed = super()._parse_candidate(candidate_data, cid, rid, rcid)
        if scope is None:
            return parsed
        text, *remaining = parsed
        return (scope.protect(rcid, text, preparser), *remaining)

    @property
    def _live_client(self) -> Any:
        session = super()._live_client
        trace = self._nodia_generation_trace
        task = asyncio.current_task()
        if (trace is not None and upload_observation_active(trace.uploads)
                and task is not getattr(self, "activity_task", None)
                and task is not getattr(self, "refresh_task", None)):
            session = ObservedUploadTransport(session, trace.uploads)
        return _Transport(session, self, trace) if trace is not None and _stream_owner.get() is self else session

    async def _observed(self, phase: str, work):
        trace = self._nodia_generation_trace
        if trace is None:
            return await work()
        role = _role(self, trace)
        trace.increment({"activity": "activity_calls", "recovery": "recovery_calls", "client_close": "client_close_calls"}[phase])
        trace.note(phase + "_started", role)
        try:
            result = await work()
        except BaseException as error:
            trace.note(phase + ("_cancelled" if isinstance(error, asyncio.CancelledError) else "_failed"), role)
            raise
        trace.note(phase + "_completed", role)
        return result

    async def _sync_activity(self):
        return await self._observed("activity", super()._sync_activity)

    async def read_chat(self, *args: Any, **kwargs: Any):
        return await self._observed("recovery", lambda: super(DiagnosticWebClient, self).read_chat(*args, **kwargs))

    async def close(self, *args: Any, **kwargs: Any):
        return await self._observed("client_close", lambda: super(DiagnosticWebClient, self).close(*args, **kwargs))

    async def _generate(self, *args: Any, **kwargs: Any):
        trace = self._nodia_generation_trace
        if native_audio_scope_active(self):
            # The pinned public SDK calls _generate with keyword descriptors.
            # Refuse an evolving positional shape rather than guessing its slot.
            if args:
                raise ValueError("Unverified native Web attachment arguments")
            kwargs["req_file_data"] = adapt_req_file_data(self, kwargs.get("req_file_data"), trace)
        if trace is not None:
            trace.note("generation_started", _role(self, trace))
        token = _stream_owner.set(self) if trace is not None else None
        try:
            async with aclosing(super()._generate(*args, **kwargs)) as generation:
                async for output in generation:
                    scope = _structured_scope(self)
                    if scope is not None:
                        scope.verify(output)
                    if trace is not None:
                        trace.output(output)
                        if trace.counts["candidate_outputs"] == 1:
                            trace.note("candidate_output", _role(self, trace))
                    yield output
        except BaseException as error:
            if trace is not None:
                trace.note("generation_cancelled" if isinstance(error, asyncio.CancelledError) else "generation_failed", _role(self, trace))
            raise
        else:
            if trace is not None:
                trace.note("generation_completed", _role(self, trace))
        finally:
            if token is not None:
                _stream_owner.reset(token)


@contextmanager
def observe_generation(client: Any, trace: WebGenerationDiagnostics | None):
    attached = isinstance(client, DiagnosticWebClient) and trace is not None and client._nodia_generation_trace is None
    if attached:
        client._nodia_generation_trace = trace
        trace.attached = True
    try:
        if attached:
            with upload_observation(trace.uploads):
                yield
        else:
            yield
    finally:
        if attached:
            client._nodia_generation_trace = None
            trace.generation_task = None
