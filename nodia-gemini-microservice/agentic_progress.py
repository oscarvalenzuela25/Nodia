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
