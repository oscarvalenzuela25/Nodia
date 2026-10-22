"""Export only the closed structural MCP terminal diagnostic, never raw service logs."""
import json
import sys

KEYS = {"phase", "state", "exception_type", "elapsed_ms", "rpc_messages", "callbacks", "exit_code", "gate_verified", "cli"}
CLI_KEYS = {"stage", "events", "invalid_lines", "stdout_bytes", "initialized", "document_read_completed", "result_seen", "last_event_age_ms", "tool_steps", "last_tool", "terminal_status", "denied_count", "stderr_bytes"}
HOOK_KEYS = {"receipt_class", "decision_count", "rejected_count", "categories_state", "categories"}
HOOK_CATEGORIES = {"allowed_finish", "finish_arguments", "dispatcher_envelope", "dispatcher_extra_fields", "foreign_server", "unregistered_tool", "arguments_type", "arguments_json", "arguments_shape", "allowed_registered", "unregistered_native", "payload_shape", "invalid_json"}
HOOK_STATES = {"missing", "oversize", "invalid_json", "invalid_shape", "valid"}
LOG_KEYS = {"state", "interpretation", "bytes_read", "lines_scanned", "truncated", "transport_indicators", "provider_error_indicators", "http_statuses"}
LOG_TRANSPORT = {"context_deadline", "io_timeout", "tls_timeout", "dns_failure", "connection_refused", "network_unreachable"}
LOG_PROVIDER = {"RESOURCE_EXHAUSTED", "UNAUTHENTICATED", "PERMISSION_DENIED", "DEADLINE_EXCEEDED"}
LOG_HTTP = {400, 401, 403, 404, 408, 409, 425, 429, 500, 502, 503, 504}


def safe_cli_log(value):
    if value is None:
        return True
    if not isinstance(value, dict) or set(value) != LOG_KEYS:
        return False
    if value["state"] not in ("missing", "unsafe_file", "read_error", "empty", "observed"):
        return False
    if value["interpretation"] != "text_indicator_not_verified_cause" or type(value["truncated"]) is not bool:
        return False
    if type(value["bytes_read"]) is not int or not 0 <= value["bytes_read"] <= 131072:
        return False
    if type(value["lines_scanned"]) is not int or not 0 <= value["lines_scanned"] <= 128:
        return False
    for key, allowed, kind in (("transport_indicators", LOG_TRANSPORT, str), ("provider_error_indicators", LOG_PROVIDER, str), ("http_statuses", LOG_HTTP, int)):
        items = value[key]
        if (not isinstance(items, list) or len(items) > len(allowed)
                or any(type(item) is not kind or item not in allowed for item in items)
                or len(set(items)) != len(items) or items != sorted(items)):
            return False
    return True


def safe_hook(value):
    if value is None:
        return True
    if not isinstance(value, dict) or set(value) != HOOK_KEYS:
        return False
    if value["receipt_class"] not in (HOOK_STATES - {"valid"}) | {"verified", "denied_tool", "unregistered"}:
        return False
    if value["categories_state"] not in HOOK_STATES:
        return False
    for key in ("decision_count", "rejected_count"):
        count = value[key]
        if count is not None and (type(count) is not int or not 0 <= count <= 128):
            return False
    categories = value["categories"]
    return (isinstance(categories, dict) and set(categories) <= HOOK_CATEGORIES
            and all(type(count) is int and 1 <= count <= 128 for count in categories.values())
            and sum(categories.values()) <= 128)


for line in sys.stdin:
    marker = "nodia_ai_mcp_terminal "
    if marker not in line:
        continue
    try:
        value = json.loads(line.split(marker, 1)[1])
        if set(value) not in (KEYS, KEYS | {"hook"}, KEYS | {"cli_log"}, KEYS | {"hook", "cli_log"}) or not isinstance(value["cli"], dict) or set(value["cli"]) != CLI_KEYS:
            continue
        if not safe_hook(value.get("hook")) or not safe_cli_log(value.get("cli_log")):
            continue
        if any(not isinstance(item, (str, int, bool, type(None))) for key, item in value.items() if key not in {"cli", "hook", "cli_log"}):
            continue
        if any(not isinstance(item, (str, int, bool, type(None))) for item in value["cli"].values()):
            continue
        print(json.dumps(value, sort_keys=True))
    except (ValueError, TypeError):
        continue
