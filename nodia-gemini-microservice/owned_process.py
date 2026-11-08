"""Bounded process ownership shared by private transports; imports have no effects.

The transport supplies its own shutdown proof. This owner retains uncertain
spawns and shutdown handles; it never infers remote outcome or process closure.
"""

from abc import ABC, abstractmethod
import asyncio
from collections.abc import Callable, Sequence

from service_errors import ServiceError


class OwnedProcessOwner(ABC):
    # Nodia shutdown budgets, not provider latency/quota promises.
    _SPAWN_SECONDS = 3.0
    _TERMINATE_SECONDS = 3.0
    _DRAIN_SECONDS = 1.0

    def __init__(self):
        self._processes: set[asyncio.subprocess.Process] = set()
        self._closed = False
        self._spawns: dict[asyncio.Task[asyncio.subprocess.Process], bool] = {}
        self._shutdowns: dict[asyncio.subprocess.Process, asyncio.Task[bool]] = {}
        self._io_tasks: dict[asyncio.subprocess.Process, tuple[asyncio.Task[object], ...]] = {}
        self._owned_callbacks: dict[asyncio.Task[asyncio.subprocess.Process], Callable[[asyncio.subprocess.Process], None]] = {}

    @staticmethod
    def _observe_task(task: asyncio.Task[object]) -> None:
        if not task.cancelled():
            task.exception()  # Retrieve failures without logging private output.

    async def _wait_owned(self, task: asyncio.Task[object], deadline: float) -> tuple[bool, bool]:
        cancelled = False
        while not task.done():
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                break
            try:
                async with asyncio.timeout(remaining):
                    await asyncio.shield(task)
            except asyncio.CancelledError:
                cancelled = True
            except Exception:
                break
        return task.done(), cancelled

    def _spawn_finished(self, task: asyncio.Task[asyncio.subprocess.Process]) -> None:
        self._observe_task(task)
        if task not in self._spawns:
            return
        if task.cancelled() or task.exception() is not None:
            self._closed = True
            return  # Keep uncertain creation tracked; never certify no process.
        process = task.result()
        self._processes.add(process)
        callback = self._owned_callbacks.pop(task, None)
        if callback is not None:
            callback(process)  # Pure ownership registration, before late cleanup.
        abandoned = self._spawns.pop(task)
        if abandoned or self._closed:
            self._start_shutdown(process, ())

    async def _spawn_owned(self, command: list[str], options: dict[str, object], timeout: float,
                           on_owned: Callable[[asyncio.subprocess.Process], None] | None = None) -> tuple[asyncio.subprocess.Process, bool]:
        spawn = asyncio.create_task(asyncio.create_subprocess_exec(*command, **options))
        self._spawns[spawn] = False
        if on_owned is not None:
            self._owned_callbacks[spawn] = on_owned
        spawn.add_done_callback(self._spawn_finished)
        done, cancelled = await self._wait_owned(spawn, asyncio.get_running_loop().time() + min(timeout, self._SPAWN_SECONDS))
        if not done or spawn.cancelled() or spawn.exception() is not None:
            self._spawns[spawn] = True
            self._closed = True
            if cancelled or asyncio.current_task().cancelling():
                raise asyncio.CancelledError()
            raise ServiceError("agentic_process_cleanup_unknown", "La creación del proceso requiere conciliación.", 502)
        self._spawn_finished(spawn)
        return spawn.result(), cancelled

    def _start_shutdown(self, process: asyncio.subprocess.Process, tasks: Sequence[asyncio.Task[object]]) -> asyncio.Task[bool]:
        if tasks:
            self._io_tasks[process] = tuple(tasks)
        current = self._shutdowns.get(process)
        if current is None:
            current = asyncio.create_task(self._shutdown_owned(process))
            self._shutdowns[process] = current
            def observed(done: asyncio.Task[bool]) -> None:
                self._observe_task(done)
                if not done.cancelled() and done.exception() is None and done.result():
                    self._shutdowns.pop(process, None)
            current.add_done_callback(observed)
        return current

    async def _finish_process(self, process: asyncio.subprocess.Process, tasks: Sequence[asyncio.Task[object]] = ()) -> None:
        if process not in self._processes:
            if asyncio.current_task().cancelling():
                raise asyncio.CancelledError()
            return  # Already verified/reaped by the shared owner, never re-kill.
        shutdown = self._start_shutdown(process, tasks)
        done, cancelled = await self._wait_owned(shutdown, asyncio.get_running_loop().time() + self._TERMINATE_SECONDS + self._DRAIN_SECONDS)
        verified = done and not shutdown.cancelled() and shutdown.exception() is None and shutdown.result()
        if not verified:
            self._closed = True
        if cancelled or asyncio.current_task().cancelling():
            raise asyncio.CancelledError()
        if not verified:
            raise ServiceError("agentic_process_cleanup_unknown", "No se verificó el cierre del proceso agéntico.", 502)


    @abstractmethod
    async def _shutdown_owned(self, process: asyncio.subprocess.Process) -> bool:
        """Apply transport-specific containment and retain every unproved handle."""
        raise NotImplementedError
