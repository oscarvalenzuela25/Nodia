"""CV text ownership tests using the real profile gate and durable journal."""
import test_support
import asyncio
from hashlib import sha256
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from pydantic import ValidationError

from native_teacher_text import TeacherNativeText
from profile_admission import ProfileAdmission
from service_errors import ServiceError
from teacher_runtime_backend import TeacherRuntimeIdentity
from teacher_text_contract import (
    CONTRACT, CV_CONTRACT, CvAck, CvObserve, CvStart, TeacherAnswer, TeacherReference, TeacherStart,
)
from test_teacher_text_contract import start_payload


class CvNativeOwnershipTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.state = Path(self.enterContext(tempfile.TemporaryDirectory())) / "state"
        self.profiles = ProfileAdmission(self.state.parent / "profile", self.state)
        identity = TeacherRuntimeIdentity("1" * 128, "2" * 64, "3" * 64)
        self.backend = SimpleNamespace(session_generation="4" * 32, timeout_seconds=10,
            prepare_admission=AsyncMock(), identity=AsyncMock(return_value=identity),
            unverified_identity=lambda: identity, validate_selection=AsyncMock(),
            process_closed=Mock(return_value=True), recover_local_closure=Mock(return_value=False),
            cleanup_owned=Mock(), catalog_supported=False)
        self.transport = SimpleNamespace(execute=AsyncMock(), cleanup=Mock())
        self.cv = self.adaptor(CV_CONTRACT)
        self.teacher = self.adaptor(CONTRACT)
        selection = CvObserve(contract=CV_CONTRACT, model_id="fixture-model", effort_id="fixture-level",
            configuration_generation="5" * 64)
        observed = await self.cv.observe(selection)
        self.assertTrue(observed.available)
        self.assertEqual(observed.contract, CV_CONTRACT)
        self.transport.execute.assert_not_awaited()
        self.command = CvStart.model_validate(start_payload(**selection.model_dump(), owner_digest="6" * 64,
            resource_key=observed.resource_key, session_generation=observed.session_generation,
            runtime_hash=observed.runtime_hash, policy_hash=observed.policy_hash))

    def adaptor(self, contract):
        value = TeacherNativeText(None, self.profiles, backend=self.backend, transport=self.transport, contract=contract)
        self.addAsyncCleanup(value.close)
        return value

    def legacy_command(self):
        payload = self.command.model_dump(exclude={"contract", "owner_digest", "request_hash"})
        return TeacherStart.model_validate(start_payload(**payload, contract=CONTRACT))

    async def test_cv_durable_proof_is_domain_bound_and_shares_the_physical_profile(self):
        resume = asyncio.Event()
        async def answer(*_args):
            await resume.wait()
            return TeacherAnswer(text="Synthetic CV response")
        self.transport.execute.side_effect = answer
        reference = self.command.reference()
        first = await self.cv.start(self.command)
        tasks = list(self.cv.tasks.values())
        self.assertEqual(first.state, "running")
        marker = self.profiles.read_dispatch_marker("agentic")
        self.assertEqual(marker["kind"], CV_CONTRACT)
        self.assertEqual(marker["owner_digest"], reference.owner_digest)
        with self.assertRaises(ServiceError) as concurrent:
            await self.teacher.start(self.legacy_command())
        self.assertEqual(concurrent.exception.code, "runtime_busy")
        resume.set()
        await asyncio.gather(*tasks)

        result = self.cv.status(reference)
        proof = result.terminal_proof
        self.assertEqual(result.state, "completed")
        self.assertEqual(proof.contract, CV_CONTRACT)
        self.assertEqual(proof.owner_digest, reference.owner_digest)
        self.assertEqual(proof.response_hash, sha256(result.text.encode()).hexdigest())
        self.assertEqual(self.profiles.read_dispatch_marker("agentic"), marker)
        with self.assertRaises(ServiceError):
            self.profiles.reserve("agentic", purpose="legacy")
        legacy_reference = self.legacy_command().reference()
        with self.assertRaises(ServiceError):
            self.teacher.status(legacy_reference)
        with self.assertRaises(ServiceError):
            self.cv.status(legacy_reference)
        with self.assertRaises(ServiceError):
            self.cv.reconcile(reference.model_copy(update={"owner_digest": "7" * 64}))

        replacement = self.adaptor(CV_CONTRACT)
        saved = replacement.status(reference)
        self.assertIsNone(saved.text)
        self.assertEqual(saved.terminal_proof, proof)
        ack = CvAck(**reference.model_dump(), terminal_proof_id=proof.terminal_proof_id,
            response_hash=proof.response_hash)
        with self.assertRaises(ServiceError):
            replacement.acknowledge(ack.model_copy(update={"owner_digest": "7" * 64}))
        self.assertTrue(replacement.acknowledge(ack)["acknowledged"])
        self.assertIsNone(self.profiles.read_dispatch_marker("agentic"))
        other_marker = {"kind": "synthetic-other-operation", "resource_key": reference.resource_key}
        async with self.profiles.operation("agentic"):
            self.profiles.arm_dispatch("agentic", other_marker)
            self.assertTrue(replacement.acknowledge(ack)["acknowledged"])
            self.assertEqual(self.profiles.read_dispatch_marker("agentic"), other_marker)
            self.profiles.resolve_current_dispatch("agentic", other_marker)
        with self.assertRaises(ServiceError):
            await replacement.start(self.command)
        new_operation = self.adaptor(CV_CONTRACT)
        altered = {**self.command.model_dump(), "operation_id": str(uuid4())}
        with self.assertRaises(ServiceError) as replay:
            await new_operation.start(CvStart.model_validate(start_payload(**altered)))
        self.assertEqual(replay.exception.code, "teacher_attempt_already_owned")
        self.transport.execute.assert_awaited_once()
        durable = list(self.state.rglob("*.json"))
        self.assertEqual({p.parent.name for p in durable}, {"cv_retired", "cv_retired_attempts"})
        for path in durable:
            self.assertNotIn(result.text, path.read_text())
            self.assertNotIn(self.command.prompt, path.read_text())

    async def test_timeout_without_closure_quarantines_exact_owner_across_replacement(self):
        self.transport.execute.side_effect = TimeoutError()
        self.backend.process_closed.return_value = False
        reference = self.command.reference()
        await self.cv.start(self.command)
        await asyncio.gather(*list(self.cv.tasks.values()))
        replacement = self.adaptor(CV_CONTRACT)
        self.assertEqual(replacement.status(reference).state, "unknown")
        self.assertIsNone(replacement.status(reference).terminal_proof)
        self.assertEqual((await replacement.start(self.command)).state, "unknown")
        with self.assertRaises(ServiceError):
            replacement.reconcile(reference)
        self.assertIsNotNone(self.profiles.read_dispatch_marker("agentic"))
        self.backend.recover_local_closure.return_value = True
        terminal = replacement.reconcile(reference).terminal_proof
        self.assertEqual(terminal.remote_outcome, "unknown")
        self.assertTrue(terminal.process_closed)
        self.assertIsNone(terminal.response_hash)
        self.assertIsNotNone(self.profiles.read_dispatch_marker("agentic"))
        ack = CvAck(**reference.model_dump(), terminal_proof_id=terminal.terminal_proof_id, response_hash=None)
        self.assertTrue(replacement.acknowledge(ack)["acknowledged"])
        self.assertIsNone(self.profiles.read_dispatch_marker("agentic"))
        self.transport.execute.assert_awaited_once()


class CvTextContractTests(test_support.AppTestCase):
    def test_cv_requires_service_authority_and_emits_only_cv_exclusion(self):
        command = start_payload(contract=CV_CONTRACT, owner_digest="a" * 64,
            deadline_at="2000-01-01T00:00:00Z")
        url = "/cv/agentic-text/start"
        self.assertEqual(self.client.post(url, json=command).status_code, 401)
        response = self.client.post(url, json=command, headers=test_support.HEADERS)
        self.assertEqual(response.status_code, 422)
        proof = response.json()["dispatch_exclusion_proof"]
        self.assertEqual(proof["contract"], CV_CONTRACT)
        self.assertEqual(proof["request_hash"], command["request_hash"])
        self.assertIs(proof["process_started"], False)
        self.assertIs(proof["provider_started"], False)
        teacher = self.client.post("/teacher/agentic-text/start", json=command, headers=test_support.HEADERS)
        self.assertEqual(teacher.status_code, 422)
        self.assertNotIn("dispatch_exclusion_proof", teacher.json())
        ambiguous = self.client.post(url, content=b'{"owner_digest":"a","owner_digest":"b"}',
            headers={**test_support.HEADERS, "Content-Type": "application/json"})
        self.assertEqual(ambiguous.json()["code"], "invalid_request")

    def test_exact_command_hash_covers_cv_owner_digest_and_domain(self):
        command = start_payload(contract=CV_CONTRACT, owner_digest="a" * 64)
        reference = CvStart.model_validate(command).reference()
        with self.assertRaises(ValidationError):
            CvStart.model_validate({**command, "owner_digest": "b" * 64})
        with self.assertRaises(ValidationError):
            TeacherReference.model_validate(json.loads(reference.model_dump_json()))
