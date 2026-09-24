"""Persistent copy of the current Gemini Web cookies.

The .env file is only a login seed. The library rotates 1PSIDTS while running,
so writing that cookie separately avoids restarting from an expired seed.
"""

import json
import os
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


def save_session(psid: str, psidts: str) -> None:
    if not psid or not psidts:
        return
    if read_session() == (psid, psidts):
        return
    SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = SESSION_FILE.with_suffix(".tmp")
    try:
        with temporary.open("w", encoding="utf-8") as stream:
            json.dump({"secure_1psid": psid, "secure_1psidts": psidts}, stream)
        if os.name != "nt":
            temporary.chmod(0o600)
        temporary.replace(SESSION_FILE)
    finally:
        temporary.unlink(missing_ok=True)
