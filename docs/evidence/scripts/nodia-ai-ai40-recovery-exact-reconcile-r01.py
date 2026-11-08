"""One exact completed native reconciliation in the retained disposable fixture."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

WORK = Path('/opt/nodia/verification/ai40-recovery-exact-reconcile-r01')
SOURCE = WORK / 'nodia-ai-ai40-recovery-exact-reconcile-r01.mjs'
SOURCE_SHA = '04a490584227e81e0f80179de1ece6102d7ec80c6d3851557e0c1d13a2e0f24b'
CONTAINER = 'template_ai40_3503696_c1fef0e4'
RELEASE = Path('/opt/nodia/releases/nodia-server-ai40-r07')


def require(value, code):
    if not value:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_once(path, value):
    require(path.parent == WORK, 'receipt_path_invalid')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w', encoding='utf8', newline='\n') as stream:
        json.dump(value, stream); stream.flush(); os.fsync(stream.fileno())
    directory = os.open(WORK, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try: os.fsync(directory)
    finally: os.close(directory)


def run(args):
    require(sys.platform == 'linux' and os.getuid() == 0 and not sys.flags.optimize, 'linux_root_required')
    require(sha(Path(__file__).resolve()) == args.operator_sha256, 'operator_pin_mismatch')
    for path in (SOURCE, Path(__file__).resolve()):
        info = path.lstat()
        require(path.resolve() == path and stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600, 'operator_file_identity_invalid')
    require(sha(SOURCE) == SOURCE_SHA and WORK.resolve() == WORK and stat.S_IMODE(WORK.stat().st_mode) == 0o700, 'source_or_work_invalid')
    require(args.authorize_one_exact_reconciliation is (args.phase == 'reconcile'), 'reconciliation_authorization_mismatch')
    require(not (WORK / 'intent-reconcile.json').exists(), 'exact_reconciliation_intent_consumed')
    observed = subprocess.run(['docker', 'inspect', CONTAINER], capture_output=True, timeout=10, check=True)
    value = json.loads(observed.stdout); require(len(value) == 1, 'fixture_inspection_invalid'); fixture = value[0]
    require(fixture['Name'] == '/' + CONTAINER and fixture['State']['Running'] is True and fixture['Config']['Image'] == 'postgres:16-alpine', 'fixture_identity_invalid')
    ports = fixture['NetworkSettings']['Ports']['5432/tcp']
    require(len(ports) == 1 and ports[0]['HostIp'] == '127.0.0.1', 'fixture_binding_invalid')
    port = int(ports[0]['HostPort']); require(1024 < port <= 65535 and port != 5432, 'fixture_port_invalid')
    env = dict(item.split('=', 1) for item in fixture['Config']['Env'] if '=' in item)
    require(env['POSTGRES_USER'] == env['POSTGRES_DB'] == 'ai40' and re.fullmatch('[a-f0-9]{40}', env['POSTGRES_PASSWORD']), 'fixture_database_invalid')
    payload = {'container': CONTAINER, 'execute': args.phase == 'reconcile', 'options': {'host': '127.0.0.1', 'port': port, 'username': 'ai40', 'database': 'ai40', 'password': env['POSTGRES_PASSWORD']}}
    # Only broker address transport is inherited; no operational SQL/config/auth values.
    keyring_pid = subprocess.run(['systemctl', 'show', 'nodia-keyring', '--property=MainPID', '--value'], capture_output=True, timeout=10, check=True).stdout.decode().strip()
    require(re.fullmatch('[1-9][0-9]*', keyring_pid), 'keyring_process_invalid')
    broker = {}
    for item in Path('/proc', keyring_pid, 'environ').read_bytes().split(b'\0'):
        key, separator, val = item.partition(b'=')
        if separator and key in (b'DBUS_SESSION_BUS_ADDRESS', b'XDG_RUNTIME_DIR'):
            broker[key.decode()] = val.decode()
    require(set(broker) == {'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR'} and broker['DBUS_SESSION_BUS_ADDRESS'] == 'unix:path=' + broker['XDG_RUNTIME_DIR'] + '/bus', 'broker_transport_invalid')
    public = {'schema': 'nodia-ai-ai40-recovery-exact-reconcile-operator-v1', 'phase': args.phase, 'operator_sha256': args.operator_sha256, 'source_sha256': SOURCE_SHA, 'container': CONTAINER, 'container_id': fixture['Id'], 'image_id': fixture['Image'], 'loopback_port': port, 'provider_requests': 0}
    if args.phase == 'reconcile':
        prior = json.loads((WORK / 'receipt-preflight.json').read_bytes())
        require(prior.get('status') == 'preflight_passed' and prior.get('operator_sha256') == args.operator_sha256 and prior.get('source_sha256') == SOURCE_SHA and prior.get('container_id') == fixture['Id'], 'successful_exact_preflight_required')
        write_once(WORK / 'intent-reconcile.json', {**public, 'mutation_may_have_started': True, 'job_id': 'eda1889e-e710-4b2e-ab14-e094a6420850', 'attempt_id': 'caa4505e-6566-470a-8438-fdcb64dc67b6'})
    run_env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory', **broker}
    child = subprocess.run(['/usr/sbin/runuser', '--preserve-environment', '-u', 'nodia', '--', '/usr/local/bin/node', '--input-type=module', '-e', SOURCE.read_text()], input=json.dumps(payload).encode(), capture_output=True, cwd=RELEASE, env=run_env, timeout=90)
    require(len(child.stdout) <= 1048576, 'child_output_exceeded')
    result = json.loads(child.stdout)
    write_once(WORK / ('child-reconcile.json' if args.phase == 'reconcile' else 'child-preflight.json'), result)
    require(child.returncode == 0 and result.get('status') == ('passed' if args.phase == 'reconcile' else 'preflight_passed') and result.get('provider_requests') == 0 and result.get('RunStage_called') is False, 'exact_child_failed_inspect_same_identity')
    report = {**public, 'status': result['status'], 'child': result, 'fixture_removed': False, 'replay_allowed': False, 'private_stderr_emitted': False}
    write_once(WORK / ('receipt-reconcile.json' if args.phase == 'reconcile' else 'receipt-preflight.json'), report)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['preflight', 'reconcile']); parser.add_argument('--operator-sha256', required=True)
    parser.add_argument('--authorize-one-exact-reconciliation', action='store_true'); args = parser.parse_args()
    try: print(json.dumps(run(args)))
    except Exception as error:
        value = str(error)
        print(json.dumps({'schema': 'nodia-ai-ai40-recovery-exact-reconcile-operator-v1', 'status': 'operator_failed', 'error_class': type(error).__name__, 'error_code': value if isinstance(error, ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}', value) else 'operator_dependency_or_protocol_error', 'mutation_may_have_started': (WORK / 'intent-reconcile.json').exists(), 'provider_requests': 0, 'replay_allowed': False, 'private_details_emitted': False})); sys.exit(1)
