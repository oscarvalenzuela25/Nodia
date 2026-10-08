"""Single bounded, actor-owned remote login for the shared Agentic session."""

import asyncio
import re
import time
from uuid import uuid4

from agentic_login_terminal import CODE_PATTERN
from agentic_service import AntigravityAgentService
from service_errors import ServiceError

ACTIVE_STATES = {"running", "waiting_code", "verifying"}


class AgenticLoginManager:
    def __init__(self, service: AntigravityAgentService, *, timeout: float = 300):
        self.service = service
        self.timeout = timeout
        self._task: asyncio.Task | None = None
        self._owner: str | None = None
        self._job: dict | None = None
        self._created = 0.0
        self._codes: asyncio.Queue[str] = asyncio.Queue(maxsize=1)
        self._submitted = asyncio.Event()

    def status(self, job_id: str | None, owner: str) -> dict | None:
        if (self._job is None or owner != self._owner
                or (job_id is not None and job_id != self._job["id"])):
            return None
        if self._task is not None and self._task.done() and time.monotonic() - self._created > 600:
            return None
        return dict(self._job)

    async def start(self, owner: str) -> dict:
        if self._task is not None and not self._task.done():
            if owner == self._owner:
                return dict(self._job)
            raise ServiceError("login_busy", "Otro administrador está iniciando sesión Agentic.", 409)
        await self.service.begin_authentication()
        self._owner = owner
        self._job = {"id": uuid4().hex, "state": "running", "authorization_url": None, "reason": None}
        self._created = time.monotonic()
        self._codes = asyncio.Queue(maxsize=1)
        self._submitted = asyncio.Event()
        self._task = asyncio.create_task(self._run())
        return dict(self._job)

    def submit(self, job_id: str, owner: str, code: str) -> dict:
        if self.status(job_id, owner) is None:
            raise ServiceError("login_not_found", "Intento de login no encontrado.", 404)
        if self._job["state"] != "waiting_code":
            raise ServiceError("login_not_waiting", "El intento no está esperando un código.", 409)
        if re.fullmatch(CODE_PATTERN, code) is None:
            raise ServiceError("login_invalid_code", "Código de autorización inválido.", 422)
        self._codes.put_nowait(code)
        self._job.update(state="verifying", authorization_url=None)
        return dict(self._job)

    async def cancel(self, job_id: str, owner: str) -> dict:
        if self.status(job_id, owner) is None:
            raise ServiceError("login_not_found", "Intento de login no encontrado.", 404)
        await self._cancel_active()
        return dict(self._job)

    async def _cancel_active(self) -> None:
        task = self._task
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            if self._task is task:
                # A task cancelled before its first instruction never executes
                # _run's finally block. Release only this attempt's admission.
                if self._job["state"] in ACTIVE_STATES:
                    self._job.update(state="cancelled", authorization_url=None)
                self._codes = asyncio.Queue(maxsize=1)
                self.service.finish_authentication()

    def _event(self, event: dict) -> None:
        if event["event"] == "challenge" and self._job["state"] == "running":
            self._job.update(state="waiting_code", authorization_url=event["authorization_url"])
        elif event["event"] == "code_sent":
            self._submitted.set()

    async def _run(self) -> None:
        terminal = None
        submitted = None
        try:
            async with asyncio.timeout(self.timeout):
                # Existing credentials are checked freshly, without inference.
                if (await self.service.observe_authentication())["has_active_session"]:
                    self._job["state"] = "succeeded"
                    return
                terminal = asyncio.create_task(self.service.runner.remote_login(self._codes, self._event))
                submitted = asyncio.create_task(self._submitted.wait())
                done, _ = await asyncio.wait((terminal, submitted), return_when=asyncio.FIRST_COMPLETED)
                if terminal in done:
                    await terminal
                while True:
                    if (await self.service.observe_authentication())["has_active_session"]:
                        self._job["state"] = "succeeded"
                        return
                    if terminal.done():
                        await terminal
                    await asyncio.sleep(2)
        except asyncio.CancelledError:
            self._job["state"] = "cancelled"
            raise
        except TimeoutError:
            self._job.update(state="failed", reason="agentic_login_timeout")
        except Exception:
            self._job.update(state="failed", reason="agentic_login_failed")
        finally:
            for task in (terminal, submitted):
                if task is not None:
                    task.cancel()
            await asyncio.gather(*(task for task in (terminal, submitted) if task is not None), return_exceptions=True)
            self._job["authorization_url"] = None
            # Drop unsubmitted codes from memory and invalidate old observations.
            self._codes = asyncio.Queue(maxsize=1)
            self.service.finish_authentication()

    async def close(self) -> None:
        await self._cancel_active()
