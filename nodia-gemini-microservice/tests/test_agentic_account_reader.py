"""Synthetic account binding and the actual shared Products OCR core; no CLI or SDK."""
import test_support
import asyncio
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from agentic_cli import CliConfig, cli_environment, prepare_cli_home
from agentic_service import AntigravityAgentService
from agentic_tool_gate import decide
from native_execution_agents import NATIVE_READER_AGENT, NATIVE_READER_AGENT_DOCUMENT
from service_errors import ServiceError
from test_support import RESULT


NAMES = ("antigravity-oauth-token", "installation_id")


def symlinks_available(root):
    source, target = root / 'link-source', root / 'link-target'
    source.write_bytes(b'synthetic')
    try:
        target.symlink_to(source)
    except OSError as error:
        if os.name == 'nt' and getattr(error, 'winerror', None) == 1314:return False
        raise
    target.unlink();source.unlink()
    return True


class AccountBindingTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.account = self.root / 'account'
        self.credentials = self.account / '.gemini/antigravity-cli'
        self.credentials.mkdir(parents=True)
        for name in NAMES:
            (self.credentials / name).write_bytes(b'synthetic-account-' + name.encode())
        (self.credentials / 'settings.json').write_bytes(b'account-settings-untouched')
        (self.credentials / 'unrelated').write_bytes(b'not-shared')
        self.snapshot = {p.name: p.read_bytes() for p in self.credentials.iterdir()}
        self.mode_snapshot = {p.name: p.stat().st_mode for p in self.credentials.iterdir()}
        self.has_symlinks = symlinks_available(self.root)

    def assert_account_unchanged(self):
        self.assertEqual({p.name: p.read_bytes() for p in self.credentials.iterdir()}, self.snapshot)
        self.assertEqual({p.name: p.stat().st_mode for p in self.credentials.iterdir()}, self.mode_snapshot)

    def test_exact_two_links_without_reading_or_copying_credentials_and_cleanup(self):
        if not self.has_symlinks:self.skipTest('Windows symlink privilege unavailable; real links require Linux validation')
        home = self.root / 'job/profile'
        original_read_bytes, original_read_text = Path.read_bytes, Path.read_text
        def no_credential_bytes(path):
            if path.name in NAMES:
                raise AssertionError('credential content must not be read')
            return original_read_bytes(path)
        def no_credential_text(path, *args, **kwargs):
            if path.name in NAMES:
                raise AssertionError('credential content must not be read')
            return original_read_text(path, *args, **kwargs)
        with patch.object(Path, 'read_bytes', no_credential_bytes), patch.object(Path, 'read_text', no_credential_text):
            prepare_cli_home(home, account_home=self.account)
        profile = home / '.gemini/antigravity-cli'
        for name in NAMES:
            self.assertTrue((profile / name).is_symlink())
            self.assertEqual((profile / name).resolve(), (self.credentials / name).resolve())
        self.assertFalse((profile / 'unrelated').exists())
        environment = cli_environment(home, {'PRIVATE_KEY': 'never-forward', 'HOME': 'old'})
        self.assertEqual(environment['HOME'], str(home))
        self.assertNotIn('PRIVATE_KEY', environment)
        import shutil
        shutil.rmtree(home.parent)
        self.assert_account_unchanged()

    def test_existing_file_or_dangling_link_refuses_without_overwriting_account(self):
        for kind in ('file', 'dangling'):
            if kind == 'dangling' and not self.has_symlinks:continue
            home = self.root / kind
            profile = home / '.gemini/antigravity-cli'; profile.mkdir(parents=True)
            destination = profile / NAMES[1]
            if kind == 'file':
                destination.write_bytes(b'owned-other-state')
            else:
                destination.symlink_to(self.root / 'missing')
            with self.assertRaisesRegex(ValueError, 'destination already exists'):
                prepare_cli_home(home, account_home=self.account)
            self.assertFalse((profile / NAMES[0]).exists())
            if kind == 'file':self.assertEqual(destination.read_bytes(), b'owned-other-state')
            else:self.assertTrue(destination.is_symlink())
            self.assert_account_unchanged()

    def test_account_itself_or_escaping_profile_is_rejected_before_settings_write(self):
        with self.assertRaisesRegex(ValueError, 'separate private CLI home'):
            prepare_cli_home(self.account, account_home=self.account)
        self.assert_account_unchanged()
        if not self.has_symlinks:return
        home = self.root / 'escape';home.mkdir()
        (home / '.gemini').symlink_to(self.account / '.gemini', target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'separate private CLI home'):
            prepare_cli_home(home, account_home=self.account)
        self.assert_account_unchanged()

    def test_partial_link_error_removes_only_links_created_by_this_call(self):
        if not self.has_symlinks:self.skipTest('Windows symlink privilege unavailable; real partial-link cleanup requires Linux validation')
        home = self.root / 'partial'
        original = Path.symlink_to
        def fail_second(path, target, *args, **kwargs):
            if path.name == NAMES[1]:raise OSError('synthetic second-link failure')
            return original(path, target, *args, **kwargs)
        with patch.object(Path, 'symlink_to', fail_second), self.assertRaises(OSError):
            prepare_cli_home(home, account_home=self.account)
        self.assertFalse((home / '.gemini/antigravity-cli' / NAMES[0]).is_symlink())
        self.assert_account_unchanged()


class InvoiceRunner:
    def __init__(self, account):
        self.config = CliConfig(Path(sys.executable), '', account, timeout=120)
        self.mode = 'success'
        self.generation_calls = 0
        self.entered = asyncio.Event()
        self.workspace = None

    async def run(self, args, **kwargs):
        if '/model' in args:
            return json.dumps({'status': 'SUCCESS', 'num_turns': 0,
                'usage': {'total_tokens': 0},
                'command': {'name': 'model', 'data': {'id': 'fixture-model'}}}), 0
        self.generation_calls += 1
        self.workspace = kwargs['cwd']
        home = kwargs['home']
        for name in NAMES:
            path = home / '.gemini/antigravity-cli' / name
            source = self.config.home / '.gemini/antigravity-cli' / name
            if source.is_file():assert path.is_symlink() and path.resolve() == source.resolve()
            else:assert not path.exists()
        assert args[args.index('--agent') + 1] == NATIVE_READER_AGENT
        role = self.workspace / '.agents/agents' / NATIVE_READER_AGENT / 'agent.md'
        assert role.read_text(encoding='utf-8') == NATIVE_READER_AGENT_DOCUMENT
        policy = json.loads((home / '.gemini/antigravity-cli/settings.json').read_text(encoding='utf-8'))
        document = self.workspace / 'invoice.pdf'
        for name, expected in [('view_file', True), ('finish', True), ('run_command', False), ('call_mcp_tool', False)]:
            assert decide({'toolCall': {'name': name, 'args': {'AbsolutePath': str(document)}}}, document)[1] is expected
        assert 'mcp(*)' in policy['permissions']['deny']
        self.entered.set()
        if self.mode == 'cancel':
            await asyncio.Event().wait()
        if self.mode == 'timeout':
            raise ServiceError('agentic_timeout', 'Safe timeout', 504)
        initialization = {'model': 'fixture-model', 'agent': NATIVE_READER_AGENT}
        if self.mode == 'wrong_role':initialization['agent'] = 'other-role'
        if self.mode == 'missing_role':initialization.pop('agent')
        if self.mode == 'wrong_model':initialization['model'] = 'other-model'
        events = [{'event': 'init', 'init': initialization}]
        if self.mode == 'missing_init':events = []
        if self.mode == 'duplicate_init':events.append(events[0])
        info = {'parameters': {'AbsolutePath': str(document)}}
        if self.mode == 'read_error':info['error'] = {}
        if self.mode == 'wrong_file':info['parameters']['AbsolutePath'] = str(self.config.home / 'other.pdf')
        events.append({'event': 'step_update', 'step_update': {'tool_name': 'view_file',
                       'state': 'ACTIVE' if self.mode == 'incomplete_read' else 'DONE', 'tool_info': info}})
        if self.mode == 'unexpected_tool':events.append({'event': 'step_update', 'step_update': {'tool_name': 'run_command'}})
        events.append({'event': 'step_update', 'step_update': {'tool_name': 'finish', 'state': 'DONE'}})
        result = {'status': 'SUCCESS', 'structured_output': RESULT}
        if self.mode == 'failure':
            events = []
            result = {'status': 'ERROR', 'error': 'PRIVATE_VENDOR_FAILURE'}
        events.append({'event': 'result', 'result': result})
        (home / 'tool_receipts.jsonl').write_text('\n'.join(json.dumps({'tool': name, 'allowed': True})
            for name in ('view_file', 'finish')), encoding='utf-8', newline='\n')
        return '\n'.join(json.dumps(event) for event in events), 0


class SharedProductsOcrTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.account = self.root / 'account'
        directory = self.account / '.gemini/antigravity-cli';directory.mkdir(parents=True)
        has_symlinks = symlinks_available(self.root)
        if has_symlinks:
            for name in NAMES:(directory / name).write_bytes(b'synthetic-' + name.encode())
        self.source = self.root / 'source.pdf';self.source.write_bytes(b'%PDF-synthetic')
        self.runner = InvoiceRunner(self.account)
        self.service = AntigravityAgentService(self.runner)
        self.service._available = True
        self.service.get_status = AsyncMock(return_value={'has_active_session': True,
            'models': [{'id': 'fixture-model', 'name': 'Fixture'}]})
        self.snapshot = {name:(directory / name).read_bytes() for name in NAMES if (directory / name).exists()}

    def assert_clean(self):
        self.assertFalse(self.runner.workspace.exists())
        self.assertEqual(self.source.read_bytes(), b'%PDF-synthetic')
        for name, value in self.snapshot.items():
            self.assertEqual((self.account / '.gemini/antigravity-cli' / name).read_bytes(), value)
        self.assertFalse(self.service._analysis_lock.locked())

    async def analyze(self):
        return await self.service.analyze_invoice(self.source, model='fixture-model', thinking_level='low')

    async def test_actual_owned_reader_bound_to_same_account_preserves_zero_and_cleans_profile(self):
        result = await self.analyze()
        self.assertEqual(result['data']['items'][0]['quantity'], 0)
        self.assertEqual(self.runner.generation_calls, 1)
        self.assert_clean()

    async def test_missing_changed_or_duplicate_identity_and_unread_document_fail_closed(self):
        cases = [('wrong_role','agentic_role_mismatch'), ('missing_role','agentic_role_mismatch'),
                 ('missing_init','agentic_role_mismatch'), ('duplicate_init','agentic_role_mismatch'),
                 ('wrong_model','agentic_model_mismatch'), ('unexpected_tool','agentic_tool_policy'),
                 ('read_error','agentic_document_unread'), ('wrong_file','agentic_document_unread'),
                 ('incomplete_read','agentic_document_unread')]
        for mode, expected in cases:
            self.runner.mode = mode
            with self.subTest(mode=mode), self.assertRaises(ServiceError) as caught:
                await self.analyze()
            self.assertEqual(caught.exception.code, expected)
            self.assert_clean()

    async def test_failure_logs_only_closed_code_and_never_retries(self):
        self.runner.mode = 'failure'
        with patch('agentic_service.logger.info') as logs, self.assertRaises(ServiceError) as caught:
            await self.analyze()
        self.assertEqual(caught.exception.code, 'agentic_execution_failed')
        self.assertNotIn('PRIVATE_VENDOR_FAILURE', str(logs.call_args_list))
        self.assertEqual(self.runner.generation_calls, 1)
        self.assert_clean()

    async def test_timeout_or_cancellation_cleans_links_without_replaying_and_releases_lock(self):
        self.runner.mode = 'timeout'
        with self.assertRaises(ServiceError):await self.analyze()
        self.assert_clean()
        self.runner.mode = 'cancel';self.runner.entered.clear()
        task = asyncio.create_task(self.analyze())
        entered = asyncio.create_task(self.runner.entered.wait())
        try:
            await asyncio.wait({task, entered}, return_when=asyncio.FIRST_COMPLETED)
            if task.done():await task
        finally:
            entered.cancel()
            await asyncio.gather(entered, return_exceptions=True)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):await task
        self.assert_clean()
        self.runner.mode = 'success'
        await self.analyze()
        self.assertEqual(self.runner.generation_calls, 3)
        self.assert_clean()


if __name__ == '__main__':unittest.main()
