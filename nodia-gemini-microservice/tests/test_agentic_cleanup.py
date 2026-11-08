"""Real runner lifecycle with synthetic subprocess/OS boundaries; no CLI/account."""
import test_support
import asyncio
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from agentic_cli import CliConfig, CliRunner
from nodia_ai_chat import ChatAdapter
from service_errors import ServiceError


class Input:
    def __init__(self): self.writes = []; self.closed = False
    def write(self, value): self.writes.append(value)
    async def drain(self): pass
    def close(self): self.closed = True


class Process:
    def __init__(self, mode="run"):
        self.pid = 999999999
        self.returncode = None
        self.mode = mode
        self.waits = 0
        self.kill_calls = 0
        self.kill_error = False
        self.report_exit = True
        self.started = asyncio.Event()
        self.cleanup_started = asyncio.Event()
        self.release_cleanup = asyncio.Event()
        self.stdin = Input()
        self.stdout = self.stderr = self

    async def read(self, _): return b""
    async def readline(self):
        self.started.set()
        await asyncio.Event().wait()
    def kill(self):
        self.kill_calls += 1
        if self.kill_error: raise OSError("Synthetic kill error")
    async def wait(self):
        self.waits += 1
        if self.mode == "run" and self.waits == 1:
            self.started.set()
            await asyncio.Event().wait()
        self.cleanup_started.set()
        await self.release_cleanup.wait()
        if self.report_exit: self.returncode = -9
        return -9


class RunnerCleanupTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        binary = self.root / "never-executed-cli"
        binary.write_bytes(b"synthetic")
        self.runner = CliRunner(CliConfig(binary, "0" * 128, self.root))
        info = binary.stat(); self.runner._verified_stat = (info.st_mtime_ns, info.st_size)
        self.process = Process()
        self.spawn_started = asyncio.Event()
        self.release_spawn = asyncio.Event(); self.release_spawn.set()
        self.spawn_calls = 0
        async def spawn(*_, **__):
            self.spawn_calls += 1
            self.spawn_started.set()
            await self.release_spawn.wait()
            return self.process
        self.enterContext(patch("agentic_cli.asyncio.create_subprocess_exec", side_effect=spawn))
        self.enterContext(patch("agentic_cli.os.killpg", side_effect=lambda *_: self.process.kill(), create=True))
        # The Windows launch gate/job are OS boundaries, never real processes.
        self.enterContext(patch.dict(sys.modules, {"windows_process_job": SimpleNamespace(
            WindowsProcessJob=lambda _: SimpleNamespace(close=lambda: None))}))

    async def turn(self):
        settled = asyncio.Event()
        asyncio.get_running_loop().call_soon(settled.set)
        await settled.wait()

    async def test_second_cancel_during_termination_preserves_cancel_and_drains_owned_process(self):
        task = asyncio.create_task(self.runner.run(["synthetic"], timeout=2))
        await asyncio.wait_for(self.process.started.wait(), 2)
        task.cancel()
        await asyncio.wait_for(self.process.cleanup_started.wait(), 2)
        task.cancel()
        self.assertIn(self.process, self.runner._processes)
        self.process.release_cleanup.set()
        with self.assertRaises(asyncio.CancelledError): await task
        self.assertEqual(self.process.returncode, -9)
        self.assertEqual(self.runner._processes, set())
        self.assertEqual(self.runner._io_tasks, {})
        self.assertEqual(self.process.kill_calls, 1)

    async def test_two_cancellations_during_spawn_keep_handle_until_early_cleanup(self):
        self.process.mode = "early"
        self.release_spawn.clear()
        task = asyncio.create_task(self.runner.run(["synthetic"], timeout=2))
        await self.spawn_started.wait()
        task.cancel(); await self.turn(); task.cancel()
        self.assertTrue(self.runner._spawns)
        self.release_spawn.set()
        await asyncio.wait_for(self.process.cleanup_started.wait(), 2)
        self.process.release_cleanup.set()
        with self.assertRaises(asyncio.CancelledError): await task
        self.assertEqual(self.runner._spawns, {})
        self.assertEqual(self.runner._processes, set())
        self.assertEqual(self.process.stdin.writes, [])

    async def test_spawn_deadline_retains_ownership_and_late_arrival_is_closed_without_inference(self):
        self.process.mode = "early"
        self.release_spawn.clear()
        self.runner._SPAWN_SECONDS = 0.01  # Synthetic operational budget only.
        with self.assertRaises(ServiceError): await self.runner.run(["synthetic"], timeout=2)
        adapter = ChatAdapter(SimpleNamespace(runner=self.runner), SimpleNamespace(_state_dir=None))
        self.assertFalse(adapter.native_operation_closed("agentic"))
        with self.assertRaises(ServiceError): await self.runner.run(["must-not-spawn"])
        self.assertEqual(self.spawn_calls, 1)
        self.release_spawn.set()
        await asyncio.wait_for(self.process.cleanup_started.wait(), 2)
        cleanup = self.runner._shutdowns[self.process]
        self.process.release_cleanup.set()
        self.assertTrue(await cleanup)
        self.assertEqual(self.runner._processes, set())
        self.assertEqual(self.runner._spawns, {})
        self.assertTrue(adapter.native_operation_closed("agentic"))
        self.assertTrue(self.runner._closed)

    async def test_cleanup_timeout_retains_process_and_never_rekills_a_stale_pid(self):
        self.process.mode = "early"
        self.runner._processes.add(self.process)
        self.runner._TERMINATE_SECONDS = 0.01
        with self.assertRaises(ServiceError): await self.runner._finish_process(self.process)
        self.assertIn(self.process, self.runner._processes)
        self.assertTrue(self.runner._shutdowns[self.process].done())
        self.assertTrue(self.runner._closed)
        with self.assertRaises(ServiceError): await self.runner.close()
        self.assertEqual(self.process.kill_calls, 1)

    async def test_terminate_error_or_missing_returncode_never_discards(self):
        for error in (True, False):
            with self.subTest(terminate_error=error):
                process = Process("early"); process.kill_error = error; process.report_exit = False
                process.release_cleanup.set()
                self.process = process  # OS boundary targets this synthetic process.
                runner = CliRunner(self.runner.config); runner._processes.add(process)
                with self.assertRaises(ServiceError): await runner._finish_process(process)
                self.assertIn(process, runner._processes)
                self.assertTrue(runner._closed)

    async def test_concurrent_close_and_run_finally_terminate_once_and_leave_no_resources(self):
        running = asyncio.create_task(self.runner.run(["synthetic"], timeout=2))
        await asyncio.wait_for(self.process.started.wait(), 2)
        closing = asyncio.create_task(self.runner.close())
        await asyncio.wait_for(self.process.cleanup_started.wait(), 2)
        self.process.release_cleanup.set()
        outcomes = await asyncio.gather(running, closing, return_exceptions=True)
        self.assertIsInstance(outcomes[0], asyncio.CancelledError)
        self.assertIsNone(outcomes[1])
        self.assertEqual(self.process.kill_calls, 1)
        self.assertEqual(self.runner._processes, set())
        self.assertEqual(self.runner._io_tasks, {})
        self.assertEqual(self.runner._shutdowns, {})

    async def test_remote_login_uses_the_same_cancellation_safe_shutdown(self):
        self.process.mode = "remote"
        task = asyncio.create_task(self.runner.remote_login(asyncio.Queue(), lambda _: None))
        await asyncio.wait_for(self.process.started.wait(), 2)
        task.cancel()
        await asyncio.wait_for(self.process.cleanup_started.wait(), 2)
        task.cancel(); self.process.release_cleanup.set()
        with self.assertRaises(asyncio.CancelledError): await task
        self.assertEqual(self.runner._processes, set())
        self.assertEqual(self.runner._io_tasks, {})
