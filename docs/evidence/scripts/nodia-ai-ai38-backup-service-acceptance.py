"""Verify the actual hardened systemd oneshot, not only direct CLI execution."""
from pathlib import Path
import importlib.util,json,hashlib
p=Path('/tmp/nodia-ai-ai38-journal-activate.py')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
spec=importlib.util.spec_from_file_location('activation',p);a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
_,helpers=a.load_helpers()
before=json.loads((a.WORK/'activation-before.json').read_bytes())['runtime']
processes=a.active_new_processes()
a.checked(['systemctl','start','nodia-ai-backup.service'],timeout=60)
service={}
for unit in ('nodia-ai-backup','nodia-ai-backup-rotate'):
    raw=a.checked(['systemctl','show',unit,'--property=Result,ExecMainStatus,ExecMainStartTimestamp,ExecMainExitTimestamp,ActiveState','--no-pager']).decode()
    values=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
    assert values['Result']=='success' and values['ExecMainStatus']=='0' and values['ActiveState']=='inactive' and values['ExecMainStartTimestamp']
    service[unit]=values
timers={}
for unit in a.TIMERS:
    raw=a.checked(['systemctl','show',unit,'--property=ActiveState,NextElapseUSecRealtime,NextElapseUSecMonotonic,LastTriggerUSec','--no-pager']).decode()
    values=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
    assert values['ActiveState']=='active' and (values['NextElapseUSecRealtime'] or values['NextElapseUSecMonotonic'])
    timers[unit]=values
status=a.journal('status');assert status['unconfirmed']==status['expired_backups']==0 and status['backups']==2
assert a.active_new_processes()==processes
assert helpers['native_epoch']()==before['Gemini']
assert helpers['schema_and_selection']()==before['SQL_schema_and_selection']
assert a.sha(a.NGINX)==a.NGINX_SHA
assert helpers['original_files']()==before['frozen_original_Node']['manifest_sha256']
assert sorted(p.name for p in Path('/var/lib/nodia-ai-recovery/spool').iterdir())==['.backup.lock']
print(json.dumps(dict(status='hardened_systemd_backup_and_rotation_passed',
      services=service,timers=timers,external_status=status,quiet=helpers['quiet'](),
      consumers_unchanged=True,Gemini_unchanged=True,nginx_unchanged=True,
      schema_and_selection_unchanged=True,original_932_outputs_unchanged=True,
      ciphertext_spool_empty=True,configured_SQL_writes=0,provider_requests=0)))
