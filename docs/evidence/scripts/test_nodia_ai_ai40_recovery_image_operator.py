"""Pure delegation tests: no VM, SDK, profile, SQL, original image or oracle reads."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('recovery_image_successor', Path(__file__).with_name('nodia-ai-ai40-recovery-image-operator-r01.py'))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
BASE = Path(__file__).with_name('nodia-ai-ai40-r07-image-operator-r01.py')


class RecoveryImageDelegation(unittest.TestCase):
    def test_only_workspace_and_identity_change_and_original_arguments_are_delegated_once(self):
        args = SimpleNamespace(phase='preflight', mime='png', operator_sha256='synthetic-fixture-pin', authorize_one_real_generation=False)
        calls = []
        original = SimpleNamespace(FIXTURES=object(), GUARD=object(), PRIVATE_SHA=object(), INSPECTOR=object())
        untouched = original.__dict__.copy()

        def run(value):
            calls.append(value)
            self.assertIs(value, args)
            self.assertEqual(original.WORK, Path('/opt/nodia/verification/ai40-recovery-images-r01'))
            self.assertEqual(original.__file__, str(Path(MODULE.__file__).resolve()))
            for key, expected in untouched.items():
                self.assertIs(getattr(original, key), expected)
            return {'status': 'preflight_passed', 'fresh_private_fixtures': True,
                    'inherited_image_protocol_sha256': 'synthetic-inherited-pin'}, 0

        original.run = run
        loader = SimpleNamespace(exec_module=lambda value: self.assertIs(value, original))
        with patch.object(MODULE, 'BASE', BASE), patch.object(MODULE.importlib.util, 'spec_from_file_location', return_value=SimpleNamespace(loader=loader)), patch.object(MODULE.importlib.util, 'module_from_spec', return_value=original):
            result, code = MODULE.run(args)
        self.assertEqual(calls, [args])
        self.assertEqual(code, 0)
        self.assertEqual(result['schema'], 'nodia-ai-ai40-recovery-image-operator-v1')
        self.assertEqual(result['inherited_R07_operator_sha256'], MODULE.BASE_SHA)
        self.assertEqual(result['inherited_image_protocol_sha256'], 'synthetic-inherited-pin')
        self.assertFalse(result['fresh_private_fixtures'])
        self.assertTrue(result['exact_R07_synthetic_fixtures_reused'])
        self.assertFalse(result['consumed_runs_or_intents_replayed'])

    def test_changed_parent_is_rejected_before_import_or_dispatch(self):
        with patch.object(MODULE, 'BASE', BASE), patch.object(MODULE, 'BASE_SHA', '0' * 64), patch.object(MODULE.importlib.util, 'spec_from_file_location') as importer:
            with self.assertRaisesRegex(ValueError, '^immutable_r07_image_operator_pin_mismatch$'):
                MODULE.run(SimpleNamespace())
            importer.assert_not_called()

    def test_original_failure_is_propagated_without_another_call(self):
        calls = []
        failure = ValueError('generation_intention_already_consumed')
        def run(args):
            calls.append(args)
            raise failure
        original = SimpleNamespace(run=run)
        loader = SimpleNamespace(exec_module=lambda value: None)
        args = SimpleNamespace(phase='probe')
        with patch.object(MODULE, 'BASE', BASE), patch.object(MODULE.importlib.util, 'spec_from_file_location', return_value=SimpleNamespace(loader=loader)), patch.object(MODULE.importlib.util, 'module_from_spec', return_value=original):
            with self.assertRaises(ValueError) as caught:
                MODULE.run(args)
        self.assertIs(caught.exception, failure)
        self.assertEqual(calls, [args])


if __name__ == '__main__':
    unittest.main()
