"""Validated metadata pieces only; no CLI, browser, profile or inference."""
import test_support
import asyncio
from collections import deque
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import agentic_service
from service_errors import ServiceError


def usage(*, fraction=1, groups=None):
    value = {"groups": [{"name": "Synthetic group", "buckets": [
        {"id": "synthetic-window", "remaining_fraction": fraction}]}]} if groups is None else {"groups": groups}
    value["ignored_raw"] = "SYNTHETIC_NOT_CACHED"
    return json.dumps({"status": "SUCCESS", "num_turns": 0, "usage": {"total_tokens": 0},
                       "command": {"name": "usage", "data": value}}), 0


MODELS = ("synthetic-model\tSynthetic model\n", 0)


class Clock:
    def __init__(self):
        self.now = 100.0

    def monotonic(self):
        return self.now

    def time(self):
        return 1000.0 + self.now


class Step:
    def __init__(self, command, result, advance=0, hold=False, resist_cancel=False):
        self.command, self.result, self.advance = command, result, advance
        self.started, self.release = asyncio.Event(), asyncio.Event()
        self.hold, self.resist_cancel = hold, resist_cancel


class FakeRunner:
    def __init__(self, clock, *steps):
        self.clock, self.steps = clock, deque(steps)
        self.calls = []
        self.active = self.maximum = 0
        self.closed = False
        self.cleaned = 0

    async def run(self, args, **kwargs):
        command = "usage" if "/usage" in args else "models" if args == ["models"] else None
        if command is None:
            raise AssertionError("Only metadata commands are permitted")
        self.calls.append(command)
        step = self.steps.popleft()
        if step.command != command:
            raise AssertionError(f"Expected {step.command}, got {command}")
        self.active += 1
        self.maximum = max(self.maximum, self.active)
        step.started.set()
        try:
            if step.hold:
                try:
                    await step.release.wait()
                except asyncio.CancelledError:
                    if not step.resist_cancel:
                        raise
            self.clock.now += step.advance
            if isinstance(step.result, BaseException):
                raise step.result
            return step.result
        finally:
            await asyncio.sleep(0)
            self.active -= 1
            self.cleaned += 1

    async def close(self):
        self.closed = True


class AgenticEvidenceCacheTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.clock = Clock()
        self.enterContext(patch.object(agentic_service, "time", self.clock))

    def service(self, *steps):
        runner = FakeRunner(self.clock, *steps)
        service = agentic_service.AntigravityAgentService(runner)
        service._available = True
        self.addAsyncCleanup(service.close)
        return service, runner

    def assert_unavailable(self, service, result, reason):
        self.assertFalse(result["has_active_session"])
        self.assertEqual(result["reason"], reason)
        self.assertEqual(result["models"], [])
        self.assertIsNone(result["quota"])
        self.assertEqual(service.get_supported_models(), [])
        self.assertIsNone(service._snapshot)

    async def test_partial_timeout_retry_only_models_then_publish_both_fresh(self):
        service, runner = self.service(Step("usage", usage()), Step("models", TimeoutError(), advance=5),
                                       Step("models", MODELS, advance=4))
        first = await service.get_status()
        self.assert_unavailable(service, first, "agentic_timeout")
        second = await service.get_status()
        self.assertTrue(second["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "models"])
        self.assertEqual(second["quota"]["synthetic-window"]["usage_percentage"], 0)
        self.assertEqual(second["quota_observed_at"], 1100)
        self.assertEqual(service._observed, 100)
        self.assertNotIn("SYNTHETIC_NOT_CACHED", repr(service._usage_evidence))
        self.assertEqual(runner.maximum, 1)

    async def test_assembly_does_not_extend_oldest_piece_30_second_TTL(self):
        service, runner = self.service(Step("usage", usage()), Step("models", TimeoutError(), advance=5),
                                       Step("models", MODELS, advance=10), Step("usage", usage()))
        await service.get_status()
        self.assertTrue((await service.get_status())["has_active_session"])
        self.clock.now = 129.999
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "models"])
        self.clock.now = 130
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls[-1], "usage")
        self.assertEqual(len(runner.calls), 4)
        self.assertEqual(service._observed, 115)

    async def test_piece_expiring_during_models_never_publishes_then_retries_only_usage(self):
        service, runner = self.service(Step("usage", usage()), Step("models", MODELS, advance=31),
                                       Step("usage", usage()))
        self.assert_unavailable(service, await service.get_status(), "agentic_session_unverified")
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "usage"])

    async def test_usage_is_validated_before_any_models_command(self):
        for result, reason in [(('invalid JSON', 0), "agentic_observation_invalid"),
                               (usage(groups=[]), "agentic_session_unverified"),
                               ((usage()[0], 1), "agentic_session_required")]:
            with self.subTest(reason=reason):
                service, runner = self.service(Step("usage", result))
                self.assert_unavailable(service, await service.get_status(), reason)
                self.assertEqual(runner.calls, ["usage"])
                self.assertIsNone(service._usage_evidence)

    async def test_non_timeout_models_errors_invalidate_previously_valid_usage(self):
        for result, reason in [(('malformed catalog row', 0), "agentic_models_invalid"),
                               ((MODELS[0], 1), "agentic_session_required"),
                               (ServiceError("agentic_session_required", "Synthetic expired auth"), "agentic_session_required"),
                               (OSError("Synthetic executable failure"), "agentic_unavailable")]:
            with self.subTest(reason=reason):
                service, runner = self.service(Step("usage", usage()), Step("models", result),
                                               Step("usage", usage()), Step("models", MODELS))
                self.assert_unavailable(service, await service.get_status(), reason)
                self.assertIsNone(service._usage_evidence)
                self.assertIsNone(service._models_evidence)
                self.assertTrue((await service.get_status())["has_active_session"])
                self.assertEqual(runner.calls, ["usage", "models", "usage", "models"])

    async def test_typed_timeout_also_preserves_valid_piece_without_retrying_implicitly(self):
        service, runner = self.service(Step("usage", usage()),
                                       Step("models", ServiceError("agentic_timeout", "Synthetic deadline", 504)),
                                       Step("models", MODELS))
        self.assert_unavailable(service, await service.get_status(), "agentic_timeout")
        self.assertEqual(runner.calls, ["usage", "models"])
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "models"])

    async def test_outer_deadline_during_models_keeps_only_previously_validated_usage(self):
        pending = Step("models", MODELS, hold=True)
        service, runner = self.service(Step("usage", usage()), pending, Step("models", MODELS))
        contexts = []
        real_timeout = asyncio.timeout
        def owned_timeout(seconds):
            self.assertEqual(seconds, 12)
            context = real_timeout(seconds)
            contexts.append(context)
            return context
        with patch.object(agentic_service.asyncio, "timeout", owned_timeout):
            reader = asyncio.create_task(service.get_status())
            await pending.started.wait()
            contexts[0].reschedule(asyncio.get_running_loop().time())
            self.assert_unavailable(service, await reader, "agentic_timeout")
            self.assertEqual(runner.active, 0)
            self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "models"])

    async def test_invalid_new_usage_discards_a_still_fresh_catalog(self):
        service, runner = self.service(Step("usage", usage()), Step("models", MODELS, advance=15),
                                       Step("usage", usage(groups=[])))
        self.assertTrue((await service.get_status())["has_active_session"])
        self.clock.now = 130
        self.assert_unavailable(service, await service.get_status(), "agentic_session_unverified")
        self.assertIsNone(service._models_evidence)
        self.assertEqual(runner.calls, ["usage", "models", "usage"])

    async def test_unknown_quota_stays_null_and_zero_stays_zero(self):
        for fraction, expected in [(None, None), (1, 0)]:
            with self.subTest(fraction=fraction):
                service, _ = self.service(Step("usage", usage(fraction=fraction)), Step("models", MODELS))
                result = await service.get_status()
                self.assertTrue(result["has_active_session"])
                if expected is None:
                    self.assertIsNone(result["quota"])
                    self.assertIsNone(result["quota_source"])
                    self.assertIsNone(result["quota_observed_at"])
                else:
                    self.assertEqual(result["quota"]["synthetic-window"]["usage_percentage"], expected)

    async def test_caller_cancel_propagates_cleans_and_keeps_only_validated_same_epoch_piece(self):
        pending = Step("models", MODELS, hold=True)
        service, runner = self.service(Step("usage", usage()), pending,
                                       Step("models", MODELS))
        reader = asyncio.create_task(service.get_status())
        await pending.started.wait()
        reader.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await reader
        self.assertEqual(runner.active, 0)
        self.assertIsNotNone(service._usage_evidence)
        self.assertIsNone(service._models_evidence)
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "models"])

    async def test_enclosing_deadline_cancel_preserves_valid_usage_for_next_observation(self):
        pending = Step("models", MODELS, hold=True)
        service, runner = self.service(Step("usage", usage()), pending, Step("models", MODELS))
        deadline = asyncio.timeout(None)
        async def expire_after_models_starts():
            await pending.started.wait()
            deadline.reschedule(asyncio.get_running_loop().time())
        controller = asyncio.create_task(expire_after_models_starts())
        try:
            with self.assertRaises(TimeoutError):
                async with deadline:
                    await service.get_status()
        finally:
            await controller
        self.assertEqual(runner.active, 0)
        self.assertEqual(service.get_supported_models(), [])
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "models"])

    async def test_cancel_resistant_runner_cannot_commit_its_late_model_result(self):
        pending = Step("models", MODELS, hold=True, resist_cancel=True)
        service, runner = self.service(Step("usage", usage()), pending, Step("models", MODELS))
        reader = asyncio.create_task(service.get_status())
        await pending.started.wait()
        reader.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await reader
        self.assertIsNone(service._models_evidence)
        self.assertEqual(service.get_supported_models(), [])
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "models"])

    async def test_login_invalidates_pieces_and_rejects_cancel_resistant_old_commit(self):
        pending = Step("models", MODELS, hold=True, resist_cancel=True)
        service, runner = self.service(Step("usage", usage()), pending,
                                       Step("usage", usage()), Step("models", MODELS))
        reader = asyncio.create_task(service.get_status())
        await pending.started.wait()
        await service.begin_authentication()
        self.assertEqual((await reader)["reason"], "agentic_login_in_progress")
        self.assertIsNone(service._usage_evidence)
        self.assertIsNone(service._models_evidence)
        service.finish_authentication()
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "usage", "models"])
        self.assertEqual(runner.maximum, 1)

    async def test_finish_login_discards_even_successful_login_observation_pieces(self):
        service, runner = self.service(*[step for _ in range(3) for step in
                                        [Step("usage", usage()), Step("models", MODELS)]])
        await service.get_status()
        await service.begin_authentication()
        self.assertTrue((await service.observe_authentication())["has_active_session"])
        self.assertEqual((await service.get_status())["reason"], "agentic_login_in_progress")
        service.finish_authentication()
        self.assertIsNone(service._usage_evidence)
        self.assertIsNone(service._models_evidence)
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models"] * 3)

    async def test_session_change_during_models_discards_old_epoch(self):
        pending = Step("models", MODELS, hold=True)
        service, runner = self.service(Step("usage", usage()), pending,
                                       Step("usage", usage()), Step("models", MODELS))
        reader = asyncio.create_task(service.get_status())
        await pending.started.wait()
        service.session_generation = "synthetic-new-session"
        pending.release.set()
        with self.assertRaises(asyncio.CancelledError):
            await reader
        self.assertIsNone(service._usage_evidence)
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(runner.calls, ["usage", "models", "usage", "models"])

    async def test_runner_replacement_cannot_reuse_or_commit_other_runner_evidence(self):
        pending = Step("models", MODELS, hold=True)
        service, old = self.service(Step("usage", usage()), pending)
        reader = asyncio.create_task(service.get_status())
        await pending.started.wait()
        replacement = FakeRunner(self.clock, Step("usage", usage()), Step("models", MODELS))
        service.runner = replacement
        pending.release.set()
        with self.assertRaises(asyncio.CancelledError):
            await reader
        self.assertTrue((await service.get_status())["has_active_session"])
        self.assertEqual(replacement.calls, ["usage", "models"])
        self.assertEqual(old.active, 0)

    async def test_close_invalidates_and_waits_for_pending_cleanup(self):
        pending = Step("models", MODELS, hold=True)
        service, runner = self.service(Step("usage", usage()), pending)
        reader = asyncio.create_task(service.get_status())
        await pending.started.wait()
        await service.close()
        with self.assertRaises(asyncio.CancelledError):
            await reader
        self.assertIsNone(service._usage_evidence)
        self.assertIsNone(service._models_evidence)
        self.assertTrue(runner.closed)
        self.assertEqual(runner.active, 0)
        self.assertFalse((await service.get_status())["has_active_session"])

    async def test_epoch_change_after_task_completion_never_returns_old_positive(self):
        pending = Step("models", MODELS, hold=True)
        service, _ = self.service(Step("usage", usage()), pending)
        reader = asyncio.create_task(service.get_status())
        await pending.started.wait()
        service._refresh.add_done_callback(lambda _: setattr(service, "session_generation", "synthetic-replaced-before-reader"))
        pending.release.set()
        self.assert_unavailable(service, await reader, "agentic_session_unverified")

    async def test_shared_readers_reuse_two_validated_pieces_and_return_isolated_copies(self):
        service, runner = self.service(Step("usage", usage()), Step("models", MODELS))
        first, second = await asyncio.gather(service.get_status(), service.get_status())
        self.assertTrue(first["has_active_session"])
        first["models"].clear()
        first["quota"]["synthetic-window"]["usage_percentage"] = 99
        self.assertEqual(second["models"], [{"id": "synthetic-model", "name": "Synthetic model"}])
        third = await service.get_status()
        self.assertEqual(third["quota"]["synthetic-window"]["usage_percentage"], 0)
        self.assertEqual(runner.calls, ["usage", "models"])
        self.assertEqual(runner.maximum, 1)

    async def test_execution_failure_invalidates_both_pieces_before_next_status(self):
        for failure, expected in [("Synthetic execution failure", "agentic_execution_failed"),
                                  ("MODEL_CAPACITY_EXHAUSTED", "agentic_quota_exhausted")]:
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as directory:
                service, runner = self.service(Step("usage", usage()), Step("models", MODELS),
                                               Step("usage", usage()), Step("models", MODELS))
                runner.config = SimpleNamespace(home=Path(directory), timeout=240, version="1.3.1")
                source = Path(directory) / "synthetic.pdf"
                source.write_bytes(b"%PDF-1.4 synthetic")
                metadata = runner.run
                executions = []
                async def failed_execution(args, **kwargs):
                    if "/model" in args:
                        return json.dumps({"status": "SUCCESS", "num_turns": 0,
                                           "usage": {"total_tokens": 0}, "command": {
                                               "name": "model", "data": {"id": "synthetic-model"}}}), 0
                    if "--input-format" in args:
                        executions.append(args)
                        return json.dumps({"event": "result", "result": {
                            "status": "FAILED", "error": failure}}), 0
                    return await metadata(args, **kwargs)
                runner.run = failed_execution
                await service.get_status()
                # Only the CLI-home boundary is replaced; actual analysis error
                # handling, temporary files, lock and invalidation run unchanged.
                with patch.object(agentic_service, "prepare_cli_home"):
                    with self.assertRaises(ServiceError) as caught:
                        await service.analyze_invoice(source, model="synthetic-model")
                self.assertEqual(caught.exception.code, expected)
                self.assertEqual(len(executions), 1)
                self.assertIsNone(service._usage_evidence)
                self.assertIsNone(service._models_evidence)
                self.assertEqual(service.get_supported_models(), [])
                self.assertFalse(service._analysis_lock.locked())
                self.assertFalse(list(Path(directory).glob("nodia-agentic-*")))
                self.assertTrue((await service.get_status())["has_active_session"])
                self.assertEqual(runner.calls, ["usage", "models", "usage", "models"])


if __name__ == "__main__":
    unittest.main()
