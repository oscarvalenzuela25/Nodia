"""Short-lived interactive login job for the private Gemini adapter."""

import asyncio
from collections.abc import Awaitable, Callable
from uuid import uuid4

from loguru import logger


class InteractiveLoginManager:
    def __init__(self) -> None:
        self._job_id: str | None = None
        self._actor: str | None = None
        self._state = "idle"
        self._task: asyncio.Task[None] | None = None

    def status(self, job_id: str, actor: str) -> dict[str, str] | None:
        if job_id != self._job_id or actor != self._actor:
            return None
        return {"id": job_id, "state": self._state}

    @property
    def is_active(self) -> bool:
        return self._task is not None and not self._task.done()

    def start(self, runner: Callable[[], Awaitable[bool]], actor: str, on_finished: Callable[[], None] | None = None, *, job_id: str | None = None) -> dict[str, str] | None:
        if self._task is not None and not self._task.done():
            return None
        self._job_id = job_id or uuid4().hex
        self._actor = actor
        self._state = "running"
        self._task = asyncio.create_task(self._run(runner))
        if on_finished is not None:
            self._task.add_done_callback(lambda _: on_finished())
        return {"id": self._job_id, "state": self._state}

    async def _run(self, runner: Callable[[], Awaitable[bool]]) -> None:
        try:
            self._state = "succeeded" if await asyncio.wait_for(runner(), 300) else "failed"
        except asyncio.CancelledError:
            self._state = "cancelled"
            raise
        except Exception as error:
            logger.error("Interactive Gemini login failed: {}", type(error).__name__)
            self._state = "failed"

    def cancel(self, job_id: str, actor: str) -> dict[str, str] | None:
        if job_id != self._job_id or actor != self._actor:
            return None
        if self._task is not None and not self._task.done():
            self._task.cancel()
            self._state = "cancelled"
        return {"id": job_id, "state": self._state}

    async def close(self) -> None:
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
