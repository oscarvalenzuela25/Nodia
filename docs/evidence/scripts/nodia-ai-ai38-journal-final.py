"""Start already-installed timers after authenticated restore, inspect final state."""
from pathlib import Path
import importlib.util,json,subprocess,time,hashlib,os
source=Path('/tmp/nodia-ai-ai38-journal-activate.py')
assert hashlib.sha256(source.read_bytes()).hexdigest()=='56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
spec=importlib.util.spec_from_file_location('activation',source);a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
_,helpers=a.load_helpers()
before=json.loads((a.WORK/'activation-before.json').read_bytes())['runtime']
consumers=a.active_new_processes()
a.checked(['systemctl','start','nodia-ai-backup-rotate.service'],timeout=40)
a.checked(['systemctl','start',*a.TIMERS],timeout=15)
# Persistent calendar may dispatch a catch-up backup; observe its known job, never replay it.
for attempt in range(60):
    states={u:a.state(u) for u in ('nodia-ai-backup','nodia-ai-backup-rotate')}
    if all(s['active'] not in ('activating','active') for s in states.values()): break
    time.sleep(.5)
assert all(s['active']=='inactive' for s in states.values())
services={}
for unit in states:
    raw=a.checked(['systemctl','show',unit,'--property=Result,ExecMainStatus','--no-pager']).decode()
    fields=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
    assert fields=={'Result':'success','ExecMainStatus':'0'}
    services[unit]=fields
timers={}
for unit in a.TIMERS:
    raw=a.checked(['systemctl','show',unit,'--property=ActiveState,NextElapseUSecRealtime,LastTriggerUSec','--no-pager']).decode()
    fields=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
    assert fields['ActiveState']=='active'
    assert a.checked(['systemctl','is-enabled',unit]).decode().strip()=='enabled'
    timers[unit]=fields
status=a.journal('status');assert status['unconfirmed']==status['expired_backups']==0 and status['backups']>=1
assert a.active_new_processes()==consumers
assert helpers['native_epoch']()==before['Gemini']
assert helpers['schema_and_selection']()==before['SQL_schema_and_selection']
assert helpers['original_files']()==before['frozen_original_Node']['manifest_sha256']
assert a.sha(a.NGINX)==a.NGINX_SHA
package=a.manifest();quiet=a.wait_quiet(helpers)
private=Path('/opt/nodia/verification/ai38-journal-combined/config.private.json')
assert private.is_file() and not private.is_symlink() and private.stat().st_uid==0
assert not Path(str(private)+'.combined-ledger.json').exists()
private.unlink()
spool=Path('/var/lib/nodia-ai-recovery/spool')
assert sorted(p.name for p in spool.iterdir())==['.backup.lock']
result=dict(status='journal_backup_rotation_operational_linux_lab',consumers=consumers,
            package=package,timers=timers,oneshot_results=services,external_status=status,quiet=quiet,
            Gemini_unchanged=True,nginx_unchanged=True,schema_and_selection_unchanged=True,
            original_932_outputs_unchanged=True,combined_private_config_removed=True,
            encrypted_spool_empty_except_lock=True,configured_SQL_writes=0,provider_requests=0,
            private_RSA_key_sent_to_VM=False,legacy_29_dumps_managed=False,
            seven_days_wall_time_observed=False,release_authorized=False)
a.freeze('operational-final.json',result)
print(json.dumps(result))
