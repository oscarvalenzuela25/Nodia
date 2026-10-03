"""Authenticate the single internal caller of the Gemini adapter."""

import os
import re
from secrets import compare_digest

from starlette.requests import Request
from starlette.responses import JSONResponse


SERVICE_HEADER = "x-nodia-service-token"
TOKEN_PATTERN = re.compile(r"[0-9a-fA-F]{64}\Z")


def assert_service_auth_configured() -> None:
    if not TOKEN_PATTERN.fullmatch(os.getenv("GEMINI_SERVICE_TOKEN", "")):
        raise RuntimeError("GEMINI_SERVICE_TOKEN must encode 32 random bytes as 64 hex characters")


def authenticate_service_request(request: Request) -> JSONResponse | None:
    if request.url.path == "/health":
        return None

    expected = os.getenv("GEMINI_SERVICE_TOKEN", "")
    if not TOKEN_PATTERN.fullmatch(expected):
        request.state.error_code = "service_auth_unconfigured"
        return JSONResponse({"code": request.state.error_code,
                             "detail": "Service authentication is not configured",
                             "request_id": getattr(request.state, "request_id", None)}, status_code=503)

    supplied = request.headers.get(SERVICE_HEADER, "")
    if len(supplied) > 256 or not compare_digest(supplied, expected):
        request.state.error_code = "service_unauthorized"
        return JSONResponse({"code": request.state.error_code, "detail": "Unauthorized",
                             "request_id": getattr(request.state, "request_id", None)}, status_code=401)

    return None
