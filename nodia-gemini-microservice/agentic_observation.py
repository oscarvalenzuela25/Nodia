"""Validate actual CLI command reports, never text scraped from the TUI."""

import json
import math
from datetime import datetime
from typing import Any

from service_errors import ServiceError


def command_data(raw: str, command: str) -> dict[str, Any]:
    try:
        envelope = json.loads(raw)
        usage = envelope["usage"]
        report = envelope["command"]
        if (envelope["status"] != "SUCCESS" or type(envelope["num_turns"]) is not int or envelope["num_turns"] != 0
                or type(usage["total_tokens"]) is not int or usage["total_tokens"] != 0 or report["name"] != command
                or not isinstance(report["data"], dict)):
            raise ValueError()
        return report["data"]
    except (ValueError, KeyError, TypeError):
        raise ServiceError("agentic_observation_invalid", "No se pudo comprobar la sesión agéntica.") from None


def discovered_models(raw: str) -> list[dict[str, str]]:
    models: dict[str, dict[str, str]] = {}
    for line in raw.splitlines():
        if not line.strip() or line == "Fetching available models...":
            continue
        fields = line.split("\t")
        if len(fields) != 2:
            raise ServiceError("agentic_models_invalid", "Catálogo agéntico inválido.", 502)
        identity, name = fields
        if not identity or len(identity) > 128 or not name or len(name) > 256 or identity in models:
            raise ServiceError("agentic_models_invalid", "Catálogo agéntico inválido.", 502)
        models[identity] = {"id": identity, "name": name}
    if len(models) > 512:
        raise ServiceError("agentic_models_invalid", "Catálogo agéntico demasiado extenso.", 502)
    return list(models.values())


def observed_quota(report: dict[str, Any]) -> dict[str, dict[str, Any]] | None:
    groups = report.get("groups")
    if not isinstance(groups, list) or len(groups) > 64:
        return None
    result = {}
    for group in groups:
        if not isinstance(group, dict) or not isinstance(group.get("buckets"), list) or len(group["buckets"]) > 64:
            return None
        for bucket in group["buckets"]:
            if not isinstance(bucket, dict):
                return None
            identity = bucket.get("id")
            fraction = bucket.get("remaining_fraction")
            if (not isinstance(identity, str) or not identity or len(identity) > 128
                    or identity in result or isinstance(fraction, bool)
                    or not isinstance(fraction, (float, int)) or not math.isfinite(fraction)
                    or not 0 <= fraction <= 1):
                return None
            reset = bucket.get("reset_time")
            if reset is not None:
                try:
                    datetime.fromisoformat(reset.replace("Z", "+00:00"))
                except (ValueError, TypeError, AttributeError):
                    return None
            result[identity] = {"usage_percentage": 100 * (1 - fraction),
                                "remaining_fraction": fraction, "reset_at": reset,
                                "window": bucket.get("window"), "group": group.get("name"),
                                "name": bucket.get("name"), "remaining": None, "total": None}
    return result or None
