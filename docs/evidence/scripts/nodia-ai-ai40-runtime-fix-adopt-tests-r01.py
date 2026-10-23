"""Offline successor deployment admission; no VM, service, SDK or network calls."""
import importlib.util
import json
from pathlib import Path
import stat
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

source = Path(__file__).with_name('nodia-ai-ai40-runtime-fix-adopt-r01.py')
spec = importlib.util.spec_from_file_location('ai40_runtime_fix', source)
d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)


class SuccessorRuntimeDeployment(unittest.TestCase):
    def fake_base(self, target=None):
        helper = types.SimpleNamespace(active_new_processes=lambda: {'nodia-api': {'pid': 101}, 'nodia-ai-worker': {'pid': 102}},
                                       freeze=lambda *args: None, journal=lambda command: {'command': command})
        run = lambda args: 'unchanged legacy orchestration'
        base = types.SimpleNamespace(plan_file=lambda *_: {'release': target or str(d.TARGET), 'files': 4400, 'dist_outputs': 3001},
                                     load_helper=lambda: (helper, {}), unchanged=lambda *_: 'validated', run=run)
        return base, helper, run

    def test_wrapper_changes_only_explicit_constants_and_preserves_run(self):
        base, _, original = self.fake_base()
        d.configure(base, 'adopt')
        self.assertIs(base.run, original)
        self.assertEqual(base.OLD, Path('/opt/nodia/releases/nodia-server-ai40-r01'))
        self.assertEqual(base.OLD_SHA, '5815fc87fb5e7ce600267470774dddd9eaafdbae6ead388d0589b982205b4429')
        self.assertEqual(base.OLD_KNOWLEDGE, '49935f292d476721ee9825fcc6e0cbce434da0d2461e2f6dd5a758faeb6840ca')
        self.assertEqual(base.WORK, Path('/opt/nodia/verification/ai40-runtime-fix-adopt-r01'))
        self.assertEqual(base.plan_file('fixture', 'pin')['files'], 4400)

    def test_successor_plan_rejects_r01_or_unrelated_release(self):
        for target in (str(d.OLD), '/opt/nodia/releases/nodia-server-ai40-r03', '/tmp/unreviewed'):
            base, _, _ = self.fake_base(target)
            d.configure(base, 'adopt')
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, 'successor_release_required'):
                base.plan_file('fixture', 'pin')

    def test_base_bytes_are_pinned_before_import(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'fake.py'; path.write_text('raise Exception("must never import")')
            with self.assertRaisesRegex(ValueError, 'base_driver_pin_mismatch'):
                d.load_base(path)

    def test_absent_keyring_dropins_remain_valid_and_only_public_env_hash_is_exposed(self):
        values = {'DBUS_SESSION_BUS_ADDRESS': 'unix:path=/run/nodia-runtime/bus', 'XDG_RUNTIME_DIR': '/run/nodia-runtime'}
        with tempfile.TemporaryDirectory() as folder, patch.object(d, 'DROPINS', (Path(folder) / 'a.conf', Path(folder) / 'b.conf')), patch.object(d, 'public_environment', return_value=values), patch.object(d, 'namespace_entry', return_value={'observed': True, 'inode': 42}):
            result = d.protected_context({'nodia-api': {'pid': 101}})
        self.assertTrue(all(value == {'present': False} for value in result['dropins'].values()))
        self.assertEqual(result['consumer_transport']['nodia-api']['public_environment_sha256'], d.digest(values))
        self.assertNotIn('/run/nodia-runtime', json.dumps(result))

    def test_namespace_metadata_uses_proc_root_not_host_view(self):
        observed = []
        info = types.SimpleNamespace(st_mode=stat.S_IFSOCK | 0o660, st_uid=10000, st_dev=123, st_ino=456)
        def metadata(path): observed.append(path.as_posix()); return info
        with patch.object(Path, 'stat', metadata):
            result = d.namespace_entry(101, '/run/nodia-runtime/bus')
        self.assertEqual(observed, ['/proc/101/root/run/nodia-runtime/bus'])
        self.assertEqual(result['inode'], 456)
        self.assertEqual(d.namespace_entry(101, '/private/auth.json'), {'observed': False})

    def test_public_environment_never_emits_private_keys(self):
        with patch.object(Path, 'read_bytes', return_value=b'AUTH_TOKEN=synthetic-never-emitted\0DBUS_SESSION_BUS_ADDRESS=unix:path=/run/nodia-runtime/bus\0XDG_RUNTIME_DIR=/run/nodia-runtime\0'):
            values = d.public_environment(101)
        self.assertEqual(set(values), {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'})
        self.assertNotIn('synthetic-never-emitted', json.dumps(values))

    def test_transport_context_drift_blocks_existing_writer_admission(self):
        base, _, _ = self.fake_base(); d.configure(base, 'adopt'); a, _ = base.load_helper()
        with patch.object(d, 'protected_context', side_effect=[{'fixture': 'absent'}, {'fixture': 'changed'}]):
            a.active_new_processes()
            with self.assertRaisesRegex(ValueError, 'runtime_transport_context_changed'):
                a.active_new_processes()

    def test_freeze_keeps_transport_fingerprint_and_wrapper_identity_in_private_receipt(self):
        frozen = []; base, helper, _ = self.fake_base(); helper.freeze = lambda name, value: frozen.append((name, value))
        d.configure(base, 'adopt'); a, _ = base.load_helper()
        with patch.object(d, 'protected_context', return_value={'fixture': 'absent'}):
            a.active_new_processes()
            original = {'status': 'adopt_completed'}; a.freeze('adopt-after.json', original)
        self.assertEqual(original, {'status': 'adopt_completed'})
        self.assertEqual(frozen[0][1]['protected_context'], {'fixture': 'absent'})
        self.assertEqual(frozen[0][1]['operator_wrapper_sha256'], d.sha(source))

    def test_only_status_transport_failure_retries_up_to_three(self):
        calls, events = [], []
        def original(command):
            calls.append(command)
            if len(calls) < 3: raise ValueError('operator_command_failed')
            return {'operation': 'status'}
        self.assertEqual(d.StatusReadJournal(original, events, sleep=lambda _: None)('status'), {'operation': 'status'})
        self.assertEqual(calls, ['status'] * 3)
        self.assertEqual([event['outcome'] for event in events], ['command_failed', 'command_failed', 'ok'])

    def test_mutations_and_structural_status_errors_never_retry(self):
        for command, error in (('bootstrap', ValueError('operator_command_failed')), ('PUT', ValueError('operator_command_failed')), ('generation', ValueError('operator_command_failed')), ('status', ValueError('journal_status_invalid'))):
            calls = []
            def original(value): calls.append(value); raise error
            with self.subTest(command=command), self.assertRaises(ValueError):
                d.StatusReadJournal(original, [], sleep=lambda _: self.fail('unexpected retry'))(command)
            self.assertEqual(calls, [command])


if __name__ == '__main__':
    unittest.main()
