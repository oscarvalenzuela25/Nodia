"""Synthetic app, actual installed transport; never calls remote providers."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import pwd
import stat
import subprocess
import time
import uuid
import zipfile

assert os.geteuid() == 0 and Path('/.dockerenv').exists()
assert Path('/proc/1/comm').read_text().strip() == 'systemd'
CHECKS = []
SOURCE = Path('/input')
LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
OLD = Path('/opt/nodia/releases/backend-111111111111-222222222222')


def check(value, name):
    assert value, name
    CHECKS.append(name)


def run(args, *, data=None, ok=True, timeout=40):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    if ok and result.returncode:
        raise AssertionError((args, result.returncode, result.stdout.decode(errors='replace'), result.stderr.decode(errors='replace')))
    return result


def write(path, content, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content.encode() if isinstance(content, str) else content)
    path.chmod(mode)


def load(path):
    spec = importlib.util.spec_from_file_location(path.stem.replace('-', '_'), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def json_command(args):
    return json.loads(run(args).stdout)


run(['groupadd', '--gid', '900', 'nodia'])
run(['useradd', '--uid', '900', '--gid', '900', '--no-create-home', '--shell', '/usr/sbin/nologin', 'nodia'])
for name in ('config', 'home', 'codex', 'backups/spool'):
    path = Path('/var/lib/nodia') / name
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(0o755)
    if name != 'config': os.chown(path, 900, 900)
for name in ('runtime.env', 'redis.env'):
    write(Path('/etc/nodia') / name, '# Synthetic fixture: no production credentials\n', 0o600)
write(LIB / 'validate-runtime-env.mjs', '// Synthetic runtime validation boundary\n')
api = "import http from 'node:http';const s=http.createServer((q,r)=>r.end('synthetic-api'));s.listen(3000,'127.0.0.1');process.on('SIGTERM',()=>s.close(()=>process.exit(0)));\n"
worker = "setInterval(()=>{},1000);process.on('SIGTERM',()=>process.exit(0));\n"
write(OLD / 'package.json', '{"type":"module","synthetic_transport_fixture":true}\n')
write(OLD / 'dist/main.js', api)
write(OLD / 'dist/nodia-ai-worker.js', worker)
write(OLD / 'scripts/nodia-ai-backups.mjs', "throw Error('synthetic backup must never run in failed preflight');\n")
write(OLD / 'scripts/nodia-ai-journal.mjs', "throw Error('synthetic journal must never run in failed preflight');\n")
stage = load(SOURCE / 'stage-backend-candidate.py')
inventory = []
for path in sorted(OLD.rglob('*')):
    if path.is_file():
        content = path.read_bytes()
        inventory.append({'path': path.relative_to(OLD).as_posix(), 'type': 'file', 'mode': '0644',
                          'size': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
tree = hashlib.sha256(json.dumps(inventory, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
manifest = dict.fromkeys(stage.MANIFEST_KEYS)
# This deliberately synthetic local manifest exercises local inventory validation only.
# Remote provenance remains untrusted; the offline GitHub lookup must reject the update.
manifest.update(schema_version=1, release_id=OLD.name, source_sha='1' * 40,
                source_provenance='git_archive', deployment_eligible=True,
                package_tree_sha256=tree, files=inventory)
write(OLD / 'release-manifest.json', json.dumps(manifest) + '\n')
Path('/opt/nodia/current').symlink_to(OLD)
write(Path('/etc/nodia/backup-runner.env'),
      f'NODIA_AI_BACKUP_SCRIPT={OLD}/scripts/nodia-ai-backups.mjs\n'
      f'NODIA_AI_JOURNAL_SCRIPT={OLD}/scripts/nodia-ai-journal.mjs\n'
      'NODIA_AI_BACKUP_CONFIG=/var/lib/nodia/config/backup.json\n'
      'NODIA_AI_RECOVERY_CONFIG=/var/lib/nodia/config/recovery.json\n', 0o600)
write(Path('/var/lib/nodia-backend-setup/installation.lock'), '', 0o600)
for path in SOURCE.glob('*.service'):
    write(Path('/etc/systemd/system') / path.name, path.read_bytes())
for path in SOURCE.glob('*.timer'):
    write(Path('/etc/systemd/system') / path.name, path.read_bytes())

# Actual reviewed Nginx proxy, only its certificate is a synthetic localhost fixture.
cert = Path('/etc/letsencrypt/live/nodia-api-ip')
cert.mkdir(parents=True)
run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
     '-subj', '/CN=synthetic-transport-fixture', '-keyout', str(cert / 'privkey.pem'),
     '-out', str(cert / 'fullchain.pem')])
Path('/etc/nginx/sites-enabled/default').unlink(missing_ok=True)
write(Path('/etc/nginx/sites-available/nodia-api.conf'), (SOURCE / 'nodia-api.nginx.conf').read_bytes())
Path('/etc/nginx/sites-enabled/nodia-api.conf').symlink_to('/etc/nginx/sites-available/nodia-api.conf')
run(['systemctl', 'daemon-reload'])
run(['systemctl', 'start', 'nginx', 'nodia-api.service', 'nodia-ai-worker.service'])
check(run(['systemctl', 'is-active', 'nodia-api.service', 'nodia-ai-worker.service']).stdout == b'active\nactive\n', 'real_reviewed_writer_units_active')
before_pids = run(['systemctl', 'show', 'nodia-api.service', 'nodia-ai-worker.service', '-p', 'MainPID']).stdout

key = Path('/root/fixture-key')
run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(key)])
prepared = json_command(['python3', '-I', str(SOURCE / 'bootstrap-deploy-identity.py'),
                         '--public-key', str(key) + '.pub', '--public-key-sha256',
                         hashlib.sha256(Path(str(key) + '.pub').read_bytes()).hexdigest()])
check(prepared['status'] == 'identity_prepared', 'dedicated_locked_account_prepared_with_generated_key')
transport = load(SOURCE / 'install-production-cd.py')
bundle = Path('/root/fixture-bundle')
prepared = transport.prepare(bundle)
installed = transport.install(bundle, prepared['bundle_manifest_sha256'])
check(installed['status'] == 'production_cd_transport_installed' and not installed['deployment_performed'], 'real_bundle_prepare_install_without_deployment')
run(['visudo', '-c'])
check(True, 'installed_sudoers_passes_real_visudo')

# Bind localhost only, use pinned generated host key; no container or host published port.
Path('/run/sshd').mkdir(exist_ok=True)
run(['ssh-keygen', '-A'])
host = Path('/etc/ssh/ssh_host_ed25519_key.pub').read_text().split()
write(Path('/root/fixture-known-hosts'), f'[127.0.0.1]:2222 {host[0]} {host[1]}\n', 0o600)
write(Path('/root/fixture-sshd.conf'), '''Port 2222
ListenAddress 127.0.0.1
HostKey /etc/ssh/ssh_host_ed25519_key
PidFile /run/fixture-sshd.pid
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
UsePAM yes
StrictModes yes
AuthorizedKeysFile .ssh/authorized_keys
AllowUsers nodia-deploy
Subsystem sftp internal-sftp
''', 0o600)
write(Path('/etc/systemd/system/nodia-fixture-sshd.service'), '''[Service]
Type=exec
ExecStart=/usr/sbin/sshd -D -e -f /root/fixture-sshd.conf
''')
run(['systemctl', 'daemon-reload'])
run(['systemctl', 'start', 'nodia-fixture-sshd.service'])
ssh_args = ['ssh', '-T', '-p', '2222', '-i', str(key), '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
            '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=/root/fixture-known-hosts',
            '-o', 'GlobalKnownHostsFile=/dev/null', '-o', 'ConnectTimeout=5']


def ssh(command, data=None, ok=True):
    result = run([*ssh_args, 'nodia-deploy@127.0.0.1', command], data=data, ok=ok)
    body = json.loads(result.stdout) if result.stdout.strip() else None
    return result, body


_, status = ssh('status')
check(status['status'] == 'deployment_ready' and status['forced_command'] and
      status['application'] == {'api_active': True, 'worker_active': True} and not status['blocked'],
      'ssh_forced_command_status_verifies_live_processes')
account = pwd.getpwnam('nodia-deploy')
check(Path(account.pw_dir).stat().st_uid == 0 and
      Path(account.pw_dir, '.ssh/authorized_keys').stat().st_uid == 0,
      'deploy_identity_cannot_replace_home_or_authorized_keys')
denied = run(['runuser', '-u', 'nodia-deploy', '--', 'sudo', '-n', '/usr/bin/true'], ok=False)
check(denied.returncode != 0, 'arbitrary_sudo_command_denied')
denied = run(['runuser', '-u', 'nodia-deploy', '--', 'sudo', '-n', '/usr/bin/python3', '-I',
              str(LIB / 'deploy-backend-receiver.py'), 'extra-argument'], ok=False)
check(denied.returncode != 0, 'sudo_receiver_extra_argument_denied')
for command, label in [('id', 'arbitrary_shell_command_denied'),
                       ('status; touch /tmp/transport-shell-escaped', 'shell_metacharacters_denied'),
                       ('', 'interactive_shell_denied')]:
    result, body = ssh(command, ok=False)
    check(result.returncode != 0 and body['status'] == 'failed', label)
check(not Path('/tmp/transport-shell-escaped').exists(), 'shell_metacharacters_never_executed')
sftp = run([*ssh_args, '-s', 'nodia-deploy@127.0.0.1', 'sftp'], ok=False)
check(sftp.returncode != 0 and json.loads(sftp.stdout)['status'] == 'failed', 'sftp_subsystem_denied_by_forced_command')

zipped = io.BytesIO()
with zipfile.ZipFile(zipped, 'w') as archive:
    archive.writestr('SYNTHETIC-UNTRUSTED.txt', 'No executable release: transport test only.\n')
data = zipped.getvalue()
digest = hashlib.sha256(data).hexdigest()
upload_command = f'upload 101 {digest} 1001 1 {len(data)}'
_, uploaded = ssh(upload_command, data)
target = STATE / 'incoming/server-1001-1/101.zip'
check(uploaded['status'] == 'uploaded' and target.read_bytes() == data and
      stat.S_IMODE(target.stat().st_mode) == 0o600 and target.stat().st_uid == 0,
      'zip_uploaded_exact_bytes_hash_root_owned_private_file')
check(stat.S_IMODE(target.parent.stat().st_mode) == 0o700, 'incoming_directory_private')
result, body = ssh(upload_command, data, ok=False)
check(result.returncode != 0 and body['error_code'] == 'upload_already_recorded_no_automatic_replay',
      'duplicate_upload_never_overwrites')
result, body = ssh(f'upload 102 {"0" * 64} 1002 1 {len(data)}', data, ok=False)
check(result.returncode != 0 and body['error_code'] == 'upload_size_or_digest_mismatch' and
      not (STATE / 'incoming/server-1002-1/102.zip').exists() and
      (STATE / 'incoming/server-1002-1/102.zip.part').exists(), 'wrong_digest_retains_partial_without_final_zip')
result, body = ssh(f'upload 103 {digest} 1003 1 {len(data)}', data[:5], ok=False)
check(result.returncode != 0 and not (STATE / 'incoming/server-1003-1/103.zip').exists(), 'truncated_upload_denied_without_final_zip')

operation = uuid.uuid4().hex
deploy_command = f'deploy {operation} 101 {digest} 1001 1 {"3" * 40} {OLD.name} {tree}'
_, submitted = ssh(deploy_command)
check(submitted['status'] == 'submitted', 'ssh_deploy_submitted_to_real_async_systemd_unit')
for _ in range(100):
    _, operation_status = ssh('status ' + operation)
    if operation_status['phase'] == 'failed': break
    time.sleep(0.2)
check(operation_status['phase'] == 'failed' and not operation_status['effects_started'] and
      not operation_status['migration_requested'], 'offline_github_preflight_failure_has_no_effects')
attempt = STATE / 'attempts' / operation
state = json.loads((attempt / 'state.json').read_bytes())
check((attempt / '101.zip').read_bytes() == data and state['failed_phase'] == 'preparing' and
      state['error_code'] == 'update_failed_inspect_private_diagnostics', 'preflight_reaches_github_after_local_hash_inventory_and_process_checks')
unit_before = run(['systemctl', 'show', 'nodia-cd-' + operation + '.service', '-p', 'InvocationID']).stdout
state_before = (attempt / 'state.json').stat().st_mtime_ns
_, duplicate = ssh(deploy_command)
check(duplicate['status'] == 'operation_status' and duplicate['phase'] == 'failed' and
      (attempt / 'state.json').stat().st_mtime_ns == state_before and
      run(['systemctl', 'show', 'nodia-cd-' + operation + '.service', '-p', 'InvocationID']).stdout == unit_before,
      'duplicate_operation_consults_durable_status_without_replay')
check(Path('/opt/nodia/current').resolve() == OLD and
      run(['systemctl', 'show', 'nodia-api.service', 'nodia-ai-worker.service', '-p', 'MainPID']).stdout == before_pids,
      'failed_preflight_preserves_current_and_both_original_writer_pids')
check(not (STATE / 'BLOCKED.json').exists() and not Path('/var/lib/nodia-maintenance/backend').exists(),
      'failed_preflight_never_enables_maintenance_or_blocked_marker')
_, status = ssh('status')
check(not status['blocked'] and status['current']['release_id'] == OLD.name,
      'transport_remains_consultable_after_safe_failed_preflight')
print(json.dumps({'schema_version': 1, 'status': 'passed', 'checks': len(CHECKS), 'passed': CHECKS,
                  'boundaries': {'ssh_sudo_systemd_nginx': 'real', 'app_and_manifest': 'synthetic',
                                 'network': 'none_localhost_only', 'github': 'offline_preflight_failure',
                                 'postgres_r2_ai': 'not_accessed', 'production_secrets': False,
                                 'successful_deployment_claimed': False}}))
