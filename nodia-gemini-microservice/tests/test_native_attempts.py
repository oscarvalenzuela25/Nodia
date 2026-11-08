import test_support
import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,Mock,patch
from uuid import uuid4

from nodia_ai_chat import Answer,ChatAdapter,ChatRequest
from native_attempts import ReconcileAttempt,AcknowledgeAttempt,NativeAttemptLedger
from profile_admission import ProfileAdmission
from service_errors import ServiceError


class NativeProofTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root=Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profiles=ProfileAdmission(self.root/'agentic',self.root/'state')
        self.agentic=test_support.fake_agentic()
        self.agentic.get_status.return_value['has_active_session']=True
        self.adapter=ChatAdapter(self.agentic,self.profiles)
        self.adapter.agentic_answer=AsyncMock(return_value=Answer(kind='answer',text='Hola'))
        self.request=ChatRequest(attempt_id=str(uuid4()),model_id='fixture-model',effort_id=None,
            canonical_prompt='No business data',resource_key=self.profiles.identity('agentic'),session_generation='a'*32,timeout_seconds=5)
        self.reference=ReconcileAttempt(resource_key=self.request.resource_key,session_generation='a'*32,operation_ref=self.request.attempt_id)

    def agentic_fixture(self, *, process_closed):
        profiles=ProfileAdmission(self.root/'agentic', self.root/'state')
        agentic=SimpleNamespace(session_generation='b'*32,
            runner=SimpleNamespace(_processes=set() if process_closed else {object()}),
            is_available=lambda:True,get_status=AsyncMock(return_value={
                'has_active_session':True,'models':[{'id':'fixture-model'}]}))
        adapter=ChatAdapter(agentic, profiles)
        request=self.request.model_copy(update={'resource_key':profiles.identity('agentic'),'session_generation':'b'*32})
        # Simulate only the external CLI answer. The real closure predicate,
        # profile ownership, durable ledger and execution state remain in use.
        adapter.agentic_answer=AsyncMock(return_value=Answer(kind='answer',text='Synthetic answer'))
        return adapter,profiles,request

    async def test_agentic_reply_without_proven_native_closure_retains_marker_and_quarantine(self):
        adapter,profiles,request=self.agentic_fixture(process_closed=False)
        with patch.object(profiles,'resolve_dispatch',wraps=profiles.resolve_dispatch) as resolve, \
                patch.object(adapter.ledger,'close',wraps=adapter.ledger.close) as close, \
                patch('nodia_ai_chat.logger.warning') as diagnostic:
            with self.assertRaises(ServiceError) as caught:
                await adapter.execute('agentic',request)
        self.assertEqual(caught.exception.code,'chat_result_unknown')
        self.assertEqual(caught.exception.status,502)
        resolve.assert_not_called()
        close.assert_not_called()
        proof=adapter.ledger.read(request.attempt_id)
        self.assertEqual(proof.state,'dispatch_armed')
        self.assertFalse(proof.process_closed)
        self.assertIsNone(proof.terminal_proof_id)
        marker=self.root/'state'/(request.resource_key.split(':')[1]+'.unknown')
        self.assertEqual(json.loads(marker.read_text()),{'attempt_id':request.attempt_id,
            'resource_key':request.resource_key,'session_generation':request.session_generation,
            'operation_ref':request.attempt_id})
        self.assertIn(request.resource_key,profiles._quarantined)
        self.assertNotIn(request.attempt_id,adapter.active_attempts)
        with self.assertRaises(ServiceError) as blocked:
            profiles.reserve('agentic')
        self.assertEqual(blocked.exception.code,'runtime_busy')
        event=json.loads(diagnostic.call_args.args[1])
        self.assertEqual(event['phase'],'terminal_record')
        self.assertEqual(event['failure_category'],'native_operation_active_or_unverified')
        self.assertNotIn(request.canonical_prompt,str(event))
        adapter.agentic_answer.assert_awaited_once()

    async def test_agentic_reply_with_proven_closure_closes_before_releasing_marker(self):
        adapter,profiles,request=self.agentic_fixture(process_closed=True)
        original_resolve=profiles.resolve_dispatch
        def resolve_after_terminal(engine):
            proof=adapter.ledger.read(request.attempt_id)
            self.assertEqual(proof.state,'completed')
            self.assertTrue(proof.process_closed)
            self.assertIsNotNone(proof.terminal_proof_id)
            original_resolve(engine)
        with patch.object(profiles,'resolve_dispatch',side_effect=resolve_after_terminal) as resolve:
            reply=await adapter.execute('agentic',request)
        self.assertEqual(reply.text,'Synthetic answer')
        resolve.assert_called_once_with('agentic')
        self.assertFalse((self.root/'state'/(request.resource_key.split(':')[1]+'.unknown')).exists())
        self.assertNotIn(request.resource_key,profiles._quarantined)
        profiles.reserve('agentic').release()
        adapter.agentic_answer.assert_awaited_once()

    async def test_completed_proof_is_idempotent_and_ack_removes_minimal_receipt(self):
        await self.adapter.execute('agentic',self.request)
        proof=self.adapter.reconcile('agentic',self.request.attempt_id,self.reference)
        self.assertEqual(proof['outcome'],'completed')
        self.assertTrue(proof['process_closed'])
        self.assertEqual(proof,self.adapter.reconcile('agentic',self.request.attempt_id,self.reference))
        self.assertNotIn('No business data',list((self.root/'state'/'attempts').glob('*.json'))[0].read_text())
        ack=AcknowledgeAttempt(**self.reference.model_dump(),terminal_proof_id=proof['terminal_proof_id'])
        self.assertTrue(self.adapter.acknowledge('agentic',self.request.attempt_id,ack)['acknowledged'])
        self.assertTrue(self.adapter.acknowledge('agentic',self.request.attempt_id,ack)['acknowledged'])
        self.assertEqual(list((self.root/'state'/'attempts').glob('*.json')),[])

    async def test_unknown_closed_transport_reconciles_without_replay_even_after_restart(self):
        self.adapter.agentic_answer.side_effect=TimeoutError()
        with self.assertRaises(ServiceError):await self.adapter.execute('agentic',self.request)
        restarted=ChatAdapter(self.agentic, ProfileAdmission(self.root/'agentic', self.root/'state'))
        proof=restarted.reconcile('agentic',self.request.attempt_id,self.reference)
        self.assertEqual(proof['outcome'],'abandoned_unknown')
        restarted.profiles.reserve('agentic').release()
        self.adapter.agentic_answer.assert_awaited_once()

    async def test_dispatch_crash_without_terminal_proof_never_clears_marker(self):
        self.adapter.ledger.arm(self.request.attempt_id,'agentic',self.reference)
        lease=self.profiles.reserve('agentic')
        self.profiles.arm_dispatch('agentic',{'attempt_id':self.request.attempt_id,**self.reference.model_dump()})
        self.profiles.quarantine('agentic');lease.release()
        restarted=ChatAdapter(self.agentic, ProfileAdmission(self.root/'agentic', self.root/'state'))
        marker=self.root/'state'/(self.request.resource_key.split(':')[1]+'.unknown')
        marker_before=marker.read_bytes()
        proof_path=self.root/'state'/'attempts'/(self.request.attempt_id+'.json')
        proof_before=proof_path.read_bytes()
        # Windows rejects the Linux-only FD proof first. Linux may verify that
        # proof but must still reject absent cgroup ownership/closure evidence.
        # Control those OS boundaries explicitly; retain the real ledger,
        # profile marker and reconciliation policy in both cases.
        for invalid_record in (True,False):
            code='native_proof_invalid' if invalid_record else 'native_operation_active_or_unverified'
            with self.subTest(recovery_record_valid=not invalid_record), \
                    patch('nodia_ai_chat.read_recovery_record',
                        side_effect=ServiceError(code,'Synthetic invalid record',409) if invalid_record else None,
                        return_value=proof_before) as read_record, \
                    patch('nodia_ai_chat.require_closed_legacy_chat_owner',
                        side_effect=ServiceError('native_operation_active_or_unverified','Synthetic unverified closure',409)) as closed_owner, \
                    patch.object(restarted.ledger,'close',wraps=restarted.ledger.close) as close, \
                    patch.object(restarted.profiles,'reconcile_dispatch',wraps=restarted.profiles.reconcile_dispatch) as release, \
                    patch.object(restarted,'agentic_answer',new_callable=AsyncMock) as infer:
                with self.assertRaises(ServiceError) as caught:
                    restarted.reconcile('agentic',self.request.attempt_id,self.reference)
                self.assertEqual(caught.exception.code,code)
                self.assertEqual(caught.exception.status,409)
                read_record.assert_called_once()
                if invalid_record:
                    closed_owner.assert_not_called()
                else:
                    closed_owner.assert_called_once_with(restarted.ledger.read(self.request.attempt_id),self.reference,proof_before)
                close.assert_not_called()
                release.assert_not_called()
                infer.assert_not_awaited()
                self.assertEqual(marker.read_bytes(),marker_before)
                self.assertEqual(proof_path.read_bytes(),proof_before)
                proof=restarted.ledger.read(self.request.attempt_id)
                self.assertEqual(proof.state,'dispatch_armed')
                self.assertFalse(proof.process_closed)
                self.assertIsNone(proof.terminal_proof_id)
                with self.assertRaises(ServiceError) as blocked:
                    restarted.profiles.reserve('agentic')
                self.assertEqual(blocked.exception.code,'runtime_busy')

    async def test_old_proof_cannot_release_new_ocr_or_foreign_identity(self):
        await self.adapter.execute('agentic',self.request)
        lease=self.profiles.reserve('agentic')
        try:
            with self.assertRaises(ServiceError):self.adapter.reconcile('agentic',self.request.attempt_id,self.reference)
        finally:lease.release()
        changed=self.reference.model_copy(update={'session_generation':'b'*32})
        with self.assertRaises(ServiceError):self.adapter.reconcile('agentic',self.request.attempt_id,changed)

    async def test_legacy_unknown_marker_is_never_cleared_by_unrelated_proof(self):
        await self.adapter.execute('agentic',self.request)
        marker=self.root/'state'/(self.request.resource_key.split(':')[1]+'.unknown')
        marker.write_text('unknown\n')
        marker.chmod(0o600)  # Match an actual private legacy marker.
        with self.assertRaises(ServiceError) as caught:self.adapter.reconcile('agentic',self.request.attempt_id,self.reference)
        self.assertEqual(caught.exception.code,'native_proof_missing')
        self.assertTrue(marker.exists())
