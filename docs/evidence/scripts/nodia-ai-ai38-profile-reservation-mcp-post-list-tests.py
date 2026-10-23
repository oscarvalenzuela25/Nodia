"""Offline guards for deliberate new canary; never execute the frozen live driver."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


SCRIPT = Path(__file__).with_name('nodia-ai-ai38-profile-reservation-mcp-post-list.py')
spec = importlib.util.spec_from_file_location('MCP_post_list_control', SCRIPT)
module = importlib.util.module_from_spec(spec)
with patch('subprocess.run', side_effect=AssertionError('Import cannot operate')):
    spec.loader.exec_module(module)
ROOT = SCRIPT.parents[3]


class NewDiagnosticControlsTests(unittest.TestCase):
    def setUp(self):
        self.prior = module.read_pinned(ROOT / 'docs/evidence/nodia-ai-ai38-profile-reservation-mcp-r01.json', module.PRIOR_SHA)
        self.terminal = module.read_pinned(ROOT / 'docs/evidence/nodia-ai-ai38-profile-reservation-mcp-terminal-r02.json', module.TERMINAL_SHA)
        self.epoch, self.attempt = module.validate_prior(self.prior, self.terminal)

    def test_no_live_call_without_ACK_explicit_GO_or_same_exact_epoch(self):
        prior = copy.deepcopy(self.prior)
        prior['native_result']['native_pending_identity'] = True
        with self.assertRaises(ValueError):
            module.validate_prior(prior, self.terminal)
        prior = copy.deepcopy(self.prior)
        prior['native_result']['native_terminal_proof_acknowledged'] = False
        with self.assertRaises(ValueError):
            module.validate_prior(prior, self.terminal)
        base = SimpleNamespace(epoch=Mock(return_value={**self.epoch, 'started_at': 'different_process_epoch'}), run=Mock())
        args = SimpleNamespace(execute_one_new_diagnostic=False, expected_image=self.epoch['image'], harness=Path('synthetic'))
        with self.assertRaises(ValueError):
            module.execute_once(base, args, self.prior, self.terminal)
        base.epoch.assert_not_called()
        args.execute_one_new_diagnostic = True
        with self.assertRaises(ValueError):
            module.execute_once(base, args, self.prior, self.terminal)
        base.run.assert_not_called()

    def test_exactly_one_deliberate_call_new_identity_and_existing_work_blocks_replay(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary) / 'new_work'
            args = SimpleNamespace(execute_one_new_diagnostic=True, expected_image=self.epoch['image'], harness=Path('synthetic'))

            def fake_run(invocation):
                self.assertEqual(set(vars(invocation)), {'expected_image', 'harness', 'execute_one_live'})
                self.assertTrue(invocation.execute_one_live)
                work.mkdir()
                (work / 'public-report.json').write_text(json.dumps({'status': 'failed_no_replay', 'native_result': {
                    'diagnostics': {'attempt_id': '12345678-1234-1234-1234-123456789012'}}}))
                return 1

            base = SimpleNamespace(epoch=Mock(return_value=self.epoch), run=Mock(side_effect=fake_run))
            with patch.object(module, 'WORK', work), patch('subprocess.run', side_effect=AssertionError('No provider subprocess in unit test')):
                self.assertEqual(module.execute_once(base, args, self.prior, self.terminal), 1)
                base.run.assert_called_once()
                receipt = json.loads((work / 'post-list-control.json').read_text())
                self.assertFalse(receipt['prior_identity_passed_to_harness'])
                self.assertEqual(receipt['maximum_new_generations'], 1)
                self.assertEqual(receipt['automatic_retries'], 0)
                self.assertNotEqual(receipt['prior_closed_attempt_id'], receipt['new_attempt_id'])
                with self.assertRaises(ValueError):
                    module.execute_once(base, args, self.prior, self.terminal)
                base.run.assert_called_once()


if __name__ == '__main__':
    unittest.main()
