"""Offline R02 -> R03 operator admission. No VM, services, SDK or network."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

SOURCE = Path(__file__).with_name('nodia-ai-ai40-availability-adopt-r01.py')
SPEC = importlib.util.spec_from_file_location('ai40_availability_adoption', SOURCE)
d = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(d)


class AvailabilityDeployment(unittest.TestCase):
    def prior(self, directory):
        common = dict(operator_wrapper_sha256=d.PRIOR_WRAPPER_SHA, plan_sha256=d.PRIOR_PLAN_SHA,
                      phase='adopt', source=str(d.PRIOR_SOURCE), target=str(d.OLD),
                      old_manifest_sha256=d.PRIOR_SOURCE_SHA, new_manifest_sha256=d.OLD_SHA)
        after = dict(common, status='adopt_completed', timers_restored=True, journal_era_preserved=True,
                     journal_bootstrap_or_close=False, new_publication=False, knowledge_release=d.OLD_KNOWLEDGE,
                     migrations=0, SQL_restores=0, configured_SQL_writes=0, provider_requests=0, business_effects=0)
        for name, value in (('adopt-before.json', common), ('adopt-after.json', after)):
            (directory / name).write_text(json.dumps(value), encoding='utf-8')
        return common, after

    def fake_base(self, target=None):
        helper = types.SimpleNamespace(active_new_processes=lambda: {'nodia-api': {'pid': 101}, 'nodia-ai-worker': {'pid': 102}},
                                       freeze=Mock(), journal=Mock(), checked=Mock(), RELEASE=d.OLD, BACKUP=Path('/fixture/backup'))
        original = Mock(return_value='pinned orchestration')
        base = types.SimpleNamespace(plan_file=lambda *_: {'release': target or str(d.TARGET), 'manifest_sha256': d.TARGET_SHA, 'knowledge_release': d.OLD_KNOWLEDGE},
                                     load_helper=lambda: (helper, {}), unchanged=Mock(return_value='verified'), run=original)
        return base, helper, original

    def test_success_guard_binds_exact_successful_r02_transition_in_separate_namespace(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name); self.prior(directory)
            with patch.object(d, 'PRIOR_WORK', directory):
                result = d.completed_prior_attempt()
            self.assertEqual(result['after_receipt_sha256'], d.sha(directory / 'adopt-after.json'))
            self.assertEqual(result['status'], 'adopt_completed')
            self.assertFalse(result['replayed_in_place'])
            self.assertEqual(result['new_manifest_sha256'], d.OLD_SHA)
            self.assertNotEqual(d.WORK, d.PRIOR_WORK)
            self.assertNotIn('failure_receipt_sha256', result)
        self.assertEqual(d.sha(SOURCE.with_name('nodia-ai-ai40-runtime-fix-adopt-r03.py')), d.PRIOR_WRAPPER_SHA)

    def test_missing_success_receipts_or_any_failure_receipt_block_before_driver_import(self):
        for missing in ('adopt-before.json', 'adopt-after.json', 'add_failure'):
            with self.subTest(missing=missing), tempfile.TemporaryDirectory() as name:
                directory = Path(name); self.prior(directory)
                if missing == 'add_failure': (directory / 'adopt-failure.json').write_text('{}')
                else: (directory / missing).unlink()
                with patch.object(d, 'PRIOR_WORK', directory), patch.object(d, 'load_base') as load:
                    with self.assertRaisesRegex(ValueError, 'prior_success_receipts_required'):
                        d.run(types.SimpleNamespace(plan_sha256=d.PLAN_SHA))
                    load.assert_not_called()

    def test_changed_prior_wrapper_plan_source_target_or_manifest_is_rejected(self):
        changes = dict(operator_wrapper_sha256='wrong', plan_sha256='wrong', source=str(d.OLD), target=str(d.TARGET),
                       old_manifest_sha256=d.OLD_SHA, new_manifest_sha256='f' * 64, phase='rollback')
        for receipt in ('adopt-before.json', 'adopt-after.json'):
            for key, value in changes.items():
                with self.subTest(receipt=receipt, key=key), tempfile.TemporaryDirectory() as name:
                    directory = Path(name); self.prior(directory)
                    file = directory / receipt; row = json.loads(file.read_bytes()); row[key] = value
                    file.write_text(json.dumps(row))
                    with patch.object(d, 'PRIOR_WORK', directory), self.assertRaisesRegex(ValueError, 'prior_success_identity_mismatch'):
                        d.completed_prior_attempt()

    def test_success_guard_rejects_uncertain_work_publication_and_non_boolean_flags(self):
        changes = [('status', 'adopt_failed'), ('timers_restored', False), ('timers_restored', 1),
                   ('journal_era_preserved', 1), ('journal_bootstrap_or_close', 0), ('new_publication', 0),
                   ('knowledge_release', 'other'), ('migrations', 1), ('SQL_restores', False),
                   ('configured_SQL_writes', 1), ('provider_requests', 1), ('business_effects', 1)]
        for key, value in changes:
            with self.subTest(key=key, value=value), tempfile.TemporaryDirectory() as name:
                directory = Path(name); _, row = self.prior(directory); row[key] = value
                (directory / 'adopt-after.json').write_text(json.dumps(row))
                with patch.object(d, 'PRIOR_WORK', directory), self.assertRaisesRegex(ValueError, 'prior_success_invariants_invalid'):
                    d.completed_prior_attempt()

    def test_new_plan_pin_is_rejected_before_reading_success_or_importing_base(self):
        args = types.SimpleNamespace(plan_sha256=d.PRIOR_PLAN_SHA)
        with patch.object(d, 'completed_prior_attempt') as prior, patch.object(d, 'load_base') as load:
            with self.assertRaisesRegex(ValueError, 'successor_plan_pin_mismatch'):
                d.run(args)
        prior.assert_not_called(); load.assert_not_called()

    def test_exact_base_is_pinned_before_import_and_never_executed_on_mismatch(self):
        with tempfile.TemporaryDirectory() as name:
            file = Path(name) / 'untrusted.py'; file.write_text('raise RuntimeError("do not import")')
            with self.assertRaisesRegex(ValueError, 'base_driver_pin_mismatch'):
                d.load_base(file)
        self.assertEqual(d.sha(SOURCE.with_name('nodia-ai-ai40-adopt-r01.py')), d.BASE_SHA)

    def test_successor_preserves_pinned_orchestration_and_only_r03_plan_is_accepted(self):
        base, _, original = self.fake_base(); d.configure(base, 'adopt')
        self.assertIs(base.run, original)
        self.assertEqual(base.OLD, Path('/opt/nodia/releases/nodia-server-ai40-r02'))
        self.assertEqual(base.WORK, Path('/opt/nodia/verification/ai40-availability-adopt-r01'))
        self.assertEqual(base.plan_file('path', 'pin')['release'], str(d.TARGET))
        for target in (str(d.OLD), str(d.PRIOR_SOURCE), '/tmp/other'):
            base, _, _ = self.fake_base(target); d.configure(base, 'adopt')
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, 'successor_release_required'):
                base.plan_file('path', 'pin')

    def test_correct_release_with_other_manifest_or_knowledge_is_rejected(self):
        for key in ('manifest_sha256', 'knowledge_release'):
            base, _, _ = self.fake_base()
            plan = {'release': str(d.TARGET), 'manifest_sha256': d.TARGET_SHA, 'knowledge_release': d.OLD_KNOWLEDGE}
            plan[key] = 'f' * 64
            base.plan_file = lambda *_: plan
            d.configure(base, 'adopt')
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, 'successor_package_pin_mismatch'):
                base.plan_file('path', 'pin')

    def test_embedded_successor_plan_matches_local_frozen_operator_package(self):
        plan_path = SOURCE.parent.parent / 'nodia-ai-ai40-adopt-plan-r03.json'
        self.assertEqual(d.sha(plan_path), d.PLAN_SHA)
        plan = json.loads(plan_path.read_bytes())
        self.assertEqual(plan['release'], d.TARGET.as_posix())
        self.assertEqual(plan['manifest_sha256'], d.TARGET_SHA)

    def test_only_safe_status_reads_retry_three_times(self):
        events = []; original = Mock(side_effect=[ValueError('operator_command_failed'), subprocess.TimeoutExpired('status', 20), {'status': 'ok'}])
        self.assertEqual(d.StatusReadJournal(original, events, sleep=lambda _: None)('status'), {'status': 'ok'})
        self.assertEqual(original.call_count, 3)
        self.assertEqual([event['outcome'] for event in events], ['command_failed', 'timeout', 'ok'])
        failed = Mock(side_effect=ValueError('operator_command_failed'))
        with self.assertRaises(ValueError): d.StatusReadJournal(failed, [], sleep=lambda _: None)('status')
        self.assertEqual(failed.call_count, 3)

    def test_mutations_and_invalid_status_never_retry(self):
        for command, error in (('backup', ValueError('operator_command_failed')), ('bootstrap', ValueError('operator_command_failed')),
                               ('close', subprocess.TimeoutExpired('close', 20)), ('status', ValueError('journal_status_invalid'))):
            original = Mock(side_effect=error)
            with self.subTest(command=command), self.assertRaises(Exception):
                d.StatusReadJournal(original, [], sleep=lambda _: self.fail('unexpected retry'))(command)
            self.assertEqual(original.call_count, 1)

    def backup(self):
        helper = types.SimpleNamespace(RELEASE=d.OLD, BACKUP=Path('/fixture/backup'))
        command = ['sudo', '-u', 'nodia', '/usr/local/bin/node', str(d.OLD / 'scripts/nodia-ai-backups.mjs'), 'backup', str(helper.BACKUP)]
        original, events = Mock(), []
        return d.checked_with_backup_diagnostic(helper, original, events), command, original, events

    def test_backup_is_not_retried_and_arbitrary_stderr_is_withheld(self):
        checked, command, original, events = self.backup()
        process = types.SimpleNamespace(returncode=1, stdout=b'private fixture output', stderr=b'private fixture secret')
        with patch.object(d.subprocess, 'run', return_value=process) as native:
            with self.assertRaisesRegex(ValueError, '^backup_cli_failed$'): checked(command, timeout=240)
        self.assertEqual(native.call_count, 1); original.assert_not_called()
        self.assertIsNone(events[0]['safe_error_code']); self.assertFalse(events[0]['retried'])
        self.assertNotIn('private fixture', json.dumps(events))

    def test_uncertain_backup_is_not_replayed(self):
        checked, command, _, events = self.backup()
        with patch.object(d.subprocess, 'run', side_effect=subprocess.TimeoutExpired(command, 240, output=b'private fixture')) as native:
            with self.assertRaisesRegex(ValueError, '^backup_cli_result_unknown$'): checked(command)
        self.assertEqual(native.call_count, 1)
        self.assertEqual(events[0]['outcome'], 'timeout_result_unknown')
        self.assertFalse(events[0]['retried']); self.assertNotIn('private fixture', json.dumps(events))

    def test_success_backup_bytes_remain_subject_to_original_validator(self):
        checked, command, original, events = self.backup(); receipt = b'{"status":"must still be validated"}'
        with patch.object(d.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0, stdout=receipt, stderr=b'')):
            self.assertIs(checked(command), receipt)
        original.assert_not_called(); self.assertFalse(events[0]['retried'])

    def test_protected_transport_must_stay_identical_through_restart(self):
        base, helper, _ = self.fake_base(); original_checked = helper.checked
        d.configure(base, 'adopt'); observed, _ = base.load_helper()
        with patch.object(d, 'protected_context', side_effect=[{'namespace': 'fixed'}, {'namespace': 'changed'}]):
            observed.active_new_processes()
            with self.assertRaisesRegex(ValueError, 'runtime_transport_context_changed'): observed.active_new_processes()
        original_checked.assert_not_called()

    def test_private_receipt_tracks_success_lineage_and_backup_status_metadata(self):
        base, helper, _ = self.fake_base(); original_freeze = helper.freeze
        d.configure(base, 'adopt'); observed, _ = base.load_helper()
        with patch.object(d, 'protected_context', return_value={'namespace': 'fixed'}), patch.object(d, 'PRIOR_SUCCESS', {'status': 'adopt_completed'}):
            observed.active_new_processes(); observed.freeze('adopt-before.json', {'phase': 'adopt'})
        frozen = original_freeze.call_args[0][1]
        self.assertEqual(frozen['previous_completed_attempt']['status'], 'adopt_completed')
        self.assertNotIn('previous_rejected_attempt', frozen)
        self.assertEqual(frozen['operator_wrapper_sha256'], d.sha(SOURCE))


if __name__ == '__main__':
    unittest.main()
