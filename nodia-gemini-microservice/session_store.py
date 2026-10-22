"""Persistent copy of the current Gemini Web cookies.

The .env file is only a login seed. The library rotates 1PSIDTS while running,
so writing that cookie separately avoids restarting from an expired seed.
"""

import json
import os
import tempfile
from pathlib import Path
from typing import Optional

SESSION_FILE = Path(__file__).resolve().parent / "session_state" / "cookies.json"


def read_session() -> Optional[tuple[str, str]]:
    try:
        data = json.loads(SESSION_FILE.read_text(encoding="utf-8"))
        psid = data.get("secure_1psid", "")
        psidts = data.get("secure_1psidts", "")
        return (psid, psidts) if psid and psidts else None
    except (OSError, ValueError, AttributeError):
        return None


def disconnected_state() -> str | None:
    """Durable logout overrides even a read-only .env seed after restart."""
    try:
        data = json.loads(SESSION_FILE.read_text(encoding="utf-8"))
        value = data.get("disconnected")
        return value if isinstance(value, str) and value in {"pending", "complete"} else None
    except (OSError, ValueError, AttributeError):
        return None


def mark_disconnected(*, pending: bool) -> None:
    _write_session({"disconnected": "pending" if pending else "complete"})


def save_session(psid: str, psidts: str, *, explicit_login: bool = False) -> None:
    if not psid or not psidts:
        return
    if disconnected_state() and not explicit_login:
        return
    if explicit_login and disconnected_state() == "pending":
        raise RuntimeError("Session cleanup must complete before login")
    if read_session() == (psid, psidts):
        return
    _write_session({"secure_1psid": psid, "secure_1psidts": psidts})


def _write_session(data: dict[str, str]) -> None:
    SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=SESSION_FILE.parent,
            prefix="cookies-", suffix=".tmp", delete=False,
        ) as stream:
            temporary = Path(stream.name)
            json.dump(data, stream)
            stream.flush()
            os.fsync(stream.fileno())
        if os.name != "nt":
            temporary.chmod(0o600)
        os.replace(temporary, SESSION_FILE)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
