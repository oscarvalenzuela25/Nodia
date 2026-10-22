"""Opt-in safe structural diagnostics; no prompts, response text or credentials."""
from pathlib import Path
import re

from agentic_progress import CliProgress
from experiments.nodia_ai_mcp_fixture import NATIVE_NAMES, parse_json


def error_categories(text: str) -> list[str]:
    lowered = text.lower()
    patterns = {
        "authentication": ("authentication required", "unauthenticated", "invalid_grant"),
        "quota": ("resource_exhausted", "quota exceeded", "rate limit exceeded"),
        "permission": ("permission_denied", "soft-denied", "permission denied"),
        "timeout": ("deadline_exceeded", "timed out", "timeout"),
        "network": ("connection refused", "connection reset", "unavailable", "no such host"),
        "readonly": ("read-only file system", "readonly database"),
        "certificate": ("certificate verify failed", "unknown authority"),
        "mcp_lookup": ("not found", "unknown tool", "unknown server", "does not exist"),
        "arguments": ("invalid argument", "validation error", "schema error"),
        "hook_contract": ("unmarshal", "injectsteps", "invalid hook", "hook output", "syntax error"),
    }
    return [category for category, needles in patterns.items() if any(n in lowered for n in needles)]


class SafeTrace(CliProgress):
    def __init__(self) -> None:
        super().__init__()
        self.steps: dict[str, int] = {}
        self.fixture_names: list[str] = []
        self.result_shape: dict[str, object] = {}
        self.tool_steps: list[dict[str, object]] = []
        self.stderr_bytes = 0
        self.stderr_categories: set[str] = set()
        self._error_tail = ""

    def feed_error(self, chunk: bytes) -> None:
        self.stderr_bytes += len(chunk)
        text = self._error_tail + chunk.decode(errors="replace")
        self.stderr_categories.update(error_categories(text))
        # Fixed bounded overlap allows patterns spanning chunks; never exported.
        self._error_tail = text[-128:]

    def _consume(self, line: bytes) -> None:
        super()._consume(line)
        try:
            event = parse_json(line)
            if not isinstance(event, dict):
                return
            if event.get("event") == "init":
                names = event.get("init", {}).get("tools", [])
                self.fixture_names = sorted(n for n in names if isinstance(n, str) and n in NATIVE_NAMES)
            elif event.get("event") == "step_update":
                step = event.get("step_update", {})
                kind = step.get("step_type")
                state = step.get("state")
                if kind in ("user_input", "agent_response", "tool", "checkpoint") and state in ("ACTIVE", "DONE"):
                    key = kind + ":" + state
                    self.steps[key] = self.steps.get(key, 0) + 1
                if kind == "tool" and len(self.tool_steps) < 24:
                    info = step.get("tool_info", {})
                    name = step.get("tool_name")
                    # Tool identifiers from this isolated, two-tool environment;
                    # never export argument values, outputs, paths or error text.
                    params = info.get("parameters", {}) if isinstance(info, dict) else {}
                    self.tool_steps.append({"name": name if isinstance(name, str) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,127}", name) else "unrecognized",
                        "state": state if state in ("ACTIVE", "DONE") else "unrecognized",
                        "argument_keys": sorted(k for k in params if isinstance(k, str) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,63}", k))[:24] if isinstance(params, dict) else [],
                        "has_error": isinstance(info, dict) and bool(info.get("error")),
                        "error_categories": error_categories(json_error(info.get("error"))) if isinstance(info, dict) else []})
            elif event.get("event") == "result":
                result = event.get("result", {})
                status = result.get("status")
                self.result_shape = {
                    "status": status if status in ("SUCCESS", "ERROR", "CANCELED", "INTERRUPTED", "INVALID", "WAITING", "RUNNING") else "unrecognized",
                    "structured_type": type(result.get("structured_output")).__name__,
                    "response_nonempty": isinstance(result.get("response"), str) and bool(result["response"].strip()),
                    "error_categories": error_categories(result.get("error", "")) if isinstance(result.get("error", ""), str) else [],
                    "num_turns": result.get("num_turns") if type(result.get("num_turns")) is int else None,
                }
        except (ValueError, TypeError, AttributeError):
            return

    def diagnostic(self, log: Path) -> dict[str, object]:
        categories: list[str] = []
        log_read = False
        if log.exists() and log.stat().st_size <= 2_000_000:
            categories = error_categories(log.read_text(errors="replace"))
            log_read = True
        return {**self.summary(), "steps": dict(self.steps), "fixture_names": self.fixture_names,
                "result_shape": dict(self.result_shape), "log_read": log_read, "log_categories": categories,
                "stderr_bytes": self.stderr_bytes, "stderr_categories": sorted(self.stderr_categories), "tool_steps": list(self.tool_steps)}


def json_error(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(v for k, v in value.items() if k in ("type", "message") and isinstance(v, str))
    return ""
