"""Content-free description of the pinned SDK's selected candidate text.

This observes the decoded candidate field before ``_parse_candidate`` cleans
artifacts. It is neither raw HTTP evidence nor an alternate response parser.
Unknown shapes and diagnostic limits never select or repair an SDK response.
"""
from __future__ import annotations

import hashlib
import json

from gemini_webapi.constants import CARD_CONTENT_RE
from gemini_webapi.utils import get_nested_value

_UNKNOWN = object()
_MAX_TEXT_BYTES = 65536
_JSON_ERRORS = {
    "Expecting property name enclosed in double quotes": "property_name",
    "Expecting ':' delimiter": "colon_delimiter",
    "Expecting ',' delimiter": "comma_delimiter",
    "Expecting value": "value",
    "Extra data": "extra_data",
}
_PUNCTUATION = {
    '"': "double_quote", "'": "single_quote", "{": "object_open", "}": "object_close",
    "[": "array_open", "]": "array_close", ":": "colon", ",": "comma", "\\": "backslash",
    "=": "equals", "`": "backtick", "&": "ampersand", "(": "paren_open", ")": "paren_close",
    "/": "slash", ";": "semicolon", "<": "angle_open", ">": "angle_close",
}


def _unknown() -> dict[str, object]:
    return {"selection_source": "unknown", "card_prefix_detected": None,
            "card_payload_available": None, "selected_payload": None}


def _slot(data: list, index: int, default: object) -> object:
    # The SDK receives plain JSON containers. Avoid invoking a subclass's
    # getters, truthiness or repr when diagnostic code sees an unknown shape.
    if len(data) > index and type(data[index]) not in (list, dict, str, int, float, bool, type(None)):
        return _UNKNOWN
    return get_nested_value(data, [index, 0], default)


def _character(value: str, position: int) -> str:
    if position < 0 or position >= len(value):
        return "boundary"
    character = value[position]
    if character in _PUNCTUATION:
        return _PUNCTUATION[character]
    if ord(character) < 32:
        return "control"
    if character.isspace():
        return "whitespace"
    if character.isalnum():
        return "alphanumeric"
    return "other"


def _syntax(error: json.JSONDecodeError) -> dict[str, object]:
    category = _JSON_ERRORS.get(error.msg)
    if category is None:
        category = ("unterminated_string" if error.msg.startswith("Unterminated string")
                    else "invalid_control" if error.msg.startswith("Invalid control character")
                    else "invalid_escape" if error.msg.startswith("Invalid ") else "other")
    return {"category": category, "position": error.pos, "line": error.lineno, "column": error.colno,
            "character_category": _character(error.doc, error.pos),
            "previous_category": _character(error.doc, error.pos - 1),
            "next_category": _character(error.doc, error.pos + 1)}


def _nonfinite(value: str) -> None:
    raise ValueError("Nonfinite JSON")


def _fingerprint(text: str) -> dict[str, object]:
    result: dict[str, object] = {"text_bytes": None, "sha256": None, "json_parseable": None,
                               "top_level_kind": "unknown", "syntax": None,
                               "diagnostic_limit_exceeded": False}
    # Checking characters first bounds the allocation made by UTF-8 encoding.
    if len(text) > _MAX_TEXT_BYTES:
        result["diagnostic_limit_exceeded"] = True
        return result
    try:
        encoded = text.encode("utf-8")
    except UnicodeError:
        return result
    result["text_bytes"] = len(encoded)
    if len(encoded) > _MAX_TEXT_BYTES:
        result["diagnostic_limit_exceeded"] = True
        return result
    result["sha256"] = hashlib.sha256(encoded).hexdigest()
    try:
        decoded = json.loads(text, parse_constant=_nonfinite)
    except json.JSONDecodeError as error:
        result.update(json_parseable=False, top_level_kind="invalid", syntax=_syntax(error))
    except (ValueError, RecursionError):
        # A nonfinite constant, Python's integer bound or recursion limit does
        # not permit a second decoder, content logging or schema acceptance.
        result.update(json_parseable=False, top_level_kind="invalid")
    else:
        result.update(json_parseable=True, top_level_kind={dict: "object", list: "array", str: "string",
            int: "number", float: "number", bool: "boolean", type(None): "null"}[type(decoded)])
    return result


def describe_preparser(candidate_data: object) -> dict[str, object]:
    """Describe the SDK's exact primary/card/fallback choice without changing it.

    ``card_payload_available`` means a nonempty plain string in the card slot;
    null means unobserved. The selected payload is fingerprinted at most once.
    No provider characters, candidate IDs, URLs, files or frame bodies survive.
    This helper cannot establish protocol-schema or attachment validity.
    """
    try:
        if type(candidate_data) is not list:
            return _unknown()
        primary = _slot(candidate_data, 1, "")
        if type(primary) is not str:
            return _unknown()
        prefix = CARD_CONTENT_RE.match(primary) is not None
        if not prefix:
            return {"selection_source": "primary", "card_prefix_detected": False,
                    "card_payload_available": None, "selected_payload": _fingerprint(primary)}
        card = _slot(candidate_data, 22, None)
        if card is _UNKNOWN or type(card) not in (list, dict, str, int, float, bool, type(None)):
            return {**_unknown(), "card_prefix_detected": True}
        selected = card if card else primary  # Mirrors the SDK's `card or text`.
        return {"selection_source": "card" if card else "fallback", "card_prefix_detected": True,
                "card_payload_available": type(card) is str and bool(card),
                "selected_payload": _fingerprint(selected) if type(selected) is str else None}
    except Exception:
        # Telemetry must never replace the SDK's result or original exception.
        return _unknown()
