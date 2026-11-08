"""Exact manual-OCR fencing with synthetic operations, no account/network."""
import test_support
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, AsyncMock, Mock
from types import SimpleNamespace

from manual_invoice_dispatch import ManualInvoiceDispatches
from cli_execution_receipt import CliExecutionReceipt
from uuid import uuid4
from agentic_service import AntigravityAgentService
from agentic_cli import CliConfig
from native_attempts import ReconcileAttempt
from profile_admission import ProfileAdmission
from service_errors import ServiceError


class ManualInvoiceDispatchTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profile = self.root / "synthetic-profile"
        self.gate = ProfileAdmission(self.profile, self.root / "admission")
        self.manager = ManualInvoiceDispatches(self.gate, self.root / "proofs")
        self.generation = "a" * 32
        self.marker = self.root / "admission" / (self.gate.identity("agentic").split(":")[1] + ".unknown")

    @staticmethod
    def closed(dispatch):
        # Simulates only the CLI/OS boundary's positive containment certificate.
        dispatch.receipt.claim()
        dispatch.receipt.record_contained_closure()

    async def test_cancelled_closed_generation_releases_only_its_capacity_and_next_is_a_new_intent(self):
        outcomes = []
        close = self.manager.ledger.close
        def record(proof, outcome):
            outcomes.append(outcome)
            return close(proof, outcome)
        with patch.object(self.manager.ledger, "close", side_effect=record):
            with self.assertRaises(asyncio.CancelledError):
                async with self.manager.operation(self.generation) as first:
                    first.arm()
                    self.closed(first)
                    raise asyncio.CancelledError()
        self.assertEqual(outcomes, ["abandoned_unknown"])
        self.assertFalse(self.marker.exists())
        self.assertIsNone(self.manager.ledger.read(first.attempt_id))
        async with self.manager.operation(self.generation) as second:
            self.assertNotEqual(second.attempt_id, first.attempt_id)
        self.assertFalse(self.gate._held)

    async def test_unproved_close_keeps_quarantine_and_new_action_cannot_dispatch(self):
        with self.assertRaises(asyncio.CancelledError):
            async with self.manager.operation(self.generation) as dispatch:
                dispatch.arm()
                raise asyncio.CancelledError()
        original = self.marker.read_bytes()
        self.assertIn(self.gate.identity("agentic"), self.gate._quarantined)
        with self.assertRaises(ServiceError) as caught:
            async with self.manager.operation(self.generation):
                self.fail("must reject before another generation")
        self.assertEqual(caught.exception.code, "native_proof_missing")
        self.assertEqual(self.marker.read_bytes(), original)
        self.assertFalse(self.manager.ledger.read(dispatch.attempt_id).process_closed)

    async def test_generation_cannot_rearm_or_reuse_its_cli_receipt(self):
        async with self.manager.operation(self.generation) as dispatch:
            dispatch.arm()
            with self.assertRaises(ServiceError):
                dispatch.arm()
            self.closed(dispatch)
            with self.assertRaises(ValueError):
                dispatch.receipt.claim()

    async def test_completed_output_requires_positive_local_closure(self):
        with self.assertRaises(ServiceError) as caught:
            async with self.manager.operation(self.generation) as dispatch:
                dispatch.arm()
        self.assertEqual(caught.exception.code, "native_proof_missing")
        self.assertTrue(self.marker.exists())
        self.assertFalse(self.manager.ledger.read(dispatch.attempt_id).process_closed)

    async def test_another_invocations_closed_receipt_cannot_release_this_marker(self):
        with self.assertRaises(ServiceError) as caught:
            async with self.manager.operation(self.generation) as dispatch:
                dispatch.arm()
                dispatch.receipt = CliExecutionReceipt(str(uuid4()))
                self.closed(dispatch)
        self.assertEqual(caught.exception.code, "native_proof_mismatch")
        self.assertTrue(self.marker.exists())
        self.assertFalse(self.manager.ledger.read(dispatch.attempt_id).process_closed)

    async def test_closed_receipt_cannot_release_replaced_marker(self):
        with self.assertRaises(asyncio.CancelledError):
            async with self.manager.operation(self.generation) as dispatch:
                dispatch.arm()
                self.closed(dispatch)
                foreign = {**dispatch.marker, "attempt_id": "00000000-0000-0000-0000-000000000000"}
                self.marker.write_text(json.dumps(foreign), encoding="utf8")
                raise asyncio.CancelledError()
        self.assertEqual(json.loads(self.marker.read_bytes()), foreign)
        self.assertIn(self.gate.identity("agentic"), self.gate._quarantined)

    async def test_failed_terminal_commit_does_not_release_marker(self):
        with patch.object(self.manager.ledger, "close", side_effect=OSError("synthetic fsync failure")):
            with self.assertRaises(asyncio.CancelledError):
                async with self.manager.operation(self.generation) as dispatch:
                    dispatch.arm()
                    self.closed(dispatch)
                    raise asyncio.CancelledError()
        self.assertTrue(self.marker.exists())
        self.assertFalse(self.manager.ledger.read(dispatch.attempt_id).process_closed)
        self.assertIn(self.gate.identity("agentic"), self.gate._quarantined)

    async def test_restart_recovers_only_a_durably_closed_exact_receipt(self):
        with patch.object(self.gate, "reconcile_dispatch", side_effect=OSError("synthetic transition interruption")):
            with self.assertRaises(asyncio.CancelledError):
                async with self.manager.operation(self.generation) as dispatch:
                    dispatch.arm()
                    self.closed(dispatch)
                    raise asyncio.CancelledError()
        self.assertTrue(self.marker.exists())
        self.assertEqual(self.manager.ledger.read(dispatch.attempt_id).state, "abandoned_unknown")
        restarted_gate = ProfileAdmission(self.profile, self.root / "admission")
        restarted = ManualInvoiceDispatches(restarted_gate, self.root / "proofs")
        async with restarted.operation("b" * 32) as new_intent:
            self.assertNotEqual(new_intent.attempt_id, dispatch.attempt_id)
        self.assertFalse(self.marker.exists())
        self.assertIsNone(restarted.ledger.read(dispatch.attempt_id))

    async def test_legacy_marker_never_gains_an_identity_from_process_idleness(self):
        self.marker.parent.mkdir()
        self.marker.write_bytes(b"unknown\n")
        self.marker.chmod(0o600)  # Match an actual private legacy marker.
        before = self.marker.read_bytes()
        restarted = ManualInvoiceDispatches(ProfileAdmission(self.profile, self.root / "admission"), self.root / "proofs")
        with self.assertRaises(ServiceError) as caught:
            async with restarted.operation(self.generation):
                self.fail("legacy marker must not be adopted")
        self.assertEqual(caught.exception.code, "native_proof_missing")
        self.assertEqual(self.marker.read_bytes(), before)

    async def test_crash_after_capacity_transition_acks_terminal_orphan_without_releasing_any_owner(self):
        with patch.object(self.manager.ledger, "acknowledge", side_effect=OSError("synthetic ACK interruption")):
            with self.assertRaises(asyncio.CancelledError):
                async with self.manager.operation(self.generation) as dispatch:
                    dispatch.arm()
                    self.closed(dispatch)
                    raise asyncio.CancelledError()
        self.assertFalse(self.marker.exists())
        self.assertTrue(self.manager.ledger.read(dispatch.attempt_id).process_closed)
        restarted_gate = ProfileAdmission(self.profile, self.root / "admission")
        restarted = ManualInvoiceDispatches(restarted_gate, self.root / "proofs")
        with patch.object(restarted_gate, "reconcile_dispatch", side_effect=AssertionError("GC cannot release capacity")):
            restarted.recover_closed()
        self.assertIsNone(restarted.ledger.read(dispatch.attempt_id))

    async def test_duplicate_marker_keys_are_rejected_without_mutation(self):
        with self.assertRaises(asyncio.CancelledError):
            async with self.manager.operation(self.generation) as dispatch:
                dispatch.arm()
                raise asyncio.CancelledError()
        original = self.marker.read_text()
        duplicate = '{"kind":"foreign",' + original[1:]
        self.marker.write_text(duplicate, encoding="utf8")
        with self.assertRaises(ServiceError) as caught:
            self.manager.recover_closed()
        self.assertEqual(caught.exception.code, "native_proof_mismatch")
        self.assertEqual(self.marker.read_text(), duplicate)

    async def test_armed_orphan_cannot_be_acked_or_admitted_after_restart(self):
        with self.assertRaises(asyncio.CancelledError):
            async with self.manager.operation(self.generation) as dispatch:
                dispatch.arm()
                raise asyncio.CancelledError()
        self.marker.unlink()  # Synthetic corruption, never an operational cleanup.
        restarted_gate = ProfileAdmission(self.profile, self.root / "admission")
        restarted = ManualInvoiceDispatches(restarted_gate, self.root / "proofs")
        restarted.initialize_safety()
        self.assertIn(restarted_gate.identity("agentic"), restarted_gate._quarantined)
        with self.assertRaises(ServiceError):
            restarted_gate.reserve("agentic", purpose="health_status")
        with self.assertRaises(ServiceError) as caught:
            async with restarted.operation(self.generation):
                self.fail("an armed orphan is not a new dispatch")
        self.assertEqual(caught.exception.code, "native_proof_missing")
        self.assertEqual(restarted.ledger.read(dispatch.attempt_id).state, "dispatch_armed")
        self.assertFalse(self.marker.exists())

    async def test_containment_unavailable_is_pre_dispatch_and_does_not_quarantine_the_profile(self):
        runner = SimpleNamespace(config=CliConfig(self.root / "synthetic-cli", "", self.root),
            run=AsyncMock(return_value=(json.dumps({"status": "SUCCESS", "num_turns": 0,
                "usage": {"total_tokens": 0}, "command": {"name": "model", "data": {"id": "fixture-model"}}}), 0)),
            prepare_closure=Mock(side_effect=ServiceError("native_proof_missing", "safe", 409)),
            discard_prepared_closure=Mock())
        service = AntigravityAgentService(runner)
        service._available = True  # Synthetic auth/catalog boundary, no real CLI.
        service.get_status = AsyncMock(return_value={"has_active_session": True,
            "models": [{"id": "fixture-model", "name": "Fixture"}]})
        invoice = self.root / "synthetic.pdf"
        invoice.write_bytes(b"%PDF-1.4")
        stages = []
        with self.assertRaises(ServiceError) as caught:
            async with self.manager.operation(self.generation) as dispatch:
                def progress(stage):
                    stages.append(stage)
                    if stage == "provider_request_started":
                        dispatch.arm()
                await service.analyze_invoice(invoice, model="fixture-model",
                    progress_callback=progress, closure_receipt=dispatch.receipt)
        self.assertEqual(caught.exception.code, "native_proof_missing")
        self.assertNotIn("provider_request_started", stages)
        self.assertFalse(self.marker.exists())
        self.assertFalse(self.gate._quarantined)
        self.assertFalse(self.gate._held)
        self.assertFalse(any("--input-format" in call.args[0] for call in runner.run.await_args_list))
        self.assertFalse(list(self.root.glob("nodia-agentic-*")))

    async def test_closed_receipt_for_another_profile_is_never_garbage_collected(self):
        attempt_id = str(uuid4())
        reference = ReconcileAttempt(resource_key="gemini-profile:" + "f" * 64,
            session_generation=self.generation, operation_ref=attempt_id)
        proof = self.manager.ledger.arm(attempt_id, "agentic", reference)
        self.manager.ledger.close(proof, "abandoned_unknown")
        self.manager.recover_closed()
        self.assertIsNotNone(self.manager.ledger.read(attempt_id))

    async def test_pre_dispatch_failure_has_no_generation_marker_or_retained_capacity(self):
        with self.assertRaises(ValueError):
            async with self.manager.operation(self.generation):
                raise ValueError("synthetic invalid selection")
        self.assertFalse(self.marker.exists())
        self.assertFalse(self.gate._held)

    async def test_concurrent_active_request_is_never_reconciled(self):
        async with self.manager.operation(self.generation) as current:
            current.arm()
            with self.assertRaises(ServiceError) as caught:
                async with self.manager.operation(self.generation):
                    self.fail("cannot enter an active owner")
            self.assertEqual(caught.exception.code, "runtime_busy")
            self.closed(current)
