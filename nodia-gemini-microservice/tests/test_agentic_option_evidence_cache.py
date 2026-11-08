"""Positive option proofs only, real profile observation ownership, synthetic CLI metadata."""
import test_support
import asyncio
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import agentic_service
from agentic_cli import CliConfig
from nodia_ai_chat import ChatAdapter, ObserveRequest
from profile_admission import ProfileAdmission
from service_errors import ServiceError


class Clock:
    def __init__(self):self.now = 100.0
    def monotonic(self):return self.now
    def time(self):return 1000.0 + self.now


def report(name, data):
    return json.dumps({'status': 'SUCCESS', 'num_turns': 0, 'usage': {'total_tokens': 0},
                       'command': {'name': name, 'data': data}})


class Runner:
    def __init__(self, root, clock):
        binary = root / 'synthetic-cli.bin'
        if not binary.exists():binary.write_bytes(b'not-an-executable')
        home = root / 'profile';home.mkdir(exist_ok=True)
        self.config = CliConfig(binary, hashlib.sha512(binary.read_bytes()).hexdigest(), home)
        self.clock, self.calls = clock, []
        self.active = self.maximum = 0
        self.option_advance = self.models_advance = 0
        self.mode = 'success'
        self.barrier = None
        self.cleanup_entered, self.cleanup_release = asyncio.Event(), asyncio.Event()
        self.hold_cancel_cleanup = False

    def pause(self):
        self.barrier = SimpleNamespace(entered=asyncio.Event(), release=asyncio.Event())
        return self.barrier

    async def run(self, args, **kwargs):
        kind = 'usage' if '/usage' in args else 'models' if args == ['models'] else 'option' if '/model' in args else None
        if kind is None:raise AssertionError('Only non-generative metadata commands allowed')
        self.calls.append(kind);self.active += 1;self.maximum = max(self.maximum, self.active)
        try:
            if kind == 'usage':
                return report('usage', {'groups': [{'name': 'Synthetic', 'buckets': [{'id': 'window', 'remaining_fraction': 1}]}]}), 0
            if kind == 'models':
                self.clock.now += self.models_advance
                return 'fixture-one\tOne\nfixture-two\tTwo\n', 0
            barrier, self.barrier = self.barrier, None
            if barrier is not None:
                barrier.entered.set()
                await barrier.release.wait()
            self.clock.now += self.option_advance
            if self.mode == 'code':return '{}', 1
            if self.mode == 'invalid':return 'not-json', 0
            model = args[args.index('--model') + 1]
            return report('model', {'id': 'other-model' if self.mode == 'mismatch' else model}), 0
        except asyncio.CancelledError:
            self.cleanup_entered.set()
            if self.hold_cancel_cleanup:await self.cleanup_release.wait()
            raise
        finally:self.active -= 1

    async def close(self):self.cleanup_release.set()


class OptionEvidenceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.clock = Clock()
        self.enterContext(patch.object(agentic_service, 'time', self.clock))
        self.runner = Runner(self.root, self.clock)
        self.service = agentic_service.AntigravityAgentService(self.runner)
        self.service._available = True
        self.profiles = ProfileAdmission(self.runner.config.home, self.root / 'state')
        self.adapter = ChatAdapter(self.service, self.profiles)
        self.jobs = []

    async def asyncTearDown(self):
        if self.runner.barrier is not None:self.runner.barrier.release.set()
        self.runner.cleanup_release.set()
        for task in self.jobs:
            if not task.done():task.cancel()
        await asyncio.gather(*self.jobs, return_exceptions=True)
        await self.service.close()

    def task(self, operation):
        task = asyncio.create_task(operation);self.jobs.append(task);return task

    def count(self, kind='option'):return self.runner.calls.count(kind)

    async def observe(self, model='fixture-one', effort='high', generation='a' * 64):
        return await self.adapter.observe('agentic', ObserveRequest(model_id=model, effort_id=effort,
                                           configuration_generation=generation))

    async def warm(self):
        self.assertTrue((await self.service.get_status())['has_active_session'])

    async def test_repeated_exact_observations_use_one_option_CLI_and_recompute_final_MCP_state(self):
        await self.warm();self.runner.option_advance = 4
        mcp = SimpleNamespace(current=False)
        self.adapter.mcp_sessions = SimpleNamespace(supports=lambda *args: mcp.current)
        first = await self.observe();self.assertTrue(first['available']);self.assertFalse(first['supports_mcp'])
        mcp.current = True
        for _ in range(3):
            result = await self.observe();self.assertTrue(result['available']);self.assertTrue(result['supports_mcp'])
        self.assertEqual(self.count(), 1)
        self.assertEqual(self.runner.maximum, 1)
        self.assertEqual(self.runner.active, 0)
        self.assertEqual(self.clock.now, 104)

    async def test_expiry_uses_earliest_existing_metadata_deadline_not_renewed_thirty_seconds(self):
        self.runner.models_advance = 7
        await self.warm();self.runner.option_advance = 4
        self.assertTrue((await self.observe())['available'])
        self.clock.now = 129.9;self.assertTrue((await self.observe())['available']);self.assertEqual(self.count(), 1)
        self.clock.now = 130
        self.assertTrue((await self.observe())['available']);self.assertEqual(self.count(), 2)
        # The original catalog would die during refresh: revalidate both without renewing old timestamps.
        self.assertEqual(self.service._usage_evidence[0], 130)
        self.assertEqual(self.service._models_evidence[0], 137)
        self.assertEqual(next(iter(self.service._model_option_evidence.values()))[2], 160)
        self.runner.models_advance = 0;self.runner.option_advance = 0
        self.clock.now = 159.9;self.assertTrue((await self.observe())['available']);self.assertEqual(self.count(), 2)
        self.clock.now = 160;self.assertTrue((await self.observe())['available']);self.assertEqual(self.count(), 3)

    async def test_model_effort_and_configuration_are_exact_distinct_proof_keys(self):
        await self.warm()
        for model, effort, config in [('fixture-one','high','a'*64),('fixture-one','low','a'*64),
                                     ('fixture-two','high','a'*64),('fixture-one','high','b'*64)]:
            self.assertTrue((await self.observe(model, effort, config))['available'])
        self.assertEqual(self.count(), 4)
        denied = await self.observe('not-discovered')
        self.assertFalse(denied['available']);self.assertEqual(denied['reason'], 'model_unavailable')
        self.assertEqual(self.count(), 4)

    async def test_runner_session_config_and_binary_changes_never_reuse_the_previous_proof(self):
        await self.warm();await self.observe();self.assertEqual(self.count(), 1)
        self.service.session_generation = 'f' * 32
        await self.observe();self.assertEqual(self.count(), 2)
        self.runner.config = replace(self.runner.config, output_bytes=self.runner.config.output_bytes + 1)
        await self.observe();self.assertEqual(self.count(), 3)
        self.runner.config.binary.write_bytes(b'new-synthetic-binary-identity')
        await self.observe();self.assertEqual(self.count(), 4)
        replacement = Runner(self.root, self.clock)
        self.service.runner = replacement;self.runner = replacement
        await self.observe();self.assertEqual(self.count(), 1)
        self.assertEqual(self.count('usage'), 1);self.assertEqual(self.count('models'), 1)

    async def test_nonzero_mismatch_and_invalid_response_are_never_cached(self):
        await self.warm()
        for mode in ('code','mismatch','invalid'):
            self.runner.mode = mode
            for _ in range(2):self.assertFalse((await self.observe())['available'])
            self.assertEqual(len(self.service._model_option_evidence), 0)
        self.assertEqual(self.count(), 6)
        self.runner.mode = 'success';await self.observe();await self.observe();self.assertEqual(self.count(), 7)

    async def test_configuration_alone_without_validated_status_evidence_never_creates_a_cache_entry(self):
        for _ in range(2):
            with self.assertRaises(ServiceError) as caught:
                await self.service.validate_model_option('fixture-one','high','a'*64)
            self.assertEqual(caught.exception.code, 'agentic_session_unverified')
        self.assertEqual(self.count(), 0)
        self.assertEqual(len(self.service._model_option_evidence), 0)
        # An option cannot be accepted without current status identity.
        self.assertIsNone(self.service._evidence_snapshot())

    async def test_cache_is_bounded_without_changing_the_dynamic_effort_catalog(self):
        await self.warm()
        for i in range(17):self.assertTrue((await self.observe(effort='synthetic-effort-'+str(i)))['available'])
        self.assertEqual(len(self.service._model_option_evidence), 16)
        await self.observe(effort='synthetic-effort-0');self.assertEqual(self.count(), 18)

    async def test_waiting_caller_cancel_does_not_cancel_owner_or_create_another_CLI(self):
        await self.warm();barrier = self.runner.pause()
        first = self.task(self.observe());await asyncio.wait_for(barrier.entered.wait(), 2)
        cancelled = self.task(self.observe());third = self.task(self.observe())
        await asyncio.sleep(0);cancelled.cancel()
        with self.assertRaises(asyncio.CancelledError):await cancelled
        self.assertEqual(self.count(), 1);self.assertEqual(self.runner.active, 1)
        barrier.release.set()
        self.assertTrue((await first)['available']);self.assertTrue((await third)['available'])
        self.assertEqual(self.count(), 1);self.assertEqual(self.runner.maximum, 1)

    async def test_cancelled_owner_finishes_cleanup_before_next_observer_and_does_not_cache(self):
        await self.warm();barrier = self.runner.pause();self.runner.hold_cancel_cleanup = True
        owner = self.task(self.observe());await asyncio.wait_for(barrier.entered.wait(), 2)
        owner.cancel();await asyncio.wait_for(self.runner.cleanup_entered.wait(), 2)
        following = self.task(self.observe());await asyncio.sleep(0)
        self.assertFalse(following.done());self.assertEqual(self.count(), 1)
        self.runner.cleanup_release.set()
        with self.assertRaises(asyncio.CancelledError):await owner
        self.assertTrue((await following)['available'])
        self.assertEqual(self.count(), 2);self.assertEqual(self.runner.maximum, 1)

    async def test_TTL_or_binary_change_during_successful_CLI_is_unverified_not_model_mismatch(self):
        await self.warm()
        for change in ('TTL','binary'):
            barrier = self.runner.pause()
            task = self.task(self.observe(generation=('b' if change=='binary' else 'a')*64))
            await asyncio.wait_for(barrier.entered.wait(), 2)
            if change == 'TTL':self.clock.now += 30
            else:self.runner.config.binary.write_bytes(b'different-binary-during-command')
            barrier.release.set();result = await task
            self.assertFalse(result['available']);self.assertEqual(result['reason'], 'agentic_session_unverified')
            self.assertEqual(len(self.service._model_option_evidence), 0)

    async def test_session_change_in_flight_does_not_publish_a_late_proof(self):
        await self.warm();barrier = self.runner.pause()
        task = self.task(self.observe());await asyncio.wait_for(barrier.entered.wait(), 2)
        self.service.session_generation = 'c' * 32;self.service._invalidate_evidence()
        barrier.release.set()
        with self.assertRaises(asyncio.CancelledError):await task
        self.assertEqual(len(self.service._model_option_evidence), 0)

    async def test_cancel_requested_before_a_cache_hit_cannot_return_positive(self):
        await self.warm();await self.observe()
        async def cancelled_hit():
            asyncio.current_task().cancel()
            return await self.service.validate_model_option('fixture-one','high','a'*64)
        task = self.task(cancelled_hit())
        with self.assertRaises(asyncio.CancelledError):await task
        self.assertEqual(self.count(), 1)


if __name__=='__main__':unittest.main()
