"""Shared process owner with synthetic spawn/shutdown boundaries; no CLI/account."""
import test_support
import asyncio
import unittest
from unittest.mock import patch

from owned_process import OwnedProcessOwner
from service_errors import ServiceError


class SyntheticOwner(OwnedProcessOwner):
    def __init__(self):
        super().__init__()
        self.shutdown_started = asyncio.Event()
        self.release_shutdown = asyncio.Event()
        self.shutdown_calls = 0
        self.proved = True

    async def _shutdown_owned(self, process):
        self.shutdown_calls += 1
        self.shutdown_started.set()
        await self.release_shutdown.wait()
        if self.proved:
            self._io_tasks.pop(process, None)
            self._processes.discard(process)
        return self.proved


class OwnedProcessTests(unittest.IsolatedAsyncioTestCase):
    async def turn(self):
        settled = asyncio.Event()
        asyncio.get_running_loop().call_soon(settled.set)
        await settled.wait()

    def test_transport_must_supply_its_own_shutdown_proof(self):
        with self.assertRaises(TypeError):
            OwnedProcessOwner()

    async def test_spawn_timeout_retains_handle_and_closes_late_process(self):
        owner = SyntheticOwner()
        owner._SPAWN_SECONDS = 0.01
        process = object()
        release_spawn = asyncio.Event()

        async def spawn(*_args, **_kwargs):
            await release_spawn.wait()
            return process

        with patch("owned_process.asyncio.create_subprocess_exec", side_effect=spawn):
            with self.assertRaises(ServiceError) as caught:
                await owner._spawn_owned(["synthetic-never-executed"], {}, 2)
        self.assertEqual(caught.exception.code, "agentic_process_cleanup_unknown")
        self.assertTrue(owner._closed)
        self.assertTrue(owner._spawns)
        release_spawn.set()
        await asyncio.wait_for(owner.shutdown_started.wait(), 2)
        self.assertIn(process, owner._processes)
        shutdown = owner._shutdowns[process]
        owner.release_shutdown.set()
        self.assertTrue(await shutdown)
        await self.turn()
        self.assertEqual(owner.shutdown_calls, 1)
        self.assertEqual(owner._spawns, {})
        self.assertEqual(owner._processes, set())
        self.assertEqual(owner._shutdowns, {})
        self.assertTrue(owner._closed)

    async def test_failed_spawn_remains_uncertain_without_claiming_no_process(self):
        owner = SyntheticOwner()

        async def spawn(*_args, **_kwargs):
            raise OSError("synthetic creation failure")

        with patch("owned_process.asyncio.create_subprocess_exec", side_effect=spawn):
            with self.assertRaises(ServiceError):
                await owner._spawn_owned(["synthetic-never-executed"], {}, 2)
        self.assertTrue(owner._closed)
        self.assertEqual(len(owner._spawns), 1)
        tracked = next(iter(owner._spawns))
        self.assertTrue(tracked.done())
        self.assertIsInstance(tracked.exception(), OSError)
        self.assertEqual(owner.shutdown_calls, 0)

    async def test_concurrent_finish_and_repeated_cancel_share_one_cleanup(self):
        owner = SyntheticOwner()
        process = object()
        owner._processes.add(process)
        first = asyncio.create_task(owner._finish_process(process))
        await asyncio.wait_for(owner.shutdown_started.wait(), 2)
        second = asyncio.create_task(owner._finish_process(process))
        first.cancel()
        await self.turn()
        first.cancel()
        self.assertIn(process, owner._processes)
        self.assertFalse(owner._shutdowns[process].cancelled())
        owner.release_shutdown.set()
        with self.assertRaises(asyncio.CancelledError):
            await first
        await second
        await self.turn()
        self.assertEqual(owner.shutdown_calls, 1)
        self.assertEqual(owner._processes, set())
        self.assertEqual(owner._shutdowns, {})

    async def test_unproved_shutdown_quarantines_and_never_restarts_cleanup(self):
        owner = SyntheticOwner()
        owner.proved = False
        owner.release_shutdown.set()
        process = object()
        owner._processes.add(process)
        for _ in range(2):
            with self.assertRaises(ServiceError) as caught:
                await owner._finish_process(process)
            self.assertEqual(caught.exception.code, "agentic_process_cleanup_unknown")
        self.assertTrue(owner._closed)
        self.assertIn(process, owner._processes)
        self.assertIn(process, owner._shutdowns)
        self.assertEqual(owner.shutdown_calls, 1)
