"""Bounded CLI progress diagnostics; never retain text, paths or credentials."""
import json
import time
from collections.abc import Callable


class CliProgress:
    def __init__(self, callback: Callable[[str], None] | None = None) -> None:
        self._callback = callback
        self._pending = b""
        self._skip_line = False
        self._last_event: float | None = None
        self.events = 0
        self.invalid_lines = 0
        self.stdout_bytes = 0
        self.initialized = False
        self.document_read_completed = False
        self.result_seen = False
        self.stage = "no_event"

    def feed(self, chunk: bytes) -> None:
        self.stdout_bytes += len(chunk)
        self._pending += chunk
        while b"\n" in self._pending:
            line, self._pending = self._pending.split(b"\n", 1)
            if self._skip_line or len(line) > 65_536:
                self._skip_line = False
                self.invalid_lines += 1
                continue
            self._consume(line)
        if len(self._pending) > 65_536:
            self._pending = b""
            self._skip_line = True

    def _consume(self, line: bytes) -> None:
        try:
            event = json.loads(line)
        except (ValueError, UnicodeError, RecursionError):
            self.invalid_lines += 1
            return
        if not isinstance(event, dict):
            self.invalid_lines += 1
            return
        kind = event.get("event")
        if kind not in ("init", "step_update", "result"):
            self.invalid_lines += 1
            return
        self.events += 1
        self._last_event = time.monotonic()
        if kind == "init":
            self.initialized = True
            self.stage = "initialized"
        elif kind == "result":
            self.result_seen = isinstance(event.get("result"), dict)
            self.stage = "result" if self.result_seen else "invalid_result"
        else:
            step = event.get("step_update")
            if not isinstance(step, dict):
                self.invalid_lines += 1
                return
            if step.get("tool_name") == "view_file":
                completed = step.get("state") == "DONE"
                self.document_read_completed |= completed
                self.stage = "document_read_completed" if completed else "document_read_started"
            elif step.get("tool_name") == "finish":
                self.stage = "finish"
            elif step.get("step_type") == "agent_response":
                self.stage = "agent_response"
            elif step.get("step_type") == "user_input":
                self.stage = "prompt_received"
            else:
                self.stage = "other_step"
        safe_stage = {"initialized": "cli_initialized", "document_read_started": "document_read_started",
                      "document_read_completed": "document_read_completed", "agent_response": "response_receiving"}.get(self.stage)
        if safe_stage and self._callback:
            self._callback(safe_stage)

    def summary(self) -> dict[str, str | int | bool | None]:
        return {"stage": self.stage, "events": self.events, "invalid_lines": self.invalid_lines,
                "stdout_bytes": self.stdout_bytes, "initialized": self.initialized,
                "document_read_completed": self.document_read_completed, "result_seen": self.result_seen,
                "last_event_age_ms": None if self._last_event is None
                else round((time.monotonic() - self._last_event) * 1000)}


class NativeFileCliProgress(CliProgress):
    """Closed structural evidence for native files; never retain content/paths."""
    def __init__(self) -> None:
        super().__init__()
        self.result_status: str | None = None
        self.denied_actions_count: int | None = None
        self.tool_error_categories: set[str] = set()
        self.tool_event_counts: dict[str, int] = {}
        self.tool_completed_counts: dict[str, int] = {}
        self.tool_error_counts: dict[str, int] = {}

    def _consume(self, line: bytes) -> None:
        previously_read = self.document_read_completed
        super()._consume(line)
        try:
            event = json.loads(line)
            if not isinstance(event, dict):
                return
            if event.get("event") == "result":
                result = event.get("result")
                if not isinstance(result, dict):
                    return
                status = result.get("status")
                self.result_status = status if status in ("SUCCESS", "ERROR", "CANCELED", "INTERRUPTED", "INVALID", "WAITING", "RUNNING") else "unrecognized"
                denied = result.get("denied_actions")
                self.denied_actions_count = len(denied) if isinstance(denied, list) else None
            elif event.get("event") == "step_update":
                step = event.get("step_update")
                if isinstance(step, dict) and step.get("tool_name") is not None:
                    name = step.get("tool_name")
                    official = ("view_file", "finish", "task_boundary", "notify_user", "view_file_outline", "list_dir", "find_by_name",
                        "grep_search", "run_command", "write_to_file", "read_url_content", "call_mcp_tool")
                    category = name if name in official else "other"
                    self.tool_event_counts[category] = self.tool_event_counts.get(category, 0) + 1
                    if step.get("state") == "DONE":
                        self.tool_completed_counts[category] = self.tool_completed_counts.get(category, 0) + 1
                    info = step.get("tool_info")
                    if isinstance(info, dict) and info.get("error") is not None:
                        self.tool_error_counts[category] = self.tool_error_counts.get(category, 0) + 1
                info = step.get("tool_info") if isinstance(step, dict) else None
                error = info.get("error") if isinstance(info, dict) else None
                if error is None:
                    return
                if step.get("tool_name") == "view_file" and step.get("state") == "DONE":
                    self.document_read_completed = previously_read
                    self.stage = "document_read_failed"
                values = [error] if isinstance(error, str) else [value for key, value in error.items() if key in ("type", "message") and isinstance(value, str)] if isinstance(error, dict) else []
                text = " ".join(values).lower()
                patterns = {"permission": ("permission", "denied"), "unsupported": ("unsupported", "not supported"),
                    "missing_file": ("not found", "no such file"), "format": ("invalid format", "decode", "binary file"),
                    "timeout": ("timeout", "timed out", "deadline"), "hook": ("hook", "unmarshal")}
                matched = {category for category, needles in patterns.items() if any(needle in text for needle in needles)}
                self.tool_error_categories.update(matched or {"unclassified"})
        except (ValueError, UnicodeError, RecursionError):
            return

    def summary(self) -> dict[str, object]:
        return {**super().summary(), "phase": self.stage, "result_status": self.result_status,
                "denied_actions_count": self.denied_actions_count, "tool_error_categories": sorted(self.tool_error_categories),
                "tool_event_counts": dict(self.tool_event_counts), "tool_completed_counts": dict(self.tool_completed_counts),
                "tool_error_counts": dict(self.tool_error_counts)}
