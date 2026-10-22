import test_support
import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,Mock
from uuid import uuid4

from nodia_ai_chat import ChatAdapter,ChatRequest
from native_attempts import ReconcileAttempt,AcknowledgeAttempt,NativeAttemptLedger
from profile_admission import ProfileAdmission
from service_errors import ServiceError


class NativeProofTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root=Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profiles=ProfileAdmission(self.root/'web',None,self.root/'state')
        self.web=SimpleNamespace(is_initialized=True,client=object(),session_generation='a'*32,
            discovered_models=lambda:[SimpleNamespace(model_id='fixture-model')],
            _generate_content=AsyncMock(return_value=SimpleNamespace(text='{"kind":"answer","text":"Hola"}')),
            _persist_live_cookies=Mock())
        self.adapter=ChatAdapter(self.web,None,self.profiles)
        self.request=ChatRequest(attempt_id=str(uuid4()),model_id='fixture-model',effort_id=None,
            canonical_prompt='No business data',resource_key=self.profiles.identity('web'),session_generation='a'*32,timeout_seconds=5)
        self.reference=ReconcileAttempt(resource_key=self.request.resource_key,session_generation='a'*32,operation_ref=self.request.attempt_id)

    async def test_completed_proof_is_idempotent_and_ack_removes_minimal_receipt(self):
        await self.adapter.execute('web',self.request)
        proof=self.adapter.reconcile('web',self.request.attempt_id,self.reference)
        self.assertEqual(proof['outcome'],'completed')
        self.assertTrue(proof['process_closed'])
        self.assertEqual(proof,self.adapter.reconcile('web',self.request.attempt_id,self.reference))
        self.assertNotIn('No business data',list((self.root/'state'/'attempts').glob('*.json'))[0].read_text())
        ack=AcknowledgeAttempt(**self.reference.model_dump(),terminal_proof_id=proof['terminal_proof_id'])
        self.assertTrue(self.adapter.acknowledge('web',self.request.attempt_id,ack)['acknowledged'])
        self.assertTrue(self.adapter.acknowledge('web',self.request.attempt_id,ack)['acknowledged'])
        self.assertEqual(list((self.root/'state'/'attempts').glob('*.json')),[])

    async def test_unknown_closed_transport_reconciles_without_replay_even_after_restart(self):
        self.web._generate_content.side_effect=TimeoutError()
        with self.assertRaises(ServiceError):await self.adapter.execute('web',self.request)
        restarted=ChatAdapter(self.web,None,ProfileAdmission(self.root/'web',None,self.root/'state'))
        proof=restarted.reconcile('web',self.request.attempt_id,self.reference)
        self.assertEqual(proof['outcome'],'abandoned_unknown')
        restarted.profiles.reserve('web').release()
        self.web._generate_content.assert_awaited_once()

    async def test_dispatch_crash_without_terminal_proof_never_clears_marker(self):
        self.adapter.ledger.arm(self.request.attempt_id,'web',self.reference)
        lease=self.profiles.reserve('web')
        self.profiles.arm_dispatch('web',{'attempt_id':self.request.attempt_id,**self.reference.model_dump()})
        self.profiles.quarantine('web');lease.release()
        restarted=ChatAdapter(self.web,None,ProfileAdmission(self.root/'web',None,self.root/'state'))
        with self.assertRaises(ServiceError) as caught:restarted.reconcile('web',self.request.attempt_id,self.reference)
        self.assertEqual(caught.exception.code,'native_operation_active_or_unverified')
        with self.assertRaises(ServiceError):restarted.profiles.reserve('web')

    async def test_old_proof_cannot_release_new_ocr_or_foreign_identity(self):
        await self.adapter.execute('web',self.request)
        lease=self.profiles.reserve('web')
        try:
            with self.assertRaises(ServiceError):self.adapter.reconcile('web',self.request.attempt_id,self.reference)
        finally:lease.release()
        changed=self.reference.model_copy(update={'session_generation':'b'*32})
        with self.assertRaises(ServiceError):self.adapter.reconcile('web',self.request.attempt_id,changed)

    async def test_legacy_unknown_marker_is_never_cleared_by_unrelated_proof(self):
        await self.adapter.execute('web',self.request)
        marker=self.root/'state'/(self.request.resource_key.split(':')[1]+'.unknown')
        marker.write_text('unknown\n')
        with self.assertRaises(ServiceError) as caught:self.adapter.reconcile('web',self.request.attempt_id,self.reference)
        self.assertEqual(caught.exception.code,'native_proof_missing')
        self.assertTrue(marker.exists())
