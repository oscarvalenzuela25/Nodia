"""Durable OCR admission/receipt invariants; provider and parser IO are fake."""
import test_support
import asyncio
import base64
import hashlib
import importlib
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from pydantic import ValidationError
from attachment_inspector import AttachmentInspection, AttachmentInspector
from native_attempts import AcknowledgeAttempt, ReconcileAttempt
from native_invoice_analysis import InvoiceTurnRequest, NativeInvoiceAnalysis, parse_invoice_turn
from nodia_ai_chat import ChatAdapter
from profile_admission import ProfileAdmission
from service_errors import ServiceError

RESULT = {"code": None, "total_amount": 0, "data": {"issue_date": "", "items": [
    {"name": "Synthetic invoice", "quantity": 0, "cost_price": None}]}}


class InvoiceAnalysisTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profiles = ProfileAdmission(self.root / "agentic", self.root / "state")
        self.inspector = AttachmentInspector(self.root / "files")
        self.inspector.decode = AsyncMock(return_value=AttachmentInspection(
            media_type="image/png", page_count=None, duration_seconds=None))
        self.agentic = SimpleNamespace(session_generation="b" * 32,
            runner=SimpleNamespace(_processes=set(), _spawns=set()))
        self.chat = ChatAdapter(self.agentic, self.profiles, self.inspector)
        self.service = NativeInvoiceAnalysis(self.chat)

        async def core(path, **options):
            self.assertTrue(path.is_file())
            self.assertEqual(path.read_bytes(), b"Synthetic private document")
            self.assertEqual(options["model"], "fixture-model")
            self.assertIsNone(options["thinking_level"])
            self.assertIsNone(options["provider_tax"])
            self.assertEqual(options["provider_fields"], {"code": "private mapping"})
            options["progress_callback"]("provider_request_started")
            self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "dispatch_armed")
            marker = self.root / "state" / (self.payload.resource_key.split(":")[1] + ".unknown")
            self.assertEqual(json.loads(marker.read_text())["operation_ref"], self.payload.attempt_id)
            return RESULT
        self.agentic.analyze_invoice = AsyncMock(side_effect=core)
        self.payload = self.request()

    def request(self, engine="agentic", **changes):
        document = b"Synthetic private document"
        return InvoiceTurnRequest.model_validate({"model_id": "fixture-model", "effort_id": None,
            "configuration_generation": "c" * 64, "attempt_id": str(uuid4()),
            "resource_key": self.profiles.identity(engine),
            "session_generation": "b" * 32,
            "timeout_seconds": 2, "attachment": {"kind": "image", "media_type": "image/png",
                "sha256": hashlib.sha256(document).hexdigest(), "content_base64": base64.b64encode(document).decode()},
            "provider_fields": {"code": "private mapping"}, "tax": None, **changes})

    def reference(self):
        return ReconcileAttempt(resource_key=self.payload.resource_key,
            session_generation=self.payload.session_generation, operation_ref=self.payload.attempt_id)

    async def test_one_dispatch_receipt_then_ack_and_zero_null_preserved(self):
        result = await self.service.execute("agentic", self.payload)
        self.assertEqual(result.extraction.total_amount, 0)
        self.assertEqual(result.extraction.data.items[0].quantity, 0)
        self.assertIsNone(result.extraction.data.items[0].cost_price)
        self.assertEqual(result.native.outcome, "completed")
        self.assertEqual(result.native.operation_ref, self.payload.attempt_id)
        self.agentic.analyze_invoice.assert_awaited_once()
        proof = self.chat.reconcile("agentic", self.payload.attempt_id, self.reference())
        self.assertEqual(proof, result.native.model_dump())
        receipt = next((self.root / "state" / "attempts").glob("*.json")).read_text()
        self.assertNotIn("private", receipt)
        self.assertNotIn("fixture-model", receipt)
        self.assertNotIn(self.payload.attachment.content_base64, receipt)
        self.assertEqual(len(json.loads(receipt)["input_digest"]), 64)
        ack = AcknowledgeAttempt(**self.reference().model_dump(), terminal_proof_id=result.native.terminal_proof_id)
        self.chat.acknowledge("agentic", self.payload.attempt_id, ack)
        with self.assertRaises(ServiceError) as caught:
            await self.service.execute("agentic", self.payload)
        self.assertEqual(caught.exception.code, "attempt_already_dispatched")
        self.assertEqual(list(self.inspector.directory.iterdir()), [])

    async def test_nested_profile_rejected_without_parser_or_provider(self):
        async with self.profiles.operation("agentic", purpose="execution"):
            with self.assertRaises(ServiceError) as caught:
                await self.service.execute("agentic", self.payload)
        self.assertEqual(caught.exception.code, "runtime_busy")
        self.agentic.analyze_invoice.assert_not_awaited()
        self.inspector.decode.assert_not_awaited()
        self.assertIsNone(self.chat.ledger.read(self.payload.attempt_id))

    async def test_preflight_error_has_closed_receipt_for_sql_reconciliation_without_generation(self):
        self.agentic.analyze_invoice.side_effect = ServiceError("model_unavailable", "safe", 422)
        with self.assertRaises(ServiceError) as caught:
            await self.service.execute("agentic", self.payload)
        self.assertEqual(caught.exception.code, "invoice_result_unknown")
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")
        self.chat.reconcile("agentic", self.payload.attempt_id, self.reference())
        self.profiles.reserve("agentic").release()

    async def test_invalid_hash_never_reaches_core(self):
        self.payload.attachment.sha256 = "0" * 64
        with self.assertRaises(ServiceError):
            await self.service.execute("agentic", self.payload)
        self.agentic.analyze_invoice.assert_not_awaited()
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")

    async def test_postdispatch_failure_closed_receipt_requires_reconciliation(self):
        async def broken(path, **options):
            options["progress_callback"]("provider_request_started")
            raise RuntimeError("PRIVATE provider response")
        self.agentic.analyze_invoice.side_effect = broken
        with self.assertRaises(ServiceError) as caught:
            await self.service.execute("agentic", self.payload)
        self.assertEqual(caught.exception.code, "invoice_result_unknown")
        self.assertNotIn("PRIVATE", str(caught.exception))
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")
        with self.assertRaises(ServiceError):
            self.profiles.reserve("agentic")
        self.chat.reconcile("agentic", self.payload.attempt_id, self.reference())
        self.profiles.reserve("agentic").release()

    async def test_unclosed_process_never_gets_terminal_proof(self):
        self.agentic.runner._processes.add(object())
        with self.assertRaises(ServiceError):
            await self.service.execute("agentic", self.payload)
        proof = self.chat.ledger.read(self.payload.attempt_id)
        self.assertEqual(proof.state, "dispatch_armed")
        self.assertIsNone(proof.terminal_proof_id)
        with self.assertRaises(ServiceError):
            self.chat.reconcile("agentic", self.payload.attempt_id, self.reference())

    async def test_cancel_after_dispatch_propagates_and_quarantines(self):
        entered = asyncio.Event()
        async def pending(path, **options):
            options["progress_callback"]("provider_request_started")
            entered.set()
            await asyncio.Future()
        self.agentic.analyze_invoice.side_effect = pending
        task = asyncio.create_task(self.service.execute("agentic", self.payload))
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")
        self.assertNotIn(self.payload.attempt_id, self.chat.active_attempts)
        self.assertEqual(list(self.inspector.directory.iterdir()), [])
        with self.assertRaises(ServiceError):
            self.profiles.reserve("agentic")

    async def test_cancel_preflight_has_closed_receipt_and_requires_reconciliation(self):
        entered = asyncio.Event()
        async def pending(path, **options):
            entered.set()
            await asyncio.Future()
        self.agentic.analyze_invoice.side_effect = pending
        task = asyncio.create_task(self.service.execute("agentic", self.payload))
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")
        self.chat.reconcile("agentic", self.payload.attempt_id, self.reference())
        self.profiles.reserve("agentic").release()

    async def test_cancel_durable_write_failure_keeps_original_cancel_and_armed_receipt(self):
        async def pending(path, **options):
            options["progress_callback"]("provider_request_started")
            raise asyncio.CancelledError()
        self.agentic.analyze_invoice.side_effect = pending
        with patch.object(self.chat.ledger, "close", side_effect=OSError("private path")):
            with self.assertRaises(asyncio.CancelledError):
                await self.service.execute("agentic", self.payload)
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "dispatch_armed")
        with self.assertRaises(ServiceError):
            self.profiles.reserve("agentic")

    async def test_timeout_postdispatch_is_unknown_not_retry(self):
        async def timeout(path, **options):
            options["progress_callback"]("provider_request_started")
            raise TimeoutError("private provider")
        self.agentic.analyze_invoice.side_effect = timeout
        with self.assertRaises(ServiceError) as caught:
            await self.service.execute("agentic", self.payload)
        self.assertEqual(caught.exception.code, "invoice_result_unknown")
        self.agentic.analyze_invoice.assert_awaited_once()

    async def test_second_provider_request_is_blocked_before_second_io(self):
        calls = []
        async def recovery(path, **options):
            for _ in range(2):
                options["progress_callback"]("provider_request_started")
                calls.append("generative IO")
            return RESULT
        self.payload = self.request("agentic")
        self.agentic.analyze_invoice.side_effect = recovery
        with self.assertRaises(ServiceError):
            await self.service.execute("agentic", self.payload)
        self.assertEqual(calls, ["generative IO"])
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")

    async def test_session_change_before_actual_io_keeps_old_identity_receipt(self):
        async def changed(path, **options):
            self.agentic.session_generation = "d" * 32
            options["progress_callback"]("provider_request_started")
            self.fail("Changed identity dispatched")
        self.agentic.analyze_invoice.side_effect = changed
        with self.assertRaises(ServiceError) as caught:
            await self.service.execute("agentic", self.payload)
        self.assertEqual(caught.exception.code, "invoice_result_unknown")
        proof = self.chat.ledger.read(self.payload.attempt_id)
        self.assertEqual(proof.state, "abandoned_unknown")
        self.assertEqual(proof.session_generation, self.payload.session_generation)

    async def test_ledger_fsync_failure_after_replace_keeps_durable_marker_and_never_calls_core(self):
        with patch.object(self.chat.ledger, "sync_directory", side_effect=OSError("private fsync")):
            with self.assertRaises(ServiceError) as caught:
                await self.service.execute("agentic", self.payload)
        self.assertEqual(caught.exception.code, "invoice_result_unknown")
        self.agentic.analyze_invoice.assert_not_awaited()
        proof = self.chat.ledger.read(self.payload.attempt_id)
        self.assertEqual(proof.state, "dispatch_armed")
        self.assertIsNone(proof.terminal_proof_id)
        restarted = ProfileAdmission(self.root / "agentic", self.root / "state")
        with self.assertRaises(ServiceError):
            restarted.reserve("agentic")

    async def test_oversized_reply_fails_closed_instead_of_truncating(self):
        async def large(path, **options):
            options["progress_callback"]("provider_request_started")
            return {**RESULT, "data": {"issue_date": "", "items": [{"name": "x" * 1024}] * 100}}
        self.agentic.analyze_invoice.side_effect = large
        with self.assertRaises(ServiceError) as caught:
            await self.service.execute("agentic", self.payload)
        self.assertEqual(caught.exception.code, "invoice_result_unknown")
        self.assertEqual(self.chat.ledger.read(self.payload.attempt_id).state, "abandoned_unknown")

    def test_closed_input_rejects_audio_extra_noncanonical_id_and_oversize(self):
        raw = self.payload.model_dump()
        for changed in ({"attempt_id": "not-uuid"}, {"callback_url": "https://forbidden.invalid"},
                        {"timeout_seconds": 121}, {"tax": float("nan")}):
            with self.subTest(changed=changed.keys()), self.assertRaises(ValidationError):
                InvoiceTurnRequest.model_validate({**raw, **changed})
        for item in ({**raw["attachment"], "kind": "audio", "media_type": "audio/wav"},
                     {**raw["attachment"], "kind": "image", "media_type": "audio/wav"},
                     {**raw["attachment"], "content_base64": "AAAA" * ((10 * 1024 * 1024) // 3 + 1)}):
            with self.assertRaises(ValidationError):
                InvoiceTurnRequest.model_validate({**raw, "attachment": item})
        with self.assertRaises(ServiceError):
            parse_invoice_turn(b'{"attempt_id":"a","attempt_id":"b"}')

    def test_import_has_no_runtime_construction(self):
        import native_invoice_analysis
        with patch("nodia_ai_chat.ChatAdapter", side_effect=AssertionError("runtime at import")), \
             patch("profile_admission.ProfileAdmission", side_effect=AssertionError("profile at import")):
            importlib.reload(native_invoice_analysis)


class InvoicePrivateBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def exercise(self, path, body, token):
        import os
        from request_guard import PrivateRequestGuard
        from test_support import TOKEN
        messages, called = [], []
        scope = {"type": "http", "method": "POST", "path": path, "query_string": b"",
            "headers": [(b"x-nodia-service-token", token.encode())] if token else []}
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}
        async def downstream(scope, receive, send):
            called.append((await receive())["body"])
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})
        async def send(message):
            messages.append(message)
        with patch.dict(os.environ, {"GEMINI_SERVICE_TOKEN": TOKEN}):
            await PrivateRequestGuard(downstream)(scope, receive, send)
        return messages, called

    async def test_private_auth_precedes_body_and_parser(self):
        for token in (None, "wrong"):
            sent, called = await self.exercise("/nodia-ai/agentic/invoice/turn", b"not json", token)
            self.assertEqual(sent[0]["status"], 401)
            self.assertEqual(called, [])

    async def test_only_agentic_exact_route_receives_bounded_invoice_size(self):
        from native_invoice_analysis import MAX_REQUEST_BYTES
        from test_support import TOKEN
        for engine in ("agentic",):
            path = f"/nodia-ai/{engine}/invoice/turn"
            sent, called = await self.exercise(path, b"x" * 300001, TOKEN)
            self.assertEqual(sent[0]["status"], 200)
            self.assertEqual(len(called[0]), 300001)
            sent, called = await self.exercise(path, b"x" * (MAX_REQUEST_BYTES + 1), TOKEN)
            self.assertEqual(sent[0]["status"], 413)
            self.assertEqual(called, [])
        sent, called = await self.exercise("/nodia-ai/unknown/invoice/turn", b"x" * 300001, TOKEN)
        self.assertEqual(sent[0]["status"], 413)

    def test_route_registration_has_closed_response_and_no_runtime_start(self):
        from main import create_app
        application = create_app()
        route = next(route for route in application.routes if getattr(route, "path", None) == "/nodia-ai/{engine}/invoice/turn")
        self.assertEqual(set(route.response_model.model_fields), {"extraction", "native"})
