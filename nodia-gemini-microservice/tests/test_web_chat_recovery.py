"""Pinned SDK stream/history lifecycle with synthetic transport, no network/account."""
import test_support
import asyncio
import builtins
from contextlib import asynccontextmanager
import json
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from loguru import logger

from gemini_webapi import GeminiClient
from gemini_webapi.constants import AccountStatus, Endpoint
from gemini_webapi.exceptions import APIError
from gemini_service import GeminiWebService
from web_chat_recovery import chat_recovery_budget
from web_generation_diagnostics import DiagnosticWebClient, WebGenerationDiagnostics


CID, RID = 'synthetic-new-cid', 'synthetic-new-rid'
TEXT = '{"kind":"answer","text":"literal &quot;answer&quot;"}'


def candidate(text=TEXT, *, complete=True):
    value = [None] * 9
    value[0], value[1], value[8] = 'synthetic-new-rcid', [text], [2 if complete else 1]
    return value


def frame(with_candidate=False):
    body = [None] * 26
    body[1] = [CID, RID]
    if with_candidate:
        body[4] = [candidate()]
    text = json.dumps([['wrb.fr', None, json.dumps(body)]])
    return (")]}'\n" + str(len(text.encode('utf-16-le')) // 2 + 2) + '\n' + text + '\n').encode()


class ChatRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def actual(self, *, direct=False, empty_history=False, cancel_history=False,
                     refusal_source=None):
        client = DiagnosticWebClient('synthetic', 'synthetic')
        client._running, client.account_status = True, AccountStatus.AVAILABLE
        client.timeout, client.watchdog_timeout = 300, 120
        if refusal_source is not None:
            # Isolate the regression from service instances constructed by any
            # earlier test: only this constructor may suppress the SDK marker.
            logger.enable('gemini_webapi')
        service = GeminiWebService()
        service.client = client
        service.is_initialized = True
        self.last_service = service
        self.initial_session_generation = service.session_generation
        trace = WebGenerationDiagnostics('synthetic-attempt')
        calls, history_cids, waits, reinitializations = [], [], [], []
        entered_history = asyncio.Event()
        closed = asyncio.Event()

        class Transport:
            cookies = {}

            async def close(self):
                closed.set()

            async def post(self, endpoint, **kwargs):
                self_outer.assertEqual(endpoint, Endpoint.BATCH_EXEC)
                payload = json.loads(json.loads(kwargs['data']['f.req'])[0][0][1])
                history_cids.append(payload[0])
                entered_history.set()
                if cancel_history:
                    await asyncio.Event().wait()
                turn = [None] * 4
                turn[0], turn[3] = [None, RID], [[candidate(refusal_source or TEXT,
                    complete=refusal_source is None)]]
                body = [] if empty_history else [['wrb.fr', None, json.dumps([[turn]])]]
                return SimpleNamespace(status_code=200, text=json.dumps(body))

            @asynccontextmanager
            async def stream(self, method, endpoint, **kwargs):
                self_outer.assertEqual((method, endpoint), ('POST', Endpoint.GENERATE))
                calls.append((method, endpoint))

                class Response:
                    status_code = 200

                    async def aiter_content(self):
                        yield frame(direct)
                        if not direct:
                            await asyncio.Event().wait()

                yield Response()

        self_outer = self
        transport = Transport()
        client.client = transport

        async def initialize(**kwargs):
            reinitializations.append(kwargs)
            client._running, client.client = True, transport

        async def controlled_wait(awaitable, timeout):
            waits.append(timeout)
            if len(waits) == 1 or direct:
                return await awaitable
            task = asyncio.ensure_future(awaitable)
            await asyncio.sleep(0)
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            raise builtins.TimeoutError()

        # Only transport, startup and maintenance are simulated. The actual SDK
        # _generate, stream parser, @running, _batch_execute, read_chat, candidate
        # parser/validator, and Nodia's structured adapter all execute unchanged.
        patches = [patch.object(GeminiClient, '_sync_activity', AsyncMock()),
                   patch.object(GeminiClient, '_fetch_usage_info', AsyncMock()),
                   patch.object(client, 'init', AsyncMock(side_effect=initialize)),
                   patch('gemini_webapi.client.save_cookies'),
                   patch('gemini_webapi.client.asyncio.wait_for', controlled_wait)]
        if empty_history:
            clock = [0]

            def advance():
                clock[0] += 20
                return clock[0]

            patches.extend([patch('gemini_webapi.client.time.time', advance),
                            patch('gemini_webapi.client.asyncio.sleep', AsyncMock())])
        for entry in patches:
            entry.start()
            self.addCleanup(entry.stop)
        operation = asyncio.create_task(service._generate_content(
            'synthetic fresh prompt', diagnostics=trace, preserve_structured_text=True,
            chat_budget_seconds=120))
        if cancel_history:
            await entered_history.wait()
            operation.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await operation
            result = None
        elif empty_history:
            with self.assertRaises(APIError):
                await operation
            result = None
        else:
            result = await operation
        self.assertEqual(len(calls), 1)
        self.assertEqual(client.watchdog_timeout, 120)
        self.assertEqual(client.timeout, 300)
        self.assertTrue(all(value == CID for value in history_cids))
        self.assertTrue(all(value == 60 for value in waits))
        self.assertTrue(all(value['watchdog_timeout'] == 55 for value in reinitializations))
        self.assertIsNone(client._nodia_generation_trace)
        return result, trace.snapshot(), history_cids, closed.is_set()

    async def test_actual_SDK_recovers_same_fresh_CID_once_and_preserves_structured_text(self):
        output, trace, cids, closed = await self.actual()
        self.assertEqual(output.text, TEXT)
        self.assertEqual(output.metadata, [CID, RID])
        self.assertEqual(cids, [CID])
        self.assertTrue(closed)
        self.assertEqual(trace['recovery_calls'], 1)
        self.assertEqual(trace['candidate_outputs'], 1)
        self.assertTrue(trace['structured_text']['last_equal'])
        self.assertNotIn(CID, json.dumps(trace))
        self.assertNotIn(TEXT, json.dumps(trace))
        self.assertTrue(self.last_service.is_initialized)
        self.assertEqual(self.last_service.session_generation, self.initial_session_generation)

    async def test_actual_SDK_success_without_recovery_restores_original_settings(self):
        output, trace, cids, closed = await self.actual(direct=True)
        self.assertEqual(output.text, TEXT)
        self.assertEqual(trace['recovery_calls'], 0)
        self.assertEqual(cids, [])
        self.assertFalse(closed)

    async def test_actual_SDK_empty_history_fails_without_regenerating_and_restores(self):
        _, trace, cids, _ = await self.actual(empty_history=True)
        self.assertGreaterEqual(len(cids), 1)
        self.assertEqual(trace['candidate_outputs'], 0)
        self.assertFalse(self.last_service.is_initialized)
        self.assertIsNone(self.last_service.client.client)

    async def test_cancellation_during_history_closes_and_restores_without_replay(self):
        _, trace, cids, closed = await self.actual(cancel_history=True)
        self.assertEqual(cids, [CID])
        self.assertTrue(closed)
        self.assertEqual(trace['candidate_outputs'], 0)
        self.assertFalse(self.last_service.is_initialized)

    async def test_next_explicit_init_after_failed_recovery_rebuilds_and_rotates_generation(self):
        await self.actual(empty_history=True)
        service, previous = self.last_service, self.last_service.client
        replacement = DiagnosticWebClient('synthetic', 'synthetic')
        replacement.account_status = AccountStatus.AVAILABLE
        async def connected(**_options):
            replacement._running = True
            replacement.client = SimpleNamespace(cookies={}, close=AsyncMock())
        replacement.init = AsyncMock(side_effect=connected)
        with (patch('gemini_service.disconnected_state', return_value=False),
              patch('gemini_service.read_session', return_value=None),
              patch.object(service, '_read_env', return_value=('synthetic', 'synthetic', '')),
              patch.object(service, '_persist_live_cookies'),
              patch.object(service, '_persist_periodically', AsyncMock()),
              patch('gemini_service.GeminiClient', return_value=replacement) as factory):
            await service.init_client()
        self.assertIsNot(service.client, previous)
        self.assertIs(service.client, replacement)
        self.assertIsNotNone(replacement.client)
        self.assertTrue(service.is_initialized)
        self.assertNotEqual(service.session_generation, self.initial_session_generation)
        factory.assert_called_once_with('synthetic', 'synthetic')
        replacement.init.assert_awaited_once()
        if service._persist_task:
            await service._persist_task

    async def test_non_chat_error_keeps_existing_OCR_lifecycle_behavior(self):
        service = GeminiWebService()
        client = DiagnosticWebClient('synthetic', 'synthetic')
        service.client, service.is_initialized = client, True
        with patch.object(client, 'generate_content', AsyncMock(side_effect=APIError('synthetic'))):
            with self.assertRaises(APIError):
                await service._generate_content('synthetic OCR caller')
        self.assertTrue(service.is_initialized)

    async def test_actual_SDK_refusal_text_stays_out_of_all_sinks_while_Nodia_diagnostics_remain(self):
        from nodia_ai_chat import _web_diagnostic
        source = '{"kind":"answer","text":"synthetic-private-refusal-marker &quot;no&quot;"}'
        observed = []
        sink = logger.add(lambda message: observed.append(str(message)), level='TRACE')
        try:
            output, trace, cids, _ = await self.actual(refusal_source=source)
            _web_diagnostic('progress', {'attempt_id': 'synthetic-nodia-visible',
                'phase': 'generation_started', 'task_role': 'generation', 'elapsed_ms': 0})
        finally:
            logger.disable('gemini_webapi')
            logger.remove(sink)
        self.assertEqual(output.text, source)
        self.assertEqual(cids, [CID])
        self.assertTrue(trace['structured_text']['last_equal'])
        emitted = '\n'.join(observed)
        self.assertNotIn('synthetic-private-refusal-marker', emitted)
        self.assertNotIn(CID, emitted)
        self.assertNotIn('gemini_webapi', emitted)
        self.assertIn('synthetic-nodia-visible', emitted)

    async def test_no_budget_preserves_OCR_client_without_reading_or_changing_attributes(self):
        with chat_recovery_budget(object(), None):
            pass
        client = SimpleNamespace(timeout=300, watchdog_timeout=120)
        with chat_recovery_budget(client, None):
            self.assertEqual((client.timeout, client.watchdog_timeout), (300, 120))

    async def test_small_budget_never_increases_timeouts_and_restores_on_error(self):
        client = SimpleNamespace(timeout=0.25, watchdog_timeout=0.5)
        with self.assertRaises(RuntimeError):
            with chat_recovery_budget(client, 0.1):
                self.assertEqual((client.timeout, client.watchdog_timeout), (0.25, 0.5))
                raise RuntimeError('synthetic')
        self.assertEqual((client.timeout, client.watchdog_timeout), (0.25, 0.5))
        client.watchdog_timeout = 120
        with chat_recovery_budget(client, 2):
            self.assertEqual(client.watchdog_timeout, 1)
        self.assertEqual(client.watchdog_timeout, 120)

    async def test_invalid_budgets_fail_before_mutating_settings(self):
        client = SimpleNamespace(timeout=300, watchdog_timeout=120)
        for value in (True, 0, -1, float('inf'), float('nan'), '120'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                with chat_recovery_budget(client, value):
                    self.fail('invalid budget entered')
            self.assertEqual((client.timeout, client.watchdog_timeout), (300, 120))
