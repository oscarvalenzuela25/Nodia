"""Offline validation decisions for the two-phase image driver, no system calls."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

if sys.platform == 'win32':
    sys.modules.setdefault('fcntl', types.ModuleType('fcntl'))
source = Path(__file__).with_name('nodia-ai-ai38-web-stream-adopt-r01.py')
spec = importlib.util.spec_from_file_location('profile_driver', source)
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)


class Decisions(unittest.TestCase):
    def plan(self, **updates):
        old = {'file_' + chr(97 + i//26) + chr(97 + i%26) + '.py': 'a' * 64 for i in range(46)}
        old['web_generation_diagnostics.py'] = 'a' * 64
        new = {**old, 'web_generation_diagnostics.py': 'b' * 64, 'web_stream_frame_diagnostics.py': 'b' * 64}
        value = dict(schema_version=1, phase='diag', source_image_id='sha256:073f319ffa35c75d82be379a2d6d0d48a1c760b7f37103c8194120e51d71660e',
                     target_image_id='sha256:' + 'b' * 64, source_python_hashes=old,
                     target_python_hashes=new, changed_python_files=['web_generation_diagnostics.py', 'web_stream_frame_diagnostics.py'])
        value.update(updates)
        return value

    def load(self, value, bad_pin=False):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'plan.json'
            path.write_bytes(json.dumps(value).encode())
            return d.load_plan(path, '0' * 64 if bad_pin else d.sha(path))

    def test_diag_admission(self):
        self.assertEqual(self.load(self.plan())['phase'], 'diag')

    def test_fix_phase_rejected(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.load(self.plan(phase='fix'))

    def test_unknown_phase_rejected(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.load(self.plan(phase='../legacy'))

    def test_plan_pin_changed_rejected(self):
        with self.assertRaisesRegex(ValueError, 'plan_pin_mismatch'):
            self.load(self.plan(), bad_pin=True)

    def test_same_image_not_a_transition(self):
        with self.assertRaisesRegex(ValueError, 'image_ids_invalid'):
            self.load(self.plan(target_image_id=self.plan()['source_image_id']))

    def test_extra_fields_cannot_enable_bootstrap(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.load(self.plan(bootstrap=True))

    def test_changed_file_not_declared(self):
        with self.assertRaisesRegex(ValueError, 'changed_source_inventory_invalid'):
            self.load(self.plan(changed_python_files=['main.py']))

    def test_changed_list_cannot_contain_duplicate(self):
        with self.assertRaisesRegex(ValueError, 'changed_source_inventory_invalid'):
            self.load(self.plan(changed_python_files=['web_generation_diagnostics.py', 'web_generation_diagnostics.py']))

    def test_source_paths_are_not_freeform(self):
        with self.assertRaisesRegex(ValueError, 'public_source_plan_invalid'):
            self.load(self.plan(source_python_hashes={'../credentials.py': 'a' * 64}))

    def test_wrong_source_image_rejected(self):
        with self.assertRaisesRegex(ValueError, 'exact_Web_diagnostic_overlay_required'):
            self.load(self.plan(source_image_id='sha256:' + 'c' * 64))

    def test_added_unrelated_source_rejected(self):
        plan = self.plan()
        plan['target_python_hashes']['extra.py'] = 'c' * 64
        plan['changed_python_files'].append('extra.py')
        with self.assertRaisesRegex(ValueError, 'exact_Web_diagnostic_overlay_required'):
            self.load(plan)

    def configuration(self):
        return dict(State={'Running': True}, Mounts=[dict(Destination='/app/session_state', Source='SYNTHETIC')],
                    Config=dict(Env=['SYNTHETIC=1'], User='nodia', Cmd=['python', 'run.py'], Entrypoint=['init']),
                    HostConfig={k: 'SYNTHETIC' for k in ('PortBindings', 'Memory', 'NanoCpus', 'Tmpfs', 'RestartPolicy',
                               'NetworkMode', 'PidsLimit', 'SecurityOpt', 'Init', 'ShmSize')})

    def test_equal_runtime_configuration(self):
        value = self.configuration()
        d.same_configuration(value, copy.deepcopy(value))

    def test_changed_profile_mount_rejected(self):
        old, new = self.configuration(), self.configuration()
        new['Mounts'][0]['Source'] = 'OTHER_SYNTHETIC'
        with self.assertRaisesRegex(ValueError, 'mount_configuration_changed'):
            d.same_configuration(old, new)

    def test_changed_environment_rejected(self):
        old, new = self.configuration(), self.configuration()
        new['Config']['Env'].append('SYNTHETIC_OTHER=2')
        with self.assertRaisesRegex(ValueError, 'process_configuration_changed'):
            d.same_configuration(old, new)

    def test_changed_resources_rejected(self):
        old, new = self.configuration(), self.configuration()
        new['HostConfig']['PortBindings'] = 'PUBLIC_SYNTHETIC'
        with self.assertRaisesRegex(ValueError, 'resource_configuration_changed'):
            d.same_configuration(old, new)

    def images(self, new_layers):
        return [dict(Id='sha256:' + 'a' * 64, RootFS={'Layers': ['base-layer']}),
                dict(Id='sha256:' + 'b' * 64, RootFS={'Layers': new_layers})]

    def test_derivative_image_preserves_base_layers(self):
        with patch.object(d, 'checked', side_effect=[json.dumps([v]).encode() for v in self.images(['base-layer', 'copy-layer'])]):
            self.assertTrue(d.image_derivative('sha256:' + 'a' * 64, 'sha256:' + 'b' * 64)['source_layer_prefix_preserved'])

    def test_rebased_image_rejected(self):
        with patch.object(d, 'checked', side_effect=[json.dumps([v]).encode() for v in self.images(['other-base', 'copy-layer'])]):
            with self.assertRaisesRegex(ValueError, 'target_not_derived_from_exact_source_image'):
                d.image_derivative('sha256:' + 'a' * 64, 'sha256:' + 'b' * 64)

    def test_no_copy_layer_rejected(self):
        with patch.object(d, 'checked', side_effect=[json.dumps([v]).encode() for v in self.images(['base-layer'])]):
            with self.assertRaisesRegex(ValueError, 'target_not_derived_from_exact_source_image'):
                d.image_derivative('sha256:' + 'a' * 64, 'sha256:' + 'b' * 64)

    def test_error_projection_redacts_untrusted_detail(self):
        self.assertEqual(d.safe_code(ValueError('credential=SECRET')), 'operation_failed')
        self.assertEqual(d.safe_code(RuntimeError('SECRET')), 'operation_failed')
        self.assertEqual(d.safe_code(ValueError('source_public_inventory_mismatch')), 'source_public_inventory_mismatch')


if __name__ == '__main__':
    unittest.main()
