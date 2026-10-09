"""Private, bounded, process-local progress. Only fixed categories are retained."""
from collections import deque
from datetime import datetime, timezone
import time
from uuid import UUID

from service_errors import ServiceError

STAGES = frozenset({"request_received", "file_validated", "session_checked", "model_checked",
                    "provider_request_started", "cli_initialized", "document_read_started",
                    "document_read_completed", "response_receiving", "response_received",
                    "extraction_validated", "failed", "cancelled"})


class AnalysisObservations:
    def __init__(self):
        self._entries: dict[str, dict] = {}

    def _prune(self):
        now = time.monotonic()
        self._entries = {key: entry for key, entry in self._entries.items() if entry["expires"] > now}

    def claim(self, identifier: str):
        self._prune()
        try:
            if str(UUID(identifier)) != identifier:
                raise ValueError()
        except ValueError:
            raise ServiceError("invalid_observation", "Identificador inválido.", 422) from None
        if identifier in self._entries:
            raise ServiceError("observation_used", "La observación ya fue utilizada.", 409)
        if len(self._entries) >= 1000:
            raise ServiceError("observation_limit", "Límite de observaciones alcanzado.", 429)
        self._entries[identifier] = {"state": "running", "expires": time.monotonic() + 420,
                                     "sequence": 0, "events": deque(maxlen=256)}
        self.emit(identifier, "request_received")

    def emit(self, identifier: str, stage: str):
        entry = self._entries.get(identifier)
        if not entry or entry["state"] != "running" or stage not in STAGES:
            return
        if entry["events"] and entry["events"][-1]["stage"] == stage:
            return
        entry["sequence"] += 1
        entry["events"].append({"version": 1, "sequence": entry["sequence"], "stage": stage,
                                "occurredAt": datetime.now(timezone.utc).isoformat(),
                                "severity": "error" if stage == "failed" else "warning" if stage == "cancelled" else "info"})

    def finish(self, identifier: str, state: str):
        entry = self._entries.get(identifier)
        if not entry or entry["state"] != "running":
            return
        self.emit(identifier, "extraction_validated" if state == "succeeded" else state)
        entry["state"] = state
        entry["expires"] = time.monotonic() + 300

    def read(self, identifier: str, after: int):
        self._prune()
        entry = self._entries.get(identifier)
        if not entry:
            raise ServiceError("observation_missing", "Observación no disponible.", 404)
        if after < 0 or after > entry["sequence"]:
            raise ServiceError("invalid_cursor", "Cursor inválido.", 422)
        return {"version": 1, "id": identifier, "state": entry["state"], "lastSequence": entry["sequence"],
                "gap": bool(entry["events"] and after < entry["events"][0]["sequence"] - 1),
                "events": [event for event in entry["events"] if event["sequence"] > after]}
