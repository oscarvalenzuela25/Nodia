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

        first = manager.start(login)
        self.assertIsNotNone(first)
        self.assertIsNone(manager.start(login))
        self.assertEqual(manager.status(first["id"])["state"], "running")
        self.assertIsNone(manager.status("unknown"))

        release.set()
        await manager._task
        self.assertEqual(manager.status(first["id"])["state"], "succeeded")
        await manager.close()

    async def test_cancel_stops_active_job(self):
        manager = InteractiveLoginManager()

        async def login():
            await asyncio.Event().wait()
            return True

        job = manager.start(login)
        self.assertIsNone(manager.cancel("unknown"))
        self.assertEqual(manager.cancel(job["id"])["state"], "cancelled")
        await manager.close()
        self.assertEqual(manager.status(job["id"])["state"], "cancelled")
