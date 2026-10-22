"""Adopt the verified successor without resetting the live external journal era."""
from pathlib import Path
import hashlib,importlib.util,json,os,subprocess,time
from datetime import datetime,timezone
p=Path('/tmp/nodia-ai-ai38-journal-activate.py')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
spec=importlib.util.spec_from_file_location('activation',p);a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
expected=json.loads(input())
assert set(expected)=={'archive_sha256','manifest_sha256'}
old=a.RELEASE;new=Path('/opt/nodia/releases/nodia-server-ai38-journal-r02')
raw=(new/'release-manifest.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()==expected['manifest_sha256']
manifest=json.loads(raw)
assert manifest['knowledge_release']==a.KNOWLEDGE
for name,digest in manifest['files'].items():
    target=new/name
    assert target.resolve().is_relative_to(new) and not target.is_symlink() and target.is_file()
    assert hashlib.sha256(target.read_bytes()).hexdigest()==digest
_,helpers=a.load_helpers()
baseline=json.loads((a.WORK/'activation-before.json').read_bytes())['runtime']
assert not (a.WORK/'upgrade-r02.json').exists()
def wait_oneshots():
    for attempt in range(60):
        if all(a.state(u)['active'] in ('inactive','failed') for u in ('nodia-ai-backup','nodia-ai-backup-rotate')): return
        time.sleep(.5)
    raise RuntimeError('backup_runner_still_busy')
def replace_exact(path,old_text,new_text,count):
    assert path.resolve()==path and path.is_file() and path.stat().st_uid==0
    text=path.read_text();assert text.count(old_text)==count and new_text not in text
    temporary=path.with_name(path.name+'.r02-next')
    a.write_new(temporary,text.replace(old_text,new_text).encode(),path.stat().st_mode&0o777)
    temporary.replace(path)
before_status=a.journal('status')
assert before_status['backups']==2 and before_status['unconfirmed']==0
try:
    a.checked(['systemctl','stop',*a.TIMERS]);wait_oneshots()
    a.checked(['systemctl','stop','nodia-api'],timeout=60);assert a.stopped('nodia-api')
    a.wait_quiet(helpers)
    a.checked(['systemctl','stop','nodia-ai-worker'],timeout=60)
    assert all(a.stopped(u) for u in a.CONSUMERS)
    for unit in a.CONSUMERS:
        path=Path('/etc/systemd/system')/(unit+'.service.d')/'zz-ai38-journal.conf'
        replace_exact(path,str(old),str(new),2)
    replace_exact(a.RUNNER_ENV,str(old),str(new),2)
    a.checked(['systemctl','daemon-reload'])
    a.RELEASE=new
    for unit in a.CONSUMERS: assert a.state(unit)['working_directory']==str(new)
    a.checked(['systemctl','start',*a.CONSUMERS],timeout=45)
    consumers=a.wait_health()
    status=a.journal('status')
    assert status['coverage_from']==before_status['coverage_from'] and status['backups']==2 and status['last_sequence']==before_status['last_sequence']
    a.checked(['systemctl','start','nodia-ai-backup-rotate.service'],timeout=40)
    a.checked(['systemctl','start','nodia-ai-backup.service'],timeout=60)
    services={}
    for unit in ('nodia-ai-backup','nodia-ai-backup-rotate'):
        raw=a.checked(['systemctl','show',unit,'--property=Result,ExecMainStatus,ExecMainStartTimestamp','--no-pager']).decode()
        value=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
        assert value['Result']=='success' and value['ExecMainStatus']=='0' and value['ExecMainStartTimestamp']
        services[unit]=value
    a.checked(['systemctl','start',*a.TIMERS])
    assert all(a.state(u)['active']=='active' for u in a.TIMERS)
    status=a.journal('status');assert status['backups']==3 and status['unconfirmed']==status['expired_backups']==0
    assert helpers['native_epoch']()==baseline['Gemini']
    assert helpers['schema_and_selection']()==baseline['SQL_schema_and_selection']
    assert helpers['original_files']()==baseline['frozen_original_Node']['manifest_sha256']
    assert a.sha(a.NGINX)==a.NGINX_SHA
    assert a.active_new_processes()==consumers
    assert sorted(p.name for p in Path('/var/lib/nodia-ai-recovery/spool').iterdir())==['.backup.lock']
    result=dict(status='successor_R02_journal_and_encrypted_backups_operational',observed_at_VM_utc=datetime.now(timezone.utc).isoformat(),
       manifest_sha256=expected['manifest_sha256'],dist_outputs=sum(name.startswith('dist/') for name in manifest['files']),
       knowledge_release=manifest['knowledge_release'],consumers=consumers,external_status=status,services=services,
       timers_active=True,external_era_preserved=True,bootstrap_replayed=False,coverage_interrupted_by_legacy=False,
       quiet=helpers['quiet'](),Gemini_unchanged=True,nginx_unchanged=True,schema_and_selection_unchanged=True,
       original_932_outputs_unchanged=True,ciphertext_spool_empty=True,configured_SQL_writes=0,provider_requests=0,
       business_effects=0,migrations=0,private_RSA_key_sent_to_VM=False,release_authorized=False)
    a.freeze('upgrade-r02.json',result);print(json.dumps(result))
except Exception:
    subprocess.run(['systemctl','stop',*a.TIMERS,'nodia-api','nodia-ai-worker'],capture_output=True,timeout=60)
    print(json.dumps(dict(status='upgrade_failed_writers_stopped_no_legacy_rollback',raw_details_emitted=False)))
    raise SystemExit(1)
