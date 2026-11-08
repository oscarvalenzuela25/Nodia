"""Synthetic ASGI contention with the production gate, adapter and service.

No CLI process, browser, account, network, session file or inference is used.
Metadata observations serialize on the real physical-profile gate; execution
remains exclusive. Event barriers require actual contention before release.
"""
import test_support

import asyncio
import json
import os
import sys
from agentic_cli import CliConfig
import tempfile
import unittest
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from loguru import logger

from agentic_service import AntigravityAgentService
from main import create_app
from test_support import HEADERS, TOKEN


MODEL_A = "synthetic-profile-model-a"
MODEL_B = "synthetic-profile-model-b"


def report(command: str, data: dict) -> str:
    return json.dumps({"status": "SUCCESS", "num_turns": 0,
                       "usage": {"total_tokens": 0},
                       "command": {"name": command, "data": data}})


@dataclass
class CommandBarrier:
    entered: asyncio.Event = field(default_factory=asyncio.Event)
    release: asyncio.Event = field(default_factory=asyncio.Event)


class MetadataRunner:
    """Only metadata commands are accepted; generations fail the test."""

    def __init__(self, home: Path):
        self.config = CliConfig(Path(sys.executable), "", home, version="1.3.1")
        self.calls: list[tuple[str, str | None]] = []
        self.barriers: dict[str, CommandBarrier] = {}
        self.active = 0
        self.maximum_active = 0
        self.cleanup_entered = asyncio.Event()
        self.cleanup_release = asyncio.Event()
        self.hold_cancel_cleanup = False

    async def initialize(self) -> None:
        pass

    async def close(self) -> None:
        self.release_all()

    def pause(self, command: str) -> CommandBarrier:
        barrier = CommandBarrier()
        self.barriers[command] = barrier
        return barrier

    def release_all(self) -> None:
        for barrier in self.barriers.values():
            barrier.release.set()
        self.cleanup_release.set()

    async def run(self, args: list[str], **_kwargs) -> tuple[str, int]:
        command = "usage" if "/usage" in args else "model" if "/model" in args else "models" if args == ["models"] else None
        if command is None:
            raise AssertionError("Only explicit non-generative metadata commands are allowed")
        model = args[args.index("--model") + 1] if "--model" in args else None
        self.calls.append((command, model))
        self.active += 1
        self.maximum_active = max(self.maximum_active, self.active)
        try:
            barrier = self.barriers.pop(command, None)
            if barrier is not None:
                await self._enter(barrier)
            if command == "usage":
                return report("usage", {"groups": [{"name": "Synthetic metadata", "buckets": [
                    {"id": "synthetic-window", "remaining_fraction": 1}]}]}), 0
            if command == "models":
                return f"{MODEL_A}\tSynthetic A\n{MODEL_B}\tSynthetic B\n", 0
            return report("model", {"id": model}), 0
        except asyncio.CancelledError:
            self.cleanup_entered.set()
            if self.hold_cancel_cleanup:
                await self.cleanup_release.wait()
            raise
        finally:
            self.active -= 1

    async def _enter(self, barrier: CommandBarrier) -> None:
        barrier.entered.set()
        await barrier.release.wait()


class AgenticProfileObservationAsgiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory(prefix="nodia-profile-observations-"))
        self.root = Path(self.directory)
        self.enterContext(patch.dict(os.environ, {
            "GEMINI_SERVICE_TOKEN": TOKEN,
            "ANTIGRAVITY_CLI_HOME": str(self.root / "agentic"),
        }))
        self.runner = MetadataRunner(self.root / "agentic")
        self.agentic = AntigravityAgentService(self.runner)
        self.app = create_app(agentic_service=self.agentic,
                              load_environment=False, temp_dir=self.root / "uploads")
        await self.enterAsyncContext(self.app.router.lifespan_context(self.app))
        self.client = await self.enterAsyncContext(httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app, raise_app_exceptions=False),
            base_url="http://synthetic-nodia.test", headers=HEADERS))
        self.runner.calls.clear()
        self.runner.maximum_active = 0
        self.jobs: list[asyncio.Task] = []
        self.addAsyncCleanup(self.finish_jobs)
        self.diagnostics: list[dict] = []
        self.diagnostic_changed = asyncio.Event()

        def observe_log(message):
            value = message.record["message"]
            if value.startswith("nodia_ai_profile_reservation "):
                self.diagnostics.append(json.loads(value.split(" ", 1)[1]))
                self.diagnostic_changed.set()

        sink = logger.add(observe_log)
        self.addCleanup(logger.remove, sink)

    async def finish_jobs(self):
        self.runner.release_all()
        for task in self.jobs:
            if not task.done():
                task.cancel()
        await asyncio.gather(*self.jobs, return_exceptions=True)

    def task(self, operation) -> asyncio.Task:
        task = asyncio.create_task(operation)
        self.jobs.append(task)
        return task

    async def entered(self, barrier: CommandBarrier) -> None:
        await asyncio.wait_for(barrier.entered.wait(), timeout=2)

    def expire_status(self) -> None:
        self.agentic._invalidate_evidence()

    async def observe(self, model: str = MODEL_A):
        return await self.client.post("/nodia-ai/agentic/observe", json={
            "model_id": model, "effort_id": "high", "configuration_generation": "a" * 64,
        })

    def rejected_by(self, purpose: str, owner: str) -> dict:
        found = [item for item in self.diagnostics if item["event"] == "reject"
                 and item["purpose"] == purpose and item["owner_purpose"] == owner]
        self.assertEqual(len(found), 1)
        return found[0]

    def assert_observed(self, response) -> None:
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["available"])
        self.assertIsNone(response.json()["reason"])
        self.assertFalse(response.json()["supports_mcp"])
        self.assertEqual(self.runner.maximum_active, 1)

    async def waiting(self, purpose: str, owner: str) -> dict:
        async def find():
            while True:
                self.diagnostic_changed.clear()
                matches = [item for item in self.diagnostics if item["event"] == "wait"
                           and item["purpose"] == purpose and item["owner_purpose"] == owner]
                if matches:
                    return matches[-1]
                await self.diagnostic_changed.wait()
        return await asyncio.wait_for(find(), timeout=2)

    async def test_health_refresh_serializes_eligibility_without_false_unavailability(self):
        self.expire_status()
        barrier = self.runner.pause("usage")
        health = self.task(self.client.get("/engines/status"))
        await self.entered(barrier)
        eligibility = self.task(self.observe())
        diagnostic = await self.waiting("eligibility", "health_status")
        self.assertFalse(diagnostic["quarantined"])
        self.assertFalse(eligibility.done())
        self.assertEqual(self.runner.calls, [("usage", None)])
        self.assertEqual(self.runner.active, 1)
        barrier.release.set()
        result = await health
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()["agentic"]["has_active_session"])
        self.assertEqual(result.json()["agentic"]["quota"]["synthetic-window"]["usage_percentage"], 0)
        self.assert_observed(await eligibility)
        self.assertEqual(self.runner.calls, [("usage", None), ("models", None), ("model", MODEL_A)])

    async def test_health_waits_for_eligibility_and_preserves_authenticated_status(self):
        barrier = self.runner.pause("model")
        eligibility = self.task(self.observe())
        await self.entered(barrier)
        health = self.task(self.client.get("/engines/status"))
        await self.waiting("health_status", "eligibility")
        self.assertFalse(health.done())
        barrier.release.set()
        self.assert_observed(await eligibility)
        result = await health
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()["agentic"]["has_active_session"])
        self.assertEqual(self.runner.calls, [("model", MODEL_A)])

    async def test_different_selection_waits_then_checks_its_own_model(self):
        barrier = self.runner.pause("model")
        first = self.task(self.observe(MODEL_A))
        await self.entered(barrier)
        second = self.task(self.observe(MODEL_B))
        await self.waiting("eligibility", "eligibility")
        self.assertFalse(second.done())
        barrier.release.set()
        self.assert_observed(await first)
        self.assert_observed(await second)
        self.assertEqual(self.runner.calls, [("model", MODEL_A), ("model", MODEL_B)])

    async def test_health_cancellation_keeps_reservation_until_fake_cli_cleanup_finishes(self):
        self.expire_status()
        barrier = self.runner.pause("usage")
        self.runner.hold_cancel_cleanup = True
        health = self.task(self.client.get("/engines/status"))
        await self.entered(barrier)
        health.cancel()
        await asyncio.wait_for(self.runner.cleanup_entered.wait(), timeout=2)
        eligibility = self.task(self.observe())
        await self.waiting("eligibility", "health_status")
        self.assertFalse(eligibility.done())
        self.assertEqual(self.runner.active, 1)
        self.runner.cleanup_release.set()
        with self.assertRaises(asyncio.CancelledError):
            await health
        self.assert_observed(await eligibility)
        self.assertEqual(self.runner.active, 0)

    async def test_cancelled_waiter_does_not_cancel_health_owner_or_leak_admission(self):
        self.expire_status()
        barrier = self.runner.pause("usage")
        health = self.task(self.client.get("/engines/status"))
        await self.entered(barrier)
        eligibility = self.task(self.observe())
        await self.waiting("eligibility", "health_status")
        eligibility.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await eligibility
        self.assertFalse(health.done())
        self.assertFalse(self.runner.cleanup_entered.is_set())
        self.assertEqual(self.runner.calls, [("usage", None)])
        barrier.release.set()
        self.assertTrue((await health).json()["agentic"]["has_active_session"])
        self.assert_observed(await self.observe())

    async def test_wait_timeout_is_typed_negative_observation_without_cancelling_owner(self):
        self.expire_status()
        barrier = self.runner.pause("usage")
        health = self.task(self.client.get("/engines/status"))
        await self.entered(barrier)
        profiles = self.app.state.profiles
        real_observation = profiles.observation

        def short_deadline(engine, *, purpose, timeout_seconds):
            return real_observation(engine, purpose=purpose,
                                    timeout_seconds=0.01 if purpose == "eligibility" else timeout_seconds)

        with patch.object(profiles, "observation", short_deadline):
            result = await self.observe()
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.json()["available"])
        self.assertEqual(result.json()["reason"], "agentic_timeout")
        self.assertFalse(result.json()["supports_mcp"])
        self.assertFalse(health.done())
        self.assertFalse(self.runner.cleanup_entered.is_set())
        self.assertEqual(self.runner.calls, [("usage", None)])
        barrier.release.set()
        self.assertTrue((await health).json()["agentic"]["has_active_session"])
        self.assert_observed(await self.observe())

    async def test_execution_reservation_stays_exclusive_for_health_and_eligibility(self):
        lease = self.app.state.profiles.reserve("agentic", purpose="execution")
        try:
            rejected = await self.observe()
            self.assertEqual(rejected.status_code, 409)
            self.assertEqual(rejected.json()["code"], "runtime_busy")
            health = await self.client.get("/engines/status")
            self.assertEqual(health.json()["agentic"]["reason"], "runtime_busy")
            self.rejected_by("eligibility", "execution")
            self.rejected_by("health_status", "execution")
            self.assertEqual(self.runner.calls, [])
        finally:
            lease.release()
        self.assert_observed(await self.observe())
