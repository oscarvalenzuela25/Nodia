"""Offline binding/closure controls; no app, VM or provider calls."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch


HERE = Path(__file__).parent
ROOT = HERE.parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    value = importlib.util.module_from_spec(spec)
    with patch('subprocess.run', side_effect=AssertionError('No operating imports')):
        spec.loader.exec_module(value)
    return value


base = load('frozen_cohort', 'nodia-ai-ai38-profile-reattest-modalities-r01.py')
web = load('successor_Web', 'nodia-ai-ai38-post-list-web-modalities-r02.py')


class WebSuccessorGuardTests(unittest.TestCase):
    def setUp(self):
        self.prior = json.loads((ROOT / 'docs/evidence/nodia-ai-ai38-mcp-post-list-modalities-r01.json').read_text())
        self.snapshot = json.loads((ROOT / 'docs/evidence/nodia-ai-ai38-mcp-post-list-web-binding-r01.json').read_text())['snapshot']

    def test_real_prior_seven_attempts_require_ACK_and_no_pending_identity(self):
        with patch('subprocess.run', side_effect=AssertionError('No operating guards')):
            self.assertEqual(len(web.prior_guard(base, self.prior)), 7)
            # Historical aggregate flag also covers an abandoned, acknowledged
            # outcome; closure is determined from each exact native receipt.
            self.assertTrue(self.prior['unknown_native_state'])
            for changed in ({'native_acknowledged': False}, {'native_pending_identity': True}, {'native_outcome': 'dispatch_armed'}):
                invalid = copy.deepcopy(self.prior)
                invalid['cases'][-1]['helper_report'].update(changed)
                with self.subTest(changed=changed), self.assertRaises(base.ControlError):
                    web.prior_guard(base, invalid)

    def test_changed_Web_session_is_required_stable_and_Agentic_proofs_are_preserved(self):
        with patch('subprocess.run', side_effect=AssertionError('No provider operations')):
            binding = web.validate_observed(base, self.snapshot, self.prior, 'web')
            self.assertNotEqual(binding['session_generation'], self.prior['bindings']['web']['session_generation'])
            old = copy.deepcopy(self.snapshot)
            old['observed']['session_generation'] = self.prior['bindings']['web']['session_generation']
            with self.assertRaises(base.ControlError):
                web.validate_observed(base, old, self.prior, 'web')
            changed_again = copy.deepcopy(self.snapshot)
            changed_again['observed']['session_generation'] = 'f' * 32
            with self.assertRaises(base.ControlError):
                web.validate_observed(base, changed_again, self.prior, 'web', binding)
            agentic = copy.deepcopy(self.snapshot)
            agentic['observed'].update(self.prior['bindings']['agentic'], supports_mcp=True,
                                        verified_attachment_media_types=[mime for _, mime in base.FORMATS.values()])
            web.validate_observed(base, agentic, self.prior, 'agentic')
            agentic['observed']['verified_attachment_media_types'] = []
            with self.assertRaises(base.ControlError):
                web.validate_observed(base, agentic, self.prior, 'agentic')


if __name__ == '__main__':
    unittest.main()
