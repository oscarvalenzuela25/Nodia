import test_support
import asyncio
import unittest

from interactive_login import InteractiveLoginManager


class InteractiveLoginManagerTest(unittest.IsolatedAsyncioTestCase):
    async def test_only_one_job_runs_and_success_is_observable(self):
        manager = InteractiveLoginManager()
        release = asyncio.Event()

        async def login():
            await release.wait()
            return True

        first = manager.start(login, "7")
        self.assertIsNotNone(first)
        self.assertIsNone(manager.start(login, "7"))
        self.assertEqual(manager.status(first["id"], "7")["state"], "running")
        self.assertIsNone(manager.status("unknown", "7"))

        release.set()
        await manager._task
        self.assertEqual(manager.status(first["id"], "7")["state"], "succeeded")
        await manager.close()

    async def test_cancel_stops_active_job(self):
        manager = InteractiveLoginManager()

        async def login():
            await asyncio.Event().wait()
            return True

        job = manager.start(login, "7")
        self.assertIsNone(manager.cancel("unknown", "7"))
        self.assertEqual(manager.cancel(job["id"], "7")["state"], "cancelled")
        await manager.close()
        self.assertEqual(manager.status(job["id"], "7")["state"], "cancelled")
