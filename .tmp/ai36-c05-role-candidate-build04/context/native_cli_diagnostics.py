"""Bounded structural CLI diagnostics; indicators never establish provider cause."""
import json
import os
import re
import stat
from pathlib import Path

ERROR_INDICATOR_PATTERNS = {
    "unknown_tool": (r"\b(?:unknown|unmapped|unrecognized|unsupported) tools?\b", r"\btools?\b.{0,100}\b(?:not found|not registered|not available|not recognized)\b"),
    "invalid_agent": (r"\binvalid agent\b", r"\bagent configuration\b.{0,100}\b(?:invalid|error)\b"),
    "schema": (r"\binvalid schema\b", r"\bjson schema\b.{0,100}\b(?:invalid|error)\b"),
    "authentication": (r"\bunauthenticated\b", r"\bauthentication (?:failed|required)\b"),
    "permission": (r"\bpermission[ _]denied\b",),
    "quota": (r"\bresource[ _]exhausted\b", r"\brate limit\b"),
    "timeout": (r"\bdeadline[ _]exceeded\b", r"\btimed? out\b", r"\btimeout\b"),
    "transport": (r"\bconnection refused\b", r"\btls handshake\b", r"\bnetwork is unreachable\b"),
}


def cli_error_indicators(text: str) -> list[str]:
    """Only fixed labels; untrusted text never becomes a reported cause."""
    bounded = text[:16384].lower()
    categories = sorted(category for category, patterns in ERROR_INDICATOR_PATTERNS.items()
        if any(re.search(pattern, bounded) for pattern in patterns))
    return categories or (["unclassified"] if bounded.strip() else [])


def result_error_diagnostic(value: object) -> dict[str, object]:
    parts: list[str] = []
    def collect(item: object, depth: int = 0) -> None:
        if depth > 4 or len(parts) >= 16:
            return
        if isinstance(item, str):
            parts.append(item[:1024])
        elif isinstance(item, dict):
            for key in ("type", "code", "message", "error", "details"):
                if key in item:
                    collect(item[key], depth + 1)
    collect(value)
    try:
        size = len(json.dumps(value, ensure_ascii=True, separators=(",", ":")).encode("ascii")) if value is not None else None
    except (TypeError, ValueError, RecursionError):
        size = None
    return {"result_error_categories": cli_error_indicators(" ".join(parts)),
        "result_error_json_utf8_bytes": size}

CLI_LOG_TRANSPORT_INDICATORS = {
    "context_deadline": b"context deadline exceeded", "io_timeout": b"i/o timeout",
    "tls_timeout": b"tls handshake timeout", "dns_failure": b"no such host",
    "connection_refused": b"connection refused", "network_unreachable": b"network is unreachable",
}
CLI_LOG_PROVIDER_INDICATORS = frozenset({"RESOURCE_EXHAUSTED", "UNAUTHENTICATED", "PERMISSION_DENIED", "DEADLINE_EXCEEDED"})
CLI_LOG_HTTP_STATUSES = frozenset({400, 401, 403, 404, 408, 409, 425, 429, 500, 502, 503, 504})
CLI_LOG_HTTP_PATTERN = re.compile(rb"\b(?:HTTP status(?: code)?|http_status(?:_code)?|status_code)\b[\s\"':=]{1,12}([1-5][0-9]{2})\b", re.IGNORECASE)


def _classify_admitted_log_windows(windows: tuple[bytes, ...]) -> dict[str, object]:
    """Closed indicators from admitted bytes; disjoint windows stay independent."""
    if (not isinstance(windows, tuple) or not 1 <= len(windows) <= 2
            or any(type(window) is not bytes for window in windows)
            or sum(len(window) for window in windows) > 131072):
        raise ValueError("Invalid bounded diagnostic windows")
    return {
        "transport_indicators": sorted(name for name, label in CLI_LOG_TRANSPORT_INDICATORS.items()
                                       if any(label in text.lower() for text in windows)),
        "provider_error_indicators": sorted(name for name in CLI_LOG_PROVIDER_INDICATORS
                                           if any(re.search(rb"\b" + name.encode() + rb"\b", text) for text in windows)),
        "http_statuses": sorted({int(match[1]) for text in windows
                                for match in CLI_LOG_HTTP_PATTERN.finditer(text)} & CLI_LOG_HTTP_STATUSES),
    }


def capture_cli_log_diagnostic(path: Path) -> dict[str, object]:
    """Untrusted text indicators, never proof of a provider response or a failure cause."""
    value: dict[str, object] = {
        "state": "missing", "interpretation": "text_indicator_not_verified_cause",
        "bytes_read": 0, "lines_scanned": 0, "truncated": False,
        "transport_indicators": [], "provider_error_indicators": [], "http_statuses": [],
    }
    try:
        before = path.lstat()
        if not stat.S_ISREG(before.st_mode) or getattr(before, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
            value["state"] = "unsafe_file"
            return value
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_BINARY", 0))
        with os.fdopen(descriptor, "rb") as stream:
            opened = os.fstat(stream.fileno())
            if not stat.S_ISREG(opened.st_mode) or (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
                value["state"] = "unsafe_file"
                return value
            if opened.st_size > 131072:
                start = stream.read(65536)
                stream.seek(max(0, opened.st_size - 65536))
                windows = (start, stream.read(65535))
                raw = b"\n".join(windows)
                value["truncated"] = True
            else:
                raw = stream.read(131072)
                windows = (raw,)
        value["bytes_read"] = len(raw)
        lines = raw.splitlines()
        if len(lines) > 128:
            lines = lines[:64] + lines[-64:]
            value["truncated"] = True
        value["lines_scanned"] = len(lines)
        value["state"] = "observed" if raw else "empty"
        # Classify every admitted byte, independently for nonadjacent windows.
        # Line sampling cannot hide indicators or fabricate one across a gap.
        value.update(_classify_admitted_log_windows(windows))
    except FileNotFoundError:
        pass
    except OSError:
        value["state"] = "read_error"
    return value


def capture_plain_gate_diagnostic(path: Path, allowed: set[str]) -> dict[str, object]:
    """Counts only; arbitrary tool names and all hook arguments stay private."""
    result: dict[str, object] = {"state": "missing", "decision_count": None,
        "rejected_count": None, "unrecognized_count": None, "finish_count": None}
    try:
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
            result["state"] = "unsafe_file"
            return result
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_BINARY", 0))
        with os.fdopen(descriptor, "rb") as stream:
            opened = os.fstat(stream.fileno())
            if not stat.S_ISREG(opened.st_mode) or (info.st_dev, info.st_ino) != (opened.st_dev, opened.st_ino):
                result["state"] = "unsafe_file"
                return result
            raw = stream.read(8193)
        lines = raw.splitlines()
        if len(raw) > 8192 or len(lines) > 128:
            result["state"] = "oversize"
            return result
        decisions = [json.loads(line) for line in lines]
        if any(not isinstance(item, dict) or set(item) != {"tool", "allowed"}
               or not isinstance(item["tool"], str) or type(item["allowed"]) is not bool for item in decisions):
            result["state"] = "invalid_shape"
            return result
        result.update(state="observed" if decisions else "empty", decision_count=len(decisions),
            rejected_count=sum(not item["allowed"] for item in decisions),
            unrecognized_count=sum(item["tool"] not in allowed for item in decisions),
            finish_count=sum(item["tool"] == "finish" for item in decisions))
    except FileNotFoundError:
        pass
    except (ValueError, UnicodeError, RecursionError):
        result["state"] = "invalid_json"
    except OSError:
        result["state"] = "read_error"
    return result


