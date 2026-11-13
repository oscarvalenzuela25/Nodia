"""Real systemd/PID/cgroup/journal integration with explicit synthetic application boundaries."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
import uuid

assert os.geteuid() == 0 and Path('/.dockerenv').exists()
assert Path('/proc/1/comm').read_text().strip() == 'systemd'


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


policy = load('fixture_policy', '/input/backend_update.py')
host_module = load('fixture_host', '/input/update-backend.py')
stage = load('fixture_stage', '/input/stage.py')
ROOT = Path('/opt/nodia')
OLD = ROOT / 'releases/backend-111111111111-222222222222'
NEW = ROOT / 'releases/backend-333333333333-444444444444'
FINAL = ROOT / 'releases/backend-555555555555-666666666666'
STATE = Path('/var/lib/nodia-updates')
FIXTURE = ROOT / 'fixture'
checks = 0


def check(condition, message):
    global checks
    assert condition, message
    checks += 1


def command(args):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=40).stdout


def write(path, content, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8', newline='\n')
    path.chmod(mode)


command(['groupadd', '--gid', '900', 'nodia'])
command(['useradd', '--uid', '900', '--gid', '900', '--no-create-home', '--shell', '/usr/sbin/nologin', 'nodia'])
for path in (STATE, STATE / 'attempts', Path('/var/lib/nodia-maintenance'),
             Path('/etc/nodia'), Path('/usr/local/lib/nodia'), FIXTURE,
             Path('/var/lib/nodia/config'), Path('/var/lib/nodia/home'), Path('/var/lib/nodia/codex'),
             Path('/var/lib/nodia/backups/spool')):
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(0o700 if path == STATE / 'attempts' else 0o755)
for path in (Path('/var/lib/nodia/home'), Path('/var/lib/nodia/codex'), Path('/var/lib/nodia/backups/spool')):
    os.chown(path, 900, 900); path.chmod(0o700)
for name in ('runtime.env', 'redis.env'):
    write(Path('/etc/nodia') / name, '# Synthetic fixture; no credentials\n', 0o600)
write(FIXTURE / 'backup-mode', 'fresh\n')

api = '''import http from 'node:http';
const server=http.createServer((_request,response)=>{response.end('synthetic-api');});
server.listen(3000,'127.0.0.1');
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
'''
worker = '''setInterval(()=>{},1000);
process.on('SIGTERM',()=>process.exit(0));
'''
backup = '''import fs from 'node:fs';import{randomUUID}from'node:crypto';
const now=new Date();const old=fs.readFileSync('/opt/nodia/fixture/backup-mode','utf8').trim()==='stale';
const captured=new Date(now.getTime()-(old?3600000:0));
if(process.argv[2]==='backup')console.log(JSON.stringify({schema_version:1,operation:'backup',
status:'ready',backup_id:randomUUID(),captured_at:captured.toISOString(),
expires_at:new Date(now.getTime()+7*86400000).toISOString(),cipher_bytes:1024,
cipher_sha256:'a'.repeat(64),encryption_key_id:'b'.repeat(64),journal_sequence:0,
rotated:{removed:0,pending_recovered:0,retained:0}}));
else console.log(JSON.stringify({schema_version:1,operation:'rotate',removed:0,pending_recovered:0,retained:0}));
'''
journal = "console.log(JSON.stringify({operation:'reconcile',confirmed:0,pending:0,SQL_writes:0}));\n"
for release in (OLD, NEW, FINAL):
    write(release / 'package.json', '{"type":"module","synthetic_fixture":true}\n')
    write(release / 'dist/main.js', api)
    write(release / 'dist/nodia-ai-worker.js', worker)
    write(release / 'scripts/nodia-ai-backups.mjs', backup)
    write(release / 'scripts/nodia-ai-journal.mjs', journal)
os.symlink(OLD, ROOT / 'current')

# A narrow real sandbox regression, not a substitute for full runtime validation.
# The fixture payload uses no credentials, DB, provider accounts or network.
state_action = FIXTURE / 'writable-state-probe.mjs'
write(state_action, '''import fs from 'node:fs';
const state=['/var/lib/nodia/home','/var/lib/nodia/codex'];
const result={schema_version:1,status:'failed',writable_state:false};
try {
  for(const directory of state){
    const info=fs.statSync(directory);
    if(!info.isDirectory()||info.uid!==900||(info.mode&0o777)!==0o700)throw Error('metadata');
    fs.accessSync(directory,fs.constants.W_OK);
  }
  result.writable_state=true;
  for(const directory of state){
    const file=directory+'/synthetic-sandbox-'+process.pid;
    fs.writeFileSync(file,'synthetic fixture',{flag:'wx',mode:0o600});fs.unlinkSync(file);
  }
  const readonly=['/var/lib/nodia/config/synthetic-writable-file',process.cwd()+'/synthetic-writable-file'];
  result.protected_paths_readonly=readonly.every(file=>{
    try{const fd=fs.openSync(file,'a');fs.closeSync(fd);return false;}
    catch(error){return error.code==='EROFS';}
  });
  const status=fs.readFileSync('/proc/self/status','utf8');
  result.unprivileged=process.getuid()===900&&process.geteuid()===900&&process.getgid()===900
    &&/^NoNewPrivs:\\s+1$/m.test(status)&&/^CapEff:\\s+0+$/m.test(status);
  if(!result.protected_paths_readonly||!result.unprivileged)throw Error('sandbox');
  result.status='verified';
}catch(error){result.error_code=error.code??'fixture_contract';process.exitCode=1;}
console.log(JSON.stringify(result));
''')
for path in (Path('/var/lib/nodia/config/synthetic-writable-file'), OLD / 'synthetic-writable-file'):
    write(path, 'synthetic protected fixture\n', 0o600)
    os.chown(path, 900, 900)
rw_line = 'ReadWritePaths=/var/lib/nodia/home /var/lib/nodia/codex\n'
source = Path('/input/update-backend.py').read_text(encoding='utf-8')
check(source.count(rw_line) == 1, 'exact two persistent writable state paths configured')
legacy_source = FIXTURE / 'legacy-readonly-updater.py'
write(legacy_source, source.replace(rw_line, ''))
legacy_module = load('legacy_readonly_host', legacy_source)
legacy = legacy_module.Host(policy, stage, {})
legacy.attempt = STATE / 'legacy-sandbox'; legacy.attempt.mkdir(mode=0o700)
legacy.candidate = OLD
try:
    legacy.node_job(state_action, [])
except policy.Rejected as error:
    check(str(error) == 'host_command_failed_inspect_private_diagnostics', 'original sandbox rejects writable state access')
else: raise AssertionError('original sandbox unexpectedly allowed state writes')
legacy_results = list(legacy.attempt.glob('*.json'))
check(len(legacy_results) == 1 and json.loads(legacy_results[0].read_bytes()) ==
      {'schema_version':1,'status':'failed','writable_state':False,'error_code':'EROFS'},
      'original sandbox failure is specifically writable state')
sandbox = host_module.Host(policy, stage, {})
sandbox.attempt = STATE / 'corrected-sandbox'; sandbox.attempt.mkdir(mode=0o700)
sandbox.candidate = OLD
sandbox_result = sandbox.node_job(state_action, [])
check(sandbox_result == {'schema_version':1,'status':'verified','writable_state':True,
                        'protected_paths_readonly':True,'unprivileged':True},
      'corrected real node_job permits only reviewed state and retains readonly unprivileged sandbox')
check(not list(Path('/run/systemd/system').glob('nodia-update-action-*.service')),
      'both sandbox probes clean their temporary inactive units')


def backup_environment(release):
    values = {'NODIA_AI_BACKUP_SCRIPT': str(release / 'scripts/nodia-ai-backups.mjs'),
              'NODIA_AI_JOURNAL_SCRIPT': str(release / 'scripts/nodia-ai-journal.mjs'),
              'NODIA_AI_BACKUP_CONFIG': '/var/lib/nodia/config/backup.json',
              'NODIA_AI_RECOVERY_CONFIG': '/var/lib/nodia/config/recovery.json'}
    write(Path('/etc/nodia/backup-runner.env'), ''.join(f'{key}={value}\n' for key, value in values.items()), 0o600)


backup_environment(OLD)
for name, entry in (('nodia-api.service', 'main.js'), ('nodia-ai-worker.service', 'nodia-ai-worker.js')):
    write(Path('/etc/systemd/system') / name, f'''[Unit]
Description=Synthetic updater systemd fixture
[Service]
Type=exec
User=nodia
Group=nodia
WorkingDirectory=/opt/nodia/current
ExecStart=/usr/local/bin/node dist/{entry}
KillSignal=SIGTERM
KillMode=mixed
TimeoutStopSec=10
''')
for name, cli in (('nodia-ai-backup.service', '${NODIA_AI_BACKUP_SCRIPT} backup ${NODIA_AI_BACKUP_CONFIG}'),
                  ('nodia-ai-backup-rotate.service', '${NODIA_AI_BACKUP_SCRIPT} rotate ${NODIA_AI_BACKUP_CONFIG}'),
                  ('nodia-ai-journal-reconcile.service', '${NODIA_AI_JOURNAL_SCRIPT} reconcile ${NODIA_AI_RECOVERY_CONFIG} ${NODIA_AI_BACKUP_CONFIG}')):
    dependencies = 'Requires=nodia-ai-journal-reconcile.service\nAfter=nodia-ai-journal-reconcile.service\n' if name == 'nodia-ai-backup.service' else ''
    write(Path('/etc/systemd/system') / name, f'''[Unit]
Description=Synthetic journal/backup fixture, no database or object storage
{dependencies}[Service]
Type=oneshot
User=nodia
Group=nodia
WorkingDirectory=/opt/nodia/current
EnvironmentFile=/etc/nodia/backup-runner.env
ExecStart=/usr/local/bin/node {cli}
StandardOutput=journal
StandardError=journal
''')
for name, target in (('nodia-ai-backup.timer', 'nodia-ai-backup.service'),
                     ('nodia-ai-backup-rotate.timer', 'nodia-ai-backup-rotate.service')):
    write(Path('/etc/systemd/system') / name, f'''[Unit]
Description=Synthetic long-delay timer
[Timer]
OnActiveSec=1d
Unit={target}
[Install]
WantedBy=timers.target
''')

proxy = '''from http.server import BaseHTTPRequestHandler,HTTPServer
from pathlib import Path
import urllib.request
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if Path('/var/lib/nodia-maintenance/backend').exists(): self.send_response(503);self.end_headers();return
  try:
   response=urllib.request.urlopen('http://127.0.0.1:3000/api/v1',timeout=1)
   self.send_response(response.status);self.end_headers();self.wfile.write(response.read())
  except Exception: self.send_response(502);self.end_headers()
 def log_message(self,*args): pass
HTTPServer(('127.0.0.1',8080),Handler).serve_forever()
'''
write(FIXTURE / 'proxy.py', proxy)
write(Path('/etc/systemd/system/nodia-fixture-proxy.service'), '''[Unit]
Description=Explicit synthetic HTTP boundary; no Nginx/TLS assertion
[Service]
Type=exec
ExecStart=/usr/bin/python3 -I /opt/nodia/fixture/proxy.py
''')
action = '''const mode=process.argv[2];
console.log(JSON.stringify({schema_version:1,status:mode==='migrate'?'migrated':'verified',
mode,client_tls_authorized:true,read_only:mode!=='migrate',quiescent:true,
before:45,target:46,pending:mode==='inspect'?1:0,incremental_migrations:1,applied:mode==='migrate'?1:0}));
'''
probe = { 'schema_version': 1, 'status': 'verified', 'checks': {
    'local_configuration': 'passed', 'postgres': {'status':'passed','database_matched':True,
    'server_version_num':160015,'transaction_read_only':True,'client_tls_authorized':True,
    'client_tls_protocol':'TLSv1.3','backend_tls':True},
    'redis':{'status':'passed','authenticated_ping':True},'r2':{'status':'passed','head_bucket':True}},
    'application_started':False,'migrations_executed':False,'mutations_requested':False }
write(Path('/usr/local/lib/nodia/update-backend-action.mjs'), action)
write(Path('/usr/local/lib/nodia/probe-backend-dependencies.mjs'), 'console.log('+json.dumps(json.dumps(probe))+');\n')
command(['systemctl', 'daemon-reload'])
command(['systemctl', 'enable', 'nodia-ai-backup.timer'])
command(['systemctl', 'start', 'nodia-api.service', 'nodia-ai-worker.service', 'nodia-fixture-proxy.service', 'nodia-ai-backup.timer'])
for _ in range(40):
    try:
        if urllib.request.urlopen('http://127.0.0.1:8080/api/v1', timeout=1).status == 200: break
    except Exception: time.sleep(0.1)
else: raise AssertionError('synthetic API/proxy failed to start')
# Seed one real prior invocation so cursor+InvocationID freshness is tested, not assumed.
command(['systemctl', 'start', '--wait', 'nodia-ai-backup.service'])
command(['journalctl', '--sync'])


class FixtureHost(host_module.Host):
    """Only GitHub/artifact and HTTP destination boundaries are substituted.

    systemctl/journalctl, node_job, PIDs/cgroups, timers, files and policy remain real.
    SQL/probe programs are explicit synthetic commands, independently covered by SQL39.
    """
    next_release = NEW
    def prepare(self, request):
        self.current = host_module.CURRENT.resolve(strict=True)
        self.candidate = self.next_release
        self.groups = self.verify_writers(self.current)
        self.backup_environment(self.current)
        self.metadata = {'package_tree_sha256': 'b'*64, 'ci': {'synthetic_fixture': True}}
        return {'candidate_release': self.candidate.name, 'source_sha': request['source_sha']}
    def http(self, url, status):
        if url.startswith('https://166.0.112.187/'):
            url = 'http://127.0.0.1:8080/api/v1'
        return super().http(url, status)


def request(current):
    return {'schema_version':1,'operation_id':uuid.uuid4().hex,'artifact_directory':'server-1-1',
            'artifact_id':'1','artifact_zip_sha256':'a'*64,'source_sha':'3'*40,
            'expected_current_release':current.name,'expected_current_tree_sha256':'a'*64}


host = FixtureHost(policy, stage, {})
before_invocation = host.show('nodia-ai-backup.service')['InvocationID']
result = policy.run_update(request(OLD), host, apply=True)
check(result['phase']=='complete' and result['deployment_performed'], 'full ordered policy completed')
check(host_module.CURRENT.resolve(strict=True)==NEW, 'current switched to candidate')
check(host.backup_environment(NEW)['NODIA_AI_BACKUP_SCRIPT'].startswith(str(NEW)), 'canonical backup script paths switched')
check(host.show('nodia-api.service')['ActiveState']=='active', 'API restarted under systemd')
check(host.show('nodia-ai-worker.service')['ActiveState']=='active', 'worker restarted under systemd')
check(host.verify_writers(NEW)==host.groups, 'real PID/cwd/executable/cgroup identities match candidate')
check(host.show('nodia-ai-backup.timer')['ActiveState']=='active' and host.show('nodia-ai-backup.timer')['UnitFileState']=='enabled', 'enabled active timer restored')
check(host.show('nodia-ai-backup-rotate.timer')['ActiveState']=='inactive' and host.show('nodia-ai-backup-rotate.timer')['UnitFileState']=='disabled', 'disabled inactive timer stays unchanged')
check(host.show('nodia-ai-backup.service')['InvocationID']!=before_invocation, 'backup InvocationID is fresh')
check(not host_module.MAINTENANCE.exists(), 'maintenance flag removed after readiness')
check(json.loads((STATE/'deployed-backend.json').read_text())['release_id']==NEW.name, 'durable deployed manifest records switched release')
check(not list(Path('/run/systemd/system').glob('nodia-update-action-*.service')), 'temporary action units removed')
check(not (STATE/'BLOCKED.json').exists(), 'successful update is not blocked')

# A stale ready message in a NEW real invocation must block before stopping writers.
write(FIXTURE/'backup-mode','stale\n')
second = FixtureHost(policy, stage, {});second.next_release=FINAL
try:
    policy.run_update(request(NEW),second,apply=True)
except policy.Rejected as error:
    check(str(error)=='backup_ready_time_invalid','stale backup timestamp is rejected despite new InvocationID')
else: raise AssertionError('stale backup incorrectly accepted')
check(host_module.CURRENT.resolve(strict=True)==NEW,'stale backup does not switch current')
check(second.show('nodia-api.service')['ActiveState']=='active' and second.show('nodia-ai-worker.service')['ActiveState']=='active','stale backup failure preserves running writers')
check(host_module.MAINTENANCE.exists(),'failure keeps admission fencing')
check((STATE/'BLOCKED.json').exists(),'failure records reconciliation block')
check(second.show('nodia-ai-backup.timer')['ActiveState']=='inactive','failure does not silently resume timers')
failed=json.loads((second.attempt/'state.json').read_text())
check(failed['failed_phase']=='backup_requested' and not failed['migration_requested'],'failure phase precedes migration intent')

print(json.dumps({'schema_version':1,'status':'passed','checks':checks,
 'writable_state_sandbox':{'original_unit_rejected':True,'corrected_unit_passed':True,
                         'config_and_release_readonly':True,'nodia_uid_gid':900,'state_modes':'0700',
                         'no_new_privileges':True,'effective_capabilities_zero':True,'full_validator_claimed':False},
 'real_systemd_pid1':True,'systemd_version':command(['/usr/lib/systemd/systemd','--version']).splitlines()[0],
 'real_systemctl_and_journalctl':True,'node_version':command(['/usr/local/bin/node','--version']).strip(),
 'real_writers_uid':900,'fresh_backup_invocation_verified':True,'stale_backup_failure_blocked':True,
 'successful_update':result,'synthetic_boundaries':['application services and encrypted backup result','SQL action and remote dependency probe programs','GitHub artifact prepare','public HTTP mapped to synthetic local proxy; no Nginx/TLS claim'],
 'host_cgroup_bind':False,'host_secrets_mounted':False,'production_accessed':False,'typescript_builds':0}))
