"""Actual service/ChatAdapter with synthetic metadata CLI only; no account or generation."""
import test_support
import asyncio
import unittest
import test_agentic_option_evidence_cache as base
from service_errors import ServiceError

class FreshnessTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp=base.OptionEvidenceTests.asyncSetUp
    asyncTearDown=base.OptionEvidenceTests.asyncTearDown
    task=base.OptionEvidenceTests.task
    count=base.OptionEvidenceTests.count
    observe=base.OptionEvidenceTests.observe
    warm=base.OptionEvidenceTests.warm

    async def test_missing_or_expired_identity_never_checks_option_or_returns_positive(self):
        for warm in (False,True):
            if warm:
                await self.warm();self.clock.now+=30
            with self.assertRaises(ServiceError) as error:
                await self.service.validate_model_option('fixture-one','high','a'*64)
            self.assertEqual(error.exception.code,'agentic_session_unverified')
            self.assertEqual(self.count(),0)
            self.assertIsNone(self.service._evidence_snapshot())

    async def test_identity_becoming_none_after_successful_model_is_rejected(self):
        await self.warm();barrier=self.runner.pause()
        task=self.task(self.observe());await asyncio.wait_for(barrier.entered.wait(),2)
        self.runner.config.binary.unlink();barrier.release.set()
        result=await task
        self.assertFalse(result['available']);self.assertEqual(result['reason'],'agentic_session_unverified')
        self.assertEqual(self.count(),1);self.assertEqual(self.service._model_option_evidence,{})

    async def test_miss_renews_aging_pair_once_before_option_without_extending_old_TTL(self):
        self.runner.models_advance=7;await self.warm()
        self.clock.now=125;self.runner.option_advance=6
        result=await self.observe()
        self.assertTrue(result['available']);self.assertEqual(self.runner.calls,['usage','models','usage','models','option'])
        self.assertEqual(self.service._usage_evidence[0],125);self.assertEqual(self.service._models_evidence[0],132)
        self.assertEqual(next(iter(self.service._model_option_evidence.values()))[2],155)
        self.assertEqual(self.clock.now,138);self.assertEqual(self.runner.maximum,1)

    async def test_partial_pair_that_would_expire_during_refresh_is_revalidated_first(self):
        self.runner.models_advance=7;await self.warm();self.clock.now=130
        result=await self.service.get_status()
        self.assertTrue(result['has_active_session']);self.assertEqual(self.runner.calls,['usage','models','usage','models'])
        self.assertEqual(self.service._observed,130)
        self.clock.now=160;self.assertIsNone(self.service._evidence_snapshot())

    async def test_valid_cache_hit_near_expiry_does_not_refresh_or_run_CLI(self):
        await self.warm();await self.observe();before=list(self.runner.calls)
        self.clock.now=129.9;self.assertTrue((await self.observe())['available'])
        self.assertEqual(self.runner.calls,before);self.assertEqual(self.service._observed,100)

    async def test_shared_refresh_with_insufficient_headroom_stops_without_another_refresh(self):
        await self.warm();self.service._models_evidence=None;self.clock.now=115
        entered,release=asyncio.Event(),asyncio.Event();run=self.runner.run
        async def paused(args,**kw):
            if args==['models']:entered.set();await release.wait()
            return await run(args,**kw)
        self.runner.run=paused
        self.service._refresh=self.task(self.service._observe())
        await asyncio.wait_for(entered.wait(),2)
        reader=self.task(self.service.get_status(minimum_remaining=10));await asyncio.sleep(0)
        self.clock.now=126;release.set();result=await reader
        self.assertFalse(result['has_active_session']);self.assertEqual(result['reason'],'agentic_session_unverified')
        self.assertEqual(self.runner.calls,['usage','models','models']);self.assertEqual(self.count(),0)

    async def test_failed_metadata_renewal_stops_before_option(self):
        await self.warm();self.clock.now=125;run=self.runner.run
        async def invalid_usage(args,**kw):
            if '/usage' in args:
                self.runner.calls.append('usage');return base.report('usage',{'groups':[]}),0
            return await run(args,**kw)
        self.runner.run=invalid_usage
        # Invalid authentication metadata changes the evidence epoch: abort this old observer.
        with self.assertRaises(asyncio.CancelledError):await self.observe()
        self.assertIsNone(self.service._evidence_snapshot())
        self.assertEqual(self.count(),0);self.assertEqual(self.runner.calls,['usage','models','usage'])

    async def test_cancellation_before_missing_identity_is_still_cancellation(self):
        async def cancelled():
            asyncio.current_task().cancel()
            return await self.service.validate_model_option('fixture-one','high','a'*64)
        with self.assertRaises(asyncio.CancelledError):await self.task(cancelled())
        self.assertEqual(self.runner.calls,[])

    async def test_option_proof_still_refuses_TTL_expiry_during_command(self):
        await self.warm();barrier=self.runner.pause()
        task=self.task(self.observe());await asyncio.wait_for(barrier.entered.wait(),2)
        self.clock.now=130;barrier.release.set();result=await task
        self.assertFalse(result['available']);self.assertEqual(result['reason'],'agentic_session_unverified')
        self.assertEqual(self.count(),1);self.assertEqual(self.service._model_option_evidence,{})

if __name__=='__main__':unittest.main()
