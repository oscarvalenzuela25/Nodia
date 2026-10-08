"""Disposable live-CLI HTTP probe. Explicit environment only; no Nodia .env/DB/Web."""
import os
import socket
import sys
import tempfile
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import create_app
from service_errors import ServiceError


class OfflineWeb:
    async def init_client(self):
        return None

    async def get_status(self):
        raise ServiceError("probe_web_offline", "Synthetic Web outage")

    async def close(self):
        return None


if __name__ == "__main__":
    if not os.environ.get("ANTIGRAVITY_CLI_PATH"):
        raise SystemExit("Explicit CLI configuration required for this live probe")
    with tempfile.TemporaryDirectory(prefix="nodia-cli-http-") as directory:
        listener = socket.socket()
        listener.bind(("127.0.0.1", 0))
        listener.listen(32)
        print(f"PROBE_PORT={listener.getsockname()[1]}", flush=True)
        app = create_app(web_service=OfflineWeb(), temp_dir=Path(directory), load_environment=False)
        server = uvicorn.Server(uvicorn.Config(app, log_level="warning", access_log=False))
        @app.post("/_probe/shutdown")
        async def shutdown():
            server.should_exit = True
            return {"ok": True}
        server.run(sockets=[listener])
