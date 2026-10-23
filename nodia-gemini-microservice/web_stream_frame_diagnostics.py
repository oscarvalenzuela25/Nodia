"""Bounded, content-free stream-envelope observation; never an answer parser.

Framing follows gemini-webapi 2.1.1 StreamingFrameParser (UTF-16 length,
including the newline after the marker). The SDK alone parses the response for
execution. This independent observer neither returns parts to it nor logs raw
frames; even the SDK parser's malformed-frame debug logging is not invoked.
"""
from __future__ import annotations

import codecs
import json
from importlib.metadata import version

from gemini_webapi.constants import ErrorCode

MAX_BYTES = 65536
MAX_PARTS = 256
_ERRORS = {
    int(ErrorCode.USAGE_LIMIT_EXCEEDED): "usage_limit",
    int(ErrorCode.MODEL_INCONSISTENT): "model_inconsistent",
    int(ErrorCode.MODEL_HEADER_INVALID): "model_header_invalid",
    int(ErrorCode.IP_TEMPORARILY_BLOCKED): "ip_blocked",
    int(ErrorCode.TEMPORARY_ERROR_1013): "temporary_1013",
}


def _slot(value: object, *path: int) -> object:
    for index in path:
        if type(value) is not list or index >= len(value):
            return None
        value = value[index]
    return value


def _reject_nonfinite(value: str) -> None:
    raise ValueError("Nonfinite JSON")


class StreamFrameDiagnostics:
    def __init__(self) -> None:
        self.enabled = version("gemini-webapi") == "2.1.1"
        self.counts = dict.fromkeys(("streams", "inspected_bytes", "frames", "parts",
            "unclassified_parts", "invalid_json_frames", "inner_json_parts",
            "invalid_inner_json_parts", "status_list_parts", "candidate_list_parts",
            "candidates", "candidate_id_parts", "completed_indicator_parts",
            "final_context_parts", "data_analysis_parts", "observer_errors"), 0)
        self.errors = dict.fromkeys((*_ERRORS.values(), "other"), 0)
        self.cid_present: bool | None = None
        self.rid_present: bool | None = None
        self.limit_exceeded = False
        self.incomplete_at_close: bool | None = None
        self._decoder = None
        self._buffer = ""
        self._prefix_checked = False
        self._expected: int | None = None
        self._payload_start = self._scanned_chars = self._scanned_units = 0

    def _count(self, name: str, amount: int = 1) -> None:
        self.counts[name] = min(2147483647, self.counts[name] + amount)

    def start(self) -> None:
        self.close()
        if self.enabled and not self.limit_exceeded:
            self._count("streams")
            self._decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
            self._prefix_checked = False

    def _stop(self) -> None:
        self._decoder = None
        self._buffer = ""
        self._expected = None
        self._payload_start = self._scanned_chars = self._scanned_units = 0

    def feed(self, chunk: object) -> None:
        if self._decoder is None:
            return
        try:
            if type(chunk) not in (bytes, bytearray, memoryview):
                return
            size = chunk.nbytes if type(chunk) is memoryview else len(chunk)
            if size > MAX_BYTES - self.counts["inspected_bytes"]:
                self.limit_exceeded = True
                self._stop()
                return
            self._count("inspected_bytes", size)
            self._buffer += self._decoder.decode(chunk, final=False)
            self._drain()
        except Exception:
            # No error messages or repr: diagnostics cannot affect execution.
            self._count("observer_errors")
            self._stop()

    def _drain(self) -> None:
        if not self._prefix_checked:
            prefix = ")]}'"
            if len(self._buffer) < len(prefix) and prefix.startswith(self._buffer):
                return
            if self._buffer.startswith(prefix):
                self._buffer = self._buffer[len(prefix):].lstrip()
            self._prefix_checked = True
        while self._decoder is not None:
            if self._expected is None:
                self._buffer = self._buffer.lstrip()
                marker, separator, _ = self._buffer.partition("\n")
                if not separator and len(marker) > 6:
                    self.limit_exceeded = True
                    self._stop()
                    return
                if not separator or not marker.isascii() or not marker.isdecimal():
                    return
                # Very long/malicious lengths cannot allocate an observer frame.
                if len(marker) > 6 or int(marker) > MAX_BYTES:
                    self.limit_exceeded = True
                    self._stop()
                    return
                self._expected = int(marker)
                self._payload_start = len(marker)
                self._scanned_chars = self._scanned_units = 0
            cursor = self._payload_start + self._scanned_chars
            while cursor < len(self._buffer) and self._scanned_units < self._expected:
                units = 2 if ord(self._buffer[cursor]) > 0xFFFF else 1
                if self._scanned_units + units > self._expected:
                    return
                self._scanned_units += units
                self._scanned_chars += 1
                cursor += 1
            if self._scanned_units < self._expected:
                return
            payload = self._buffer[self._payload_start:cursor]
            self._buffer = self._buffer[cursor:]
            self._expected = None
            self._count("frames")
            try:
                decoded = json.loads(payload, parse_constant=_reject_nonfinite)
            except (ValueError, RecursionError):
                self._count("invalid_json_frames")
                continue
            for part in decoded if type(decoded) is list else [decoded]:
                if self.counts["parts"] >= MAX_PARTS:
                    self.limit_exceeded = True
                    self._stop()
                    return
                self._count("parts")
                self._describe(part)

    def _describe(self, part: object) -> None:
        if type(part) is not list:
            self._count("unclassified_parts")
            return
        status = _slot(part, 5)
        if type(status) is list and status:
            self._count("status_list_parts")
        error = _slot(part, 5, 2, 0, 1, 0)
        if error is not None and error != 0:
            category = _ERRORS.get(error, "other") if type(error) is int else "other"
            self.errors[category] = min(2147483647, self.errors[category] + 1)
        inner = _slot(part, 2)
        if type(inner) is not str or not inner:
            return
        self._count("inner_json_parts")
        try:
            decoded = json.loads(inner, parse_constant=_reject_nonfinite)
        except (ValueError, RecursionError):
            self._count("invalid_inner_json_parts")
            return
        if type(decoded) is not list:
            self._count("unclassified_parts")
            return
        cid, rid = _slot(decoded, 1, 0), _slot(decoded, 1, 1)
        self.cid_present = bool(self.cid_present) or (type(cid) is str and bool(cid))
        self.rid_present = bool(self.rid_present) or (type(rid) is str and bool(rid))
        if _slot(decoded, 6, 1, 0) == "data_analysis_tool":
            self._count("data_analysis_parts")
        if type(_slot(decoded, 25)) is str:
            self._count("final_context_parts")
        candidates = _slot(decoded, 4)
        if type(candidates) is list:
            self._count("candidate_list_parts")
            self._count("candidates", min(MAX_PARTS, len(candidates)))
            for candidate in candidates[:MAX_PARTS]:
                if type(_slot(candidate, 0)) is str and _slot(candidate, 0):
                    self._count("candidate_id_parts")
                if _slot(candidate, 8, 0) == 2:
                    self._count("completed_indicator_parts")

    def close(self) -> None:
        if self._decoder is not None:
            self.incomplete_at_close = (bool(self._buffer.strip()) or self._expected is not None
                                        or bool(self._decoder.getstate()[0]))
        self._stop()

    def snapshot(self) -> dict[str, object]:
        return {"enabled": self.enabled, **self.counts, "error_categories": dict(self.errors),
            "cid_present": self.cid_present, "rid_present": self.rid_present,
            "limit_exceeded": self.limit_exceeded, "incomplete_at_close": self.incomplete_at_close}
