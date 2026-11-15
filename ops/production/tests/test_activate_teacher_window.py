"""Teacher window safety with real root filesystem/locks and synthetic systemd/SQL boundaries."""
from contextlib import ExitStack
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

BASE=Path(__file__).resolve().parents[1]/'ai-runtime'
spec=importlib.util.spec_from_file_location('teacher_window',BASE/'activate-teacher-window.py')
window=importlib.util.module_from_spec(spec);spec.loader.exec_module(window)


@unittest.skipUnless(os.name=='posix' and os.geteuid()==0,'requires isolated Linux root ownership')
class TeacherWindowTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir='/root');self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.lib=self.root/'lib';self.state=self.root/'state';self.units=self.root/'units'
        self.registry=self.root/'config/consumers.json';self.env=self.root/'config/teacher-runtime.env'
        self.maintenance=self.root/'maintenance/backend';self.lock=self.root/'installation.lock'
        for p in (self.lib/'ai-runtime',self.state,self.units,self.registry.parent,self.maintenance.parent):p.mkdir(parents=True)
        self.write(self.lock,b'',0o600);self.write(self.state/'receiver.lock',b'',0o600)
        self.io=window.io_policy();self.events=[];self.started=0;self.activation_count=0;self.host_instances=0
        self.apps=True;self.partial_activation=False;self.fail_stop=False;self.dirty_post=False;self.empty_groups=True;self.drift_manifest=False
        self.inspections=[]
        self.states={name:{'ActiveState':'active','SubState':'running','Result':'success','MainPID':str(os.getpid()),'DropInPaths':''}
                     for name in self.io.RUNTIME_UNITS}
        for name in self.states:
            if name.endswith('.timer'):self.states[name].update(SubState='waiting',MainPID='0',UnitFileState='enabled')
        self.io.snapshot.__globals__['SYSTEMD']=self.units
        self.io.snapshot.__globals__['timer_enabled']=lambda unit:self.states[unit]['UnitFileState']
        self.current=self.root/'current';self.release=self.root/('backend-'+'a'*12+'-'+'b'*12);self.release.mkdir();self.current.symlink_to(self.release)
        manifest={'release_id':self.release.name,'source_sha':'a'*40,'package_tree_sha256':'b'*64,
                  'files':[{'path':'dist/migrations/1790000000000-Synthetic.js','type':'file'}]}
        self.write(self.release/'release-manifest.json',json.dumps(manifest).encode())
        self.settings={'schema_version':1,'assets':{},'service_hashes':{}}
        for name in self.io.ASSETS|set(window.PINS)|{'deploy-gateway.py'}:
            self.write(self.lib/name,('# Synthetic dependency '+name+'\n').encode(),0o755 if name=='deploy-gateway.py' else 0o644)
        self.settings['assets']={name:self.io.sha((self.lib/name).read_bytes()) for name in self.io.ASSETS}
        for name in self.io.BASE_UNITS:
            self.write(self.units/name,('# Synthetic base '+name+'\n').encode())
            self.settings['service_hashes'][name]=self.io.sha((self.units/name).read_bytes())
        self.write(self.state/'settings.json',json.dumps(self.settings).encode(),0o600)
        receiver_settings={'assets':{n:self.io.sha((self.lib/n).read_bytes()) for n in ['deploy-backend-receiver.py','deploy-gateway.py']}}
        self.write(self.state/'receiver-settings.json',json.dumps(receiver_settings).encode(),0o600)
        self.old_registry={'schema_version':1,'purpose':'nodia_ai_runtime_consumers','units':{unit:{'70-codex-runtime.conf':'c'*64,'71-gemini-runtime.conf':'d'*64} for unit in self.io.SERVICES}}
        self.write(self.registry,json.dumps(self.old_registry).encode(),0o600)
        self.hosts=self.root/'hosts';self.staged=self.root/'staged';self.hosts.mkdir();self.staged.mkdir()
        binary=b'Synthetic host. Never executed.\n';import hashlib
        self.binary_sha=hashlib.sha512(binary).hexdigest();self.write(self.hosts/('host-'+self.binary_sha),binary,0o755)
        prepared={'manifest_sha256':'e'*64,'binary_sha512':self.binary_sha}
        self.write(self.hosts/'prepared.json',json.dumps(prepared).encode())
        self.env_bytes=b'SYNTHETIC_HOST='+self.binary_sha.encode()+b'\n';self.write(self.staged/'teacher-runtime.env',self.env_bytes)
        binding={key:'f'*64 for key in window.RECOVERY_BINDINGS};binding['backup_id']='11111111-1111-4111-8111-111111111111'
        self.restore={'schema_version':1,'status':'verified','phase':'complete',**binding,'release_id':self.release.name,
            'release_manifest_sha256':self.io.sha((self.release/'release-manifest.json').read_bytes()),'source_sha':'a'*40,'package_tree_sha256':'b'*64,
            'before_prepare':{'status':'verified','source_content_verified_before_prepare':True,'fingerprint_sha256':'f'*64,'migrations_verified':1},
            'cleanup':{'plaintext_quarantine_volume_removed':True,'errors':[]},'restore_scope':'database_equality_only_before_prepare',
            'decryption':{'status':'decrypted','gcm_verified':True,'backup_id':binding['backup_id']},
            'release_authorized':False,'runtime_recovery_authorized':False,'journal_reconciled':False}
        self.restore_file=self.root/'restore.json';self.write(self.restore_file,json.dumps(self.restore).encode())
        self.plan={'schema':'teacher-runtime-window/1','window_id':'1'*32,'current_release':self.release.name,
            'current_manifest_sha256':self.restore['release_manifest_sha256'],'settings_sha256':self.io.sha((self.state/'settings.json').read_bytes()),
            'receiver_settings_sha256':self.io.sha((self.state/'receiver-settings.json').read_bytes()),'registry_before_sha256':self.io.sha(self.registry.read_bytes()),
            'prepared_receipt_sha256':self.io.sha((self.hosts/'prepared.json').read_bytes()),'binary_sha512':self.binary_sha,
            'staged_environment_sha256':self.io.sha(self.env_bytes),'restore_receipt_sha256':self.io.sha(self.restore_file.read_bytes()),
            'recovery':binding,'operator_pins':{n:self.io.sha((self.lib/n).read_bytes()) for n in window.PINS}}
        self.plan_file=self.root/'plan.json';self.seal()
        self.receiver=SimpleNamespace(deployment_status=self.ready,unit_state=lambda unit:dict(self.states.get(unit,{'DropInPaths':''})))
        self.activation=SimpleNamespace(preflight=self.preflight,http_smoke=self.http_smoke)
        self.updater=SimpleNamespace(Host=self.make_host,SERVICES=self.io.SERVICES,SYSTEMD_UNITS=self.units,
            TEACHER_RUNTIME_NAME='72-teacher-runtime.conf',TEACHER_RUNTIME_TEMPLATE=b'[Service]\nEnvironmentFile=/etc/nodia/teacher-runtime.env\n',
            teacher_runtime_descriptor=lambda:{'environment_sha256':self.io.sha(self.env.read_bytes()),'binary_sha512':self.binary_sha})
        self.prepare=SimpleNamespace(RECEIPT=self.hosts/'prepared.json',STAGED=self.staged,HOSTS=self.hosts,
            environment_bytes=lambda _:self.env_bytes,digest=lambda p,_:hashlib.sha512(p.read_bytes()).hexdigest(),activate=self.activate)
        self.safe=SimpleNamespace(read_regular=lambda p,mode:self.io.read_source(p,installed=True,mode=mode),checked=lambda p,mode:p.exists() and p.stat().st_mode&0o777==mode)
        modules={'update-backend.py':self.updater,'backend_update.py':SimpleNamespace(),'deploy-backend-receiver.py':self.receiver,
            'ai-runtime/prepare-teacher-runtime.py':self.prepare,'ai-runtime/activate-ai-runtime.py':self.activation,'ai-runtime/codex-provision.py':self.safe}
        self.io.load_bytes=lambda raw,path,_:modules[path.relative_to(self.lib).as_posix()]
        self.patch=ExitStack();self.addCleanup(self.patch.close)
        self.patch.enter_context(patch.object(window,'io_policy',return_value=self.io))
        self.patch.enter_context(patch.object(window.time,'sleep',return_value=None))
        for name,value in {'LIB':self.lib,'STATE':self.state,'CURRENT':self.current,'REGISTRY':self.registry,'ENVIRONMENT':self.env,
                           'MAINTENANCE':self.maintenance,'INSTALL_LOCK':self.lock}.items():self.patch.enter_context(patch.object(window,name,value))

    def write(self,path,raw,mode=0o644):
        path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw);path.chmod(mode)

    def seal(self):
        self.write(self.restore_file,json.dumps(self.restore).encode())
        self.plan['restore_receipt_sha256']=self.io.sha(self.restore_file.read_bytes())
        self.write(self.plan_file,json.dumps(self.plan).encode());self.plan_sha=self.io.sha(self.plan_file.read_bytes())
        self.record=self.state/('teacher-runtime-window-'+self.plan['window_id'])

    def run_window(self):return window.activate_window(self.plan_file,self.plan_sha,self.restore_file)

    def ready(self):
        return {'status':'deployment_ready','blocked':False,'application':{'api_active':self.apps,'worker_active':self.apps},
                'current':{'release_id':self.release.name,'source_sha':'a'*40,'package_tree_sha256':'b'*64}}

    def counts(self,n=0):
        values={name:0 for name in window.COUNTERS};values['teacher_jobs']=n
        return {'read_only':True,'client_tls_authorized':True,'quiescent':n==0,'counts':values}

    def preflight(self):
        if self.apps:raise RuntimeError('activation_command_failed')
        return self.counts(1 if self.dirty_post else 0)

    def locked(self):
        import fcntl
        for path in (self.state/'receiver.lock',self.lock):
            with path.open('r+b') as stream:
                with self.assertRaises(BlockingIOError):fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)

    def make_host(self,*_):
        self.host_instances+=1;owner=self;initial=self.io.sha(self.registry.read_bytes())
        class Host:
            def show(self,unit):return owner.receiver.unit_state(unit)
            def service_overrides(self,*_):pass
            def verify_writers(self,current):
                owner.assertTrue(owner.apps);owner.assertEqual(current,owner.release)
                owner.assertEqual(initial,owner.io.sha(owner.registry.read_bytes()),'new snapshot phase required')
                return {unit:'/system.slice/'+unit for unit in owner.io.SERVICES}
            def http(self,_,status):owner.assertEqual(owner.maintenance.exists(),status==503)
            def public_smoke(self):owner.assertFalse(owner.maintenance.exists())
            def pause_timers(self):
                owner.locked();owner.events.append('pause')
                before={u:{'active':owner.states[u]['ActiveState']=='active','enabled':owner.states[u]['UnitFileState']} for u in owner.states if u.endswith('.timer')}
                for unit in before:owner.states[unit]['ActiveState']='inactive'
                owner.io.exclusive(self.attempt/'timers-before.json',json.dumps(before).encode())
                return before
            def node_action(self,mode):
                owner.assertEqual(mode,'inspect');owner.events.append('inspect')
                return owner.inspections.pop(0) if owner.inspections else owner.counts()
            def stop_writers(self):
                owner.locked();owner.events.append('stop');owner.apps=False
                for unit in owner.io.SERVICES:owner.states[unit]['ActiveState']='inactive';owner.states[unit]['MainPID']='0'
                if owner.drift_manifest:(owner.release/'release-manifest.json').write_bytes(b'changed')
                if owner.fail_stop:raise RuntimeError('synthetic_stop_failure')
            def cgroup_empty(self,_):return owner.empty_groups
            def command(self,args,_seconds):
                owner.locked();owner.assertEqual(args[:2],['/usr/bin/systemctl','start']);owner.assertGreater(owner.activation_count,0)
                owner.events.append('start');owner.started+=1;owner.apps=True
                for unit in owner.io.SERVICES:owner.states[unit]['ActiveState']='active';owner.states[unit]['MainPID']=str(os.getpid())
            def restore_timers(self,before):
                owner.locked();owner.events.append('timers_restored')
                for unit,value in before.items():owner.states[unit]['ActiveState']='active' if value['active'] else 'inactive'
        return Host()

    def activate(self,*_):
        self.locked();self.assertFalse(self.apps);self.activation_count+=1;self.events.append('activate')
        self.preflight();self.io.exclusive(self.env,self.env_bytes,0o644)
        if self.partial_activation:raise RuntimeError('synthetic_partial_activation')
        for unit in self.io.SERVICES:
            self.io.exclusive(self.units/(unit+'.d')/'72-teacher-runtime.conf',self.updater.TEACHER_RUNTIME_TEMPLATE,0o644)
        value=json.loads(self.registry.read_bytes());value['teacher_host']=self.updater.teacher_runtime_descriptor()
        for unit in self.io.SERVICES:value['units'][unit]['72-teacher-runtime.conf']=self.io.sha(self.updater.TEACHER_RUNTIME_TEMPLATE)
        self.io.replace(self.registry,json.dumps(value).encode(),0o600)
        return {'status':'teacher_runtime_activated_consumers_still_stopped','binary_sha512':self.binary_sha}

    def http_smoke(self):self.assertTrue(self.apps);self.assertTrue(self.maintenance.exists())

    def test_exact_happy_window_holds_both_locks_through_start_and_restores_timers(self):
        for unit in self.io.SERVICES:(self.units/(unit+'.d')).mkdir()
        result=self.run_window()
        self.assertEqual(result['status'],'teacher_runtime_window_complete');self.assertEqual(self.started,1)
        self.assertEqual(self.events,['pause','inspect','stop','activate','start','timers_restored'])
        self.assertEqual(self.host_instances,2);self.assertFalse(self.maintenance.exists())
        self.assertEqual(json.loads((self.record/'registry-before.json').read_bytes()),self.old_registry)
        self.assertEqual(len(json.loads((self.record/'before.json').read_bytes())['absent_paths']),3)
        self.assertFalse((self.state/'attempts').exists());self.assertFalse(result['provider_calls'])

    def test_bad_backup_binding_or_restore_scope_fails_before_record_or_stop(self):
        for change in ({'cipher_sha256':'a'*64},{'runtime_recovery_authorized':True},{'schema_version':True},
                       {'decryption':{'status':'decrypted','gcm_verified':False,'backup_id':self.plan['recovery']['backup_id']}},
                       {'before_prepare':{**self.restore['before_prepare'],'migrations_verified':0}}):
            original=dict(self.restore);self.restore.update(change);self.seal()
            with self.assertRaises(ValueError):self.run_window()
            self.assertFalse(self.record.exists());self.assertEqual(self.events,[])
            self.restore=original

    def test_live_work_drains_with_verified_inspect_instead_of_exit2_preflight(self):
        for unit in self.io.SERVICES:(self.units/(unit+'.d')).mkdir()
        self.inspections=[self.counts(1),self.counts()]
        self.run_window();self.assertEqual(self.events.count('inspect'),2)

    def test_failed_stop_leaves_maintenance_and_timers_without_any_restart_or_replay(self):
        self.fail_stop=True
        with self.assertRaises(RuntimeError):self.run_window()
        self.assertTrue(self.maintenance.exists());self.assertEqual(self.started,0)
        self.assertEqual(json.loads((self.record/'failure.json').read_bytes())['phase'],'stop_requested')
        with self.assertRaisesRegex(ValueError,'window_already_reserved_no_replay'):self.run_window()

    def test_nonquiet_after_stop_or_nonempty_cgroup_never_activates(self):
        self.dirty_post=True
        with self.assertRaisesRegex(ValueError,'nine_readonly_counters_unverified'):self.run_window()
        self.assertEqual(self.activation_count,0);self.assertEqual(self.started,0)

    def test_nonempty_cgroup_after_stop_never_activates_or_restarts(self):
        self.empty_groups=False
        with self.assertRaisesRegex(ValueError,'writer_cgroup_not_empty'):self.run_window()
        self.assertEqual(self.activation_count,0);self.assertEqual(self.started,0)

    def test_partial_activation_preserves_unknown_state_and_never_starts(self):
        self.partial_activation=True
        with self.assertRaises(RuntimeError):self.run_window()
        self.assertTrue(self.env.exists());self.assertTrue(self.maintenance.exists());self.assertEqual(self.started,0)
        self.assertEqual(json.loads(self.registry.read_bytes()),self.old_registry)

    def test_current_manifest_drift_after_stop_is_rechecked_before_activation(self):
        self.drift_manifest=True
        with self.assertRaisesRegex(ValueError,'current_changed_before_activation'):self.run_window()
        self.assertEqual(self.activation_count,0);self.assertEqual(self.started,0)

    def test_existing_maintenance_owner_is_never_replaced(self):
        self.write(self.maintenance,b'other-owner\n')
        with self.assertRaisesRegex(ValueError,'maintenance_already_owned'):self.run_window()
        self.assertEqual(self.maintenance.read_bytes(),b'other-owner\n');self.assertFalse(self.record.exists())

    def test_receiver_and_installation_lock_contention_prevents_reservation(self):
        import fcntl
        for path in (self.state/'receiver.lock',self.lock):
            with path.open('r+b') as stream:
                fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):self.run_window()
            self.assertFalse(self.record.exists())

    def test_reviewed_operator_digest_drift_rejects_before_maintenance(self):
        (self.lib/'ai-runtime/prepare-teacher-runtime.py').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'window_operator_pin_changed'):self.run_window()
        self.assertFalse(self.record.exists());self.assertFalse(self.maintenance.exists())

    def test_original_inactive_disabled_timer_state_is_restored_without_enable(self):
        for unit in self.io.SERVICES:(self.units/(unit+'.d')).mkdir()
        timer='nodia-ai-backup.timer';self.states[timer].update(ActiveState='inactive',UnitFileState='disabled')
        self.run_window();self.assertEqual(self.states[timer]['ActiveState'],'inactive');self.assertEqual(self.states[timer]['UnitFileState'],'disabled')


if __name__=='__main__':unittest.main()
