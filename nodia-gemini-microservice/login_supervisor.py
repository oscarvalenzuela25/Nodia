"""Private, bounded supervisor for one durable Gemini login request.

The socket transports human interaction only. No payload, auth URL, code, cookie,
frame or exception body is written to the journal or stdout/stderr.
"""
import asyncio
import json
import os
from pathlib import Path
import select
import signal
import sys
import time

from login_request_store import LoginRequestStore, TERMINAL
from service_errors import ServiceError


class LoginSupervisor:
    def __init__(self, store: LoginRequestStore, key: str):
        self.store, self.key = store, key
        self.manager = self.service = None
        self.record = None
        self.done = asyncio.Event()
        self.finishing = asyncio.Lock()
        self.login_task = None

    def current(self) -> dict:
        if self.done.is_set():
            return self.store.public(self.record)
        job = self.manager.status(self.key, self.record["actor"]) if self.manager else None
        if job is None:
            return self.store.public(self.record)
        # A manager's early terminal flag isn't proof of native closure.
        if job["state"] in TERMINAL and not self.done.is_set():
            job["state"] = "running"
        return job

    async def finish(self, state: str) -> dict:
        async with self.finishing:
            if self.done.is_set():
                async with self.store.alocked():
                    return self.store.public(self.store.read(self.key))
            graceful = True
            try:
                async with asyncio.timeout(8):
                    if self.login_task is not None and self.login_task is not asyncio.current_task():
                        self.login_task.cancel()
                        await asyncio.gather(self.login_task, return_exceptions=True)
                    if self.manager is not None:
                        await self.manager.close()
                    if self.service is not None:
                        await self.service.close()
            except Exception:
                graceful = False
            async with self.store.alocked():
                record = self.store.read(self.key)
                # This supervisor itself still belongs to the native cgroup.
                # A candidate is not closure proof. The HTTP/worker observer
                # publishes terminal only after this process exits and the
                # kernel confirms populated=0 (killing residual children first).
                record.update(state="closing" if graceful else "unknown", closure_proof=None)
                if graceful:
                    record["candidate_state"] = state
                self.store.write(record)
                self.record = record
            self.done.set()
            return self.store.public(record)

    async def interact(self, request: dict) -> dict:
        if (request.get("actor"), request.get("provider")) != (self.record["actor"], self.record["provider"]):
            raise ServiceError("login_not_found", "Intento no encontrado.", 404)
        action = request.get("action")
        if action == "cancel":
            return await self.finish("cancelled")
        if action == "status":
            return self.current()
        if self.manager is None or self.done.is_set() or self.current()["state"] != "running" and action != "code":
            raise ServiceError("login_not_ready", "El login no admite esa interacción.", 409)
        payload = request.get("payload")
        if action == "code" and self.record["engine"] == "agentic":
            from schemas import AgenticLoginCode
            code = AgenticLoginCode.model_validate(payload).code
            return self.manager.submit(self.key, self.record["actor"], code)
        raise ServiceError("login_invalid_action", "Interacción inválida.", 422)

    async def connection(self, reader, writer) -> None:
        try:
            request = json.loads(await asyncio.wait_for(reader.readline(), 5))
            result = await self.interact(request)
            response = {"result": result}
        except ServiceError as error:
            response = {"error": error.code, "status": error.status}
        except Exception:
            response = {"error": "login_invalid_interaction", "status": 422}
        try:
            writer.write((json.dumps(response) + "\n").encode())
            await writer.drain()
        finally:
            writer.close()
            await writer.wait_closed()

    async def login(self) -> None:
        try:
            if self.record["engine"] != "agentic":
                raise ServiceError("invalid_engine", "Unsupported execution mode.", 422)
            from agentic_service import AntigravityAgentService
            from agentic_login import AgenticLoginManager
            self.service = AntigravityAgentService()
            await self.service.initialize()
            self.manager = AgenticLoginManager(self.service, timeout=max(1, self.record["expires_at"] - time.time()))
            await self.manager.start(self.record["actor"], job_id=self.key)
            while not self.done.is_set():
                job = self.manager.status(self.key, self.record["actor"])
                if job and job["state"] in TERMINAL:
                    await self.finish(job["state"])
                    return
                if time.time() >= self.record["expires_at"]:
                    await self.finish("cancelled")
                    return
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            raise
        except Exception:
            await self.finish("failed")

    async def run(self) -> None:
        async with self.store.alocked():
            record = self.store.read(self.key)
            # Cancellation may have won while subprocess creation was delayed.
            if record["state"] != "armed" or time.time() >= record["expires_at"]:
                return
            record["state"] = "running"
            self.store.write(record)
            self.record = record
        socket = self.store.directory / (self.key + ".sock")
        socket.unlink(missing_ok=True)
        server = await asyncio.start_unix_server(self.connection, str(socket), limit=16_384)
        os.chmod(socket, 0o600)
        task = asyncio.create_task(self.login())
        self.login_task = task
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self.finish("cancelled")))
        try:
            async with server:
                await self.done.wait()
                # Let the cancellation/status reply drain before socket removal.
                await asyncio.sleep(0.1)
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            socket.unlink(missing_ok=True)


def main() -> None:
    directory, key, gate = sys.argv[1:]
    descriptor = int(gate)
    readable, _, _ = select.select([descriptor], [], [], 10)
    value = os.read(descriptor, 1) if readable else b""
    os.close(descriptor)
    if value != b"1":
        return
    asyncio.run(LoginSupervisor(LoginRequestStore(Path(directory)), key).run())


if __name__ == "__main__":
    try:
        main()
    except Exception:
        raise SystemExit(1) from None
