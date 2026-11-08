"""Teacher ownership/policy integration with synthetic CLI boundaries, no account/network."""
import test_support
import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from dataclasses import replace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from agentic_cli import CliConfig
from native_teacher_text import TeacherNativeText, TeacherDispatchExcluded
from profile_admission import ProfileAdmission
from service_errors import ServiceError
from teacher_text_contract import TeacherObserve, TeacherStart, TeacherAck, TeacherAnswer
from teacher_text_execution import AGENT_NAME, AGENT_DOCUMENT
from test_teacher_text_contract import start_payload


class TeacherRuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.root = Path(self.directory)
        self.home = self.root / "synthetic-profile"
        self.home.mkdir()
        binary = self.root / "synthetic-cli"
        binary.write_bytes(b"synthetic CLI binary, never executable")
        info = binary.stat()
        self.runner = SimpleNamespace(config=CliConfig(binary, hashlib.sha512(binary.read_bytes()).hexdigest(),
            self.home, version="1.3.1", timeout=5), _verified_stat=(info.st_mtime_ns, info.st_size),
            _processes=set(), _spawns={}, _shutdowns={}, run=AsyncMock())
        self.agentic = SimpleNamespace(runner=self.runner, session_generation="a" * 32,
            is_available=lambda: True, get_status=AsyncMock(return_value={"available": True,
            "has_active_session": True, "models": [{"id": "synthetic-model"}]}),
            validate_model_option=AsyncMock(return_value=True))
        self.profiles = ProfileAdmission(self.home, self.root / "state")
        self.adapter = TeacherNativeText(self.agentic, self.profiles)
        self.addAsyncCleanup(self.adapter.close)
        self.runner.run.side_effect = self.successful_cli

    async def command(self, **updates):
        observe = TeacherObserve(contract="teacher-agentic-text/1", model_id="synthetic-model",
            effort_id="synthetic-effort", configuration_generation="b" * 64)
        seen = await self.adapter.observe(observe)
        self.assertTrue(seen.available)
        return TeacherStart.model_validate(start_payload(**observe.model_dump(), resource_key=seen.resource_key,
            session_generation=seen.session_generation, runtime_hash=seen.runtime_hash,
            policy_hash=seen.policy_hash, **updates))

    async def successful_cli(self, args, **kwargs):
        workspace, home = kwargs["cwd"], kwargs["home"]
        self.assertNotEqual(home, self.home)
        self.assertNotEqual(workspace, self.home)
        self.assertEqual((home / ".gemini/config/agents" / AGENT_NAME / "agent.md").read_text(), AGENT_DOCUMENT)
        self.assertFalse((workspace / ".agents/agents" / AGENT_NAME / "agent.md").exists())
        self.assertFalse((self.home / ".gemini/config/agents" / AGENT_NAME / "agent.md").exists())
        role_lines = (home / ".gemini/config/agents" / AGENT_NAME / "agent.md").read_text().split("---", 2)[1].splitlines()
        self.assertEqual([line for line in role_lines if line.startswith("excludeDefaultComponents:")], ["excludeDefaultComponents: true"])
        self.assertEqual(json.loads((home / ".gemini/config/mcp_config.json").read_text()), {"mcpServers": {}})
        settings = json.loads((home / ".gemini/antigravity-cli/settings.json").read_text())
        self.assertEqual(settings["permissions"]["allow"], [])
        self.assertIn("mcp(*)", settings["permissions"]["deny"])
        self.assertIn("PreToolUse", json.loads((home / ".gemini/config/hooks.json").read_text())["nodia-teacher-text"])
        self.assertIn("--disable-slash-commands", args)
        self.assertEqual(args[args.index("--model") + 1], "synthetic-model")
        self.assertEqual(args[args.index("--effort") + 1], "synthetic-effort")
        (workspace / "gate_receipts.jsonl").write_text('{"tool":"finish","allowed":true}\n')
        return "\n".join(json.dumps(event) for event in [
            {"event": "init", "init": {"model": "synthetic-model", "agent": AGENT_NAME, "tools": ["finish"]}},
            {"event": "result", "result": {"status": "SUCCESS", "structured_output": {"text": "Synthetic answer"}}}]), 0

    async def settled(self):
        await asyncio.gather(*list(self.adapter.tasks.values()), return_exceptions=True)

    async def test_teacher_waits_for_real_observational_owner_before_one_dispatch(self):
        command = await self.command()
        prepared = asyncio.Event()
        original = self.adapter.backend.prepare_admission

        async def prepare():
            await original()
            prepared.set()

        task = None
        try:
            async with self.profiles.observation("agentic", purpose="eligibility", timeout_seconds=2):
                with patch.object(self.adapter.backend, "prepare_admission", side_effect=prepare):
                    task = asyncio.create_task(self.adapter.start(command))
                    await asyncio.wait_for(prepared.wait(), 2)
                    self.assertFalse(task.done(), "Teacher must wait for the observational owner, not reject it")
                    self.assertFalse(self.adapter.records)
                    self.runner.run.assert_not_awaited()
            result = await asyncio.wait_for(task, 2)
            self.assertEqual(result.operation_id, command.operation_id)
            await self.settled()
            self.assertEqual(self.runner.run.await_count, 1)
            self.assertTrue(self.adapter.status(command.reference()).terminal_proof.process_closed)
        finally:
            if task is not None:
                if not task.done():
                    task.cancel()
                await asyncio.gather(task, return_exceptions=True)

    async def test_observe_is_exact_metadata_and_shares_chat_physical_capacity(self):
        command = await self.command()
        self.runner.run.assert_not_awaited()
        self.assertEqual(command.resource_key, self.profiles.identity("agentic"))
        reservation = self.profiles.reserve("agentic", purpose="legacy")
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.start(command)
        self.assertEqual(caught.exception.code, "runtime_busy")
        reservation.release()
        self.assertFalse(self.adapter.records)
        self.runner.config.binary.write_bytes(b"tampered")
        seen = await self.adapter.observe(TeacherObserve.model_validate(command.model_dump(include={
            "contract", "model_id", "effort_id", "configuration_generation"})))
        self.assertFalse(seen.available)
        self.assertIsNone(seen.binary_sha512)

    async def test_cancelled_admission_wait_never_arms_or_releases_another_owner(self):
        command = await self.command()
        waiting = asyncio.Event()
        def diagnostic(event, _engine, purpose, *_rest):
            if event == "wait" and purpose == "execution":
                waiting.set()
        task = None
        try:
            async with self.profiles.observation("agentic", purpose="eligibility", timeout_seconds=2):
                with patch.object(self.profiles, "_diagnostic", side_effect=diagnostic):
                    task = asyncio.create_task(self.adapter.start(command))
                    await asyncio.wait_for(waiting.wait(), 2)
                    task.cancel()
                    with self.assertRaises(asyncio.CancelledError):
                        await task
                self.assertFalse(self.adapter.records)
                self.assertIsNone(self.adapter.ledger.read(command.attempt_id))
                with self.assertRaises(ServiceError):
                    self.profiles.reserve("agentic", purpose="login")
            self.profiles.reserve("agentic", purpose="legacy").release()
            self.runner.run.assert_not_awaited()
        finally:
            if task is not None:
                if not task.done():
                    task.cancel()
                await asyncio.gather(task, return_exceptions=True)

    async def test_signed_deadline_expiring_during_wait_never_arms_dispatch(self):
        command = await self.command(deadline_at=(datetime.now(timezone.utc) + timedelta(seconds=0.1)).isoformat())
        async with self.profiles.observation("agentic", purpose="eligibility", timeout_seconds=2):
            with self.assertRaises(TeacherDispatchExcluded) as caught:
                await self.adapter.start(command)
            self.assertEqual((caught.exception.code, caught.exception.status), ("teacher_deadline_expired", 422))
            self.assertFalse(caught.exception.proof.provider_started)
            self.assertFalse(self.adapter.records)
            self.assertIsNone(self.adapter.ledger.read(command.attempt_id))
            self.runner.run.assert_not_awaited()

    async def test_epoch_changed_while_waiting_rejects_before_durable_arm(self):
        command = await self.command()
        waiting = asyncio.Event()
        def diagnostic(event, _engine, purpose, *_rest):
            if event == "wait" and purpose == "execution":
                waiting.set()
        task = None
        try:
            async with self.profiles.observation("agentic", purpose="eligibility", timeout_seconds=2):
                with patch.object(self.profiles, "_diagnostic", side_effect=diagnostic):
                    task = asyncio.create_task(self.adapter.start(command))
                    await asyncio.wait_for(waiting.wait(), 2)
                    self.agentic.session_generation = "c" * 32
            with self.assertRaises(TeacherDispatchExcluded) as caught:
                await task
            self.assertEqual(caught.exception.code, "runtime_generation_changed")
            self.assertFalse(caught.exception.proof.process_started)
            self.assertFalse(self.adapter.records)
            self.assertIsNone(self.adapter.ledger.read(command.attempt_id))
            self.runner.run.assert_not_awaited()
            self.profiles.reserve("agentic", purpose="legacy").release()
        finally:
            if task is not None:
                if not task.done():
                    task.cancel()
                await asyncio.gather(task, return_exceptions=True)

    async def test_concurrent_duplicate_has_one_generation_and_exact_ack_cleanup(self):
        command = await self.command()
        replies = await asyncio.gather(self.adapter.start(command), self.adapter.start(command))
        await self.settled()
        self.assertEqual({r.operation_id for r in replies}, {command.operation_id})
        self.assertEqual(self.runner.run.await_count, 1)
        snapshot = self.adapter.status(command.reference())
        self.assertEqual(snapshot.state, "completed")
        self.assertEqual(snapshot.text, "Synthetic answer")
        proof = snapshot.terminal_proof
        self.assertEqual(proof.operation_id, command.operation_id)
        self.assertEqual(proof.session_id, command.session_id)
        self.assertEqual(proof.job_id, command.job_id)
        self.assertEqual(proof.attempt_id, command.attempt_id)
        self.assertEqual(proof.request_hash, command.request_hash)
        self.assertTrue(proof.process_closed)
        self.assertLess(len(proof.model_dump_json().encode()), 8192)
        for path in (self.root / "state").rglob("*.json"):
            raw = path.read_text()
            self.assertNotIn(command.prompt, raw)
            self.assertNotIn("Synthetic answer", raw)
        self.assertFalse(self.adapter.transport.workspaces)
        ack = TeacherAck(**command.reference().model_dump(), terminal_proof_id=proof.terminal_proof_id,
            response_hash=proof.response_hash)
        self.assertTrue(self.adapter.acknowledge(ack)["acknowledged"])
        self.assertTrue(self.adapter.acknowledge(ack)["acknowledged"])
        self.assertFalse(list((self.root / "state/teacher_owners").glob("*.json")))
        self.assertFalse(list((self.root / "state/teacher_attempts").glob("*.json")))
        tombstones = list((self.root / "state/teacher_retired").glob("*.json"))
        self.assertEqual(len(tombstones), 1)
        self.assertEqual(set(json.loads(tombstones[0].read_text())),
            {"operation_id", "attempt_id", "request_hash", "ack_digest"})
        replacement = TeacherNativeText(self.agentic, self.profiles)
        self.addAsyncCleanup(replacement.close)
        self.assertTrue(replacement.acknowledge(ack)["acknowledged"])
        with self.assertRaises(ServiceError) as caught:
            await replacement.start(command)
        self.assertEqual(caught.exception.code, "teacher_operation_acknowledged")
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.start(command)
        self.assertEqual(caught.exception.code, "teacher_operation_acknowledged")
        changed_id = TeacherStart.model_validate(start_payload(**{
            **command.model_dump(exclude={"request_hash"}), "operation_id": str(uuid4())}))
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.start(changed_id)
        self.assertEqual(caught.exception.code, "teacher_attempt_already_owned")
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_changed_owner_hash_or_selection_cannot_reuse_operation(self):
        command = await self.command()
        await self.adapter.start(command)
        await self.settled()
        changed = TeacherStart.model_validate(start_payload(**{
            **command.model_dump(exclude={"request_hash"}), "prompt": "Other input"}))
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.start(changed)
        self.assertEqual(caught.exception.code, "teacher_operation_mismatch")
        for field, value in {"actor_id": "2", "session_id": str(uuid4()), "effort_id": None}.items():
            reference = command.reference().model_copy(update={field: value})
            with self.subTest(field=field), self.assertRaises(ServiceError):
                self.adapter.status(reference)
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_hook_or_foreign_tool_failure_is_closed_unknown_without_replay(self):
        command = await self.command()
        successful = self.successful_cli
        async def forbidden(args, **kwargs):
            raw, code = await successful(args, **kwargs)
            (kwargs["cwd"] / "gate_receipts.jsonl").write_text('{"tool":"other","allowed":false}\n')
            return raw, code
        self.runner.run.side_effect = forbidden
        await self.adapter.start(command)
        await self.settled()
        snapshot = self.adapter.status(command.reference())
        self.assertEqual(snapshot.state, "unknown")
        self.assertIsNone(snapshot.text)
        self.assertEqual(snapshot.terminal_proof.remote_outcome, "unknown")
        marker = next((self.root / "state").glob("*.unknown"))
        wrong = TeacherAck(**command.reference().model_dump(), terminal_proof_id=str(uuid4()), response_hash=None)
        with self.assertRaises(ServiceError):
            self.adapter.acknowledge(wrong)
        self.assertTrue(marker.exists(), "invalid ACK must not clear quarantine")
        self.assertEqual((await self.adapter.start(command)).state, "unknown")
        self.assertEqual(self.runner.run.await_count, 1)
        self.adapter.reconcile(command.reference())
        self.assertFalse(marker.exists())

    async def test_failure_is_durable_before_workspace_cleanup_and_retained_after_exact_ack(self):
        command = await self.command()
        successful = self.successful_cli
        async def invalid(args, **kwargs):
            raw, code = await successful(args, **kwargs)
            (kwargs["cwd"] / "gate_receipts.jsonl").write_text('{"tool":"other","allowed":false}\n')
            return raw, code
        self.runner.run.side_effect = invalid
        cleanup = self.adapter.transport.cleanup
        seen = []
        def checked_cleanup(operation_id):
            path = self.root / "state/teacher_owners" / (operation_id + ".json")
            diagnostic = json.loads(path.read_text())["failure"]
            seen.append(diagnostic["code"])
            self.assertEqual(diagnostic["code"], "hook_policy_rejected")
            self.assertTrue(self.adapter.transport.workspaces)
            cleanup(operation_id)
        self.adapter.transport.cleanup = checked_cleanup
        await self.adapter.start(command); await self.settled()
        self.assertEqual(seen, ["hook_policy_rejected"])
        self.adapter.transport.cleanup = cleanup
        snapshot = self.adapter.status(command.reference())
        self.assertEqual(snapshot.state, "unknown")
        self.assertNotIn("failure", snapshot.model_dump())
        proof = snapshot.terminal_proof
        ack = TeacherAck(**command.reference().model_dump(), terminal_proof_id=proof.terminal_proof_id, response_hash=None)
        self.adapter.acknowledge(ack)
        retired = self.root / "state/teacher_retired" / (command.operation_id + ".json")
        saved = json.loads(retired.read_text())
        self.assertEqual(saved["failure"], {"stage": "hook", "code": "hook_policy_rejected"})
        self.assertNotIn(command.prompt, retired.read_text())
        self.assertNotIn("Synthetic answer", retired.read_text())
        replacement = TeacherNativeText(self.agentic, self.profiles)
        self.addAsyncCleanup(replacement.close)
        self.assertTrue(replacement.acknowledge(ack)["acknowledged"])
        with self.assertRaises(ServiceError): await replacement.start(command)
        self.assertEqual(replacement._read_retired(command.operation_id).failure.code, "hook_policy_rejected")
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_diagnostic_write_failure_retains_workspace_and_armed_fence(self):
        command = await self.command()
        successful = self.successful_cli
        async def invalid(args, **kwargs):
            raw, code = await successful(args, **kwargs)
            (kwargs["cwd"] / "gate_receipts.jsonl").unlink()
            return raw, code
        self.runner.run.side_effect = invalid
        write = self.adapter._write
        def unavailable(record):
            if record.failure is not None: raise OSError("SYNTHETIC_PRIVATE_DISK_ERROR")
            write(record)
        self.adapter._write = unavailable
        await self.adapter.start(command); await self.settled()
        snapshot = self.adapter.status(command.reference())
        self.assertIsNone(snapshot.terminal_proof)
        self.assertTrue(self.adapter.transport.workspaces)
        self.assertEqual(self.adapter.ledger.read(command.attempt_id).state, "dispatch_armed")
        with self.assertRaises(ServiceError): self.profiles.reserve("agentic", purpose="legacy")
        self.adapter._write = write
        self.adapter.reconcile(command.reference())
        self.assertEqual(self.adapter._read(command.operation_id).failure.code, "reconciled_without_diagnostic")
        self.assertFalse(self.adapter.transport.workspaces)
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_lost_response_retains_durable_proof_without_replaying(self):
        command = await self.command()
        await self.adapter.start(command)
        await self.settled()
        previous = self.adapter.status(command.reference())
        replacement = TeacherNativeText(self.agentic, self.profiles)
        self.addAsyncCleanup(replacement.close)
        current = replacement.status(command.reference())
        self.assertIsNone(current.text)
        self.assertEqual(current.terminal_proof, previous.terminal_proof)
        self.assertEqual((await replacement.start(command)).state, "completed")
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_timeout_keeps_unknown_fence_until_real_supervisor_closes(self):
        command = await self.command()
        entered = asyncio.Event()
        async def never_closes(args, **kwargs):
            self.runner._processes.add("synthetic-unclosed-process")
            entered.set()
            await asyncio.Event().wait()
        self.runner.run.side_effect = never_closes
        await self.adapter.start(command)
        await entered.wait()
        task = self.adapter.tasks[command.operation_id]
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        self.assertIsNone(self.adapter.status(command.reference()).terminal_proof)
        self.assertTrue(self.adapter.transport.workspaces)
        replacement_runner = SimpleNamespace(**vars(self.runner))
        replacement_runner._processes = set()
        replacement = TeacherNativeText(SimpleNamespace(**{**vars(self.agentic), "runner": replacement_runner}), self.profiles)
        self.addAsyncCleanup(replacement.close)
        with self.assertRaises(ServiceError) as caught:
            replacement.reconcile(command.reference())
        self.assertEqual(caught.exception.code, "teacher_original_owner_closure_required")
        with self.assertRaises(ServiceError):
            self.profiles.reserve("agentic", purpose="legacy")
        self.runner._processes.clear()  # Synthetic supervisor finally attests its own shutdown.
        result = self.adapter.reconcile(command.reference())
        self.assertEqual(result.terminal_proof.remote_outcome, "unknown")
        self.assertFalse(self.adapter.transport.workspaces)
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_execution_deadline_does_not_retry_and_retains_closed_unknown(self):
        command = await self.command()
        self.runner.config = replace(self.runner.config, timeout=0.02)
        async def bounded(args, **kwargs):
            self.runner._processes.add("synthetic-supervised-process")
            try:
                await asyncio.Event().wait()
            finally:
                self.runner._processes.clear()
        self.runner.run.side_effect = bounded
        await self.adapter.start(command)
        await self.settled()
        terminal = self.adapter.status(command.reference()).terminal_proof
        self.assertTrue(terminal.process_closed)
        self.assertEqual(terminal.remote_outcome, "unknown")
        self.assertEqual((await self.adapter.start(command)).state, "unknown")
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_execution_uses_authorized_deadline_with_300_second_ceiling(self):
        self.runner.config = replace(self.runner.config, timeout=600)
        execute = AsyncMock(return_value=TeacherAnswer(text="Synthetic bounded answer"))
        self.adapter.transport.execute = execute
        for authorized, expected in ((300, 300), (120, 120), (7, 7), (600, 300)):
            with self.subTest(authorized=authorized):
                command = await self.command(deadline_at=(datetime.now(timezone.utc)
                    + timedelta(seconds=authorized)).isoformat())
                await self.adapter.start(command)
                await self.settled()
                actual = execute.await_args.args[1]
                self.assertGreater(actual, expected - 2)
                self.assertLessEqual(actual, expected)
                self.assertEqual(self.adapter.status(command.reference()).state, "completed")
        self.assertEqual(execute.await_count, 4)
        self.runner.run.assert_not_awaited()

    async def test_invalid_runtime_budget_rejects_before_execution_and_releases_capacity(self):
        self.adapter.transport.execute = AsyncMock()
        for invalid in (None, True, float("nan"), 0):
            with self.subTest(invalid=invalid):
                self.runner.config = replace(self.runner.config, timeout=invalid)
                command = await self.command()
                with self.assertRaises(ServiceError) as caught:
                    await self.adapter.start(command)
                self.assertEqual(caught.exception.code, "teacher_runtime_unverified")
                self.assertEqual(list((self.root / "state").glob("*.unknown")), [])
                self.assertNotIn(self.profiles.identity("agentic"), self.profiles._held)
        self.adapter.transport.execute.assert_not_awaited()

    async def test_graceful_shutdown_waits_for_owned_process_and_persists_unknown_proof(self):
        command = await self.command()
        entered = asyncio.Event()
        async def supervised(args, **kwargs):
            self.runner._processes.add("synthetic-owned-group")
            entered.set()
            try:
                await asyncio.Event().wait()
            finally:
                self.runner._processes.clear()
        self.runner.run.side_effect = supervised
        await self.adapter.start(command)
        await entered.wait()
        await self.adapter.close()
        self.assertFalse(self.runner._processes)
        self.assertFalse(self.adapter.tasks)
        proof = self.adapter.status(command.reference()).terminal_proof
        self.assertTrue(proof.process_closed)
        self.assertEqual(proof.remote_outcome, "unknown")
        self.assertFalse(self.adapter.transport.workspaces)
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_expired_or_changed_epoch_command_never_arms_dispatch(self):
        command = await self.command(deadline_at="2000-01-01T00:00:00Z")
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.start(command)
        self.assertEqual(caught.exception.code, "teacher_deadline_expired")
        self.assertIsInstance(caught.exception, TeacherDispatchExcluded)
        self.assertTrue(caught.exception.proof.dispatch_exclusion)
        self.assertFalse(caught.exception.proof.provider_started)
        self.assertEqual(caught.exception.proof.request_hash, command.request_hash)
        changed = await self.command()
        self.agentic.session_generation = "f" * 32
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.start(changed)
        self.assertEqual(caught.exception.code, "runtime_generation_changed")
        self.assertFalse(self.adapter.records)
        self.assertFalse(list((self.root / "state").rglob("*.json")))
        self.runner.run.assert_not_awaited()

    async def test_partial_durable_admission_never_claims_dispatch_exclusion(self):
        command = await self.command()
        original = self.profiles.arm_dispatch
        def refuse(*args):
            raise ServiceError("synthetic_marker_failure", "Synthetic", 409)
        self.profiles.arm_dispatch = refuse
        with self.assertRaises(ServiceError) as caught:
            await self.adapter.start(command)
        self.assertNotIsInstance(caught.exception, TeacherDispatchExcluded)
        self.assertIsNotNone(self.adapter.ledger.read(command.attempt_id))
        self.runner.run.assert_not_awaited()
        self.profiles.arm_dispatch = original


class TeacherHttpBoundaryTests(test_support.AppTestCase):
    def test_valid_expired_start_returns_bound_exclusion_without_creating_attempt(self):
        command = start_payload(deadline_at="2000-01-01T00:00:00Z")
        response = self.client.post("/teacher/agentic-text/start", json=command, headers=test_support.HEADERS)
        self.assertEqual(response.status_code, 422)
        proof = response.json()["dispatch_exclusion_proof"]
        self.assertEqual(proof["operation_id"], command["operation_id"])
        self.assertEqual(proof["request_hash"], command["request_hash"])
        self.assertEqual(proof["session_generation"], command["session_generation"])
        self.assertEqual(proof["runtime_hash"], command["runtime_hash"])
        self.assertIs(proof["process_started"], False)
        self.assertIs(proof["provider_started"], False)
        self.assertIs(proof["dispatch_exclusion"], True)
        self.assertFalse(self.app.state.teacher_text.records)

    def test_new_routes_require_service_auth_and_reject_unbounded_body(self):
        for path in ("observe", "inspect-catalog", "start", "status", "reconcile", "ack"):
            url = "/teacher/agentic-text/" + path
            self.assertEqual(self.client.post(url, json={}).status_code, 401)
            self.assertEqual(self.client.post(url, json={}, headers={"X-Nodia-Service-Token": "bad"}).status_code, 401)
            response = self.client.post(url, json={"prompt": "must-not-be-echoed"}, headers=test_support.HEADERS)
            self.assertEqual(response.status_code, 422)
            self.assertNotIn("must-not-be-echoed", response.text)
        response = self.client.post("/teacher/agentic-text/inspect-catalog", content=b"x" * 8193,
            headers={**test_support.HEADERS, "Content-Type": "application/json"})
        self.assertEqual(response.status_code, 413)
        response = self.client.post("/teacher/agentic-text/start", content=b"x" * 800001,
            headers={**test_support.HEADERS, "Content-Type": "application/json"})
        self.assertEqual(response.status_code, 413)
        self.assertFalse(self.app.state.teacher_text.records)
        response = self.client.post("/teacher/agentic-text/start", content=b'{"actor_id":"1","actor_id":"2"}',
            headers={**test_support.HEADERS, "Content-Type": "application/json"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "invalid_request")
