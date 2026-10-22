import test_support
import asyncio
import json
import unittest
from unittest.mock import AsyncMock

from agentic_service import AntigravityAgentService
from service_errors import ServiceError


def usage_report():
    return json.dumps({"status": "SUCCESS", "num_turns": 0, "usage": {"total_tokens": 0},
                       "command": {"name": "usage", "data": {"groups": [{
                           "name": "Synthetic observation group", "buckets": [{
                               "id": "synthetic-window", "remaining_fraction": 1,
                           }],
                       }]}}})


class PendingObservationRunner:
    """An isolated transport resource whose cleanup must finish before release."""
    def __init__(self):
        self.lock = asyncio.Lock()
        self.started = asyncio.Event()
        self.cleanup_finished = False
        self.active = 0
        self.calls = []
        self.close = AsyncMock()

    async def run(self, args, **kwargs):
        self.calls.append(args)
        async with self.lock:
            self.active += 1
            self.started.set()
            try:
                await asyncio.Future()
            finally:
                # Exercise asynchronous cleanup, not only a synchronous flag.
                await asyncio.sleep(0)
                self.active -= 1
                self.cleanup_finished = True


class AgenticObservationTimeoutTest(unittest.IsolatedAsyncioTestCase):
    def service(self, runner):
        value = AntigravityAgentService(runner)
        value._available = True
        value._snapshot = {"models": [{"id": "stale-fixture", "name": "Stale fixture"}]}
        value._observed = 0
        self.addAsyncCleanup(value.close)
        return value

    def assert_unverified(self, service, status, reason):
        self.assertEqual(status["reason"], reason)
        self.assertFalse(status["has_active_session"])
        self.assertEqual(status["models"], [])
        self.assertIsNone(status["model"])
        self.assertIsNone(status["quota"])
        self.assertIsNone(status["quota_observed_at"])
        self.assertIsNone(service._snapshot)
        self.assertEqual(service._observed, 0)

    async def test_outer_shared_timeout_waits_for_cleanup_and_invalidates_stale_snapshot(self):
        runner = PendingObservationRunner()
        service = self.service(runner)
        status = await service.get_status(timeout=0)
        self.assert_unverified(service, status, "agentic_timeout")
        self.assertTrue(runner.cleanup_finished)
        self.assertFalse(runner.lock.locked())
        self.assertEqual(runner.active, 0)
        self.assertEqual(len(runner.calls), 1)
        self.assertIn("/usage", runner.calls[0])
        self.assertTrue(service._refresh.done())

    async def test_runner_timeout_preserves_same_typed_reason_without_launching_models(self):
        runner = AsyncMock()
        runner.run.side_effect = ServiceError("agentic_timeout", "Synthetic transport timeout", 504)
        service = self.service(runner)
        status = await service.get_status()
        self.assert_unverified(service, status, "agentic_timeout")
        self.assertEqual(runner.run.await_count, 1)

    async def test_os_error_stays_unavailable_instead_of_becoming_retryable_timeout(self):
        runner = AsyncMock()
        runner.run.side_effect = OSError("Synthetic missing executable")
        service = self.service(runner)
        status = await service.get_status()
        self.assert_unverified(service, status, "agentic_unavailable")
        self.assertEqual(runner.run.await_count, 1)

    async def test_caller_cancellation_propagates_after_shared_runner_cleanup(self):
        runner = PendingObservationRunner()
        service = self.service(runner)
        reader = asyncio.create_task(service.get_status())
        await runner.started.wait()
        reader.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await reader
        self.assertTrue(runner.cleanup_finished)
        self.assertFalse(runner.lock.locked())
        self.assertEqual(runner.active, 0)
        self.assertTrue(service._refresh.done())
        self.assertEqual(len(runner.calls), 1)

    async def test_success_keeps_observed_zero_quota_and_reuses_copy_of_legacy_catalog(self):
        runner = AsyncMock()
        runner.run.side_effect = [(usage_report(), 0), ("synthetic-model\tSynthetic model\n", 0)]
        service = self.service(runner)
        first = await service.get_status()
        self.assertIsNone(first["reason"])
        self.assertTrue(first["has_active_session"])
        self.assertEqual(first["quota"]["synthetic-window"]["usage_percentage"], 0)
        self.assertEqual(first["models"], [{"id": "synthetic-model", "name": "Synthetic model"}])
        first["models"].clear()
        second = await service.get_status()
        self.assertEqual(len(second["models"]), 1)
        self.assertEqual(runner.run.await_count, 2)
