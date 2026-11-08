"""Bounded native metadata admission with real asyncio barriers and no provider."""
import test_support
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from profile_admission import ProfileAdmission
from service_errors import ServiceError


class ProfileObservationAdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.gate = ProfileAdmission(self.root / "shared", self.root / "state")
        self.events = []
        self.waits = [asyncio.Event() for _ in range(8)]
        self.tasks = []
        self.release_all = asyncio.Event()

        def capture(_format, payload):
            event = json.loads(payload)
            self.events.append(event)
            count = sum(row["event"] == "wait" for row in self.events)
            if event["event"] == "wait" and count <= len(self.waits):
                self.waits[count - 1].set()

        self.enterContext(patch("profile_admission.logger.info", side_effect=capture))

    async def asyncTearDown(self):
        self.release_all.set()
        for task in self.tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)

    def task(self, coroutine):
        task = asyncio.create_task(coroutine)
        self.tasks.append(task)
        return task

    async def entered(self, event):
        await asyncio.wait_for(event.wait(), 2)

    async def owner(self, entered, *, purpose="health_status"):
        async with self.gate.observation("agentic", purpose=purpose, timeout_seconds=2):
            entered.set()
            await self.release_all.wait()

    def assert_available(self):
        self.gate.reserve("agentic", purpose="execution").release()
        self.assertTrue(all(count == 0 for count in self.gate._observation_admitted.values()))

    async def test_four_waiters_are_FIFO_and_never_overlap_the_active_profile(self):
        entered = asyncio.Event()
        owner = self.task(self.owner(entered))
        await self.entered(entered)
        order = []
        active = 0
        maximum = 0

        async def observer(position):
            nonlocal active, maximum
            async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=2):
                active += 1
                maximum = max(maximum, active)
                order.append(position)
                self.assertEqual(len(self.gate._held), 1)
                active -= 1

        readers = []
        for position in range(4):
            readers.append(self.task(observer(position)))
            await self.entered(self.waits[position])
        self.assertEqual(self.gate._observation_admitted[self.gate.identity("agentic")], 5)
        self.assertEqual(order, [])
        self.release_all.set()
        await asyncio.gather(owner, *readers)
        self.assertEqual(order, [0, 1, 2, 3])
        self.assertEqual(maximum, 1)
        self.assert_available()

    async def test_sixth_observer_is_rejected_without_an_extra_waiter_or_body(self):
        entered = asyncio.Event()
        owner = self.task(self.owner(entered))
        await self.entered(entered)
        readers = []
        for position in range(4):
            readers.append(self.task(self.owner(asyncio.Event(), purpose="eligibility")))
            await self.entered(self.waits[position])
        with self.assertRaises(ServiceError) as caught:
            async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=2):
                self.fail("Saturated request must not enter the body")
        self.assertEqual((caught.exception.code, caught.exception.status), ("runtime_busy", 409))
        self.assertEqual(sum(row["event"] == "wait" for row in self.events), 4)
        self.assertEqual(self.gate._observation_admitted[self.gate.identity("agentic")], 5)
        self.release_all.set()
        await asyncio.gather(owner, *readers)
        self.assert_available()

    async def test_cancelling_one_waiter_does_not_release_or_cancel_the_owner(self):
        entered = asyncio.Event()
        owner = self.task(self.owner(entered))
        await self.entered(entered)
        waiter = self.task(self.owner(asyncio.Event(), purpose="eligibility"))
        await self.entered(self.waits[0])
        waiter.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await waiter
        self.assertFalse(owner.done())
        self.assertEqual(self.gate._observation_admitted[self.gate.identity("agentic")], 1)
        with self.assertRaises(ServiceError):
            self.gate.reserve("agentic", purpose="login")
        self.assertEqual(sum(row["event"] == "release" for row in self.events), 0)
        self.release_all.set()
        await owner
        self.assert_available()

    async def test_cancelled_owner_keeps_profile_until_real_body_cleanup_finishes(self):
        entered, cleaning, finish_cleanup, waiter_entered = (asyncio.Event() for _ in range(4))

        async def work():
            async with self.gate.observation("agentic", purpose="health_status", timeout_seconds=2):
                entered.set()
                try:
                    await self.release_all.wait()
                except asyncio.CancelledError:
                    cleaning.set()
                    await finish_cleanup.wait()
                    raise

        owner = self.task(work())
        await self.entered(entered)
        waiter = self.task(self.owner(waiter_entered, purpose="eligibility"))
        await self.entered(self.waits[0])
        owner.cancel()
        await self.entered(cleaning)
        self.assertFalse(waiter_entered.is_set())
        with self.assertRaises(ServiceError):
            self.gate.reserve("agentic", purpose="execution")
        finish_cleanup.set()
        with self.assertRaises(asyncio.CancelledError):
            await owner
        await self.entered(waiter_entered)
        self.release_all.set()
        await waiter
        self.assert_available()

    async def test_wait_deadline_expires_only_that_waiter(self):
        entered = asyncio.Event()
        owner = self.task(self.owner(entered))
        await self.entered(entered)
        with self.assertRaises(ServiceError) as caught:
            async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=0.01):
                self.fail("Expired waiter must not run")
        self.assertEqual((caught.exception.code, caught.exception.status), ("agentic_timeout", 504))
        self.assertFalse(owner.done())
        self.assertEqual(self.gate._observation_admitted[self.gate.identity("agentic")], 1)
        self.release_all.set()
        await owner
        self.assert_available()

    async def test_total_deadline_also_cancels_work_after_acquisition(self):
        cleaned = asyncio.Event()
        with self.assertRaises(ServiceError) as caught:
            async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=0.01):
                try:
                    await self.release_all.wait()
                finally:
                    cleaned.set()
        self.assertEqual((caught.exception.code, caught.exception.status), ("agentic_timeout", 504))
        self.assertTrue(cleaned.is_set())
        self.assert_available()

    async def test_body_timeout_is_not_reclassified_as_the_context_deadline(self):
        body_error = TimeoutError("synthetic body timeout")
        with self.assertRaises(TimeoutError) as caught:
            async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=2):
                raise body_error
        self.assertIs(caught.exception, body_error)
        self.assert_available()

    async def test_diagnostic_label_alone_never_grants_observation_policy(self):
        reservation = self.gate.reserve("agentic", purpose="health_status")
        with self.assertRaises(ServiceError) as caught:
            async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=2):
                self.fail("Exclusive ownership must stay exclusive")
        self.assertEqual(caught.exception.code, "runtime_busy")
        self.assertEqual(sum(row["event"] == "wait" for row in self.events), 0)
        reservation.release()
        self.assert_available()

    async def test_operation_remains_fail_fast_while_observation_owns_profile(self):
        async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=2):
            with self.assertRaises(ServiceError) as caught:
                async with self.gate.operation("agentic", purpose="login"):
                    self.fail("Legacy operation must not queue or overlap")
            self.assertEqual(caught.exception.code, "runtime_busy")
        self.assert_available()

    async def test_quarantine_prevents_observation_without_modifying_marker(self):
        async with self.gate.operation("agentic", purpose="execution"):
            self.gate.arm_dispatch("agentic")
            self.gate.quarantine("agentic")
        marker = next((self.root / "state").glob("*.unknown"))
        before = marker.read_bytes()
        with self.assertRaises(ServiceError) as caught:
            async with self.gate.observation("agentic", purpose="health_status", timeout_seconds=2):
                self.fail("Quarantined profile must not be observed")
        self.assertEqual(caught.exception.code, "runtime_busy")
        self.assertEqual(marker.read_bytes(), before)
        self.assertTrue(self.events[-1]["quarantined"])
        self.assertTrue(all(count == 0 for count in self.gate._observation_admitted.values()))

    async def test_exclusive_owner_winning_fifo_handoff_is_rechecked_before_body(self):
        entered, exclusive_entered, finish_exclusive = (asyncio.Event() for _ in range(3))

        async def first():
            async with self.gate.observation("agentic", purpose="health_status", timeout_seconds=2):
                entered.set()
                await self.release_all.wait()
            reservation = self.gate.reserve("agentic", purpose="execution")
            exclusive_entered.set()
            try:
                await finish_exclusive.wait()
            finally:
                reservation.release()

        owner = self.task(first())
        await self.entered(entered)
        waiter = self.task(self.owner(asyncio.Event(), purpose="eligibility"))
        await self.entered(self.waits[0])
        self.release_all.set()
        await self.entered(exclusive_entered)
        with self.assertRaises(ServiceError) as caught:
            await waiter
        self.assertEqual(caught.exception.code, "runtime_busy")
        with self.assertRaises(ServiceError):
            self.gate.reserve("agentic", purpose="login")
        finish_exclusive.set()
        await owner
        self.assert_available()

    async def test_stale_reservation_after_reconciliation_cannot_release_new_owner(self):
        old = self.gate.reserve("agentic", purpose="execution")
        operation = {"resource_key": self.gate.identity("agentic"), "operation_ref": "synthetic-operation"}
        self.gate.arm_dispatch("agentic", operation)
        self.gate.quarantine("agentic")
        self.gate.reconcile_dispatch("agentic", operation)
        current = self.gate.reserve("agentic", purpose="execution")
        old.release()
        with self.assertRaises(ServiceError) as caught:
            self.gate.reserve("agentic", purpose="login")
        self.assertEqual(caught.exception.code, "runtime_busy")
        current.release()
        self.assert_available()


    async def test_invalid_budgets_never_reserve_or_admit_work(self):
        for timeout in (0, -1, float("nan"), float("inf"), True, "18"):
            with self.subTest(timeout=timeout), self.assertRaises(ValueError):
                async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=timeout):
                    self.fail("Invalid timeout must not admit work")
        self.assertEqual(self.events, [])
        self.assert_available()
