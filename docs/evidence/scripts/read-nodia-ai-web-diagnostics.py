"""Project closed Web lifecycle diagnostics; never export native log lines or payloads."""
import json
import re
import sys

PHASES = {
    "activity_started", "activity_completed", "activity_failed", "activity_cancelled",
    "generation_started", "generation_completed", "generation_failed", "generation_cancelled",
    "request_started", "response_opened", "request_failed", "request_cancelled",
    "first_body_chunk", "candidate_output", "recovery_started", "recovery_completed",
    "recovery_failed", "recovery_cancelled", "stream_exit_started", "stream_exit_completed",
    "stream_exit_failed", "stream_exit_cancelled", "client_close_started", "client_close_completed",
    "client_close_failed", "client_close_cancelled", "cancellation_requested",
}
ROLES = {"generation", "caller", "background_activity", "background_refresh"}
CHAT_PHASES = {"generation", "reply_validation", "cookie_persistence", "terminal_record"}
ERRORS = {"TimeoutError", "ServiceError", "ValueError", "TypeError", "KeyError", "AttributeError", "RuntimeError", "APIError", "AuthError", "ReadTimeout", "Other"}
# Public exception classes verified in the installed gemini-webapi/curl_cffi sources.
ERRORS |= {"ImageGenerationError", "GeminiError", "UsageLimitExceededError", "ModelInvalidError", "TemporarilyBlockedError", "RequestException", "CookieConflict", "SessionClosed", "ImpersonateError", "InvalidJSONError", "JSONDecodeError", "HTTPError", "IncompleteRead", "ConnectionError", "DNSError", "ProxyError", "SSLError", "CertificateVerifyError", "Timeout", "ConnectTimeout", "URLRequired", "TooManyRedirects", "MissingSchema", "InvalidSchema", "InvalidURL", "InvalidHeader", "InvalidProxyURL", "ChunkedEncodingError", "ContentDecodingError", "StreamConsumedError", "RetryError", "UnrewindableBodyError", "InterfaceError"}
EVENT_KEYS = {"phase", "task_role", "elapsed_ms"}
COUNTERS = {"byte_chunks", "body_bytes", "candidate_outputs", "activity_calls", "recovery_calls", "client_close_calls", "sink_errors"}
SNAPSHOT_KEYS = {"attached", "last_phase", "cancelled_at_phase", "elapsed_ms", "http_status", "events"} | COUNTERS
SHAPE_BOOLEANS = {"text_nonempty", "text_delta_nonempty", "thoughts_present", "thoughts_empty"}
SHAPE_COUNTS = {"candidates_count", "media_count"}
SHAPE_TIMES = {"first_yield_elapsed_ms", "last_yield_elapsed_ms", "first_text_elapsed_ms"}
SHAPE_COUNTERS = {"text_outputs", "thoughts_only_outputs", "empty_outputs", "unclassified_outputs"}
EXTENDED_KEYS = {"output_shape", "upstream_eof_seen", "upstream_eof_elapsed_ms"}


def integer(value, maximum):
    return type(value) is int and 0 <= value <= maximum


def event(value):
    return (isinstance(value, dict) and set(value) == EVENT_KEYS
            and value["phase"] in PHASES and value["task_role"] in ROLES
            and integer(value["elapsed_ms"], 86400000))


def output_shape(value):
    return (isinstance(value, dict) and set(value) == SHAPE_BOOLEANS | SHAPE_COUNTS | SHAPE_TIMES | SHAPE_COUNTERS
            and all(value[key] is None or type(value[key]) is bool for key in SHAPE_BOOLEANS)
            and all(value[key] is None or integer(value[key], 2147483647) for key in SHAPE_COUNTS)
            and all(value[key] is None or integer(value[key], 86400000) for key in SHAPE_TIMES)
            and all(integer(value[key], 2147483647) for key in SHAPE_COUNTERS))


def extension(value):
    if set(value) == SNAPSHOT_KEYS:
        return True  # Historical snapshots remain readable, without invented shape.
    return (set(value) == SNAPSHOT_KEYS | EXTENDED_KEYS
            and output_shape(value["output_shape"])
            and type(value["upstream_eof_seen"]) is bool
            and (integer(value["upstream_eof_elapsed_ms"], 86400000) if value["upstream_eof_seen"]
                 else value["upstream_eof_elapsed_ms"] is None))


def snapshot(value):
    return (isinstance(value, dict) and extension(value)
            and type(value["attached"]) is bool
            and value["last_phase"] in PHASES | {None}
            and value["cancelled_at_phase"] in PHASES | {None}
            and integer(value["elapsed_ms"], 86400000)
            and (value["http_status"] is None or type(value["http_status"]) is int and 100 <= value["http_status"] <= 599)
            and all(integer(value[key], 2147483647) for key in COUNTERS)
            and isinstance(value["events"], list) and len(value["events"]) <= 16
            and all(event(item) for item in value["events"]))


def project(marker, value):
    if not isinstance(value, dict) or not isinstance(value.get("attempt_id"), str) or not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", value["attempt_id"]):
        return None
    if marker == "nodia_ai_web_progress ":
        safe = {key: item for key, item in value.items() if key != "attempt_id"}
        return {"event": "web_progress", **safe} if event(safe) else None
    if marker in ("nodia_ai_web_success ", "nodia_ai_web_cancelled "):
        if set(value) not in ({"attempt_id", "web_generation"}, {"attempt_id", "phase", "web_generation"}):
            return None
        if "phase" in value and value["phase"] not in CHAT_PHASES:
            return None
        if not snapshot(value["web_generation"]):
            return None
        return {"event": "web_success" if marker == "nodia_ai_web_success " else "web_cancelled", **{key: item for key, item in value.items() if key != "attempt_id"}}
    allowed = {"engine", "attempt_id", "phase", "error_type", "elapsed_ms"}
    if set(value) not in (allowed, allowed | {"web_generation"}) or value["engine"] != "web" or value["phase"] not in CHAT_PHASES or value["error_type"] not in ERRORS or not integer(value["elapsed_ms"], 86400000):
        return None
    if "web_generation" in value and not snapshot(value["web_generation"]):
        return None
    return {"event": "web_failure", **{key: item for key, item in value.items() if key != "attempt_id"}}


def main():
    remaining_bytes = 1048576
    for _ in range(1024):
        raw = sys.stdin.buffer.readline(min(131073, remaining_bytes + 1))
        if not raw:
            break
        remaining_bytes -= len(raw)
        if len(raw) > 131072 or remaining_bytes < 0:
            break
        try:
            line = raw.decode("utf-8")
        except UnicodeError:
            continue
        for marker in ("nodia_ai_web_progress ", "nodia_ai_web_success ", "nodia_ai_web_cancelled ", "nodia_ai_chat_failure "):
            if marker not in line:
                continue
            try:
                result = project(marker, json.loads(line.split(marker, 1)[1]))
                if result is not None:
                    print(json.dumps(result, sort_keys=True))
            except (ValueError, TypeError, KeyError):
                pass
            break


if __name__ == "__main__":
    main()
