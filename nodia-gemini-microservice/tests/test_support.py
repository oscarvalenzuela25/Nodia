"""Install isolation before importing the HTTP application or constructing services."""

import atexit
import os
import socket
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

_isolation = ExitStack()
_directory = _isolation.enter_context(tempfile.TemporaryDirectory(prefix="nodia-unit-"))
_root = Path(_directory)
_isolation.enter_context(patch.dict(os.environ, {
    "GEMINI_SECURE_1PSID": "", "GEMINI_SECURE_1PSIDTS": "", "GEMINI_MODEL": "",
    "GEMINI_COOKIE_PATH": str(_root / "sdk-cache"),
    "ANTIGRAVITY_CLI_PATH": "",
}))
_original_connect = socket.socket.connect


def isolated_connect(sock, address):
    # Windows event-loop wakeup sockets use loopback; external network is forbidden.
    if sock.family in (socket.AF_INET, socket.AF_INET6) and address[0] not in ("127.0.0.1", "::1"):
        raise AssertionError("External network is forbidden in unit tests")
    return _original_connect(sock, address)


_isolation.enter_context(patch.object(socket.socket, "connect", isolated_connect))
import browser_manager
import gemini_service
import session_store

for module, name, value in (
    (browser_manager, "PROFILE_DIR", _root / "profile"),
    (browser_manager, "ENV_FILE", _root / ".env"),
    (gemini_service, "ENV_FILE", _root / ".env"),
    (gemini_service, "SESSION_FILE", _root / "session" / "cookies.json"),
    (session_store, "SESSION_FILE", _root / "session" / "cookies.json"),
):
    _isolation.enter_context(patch.object(module, name, value))
for module, name in ((browser_manager, "GeminiClient"), (gemini_service, "GeminiClient"),
                     (browser_manager, "async_playwright")):
    _isolation.enter_context(patch.object(module, name, side_effect=AssertionError("Use an explicit test double")))
atexit.register(_isolation.close)

TOKEN = "ab" * 32
HEADERS = {"X-Nodia-Service-Token": TOKEN}
RESULT = {"code": "INV-1", "total_amount": 1200,
          "data": {"issue_date": "2026-09-29", "items": [{"name": "Producto", "quantity": 0}]}}


def fake_web():
    return SimpleNamespace(
        init_client=AsyncMock(), close=AsyncMock(), is_initialized=False, client=None,
        get_status=AsyncMock(return_value={"initialized": False, "has_cookies": False,
            "has_browser_profile": False, "model": None, "model_display": None, "tier": "UNKNOWN"}),
        get_quota_summary=AsyncMock(return_value={"source": "web", "observed_at": None,
            "usage_info": None, "quotas": None}),
        get_models_and_quota=AsyncMock(return_value={"authenticated": False, "models": []}),
        analyze_invoice=AsyncMock(return_value=RESULT), recover_auth=AsyncMock(), reload_cookies=AsyncMock(),
        browser_manager=SimpleNamespace(login_interactive=AsyncMock(return_value={"success": False})),
    )


class AppTestCase(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from main import create_app
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch.dict(os.environ, {"GEMINI_SERVICE_TOKEN": TOKEN}))
        self.web = fake_web()
        self.app = create_app(web_service=self.web, load_environment=False, temp_dir=Path(self.directory))
        self.client = self.enterContext(TestClient(self.app, raise_server_exceptions=False))

    def analyze(self, **fields):
        return self.client.post("/analyze-invoice", headers=HEADERS,
                                data={"model": "discovered-model", **fields},
                                files={"file": ("invoice.pdf", b"%PDF-1.4", "application/pdf")})
