"""Teacher-only admission fairness, using real leases and asyncio barriers."""
import test_support
import asyncio
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from profile_admission import ProfileAdmission
from service_errors import ServiceError


class TeacherProfileAdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.gate = ProfileAdmission(self.root / "profile", self.root / "state")
        self.tasks = []
        self.owner_entered = asyncio.Event()
        self.release_owner = asyncio.Event()
        self.reader_waiting = asyncio.Event()
        self.teacher_waiting = asyncio.Event()

        def diagnostic(event, _engine, purpose, *_rest):
            if event == "wait":
                (self.teacher_waiting if purpose == "execution" else self.reader_waiting).set()
        self.enterContext(patch.object(self.gate, "_diagnostic", side_effect=diagnostic))

    async def asyncTearDown(self):
        self.release_owner.set()
        for task in self.tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)

    def task(self, coroutine):
        task = asyncio.create_task(coroutine)
        self.tasks.append(task)
        return task

    async def barrier(self, event):
        await asyncio.wait_for(event.wait(), 2)

    async def owner(self):
        async with self.gate.observation("agentic", purpose="eligibility", timeout_seconds=2):
            self.owner_entered.set()
            await self.release_owner.wait()

    async def test_teacher_turn_prevents_queued_and_new_observers_from_overtaking(self):
        owner = self.task(self.owner())
        await self.barrier(self.owner_entered)

        async def reader():
            async with self.gate.observation("agentic", purpose="health_status", timeout_seconds=2):
                self.fail("A reader must not overtake the pending Teacher execution")
        queued = self.task(reader())
        await self.barrier(self.reader_waiting)
        teacher = self.task(self.gate.reserve_teacher_execution("agentic", timeout_seconds=2))
        await self.barrier(self.teacher_waiting)
        with self.assertRaises(ServiceError):
            async with self.gate.observation("agentic", purpose="discovery", timeout_seconds=2):
                self.fail("New observation entered while Teacher held an admission turn")
        with self.assertRaises(ServiceError):
            self.gate.reserve("agentic", purpose="legacy")
        self.assertFalse(teacher.done())
        self.release_owner.set()
        await owner
        with self.assertRaises(ServiceError) as caught:
            await queued
        self.assertEqual(caught.exception.code, "runtime_busy")
        reservation = await teacher
        with self.assertRaises(ServiceError):
            self.gate.reserve("agentic", purpose="login")
        reservation.release()
        self.gate.reserve("agentic", purpose="legacy").release()

    async def test_labels_never_make_exclusive_owners_waitable_and_quarantine_still_blocks(self):
        for purpose in ["execution", "login", "legacy", "eligibility", "health_status", "discovery"]:
            with self.subTest(purpose=purpose):
                owner = self.gate.reserve("agentic", purpose=purpose)
                try:
                    with self.assertRaises(ServiceError) as caught:
                        await self.gate.reserve_teacher_execution("agentic", timeout_seconds=2)
                    self.assertEqual(caught.exception.code, "runtime_busy")
                    self.assertFalse(self.teacher_waiting.is_set())
                finally:
                    owner.release()
        self.gate.quarantine("agentic")
        with self.assertRaises(ServiceError):
            await self.gate.reserve_teacher_execution("agentic", timeout_seconds=2)

    async def test_cancelled_teacher_waiter_never_releases_the_observational_owner(self):
        owner = self.task(self.owner())
        await self.barrier(self.owner_entered)
        teacher = self.task(self.gate.reserve_teacher_execution("agentic", timeout_seconds=2))
        await self.barrier(self.teacher_waiting)
        teacher.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await teacher
        self.assertFalse(owner.done())
        self.assertFalse(self.gate._teacher_execution_pending)
        with self.assertRaises(ServiceError):
            self.gate.reserve("agentic", purpose="legacy")
        self.release_owner.set()
        await owner
        self.gate.reserve("agentic", purpose="legacy").release()

    async def test_expired_teacher_wait_is_bounded_and_does_not_steal_a_lease(self):
        owner = self.task(self.owner())
        await self.barrier(self.owner_entered)
        with self.assertRaises(TimeoutError):
            await self.gate.reserve_teacher_execution("agentic", timeout_seconds=0.01)
        self.assertFalse(owner.done())
        self.assertFalse(self.gate._teacher_execution_pending)
        with self.assertRaises(ServiceError):
            self.gate.reserve("agentic", purpose="execution")
        self.release_owner.set()
        await owner
        self.gate.reserve("agentic", purpose="legacy").release()

    async def test_quarantine_during_wait_cannot_be_cleared_by_either_owner(self):
        owner = self.task(self.owner())
        await self.barrier(self.owner_entered)
        teacher = self.task(self.gate.reserve_teacher_execution("agentic", timeout_seconds=2))
        await self.barrier(self.teacher_waiting)
        self.gate.quarantine("agentic")
        self.release_owner.set()
        await owner
        with self.assertRaises(ServiceError):
            await teacher
        self.assertFalse(self.gate._teacher_execution_pending)
        with self.assertRaises(ServiceError):
            self.gate.reserve("agentic", purpose="legacy")

    async def test_cancelled_owner_must_finish_cleanup_before_teacher_acquires(self):
        cleaning, finish_cleanup = asyncio.Event(), asyncio.Event()

        async def work():
            async with self.gate.observation("agentic", purpose="health_status", timeout_seconds=2):
                self.owner_entered.set()
                try:
                    await asyncio.Event().wait()
                finally:
                    cleaning.set()
                    await finish_cleanup.wait()
        owner = self.task(work())
        await self.barrier(self.owner_entered)
        teacher = self.task(self.gate.reserve_teacher_execution("agentic", timeout_seconds=2))
        await self.barrier(self.teacher_waiting)
        owner.cancel()
        await self.barrier(cleaning)
        self.assertFalse(teacher.done())
        finish_cleanup.set()
        with self.assertRaises(asyncio.CancelledError):
            await owner
        (await teacher).release()
        self.gate.reserve("agentic", purpose="legacy").release()
