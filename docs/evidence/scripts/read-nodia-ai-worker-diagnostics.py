"""Project closed worker failure categories from plain or journal-JSON lines.

Contract: nodia-server/src/nodia-ai-runtime/types/nodia-ai-failure-diagnostic.ts
and the code-owned ToolPhase union. No application imports or raw log export.
"""
import json
import re
import sys

ERROR_TYPES = {
    "Error", "TypeError", "RangeError", "SyntaxError", "QueryFailedError",
    "EntityMetadataNotFoundError", "ForbiddenException", "UnauthorizedException",
    "BadRequestException", "NotFoundException", "ServiceUnavailableException",
    "NodiaAiLostLeaseError", "NodiaAiKnownPreDispatchError", "NodiaAiAdapterError",
    "AbortError", "TimeoutError", "Other",
}
ERROR_CODES = {
    "nodia_ai:invalid_tool_input", "nodia_ai:invalid_tool_output", "nodia_ai:invalid_input",
    "nodia_ai:invalid_selection", "nodia_ai:execution_limit", "nodia_ai:cancelled",
    "nodia_ai:capability_denied", "nodia_ai:catalog_changed", "nodia_ai:context_limit",
    "nodia_ai:tool_catalog_limit", "nodia_ai:deadline_exceeded", "nodia_ai:eligibility_changed",
    "nodia_ai:stage_failed", "nodia_ai:outcome_unknown", "nodia_ai:module_not_allowed",
    "nodia_ai:business_scope_not_allowed", "nodia_ai:business_result_scope_invalid",
    "nodia_ai:business_operation_invalid", "nodia_ai:business_result_invalid",
    "nodia_ai:invalid_knowledge_request", "nodia_ai:forbidden_knowledge_fragment",
    "nodia_ai:knowledge_release_changed", "nodia_ai:knowledge_not_available", "nodia_ai:request_conflict",
    "nodia_ai:invalid_provider_response", "nodia_ai:tool_registry_invalid",
    "nodia_ai:operation_not_implemented", "authorization:transaction_required",
    "authorization:statement_timeout", "auth:session_expired", "mcp_result_unknown",
    "mcp_call_invalid", "mcp_result_invalid", "mcp_events_invalid", "mcp_cancelled",
    "mcp_terminal_missing", "adapter_configuration_changed",
}
SQL_STATES = {"23503", "23505", "23502", "22P02", "22007", "42703", "42P01",
              "40001", "40P01", "57014", "55P03"}
TOOL_PHASES = {
    "reserve_budget", "validate_envelope", "technical", "external", "authority",
    "select_contract", "validate_input", "resource_authority", "replay", "native_read",
    "validate_output", "output_authority", "persist_receipt",
}
TOOL_EVENT = "nodia_ai_tool_execution_failed"
STAGE_EVENTS = {"nodia_ai_stage_execution_failed": "handler",
                "nodia_ai_stage_checkpoint_unavailable": "checkpoint"}
BASE_KEYS = {"phase", "error_type", "error_code", "sql_state"}
FLAGS = {"dispatched", "signal_aborted", "lost_lease"}
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_key")
        result[key] = value
    return result


def load(value):
    return json.loads(value, object_pairs_hook=unique_object)


def optional_enum(value, choices):
    return value is None or (type(value) is str and value in choices)


def project(marker, value):
    if not isinstance(value, dict):
        return None
    keys = BASE_KEYS if marker == TOOL_EVENT else BASE_KEYS | FLAGS
    if set(value) != keys or type(value["phase"]) is not str:
        return None
    if marker == TOOL_EVENT:
        if value["phase"] not in TOOL_PHASES:
            return None
    elif marker in STAGE_EVENTS:
        if value["phase"] != STAGE_EVENTS[marker] or any(type(value[key]) is not bool for key in FLAGS):
            return None
    else:
        return None
    if (type(value["error_type"]) is not str or value["error_type"] not in ERROR_TYPES
            or not optional_enum(value["error_code"], ERROR_CODES)
            or not optional_enum(value["sql_state"], SQL_STATES)):
        return None
    return {"event": marker, **value}


def message_from_line(line):
    if line.lstrip().startswith("{"):
        outer = load(line)
        if isinstance(outer, dict) and "MESSAGE" in outer:
            message = outer["MESSAGE"]
            if isinstance(message, list) and all(type(x) is int and 0 <= x <= 255 for x in message):
                message = bytes(message).decode("utf-8")
            return message if type(message) is str else None
    return line


def main():
    remaining = 1048576
    for _ in range(1024):
        raw = sys.stdin.buffer.readline(min(131073, remaining + 1))
        if not raw:
            break
        remaining -= len(raw)
        if len(raw) > 131072 or remaining < 0:
            break
        try:
            message = message_from_line(raw.decode("utf-8"))
            if message is None:
                continue
            message = ANSI.sub("", message)
            for marker in (TOOL_EVENT, *STAGE_EVENTS):
                token = marker + " "
                if token not in message:
                    continue
                result = project(marker, load(message.split(token, 1)[1].strip()))
                if result is not None:
                    print(json.dumps(result, sort_keys=True))
                break
        except (ValueError, TypeError, KeyError, UnicodeError):
            continue


if __name__ == "__main__":
    main()
