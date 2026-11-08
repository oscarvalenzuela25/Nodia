"""Install filesystem/network isolation before importing operational adapters."""
import atexit
import os
import socket
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

_isolation = ExitStack()
_directory = _isolation.enter_context(tempfile.TemporaryDirectory(prefix="nodia-unit-"))
_root = Path(_directory)
_isolation.enter_context(patch.dict(os.environ, {"ANTIGRAVITY_CLI_PATH": "", "ANTIGRAVITY_CLI_HOME": ""}))
_original_connect = socket.socket.connect


def isolated_connect(sock, address):
    if sock.family in (socket.AF_INET, socket.AF_INET6) and address[0] not in ("127.0.0.1", "::1"):
        raise AssertionError("External network is forbidden in unit tests")
    return _original_connect(sock, address)


_isolation.enter_context(patch.object(socket.socket, "connect", isolated_connect))
import main
_isolation.enter_context(patch.object(main, "STATE_DIR", _root / "state"))
atexit.register(_isolation.close)

TOKEN = "ab" * 32
HEADERS = {"X-Nodia-Service-Token": TOKEN}
RESULT = {"code": "INV-1", "total_amount": 1200,
          "data": {"issue_date": "2026-09-29", "items": [{"name": "Producto", "quantity": 0}]}}


def fake_agentic():
    return SimpleNamespace(
        session_generation="a" * 32, close=AsyncMock(), is_available=lambda: True,
        runner=SimpleNamespace(config=SimpleNamespace(home=_root / uuid4().hex, version="1.3.1"),
                               _processes=set(), _spawns=set()),
        get_status=AsyncMock(return_value={"engine": "agentic", "available": True,
            "has_active_session": False, "models": [{"id": "fixture-model"}]}),
        analyze_invoice=AsyncMock(return_value=RESULT),
        validate_model_option=AsyncMock(return_value=True),
    )


class AppTestCase(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.state_directory = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch.dict(os.environ, {"GEMINI_SERVICE_TOKEN": TOKEN}))
        self.enterContext(patch.object(main, "STATE_DIR", Path(self.state_directory)))
        self.agentic = fake_agentic()
        self.app = main.create_app(agentic_service=self.agentic, load_environment=False,
                                   temp_dir=Path(self.directory))
        self.client = self.enterContext(TestClient(self.app, raise_server_exceptions=False))

    def analyze(self, **fields):
        return self.client.post("/agentic/analyze-invoice", headers=HEADERS,
            data={"model": "discovered-model", **fields},
            files={"file": ("invoice.pdf", b"%PDF-1.4", "application/pdf")})
