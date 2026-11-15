"""Fresh capture ordering/locks/equality without production DB, R2, credentials or services."""
from contextlib import ExitStack
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

BASE=Path(__file__).resolve().parents[1]/'ai-runtime'
spec=importlib.util.spec_from_file_location('teacher_capture',BASE/'capture-teacher-backup.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
fixture_spec=importlib.util.spec_from_file_location('teacher_capture_window_fixture',Path(__file__).with_name('test_activate_teacher_window.py'))
fixtures=importlib.util.module_from_spec(fixture_spec);fixture_spec.loader.exec_module(fixtures)


@unittest.skipUnless(fixtures.os.name=='posix' and fixtures.os.geteuid()==0,'requires isolated native Linux root ownership')
class TeacherBackupCaptureTests(unittest.TestCase):
    def setUp(self):
        # Reuse only the explicitly synthetic fixture, not its tests.
        self.f=fixtures.TeacherWindowTests();self.f.setUp();self.addCleanup(self.f.doCleanups)
        f=self.f;self.backup_calls=0;self.jobs=0;self.changed_after=False;self.unknown_backup=False;self.backup_lock_busy=False
        self.backup={'backup_id':'11111111-1111-4111-8111-111111111111','cipher_sha256':'c'*64,
                     'captured_at':'2026-11-15T00:00:00Z','journal_sequence':1}
        original=f.updater.Host
        def host(*args):
            instance=original(*args)
            instance.backup=self.create_backup;instance.node_job=self.fingerprint_job
            return instance
        f.updater.Host=host;f.updater.MAINTENANCE=f.maintenance
        def install(path,raw,mode):
            if path.exists():self.assertEqual(path.read_bytes(),raw)
            else:f.io.exclusive(path,raw,mode)
        f.safe.install_file=install
        self.fingerprint=f.root/'fingerprint.mjs';f.write(self.fingerprint,b'// Synthetic pinned capture source; never executed\n')
        self.plan={'schema':'teacher-backup-capture/1','capture_id':'2'*32,'current_release':f.release.name,
                   'current_manifest_sha256':f.plan['current_manifest_sha256'],'settings_sha256':f.plan['settings_sha256'],
                   'receiver_settings_sha256':f.plan['receiver_settings_sha256'],'registry_sha256':f.plan['registry_before_sha256'],
                   'fingerprint_sha256':f.io.sha(self.fingerprint.read_bytes()),
                   'operator_pins':{name:f.io.sha((f.lib/name).read_bytes()) for name in capture.PINS}}
        self.plan_file=f.root/'capture-plan.json';self.seal()
        self.patch=ExitStack();self.addCleanup(self.patch.close)
        self.patch.enter_context(patch.object(capture,'io_policy',return_value=f.io))
        for name,value in {'LIB':f.lib,'STATE':f.state,'CURRENT':f.current,'REGISTRY':f.registry,'INSTALL_LOCK':f.lock}.items():
            self.patch.enter_context(patch.object(capture,name,value))

    def seal(self):
        self.f.write(self.plan_file,json.dumps(self.plan).encode());self.sha=self.f.io.sha(self.plan_file.read_bytes())
        self.record=self.f.state/('teacher-backup-capture-'+self.plan['capture_id'])

    def create_backup(self):
        self.f.locked();self.assertTrue(self.f.apps);self.f.events.append('backup');self.backup_calls+=1
        self.assertTrue(all(state['ActiveState']=='inactive' for unit,state in self.f.states.items() if unit.endswith('.timer')))
        if self.backup_lock_busy:raise RuntimeError('synthetic_backup_flock_exit_75')
        if self.unknown_backup:raise RuntimeError('synthetic_backup_outcome_unknown')
        return self.backup

    def fingerprint_job(self,path,args,seconds):
        self.f.locked();self.jobs+=1;self.f.events.append('fingerprint')
        self.assertEqual(args[0],'--capture');self.assertEqual(args[3],self.f.release.name);self.assertEqual(seconds,180)
        self.assertEqual(path.read_bytes(),self.fingerprint.read_bytes());self.assertTrue(self.f.apps)
        self.assertTrue(all(state['ActiveState']=='inactive' for unit,state in self.f.states.items() if unit.endswith('.timer')))
        tables=[{'name':'synthetic_table','rows':2 if self.changed_after and self.jobs==2 else 1,'md5':'d'*32}]
        return {'tables':tables,'aggregate_sha256':self.f.io.sha(json.dumps(tables,separators=(',',':')).encode())}

    def run_capture(self):return capture.capture(self.plan_file,self.sha,self.fingerprint)

    def test_exact_before_backup_after_and_healthy_runtime_produce_scoped_receipt(self):
        result=self.run_capture()
        self.assertEqual(result['status'],'captured_source_equal');self.assertEqual(result['backup_id'],self.backup['backup_id'])
        self.assertEqual(self.f.events,['pause','fingerprint','backup','fingerprint','timers_restored']);self.assertEqual(self.backup_calls,1)
        self.assertFalse(self.f.maintenance.exists());self.assertTrue(self.f.apps);self.assertEqual(self.f.started,0)
        fingerprint=self.record/'source-fingerprint.json'
        self.assertEqual(self.f.io.sha(fingerprint.read_bytes()),result['source_fingerprint_file_sha256'])
        self.assertFalse(result['restore_performed']);self.assertFalse(result['runtime_recovery_authorized'])
        self.assertTrue(result['timers_paused']);self.assertTrue(result['timers_restored'])
        self.assertTrue(all(state['ActiveState']=='active' for unit,state in self.f.states.items() if unit.endswith('.timer')))
        self.assertFalse((self.f.state/'attempts').exists())

    def test_wrong_source_or_metadata_CAS_prevents_reservation_and_backup(self):
        self.fingerprint.write_bytes(b'// changed after review\n')
        with self.assertRaisesRegex(ValueError,'reviewed_fingerprint_source_required'):self.run_capture()
        self.assertFalse(self.record.exists());self.assertEqual(self.backup_calls,0)

    def test_data_change_keeps_completed_backup_and_refuses_replay(self):
        self.changed_after=True
        with self.assertRaisesRegex(ValueError,'source_changed_across_backup'):self.run_capture()
        self.assertEqual(json.loads((self.record/'backup.json').read_bytes()),self.backup)
        failure=json.loads((self.record/'failure.json').read_bytes());self.assertTrue(failure['backup_result_known'])
        self.assertFalse(failure['backup_delete_or_retry_attempted'])
        with self.assertRaisesRegex(ValueError,'capture_already_reserved_no_replay'):self.run_capture()
        self.assertEqual(self.backup_calls,1)

    def test_both_locks_exclude_concurrent_capture_before_reservation(self):
        import fcntl
        for path in (self.f.state/'receiver.lock',self.f.lock):
            with path.open('r+b') as stream:
                fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):self.run_capture()
            self.assertFalse(self.record.exists())
        self.assertEqual(self.backup_calls,0)

    def test_unknown_backup_is_never_deleted_or_dispatched_again(self):
        self.unknown_backup=True
        with self.assertRaises(RuntimeError):self.run_capture()
        failure=json.loads((self.record/'failure.json').read_bytes())
        self.assertTrue(failure['backup_side_effects_possible']);self.assertFalse(failure['backup_result_known'])
        self.assertFalse(failure['backup_delete_or_retry_attempted']);self.assertFalse((self.record/'receipt.json').exists())
        self.assertTrue(failure['timers_paused']);self.assertFalse(failure['timers_restored'])
        self.assertNotIn('timers_restored',self.f.events)
        with self.assertRaisesRegex(ValueError,'capture_already_reserved_no_replay'):self.run_capture()
        self.assertEqual(self.backup_calls,1)

    def test_backup_lock_busy_keeps_timer_state_for_review_without_resuming_or_replay(self):
        self.backup_lock_busy=True
        with self.assertRaisesRegex(RuntimeError,'flock_exit_75'):self.run_capture()
        failure=json.loads((self.record/'failure.json').read_bytes())
        self.assertEqual(failure['phase'],'backup_requested');self.assertTrue(failure['timers_pause_requested'])
        self.assertTrue(failure['timers_paused']);self.assertFalse(failure['timers_restored'])
        self.assertTrue(all(state=={'active':True,'enabled':'enabled'} for state in failure['timer_states_before'].values()))
        self.assertEqual(self.f.events,['pause','fingerprint','backup']);self.assertEqual(self.jobs,1)
        self.assertTrue(all(state['ActiveState']=='inactive' for unit,state in self.f.states.items() if unit.endswith('.timer')))
        with self.assertRaisesRegex(ValueError,'capture_already_reserved_no_replay'):self.run_capture()
        self.assertEqual(self.backup_calls,1);self.assertFalse(failure['automatic_retry_allowed'])

    def test_installed_pause_waits_for_existing_backup_work_before_first_fingerprint(self):
        updater_spec=importlib.util.spec_from_file_location('synthetic_capture_real_updater',BASE.parent/'update-backend.py')
        updater=importlib.util.module_from_spec(updater_spec);updater_spec.loader.exec_module(updater)
        self.f.states['nodia-ai-backup-rotate.timer'].update(ActiveState='inactive',UnitFileState='disabled')
        original=self.f.updater.Host;busy=True
        def host(*args):
            instance=original(*args);show=instance.show
            def unit_state(unit):
                if unit in updater.BACKUPS:return {'ActiveState':'active' if busy else 'inactive'}
                return show(unit)
            def command(arguments):
                self.f.locked();self.assertEqual(arguments,['/usr/bin/systemctl','stop',*updater.TIMERS])
                self.f.events.append('pause')
                for unit in updater.TIMERS:self.f.states[unit]['ActiveState']='inactive'
            instance.show=unit_state;instance.command=command
            instance.must=lambda value,_:self.assertTrue(value)
            instance.pause_timers=lambda:updater.Host.pause_timers(instance)
            return instance
        def wait(_):
            nonlocal busy
            self.assertEqual(self.jobs,0);self.assertEqual(self.backup_calls,0)
            self.f.events.append('wait_existing_backup');busy=False
        self.f.updater.Host=host
        with patch.object(updater,'atomic_write',side_effect=lambda path,raw:self.f.write(path,raw,0o600)), \
             patch.object(updater.time,'sleep',side_effect=wait):
            self.run_capture()
        self.assertEqual(self.f.events,['pause','wait_existing_backup','fingerprint','backup','fingerprint','timers_restored'])
        self.assertEqual(self.f.states['nodia-ai-backup-rotate.timer']['ActiveState'],'inactive')
        self.assertEqual(self.f.states['nodia-ai-backup-rotate.timer']['UnitFileState'],'disabled')

    def test_pause_failure_preserves_original_states_before_any_fingerprint_or_backup(self):
        original=self.f.updater.Host
        def host(*args):
            instance=original(*args);pause=instance.pause_timers
            def interrupted():
                pause();raise RuntimeError('synthetic_backup_units_still_busy')
            instance.pause_timers=interrupted;return instance
        self.f.updater.Host=host
        with self.assertRaisesRegex(RuntimeError,'backup_units_still_busy'):self.run_capture()
        failure=json.loads((self.record/'failure.json').read_bytes())
        self.assertEqual(failure['phase'],'timers_pausing');self.assertTrue(failure['timers_pause_requested'])
        self.assertFalse(failure['timers_paused']);self.assertFalse(failure['timers_restored'])
        self.assertTrue((self.record/'timers-before.json').exists());self.assertEqual(self.f.events,['pause'])
        self.assertFalse(failure['backup_side_effects_possible']);self.assertEqual(self.jobs,0);self.assertEqual(self.backup_calls,0)

    def test_invalid_fingerprint_digest_fails_before_backup(self):
        original=self.fingerprint_job
        def invalid(*args):return {**original(*args),'aggregate_sha256':'0'*64}
        self.fingerprint_job=invalid
        with self.assertRaisesRegex(ValueError,'capture_fingerprint_digest_invalid'):self.run_capture()
        self.assertEqual(self.backup_calls,0);self.assertTrue(self.f.apps);self.assertFalse(self.f.maintenance.exists())


if __name__=='__main__':unittest.main()
