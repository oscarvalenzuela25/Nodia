"""Offline successor deployment admission; no VM, service, SDK or network calls."""
import importlib.util
import json
from pathlib import Path
import stat
import sys
import tempfile
import types
import unittest
from unittest.mock import patch, Mock

source = Path(__file__).with_name('nodia-ai-ai40-runtime-fix-adopt-r03.py')
spec = importlib.util.spec_from_file_location('ai40_runtime_fix', source)
d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)


class SuccessorRuntimeDeployment(unittest.TestCase):
    def fake_base(self, target=None):
        helper = types.SimpleNamespace(active_new_processes=lambda: {'nodia-api': {'pid': 101}, 'nodia-ai-worker': {'pid': 102}},
                                       freeze=lambda *args: None, journal=lambda command: {'command': command},
                                       checked=lambda *args, **kwargs: b'original', RELEASE=d.OLD, BACKUP=Path('/fixture/backup'))
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
        self.assertEqual(base.WORK, Path('/opt/nodia/verification/ai40-runtime-fix-adopt-r03'))
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


    def prior_receipts(self, folder):
        before = {'operator_wrapper_sha256': d.PRIOR_WRAPPER_SHA, 'plan_sha256': d.PRIOR_PLAN_SHA,
                  'phase': 'adopt', 'source': str(d.OLD), 'target': str(d.TARGET)}
        failure = {'operator_wrapper_sha256': d.PRIOR_WRAPPER_SHA, 'status': 'adopt_failed',
                   'admission_closed': False, 'timers_restored': True, 'failure_code': 'backup_cli_failed',
                   'backup_commands': [{'operation': 'backup', 'attempt': 1, 'outcome': 'command_failed',
                                        'exit_code': 1, 'safe_error_code': 'nodia_ai:recovery_read_unavailable', 'retried': False}]}
        for name, value in (('adopt-before.json', before), ('adopt-failure.json', failure)):
            (folder / name).write_text(json.dumps(value), encoding='utf-8')
        return before, failure

    def test_previous_failure_is_required_and_remains_a_separate_attempt(self):
        with tempfile.TemporaryDirectory() as name:
            folder = Path(name); self.prior_receipts(folder)
            with patch.object(d, 'PRIOR_WORK', folder):
                receipt = d.rejected_prior_attempt()
            self.assertFalse(receipt['replayed_in_place'])
            self.assertNotEqual(d.WORK, d.PRIOR_WORK)
            self.assertEqual(receipt['failure_receipt_sha256'], d.sha(folder / 'adopt-failure.json'))
        self.assertEqual(d.sha(source.with_name('nodia-ai-ai40-runtime-fix-adopt-r02.py')), d.PRIOR_WRAPPER_SHA)

    def test_prior_guard_rejects_changed_identity_admission_or_failed_timer_recovery(self):
        cases = [('adopt-before.json', 'operator_wrapper_sha256', 'changed'),
                 ('adopt-before.json', 'plan_sha256', 'changed'),
                 ('adopt-before.json', 'source', str(d.TARGET)),
                 ('adopt-failure.json', 'admission_closed', True),
                 ('adopt-failure.json', 'admission_closed', 0),
                 ('adopt-failure.json', 'timers_restored', False),
                 ('adopt-failure.json', 'timers_restored', 1)]
        for filename, key, replacement in cases:
            with self.subTest(key=key, value=replacement), tempfile.TemporaryDirectory() as name:
                folder = Path(name); self.prior_receipts(folder)
                path = folder / filename; value = json.loads(path.read_text()); value[key] = replacement
                path.write_text(json.dumps(value))
                with patch.object(d, 'PRIOR_WORK', folder), self.assertRaisesRegex(ValueError, 'prior_rejection_not_safe_for_successor'):
                    d.rejected_prior_attempt()

    def test_completed_prior_attempt_cannot_be_replayed(self):
        with tempfile.TemporaryDirectory() as name:
            folder = Path(name); self.prior_receipts(folder); (folder / 'adopt-after.json').write_text('{}')
            with patch.object(d, 'PRIOR_WORK', folder), self.assertRaisesRegex(ValueError, 'prior_rejection_not_safe_for_successor'):
                d.rejected_prior_attempt()

    def backup_fixture(self):
        helper = types.SimpleNamespace(RELEASE=d.OLD, BACKUP=Path('/fixture/backup'))
        command = ['sudo', '-u', 'nodia', '/usr/local/bin/node', str(d.OLD / 'scripts/nodia-ai-backups.mjs'), 'backup', str(helper.BACKUP)]
        original, events = Mock(return_value=b'original'), []
        return d.checked_with_backup_diagnostic(helper, original, events), command, original, events

    def test_exact_backup_failure_runs_once_and_exposes_only_safe_code(self):
        checked, command, original, events = self.backup_fixture()
        process = types.SimpleNamespace(returncode=1, stdout=b'synthetic-private-output', stderr=b'nodia_ai:recovery_read_unavailable\n')
        with patch.object(d.subprocess, 'run', return_value=process) as run:
            with self.assertRaisesRegex(ValueError, '^backup_cli_failed$'):
                checked(command, timeout=240)
        run.assert_called_once_with(command, cwd=None, capture_output=True, timeout=240, check=False)
        original.assert_not_called()
        self.assertEqual(events[0]['safe_error_code'], 'nodia_ai:recovery_read_unavailable')
        self.assertFalse(events[0]['retried'])
        self.assertNotIn('synthetic-private-output', json.dumps(events))

    def test_arbitrary_or_multiline_stderr_is_never_reported(self):
        for stderr in (b'secret fixture', b'nodia_ai:failed\nprivate', b'\xff', b'x' * 257):
            checked, command, _, events = self.backup_fixture()
            with self.subTest(stderr=stderr), patch.object(d.subprocess, 'run', return_value=types.SimpleNamespace(returncode=1, stdout=b'', stderr=stderr)):
                with self.assertRaises(ValueError): checked(command)
            self.assertIsNone(events[0]['safe_error_code'])
            self.assertFalse(events[0]['raw_details_emitted'])

    def test_backup_timeout_is_uncertain_and_never_retried(self):
        checked, command, _, events = self.backup_fixture()
        with patch.object(d.subprocess, 'run', side_effect=d.subprocess.TimeoutExpired(command, 240, output=b'private fixture')) as run:
            with self.assertRaisesRegex(ValueError, '^backup_cli_result_unknown$'):
                checked(command, timeout=240)
        self.assertEqual(run.call_count, 1)
        self.assertEqual(events[0]['outcome'], 'timeout_result_unknown')
        self.assertFalse(events[0]['retried'])
        self.assertNotIn('private fixture', json.dumps(events))

    def test_successful_backup_retains_original_stdout_for_receipt_validation(self):
        checked, command, original, events = self.backup_fixture()
        raw = b'{"synthetic_receipt":"must still be validated by pinned base"}'
        with patch.object(d.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0, stdout=raw, stderr=b'')) as run:
            self.assertIs(checked(command), raw)
        self.assertEqual(run.call_count, 1)
        original.assert_not_called()
        self.assertNotIn('synthetic_receipt', json.dumps(events))

    def test_non_backup_command_is_delegated_exactly_once_and_never_subprocessed_by_wrapper(self):
        checked, command, original, events = self.backup_fixture()
        command[5] = 'rotate'
        with patch.object(d.subprocess, 'run', side_effect=AssertionError('no wrapper operation')):
            self.assertEqual(checked(command, timeout=99, cwd='/fixture'), b'original')
        original.assert_called_once_with(command, timeout=99, cwd='/fixture')
        self.assertEqual(events, [])

    def test_changed_successor_plan_is_rejected_before_loading_or_receipt_reads(self):
        args = types.SimpleNamespace(plan_sha256='changed')
        with patch.object(d, 'load_base') as load, patch.object(d, 'rejected_prior_attempt') as prior:
            with self.assertRaisesRegex(ValueError, 'successor_plan_pin_mismatch'):
                d.run(args)
        load.assert_not_called(); prior.assert_not_called()


    def test_xdg_directory_inode_may_change_but_bus_inode_and_directory_mode_are_protected(self):
        env = {'DBUS_SESSION_BUS_ADDRESS': 'unix:path=/run/nodia-runtime/bus', 'XDG_RUNTIME_DIR': '/run/nodia-runtime'}
        directory_inode, bus_inode, directory_mode = [100], [200], [0o700]
        def entry(pid, path):
            is_bus = path.endswith('/bus')
            return {'observed': True, 'kind': stat.S_IFSOCK if is_bus else stat.S_IFDIR,
                    'uid': 10000, 'mode': 0o660 if is_bus else directory_mode[0],
                    'device': 26, 'inode': bus_inode[0] if is_bus else directory_inode[0]}
        with patch.object(d, 'DROPINS', ()), patch.object(d, 'public_environment', return_value=env), patch.object(d, 'namespace_entry', side_effect=entry):
            initial = d.protected_context({'nodia-api': {'pid': 101}})
            directory_inode[0] += 1
            self.assertEqual(d.protected_context({'nodia-api': {'pid': 102}}), initial)
            bus_inode[0] += 1
            self.assertNotEqual(d.protected_context({'nodia-api': {'pid': 102}}), initial)
            bus_inode[0] -= 1; directory_mode[0] = 0o755
            self.assertNotEqual(d.protected_context({'nodia-api': {'pid': 102}}), initial)
        self.assertNotIn('inode', initial['consumer_transport']['nodia-api']['xdg'])
        self.assertEqual(initial['consumer_transport']['nodia-api']['bus']['inode'], 200)


    def test_prior_backup_failure_must_match_known_get_failure_without_retry_or_unknown_effect(self):
        cases = [('safe_error_code', 'nodia_ai:recovery_write_unknown'), ('operation', 'PUT'),
                 ('retried', True), ('outcome', 'timeout_result_unknown'), ('attempt', 2), ('exit_code', 0)]
        for key, value in cases:
            with self.subTest(key=key), tempfile.TemporaryDirectory() as name:
                folder = Path(name); _, failure = self.prior_receipts(folder)
                failure['backup_commands'][0][key] = value
                (folder / 'adopt-failure.json').write_text(json.dumps(failure))
                with patch.object(d, 'PRIOR_WORK', folder), self.assertRaisesRegex(ValueError, 'prior_backup_failure_not_matching'):
                    d.rejected_prior_attempt()

    def test_prior_backup_receipt_cannot_have_multiple_invocations(self):
        with tempfile.TemporaryDirectory() as name:
            folder = Path(name); _, failure = self.prior_receipts(folder)
            failure['backup_commands'].append(dict(failure['backup_commands'][0]))
            (folder / 'adopt-failure.json').write_text(json.dumps(failure))
            with patch.object(d, 'PRIOR_WORK', folder), self.assertRaisesRegex(ValueError, 'prior_backup_failure_not_matching'):
                d.rejected_prior_attempt()


if __name__ == '__main__':
    unittest.main()
