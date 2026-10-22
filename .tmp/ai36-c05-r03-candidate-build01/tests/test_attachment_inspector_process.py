"""Real owned subprocess lifecycle fixtures; no parser sandbox or provider claim."""
import asyncio
import contextlib
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import test_support  # Installs the repository's network/configuration guards first.
from attachment_inspector import AttachmentInspector
from service_errors import ServiceError


class AttachmentInspectorProcessTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.inspector = AttachmentInspector(self.directory)
        self.children = []
        self.spawned = asyncio.Event()
        self.communicating = asyncio.Event()
        self.release_spawn = asyncio.Event()
        self.real_spawn = asyncio.create_subprocess_exec
        self.real_timeout = asyncio.timeout
        # This exercises lifecycle on both hosts, not Linux seccomp on Windows.
        self.enterContext(patch("attachment_inspector.sys", SimpleNamespace(
            platform="linux", executable=sys.executable,
        )))

    async def asyncTearDown(self):
        for child in self.children:
            if child.returncode is None:
                child.kill()
            await child.wait()

    def request(self):
        async def stream():
            yield b"synthetic-owned-parser-input"
        return SimpleNamespace(headers={
            "x-nodia-attachment-kind": "audio", "content-type": "application/octet-stream",
        }, stream=stream)

    def control_child(self, *, exits=False, pause_spawn=False):
        async def spawn(*args, **kwargs):
            self.assertEqual(args[0:2], (sys.executable, "-I"))
            self.assertEqual(Path(args[2]).name, "attachment_inspector_worker.py")
            self.assertEqual(set(kwargs["env"]), {"LANG", "OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS"})
            self.assertTrue(Path(args[3]).is_file())
            script = (
                "import sys; print('{\"error\":\"synthetic_child_failure\"}'); sys.exit(9)"
                if exits else "import time; time.sleep(60)"
            )
            child = await self.real_spawn(sys.executable, "-I", "-c", script, **kwargs)
            self.children.append(child)
            communicate = child.communicate

            async def observed_communicate():
                self.communicating.set()
                return await communicate()

            child.communicate = observed_communicate
            self.spawned.set()
            if pause_spawn:
                await self.release_spawn.wait()
            return child

        self.enterContext(patch("attachment_inspector.asyncio.create_subprocess_exec", side_effect=spawn))

    async def assert_resources_released(self):
        self.assertEqual(len(self.children), 1)
        self.assertIsNotNone(self.children[0].returncode)
        self.assertEqual(list(self.directory.iterdir()), [])
        # Acquire both actual permits: a leaked slot would time out here.
        acquired = 0
        try:
            for _ in range(2):
                await asyncio.wait_for(self.inspector.slots.acquire(), timeout=1)
                acquired += 1
            self.assertTrue(self.inspector.slots.locked())
        finally:
            for _ in range(acquired):
                self.inspector.slots.release()

    async def test_dead_child_rejects_without_metadata_and_releases_temp_and_slots(self):
        self.control_child(exits=True)
        with self.assertRaises(ServiceError) as raised:
            await self.inspector.receive(self.request())
        self.assertEqual(raised.exception.code, "attachment_invalid")
        self.assertEqual(self.children[0].returncode, 9)
        await self.assert_resources_released()

    async def test_parser_timeout_kills_and_waits_real_child_before_releasing_resources(self):
        self.control_child()
        requested_deadlines = []

        def timeout(seconds):
            requested_deadlines.append(seconds)
            return self.real_timeout(0.05 if seconds == 15 else seconds)

        with patch("attachment_inspector.asyncio.timeout", side_effect=timeout):
            with self.assertRaises(ServiceError) as raised:
                await self.inspector.receive(self.request())
        self.assertEqual(raised.exception.code, "attachment_parser_timeout")
        self.assertEqual(requested_deadlines, [60, 15])
        await self.assert_resources_released()

    async def cancel_receive(self, *, during_spawn):
        self.control_child(pause_spawn=during_spawn)
        task = asyncio.create_task(self.inspector.receive(self.request()))
        try:
            await asyncio.wait_for(self.spawned.wait() if during_spawn else self.communicating.wait(), timeout=5)
            task.cancel()
            if during_spawn:
                await asyncio.sleep(0)
                self.assertFalse(task.done(), "Cancellation must retain ownership until spawn returns its child")
                self.release_spawn.set()
            with self.assertRaises(asyncio.CancelledError):
                await asyncio.wait_for(task, timeout=5)
        finally:
            self.release_spawn.set()
            if not task.done():
                task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        await self.assert_resources_released()

    async def test_cancellation_during_communicate_kills_and_waits_real_child(self):
        await self.cancel_receive(during_spawn=False)

    async def test_cancellation_during_spawn_keeps_handle_until_child_is_killed_and_waited(self):
        await self.cancel_receive(during_spawn=True)


if __name__ == "__main__":
    unittest.main()
