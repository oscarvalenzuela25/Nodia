"""Antigravity remains unavailable until a session adapter is verified.

The installed LocalAgentConfig path uses API credentials. Web login does not
authenticate Antigravity and must never serve as its replacement.
"""

from pathlib import Path
from typing import Any

from service_errors import ServiceError


class AntigravityAgentService:
    def is_available(self) -> bool:
        return False

    def get_supported_models(self) -> list[dict[str, Any]]:
        return []

    async def get_status(self) -> dict[str, Any]:
        return {
            "engine": "agentic", "available": False, "has_active_session": False,
            "quota_type": "antigravity_token_plan", "model": None,
            "model_display": None, "models": [], "quota": None,
            "reason": "session_adapter_unverified",
        }

    async def analyze_invoice(self, file_path: Path, **kwargs: Any) -> dict[str, Any]:
        raise ServiceError("agentic_unavailable", "Antigravity no dispone de un adaptador de sesión verificado.")
