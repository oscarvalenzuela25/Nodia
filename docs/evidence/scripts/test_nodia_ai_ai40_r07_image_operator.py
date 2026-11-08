"""Atomic delegation guarantees for the pinned R07 image successor."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('r07_image_successor', Path(__file__).with_name('nodia-ai-ai40-r07-image-operator-r01.py'))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
BASE = Path(__file__).with_name('nodia-ai-ai40-r06-image-operator-r01.py')


class SuccessorDelegation(unittest.TestCase):
    def test_exact_successor_coordinates_and_original_arguments_are_forwarded_once(self):
        args = SimpleNamespace(phase='preflight', mime='png', operator_sha256='synthetic-fixture-pin', authorize_one_real_generation=False)
        calls = []
        original = SimpleNamespace()

        def run(value):
            calls.append(value)
            self.assertIs(value, args)
            for name in ('WORK', 'FIXTURES', 'GUARD', 'GUARD_SHA', 'INSPECTOR', 'INSPECTOR_SHA', 'PRIVATE_SHA'):
                self.assertEqual(getattr(original, name), getattr(MODULE, name))
            self.assertEqual(original.__file__, str(Path(MODULE.__file__).resolve()))
            return {'status': 'preflight_passed', 'fixture': True}, 0

        original.run = run
        loader = SimpleNamespace(exec_module=lambda value: self.assertIs(value, original))
        with patch.object(MODULE, 'BASE', BASE), patch.object(MODULE.importlib.util, 'spec_from_file_location', return_value=SimpleNamespace(loader=loader)), patch.object(MODULE.importlib.util, 'module_from_spec', return_value=original):
            result, code = MODULE.run(args)
        self.assertEqual(calls, [args])
        self.assertEqual(code, 0)
        self.assertEqual(result['schema'], 'nodia-ai-ai40-r07-image-operator-v1')
        self.assertEqual(result['inherited_image_protocol_sha256'], MODULE.BASE_SHA)
        self.assertTrue(result['fixture'])

    def test_changed_immutable_parent_is_rejected_before_import_or_dispatch(self):
        with patch.object(MODULE, 'BASE', BASE), patch.object(MODULE, 'BASE_SHA', '0' * 64):
            with self.assertRaisesRegex(ValueError, '^immutable_image_operator_pin_mismatch$'):
                MODULE.run(SimpleNamespace())


if __name__ == '__main__':
    unittest.main()
