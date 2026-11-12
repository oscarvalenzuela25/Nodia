#!/usr/bin/env python3
"""Fixed-command root boundary for CD. Reads bounded JSON then optional ZIP stdin.

Never executes uploaded code as root. Updates run detached in a fixed systemd unit;
repeated submissions only inspect recorded status, never replay an uncertain effect.
"""
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import time

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
INCOMING = STATE / 'incoming'
SUBMISSIONS = STATE / 'submissions'
MAX_UPLOAD = 768 * 1024 ** 2
MAX_INCOMING = 2 * 1024 ** 3
SAFE_ENV = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'TZ': 'UTC'}


def require(condition, code):
    if not condition: raise ValueError(code)


def unique_json(raw):
    def pairs(items):
        result = {}
        for name, value in items:
            require(name not in result, 'duplicate_json_key')
            result[name] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('invalid_json_number')))


def validate_message(value):
    require(isinstance(value, dict) and value.get('schema_version') == 1 and
            type(value['schema_version']) is int, 'invalid_receiver_message')
    command = value.get('command')
    fields = {'schema_version', 'command'}
    if command == 'status':
        require(set(value) in (fields, fields | {'operation_id'}), 'invalid_status_message')
    elif command == 'upload':
        require(set(value) == fields | {'artifact_id', 'artifact_zip_sha256', 'run_id', 'run_attempt', 'bytes'},
                'invalid_upload_message')
        require(type(value['bytes']) is int and 0 < value['bytes'] <= MAX_UPLOAD, 'invalid_upload_size')
    elif command == 'deploy':
        require(set(value) == fields | {'operation_id', 'artifact_id', 'artifact_zip_sha256', 'run_id',
                'run_attempt', 'source_sha', 'expected_current_release', 'expected_current_tree_sha256'},
                'invalid_deploy_message')
    else: raise ValueError('receiver_command_not_allowed')
    patterns = {'artifact_id': r'[1-9][0-9]{0,19}', 'run_id': r'[1-9][0-9]{0,19}',
                'run_attempt': r'[1-9][0-9]{0,5}', 'artifact_zip_sha256': r'[a-f0-9]{64}',
                'operation_id': r'[a-f0-9]{32}', 'source_sha': r'[a-f0-9]{40}',
                'expected_current_release': r'backend-[a-f0-9]{12}-[a-f0-9]{12}',
                'expected_current_tree_sha256': r'[a-f0-9]{64}'}
    for name, pattern in patterns.items():
        if name in value:
            require(isinstance(value[name], str) and re.fullmatch(pattern, value[name]), 'invalid_' + name)
    return value


def protect(path, mode=None, directory=False):
    info = path.lstat()
    require(path.resolve(strict=True) == path and info.st_uid == info.st_gid == 0 and
            not info.st_mode & 0o022, 'unsafe_receiver_path')
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode) and info.st_nlink == 1,
            'invalid_receiver_file_type')
    if mode is not None: require(stat.S_IMODE(info.st_mode) == mode, 'invalid_receiver_file_mode')
    return info


def bounded_json(path):
    info = protect(path, 0o600)
    require(info.st_size <= 16384, 'receiver_state_too_large')
    return unique_json(path.read_bytes())


def save_new(path, value):
    data = (json.dumps(value, sort_keys=True) + '\n').encode()
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), 0o600); stream.write(data); stream.flush(); os.fsync(stream.fileno())
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(directory)
    finally: os.close(directory)


def command(arguments, timeout=25):
    result = subprocess.run(arguments, capture_output=True, env=SAFE_ENV, timeout=timeout)
    require(result.returncode == 0, 'receiver_host_command_failed')
    return result.stdout.decode('utf-8')


def unit_state(unit):
    result = command(['/usr/bin/systemctl', 'show', unit, '--no-pager',
                      '--property=ActiveState,SubState,Result,MainPID,ControlGroup,DropInPaths'])
    return dict(line.split('=', 1) for line in result.splitlines() if '=' in line)


def operation_status(operation_id):
    submission = SUBMISSIONS / (operation_id + '.json')
    require(submission.exists(), 'operation_not_found')
    bounded_json(submission)
    state_path = STATE / 'attempts' / operation_id / 'state.json'
    result = {'schema_version': 1, 'status': 'operation_status', 'operation_id': operation_id,
              'phase': 'submitted', 'effects_started': False, 'migration_requested': False,
              'deployment_performed': False, 'automatic_retry_allowed': False}
    if state_path.exists():
        state = bounded_json(state_path)
        phase = state.get('phase')
        require(isinstance(phase, str) and re.fullmatch(r'[a-z_]{1,60}', phase), 'invalid_operation_phase')
        result.update(phase=phase, effects_started=state.get('effects_started') is True,
                      migration_requested=state.get('migration_requested') is True,
                      deployment_performed=phase == 'complete')
        if phase == 'failed':
            code = state.get('error_code', 'update_failed_inspect_private_state')
            require(isinstance(code, str) and re.fullmatch(r'[a-z0-9_]{1,100}', code), 'unsafe_error_code')
            result['error_code'] = code
    if result['phase'] not in ('complete', 'failed'):
        unit = unit_state('nodia-cd-' + operation_id + '.service')
        if unit.get('ActiveState') not in ('active', 'activating', 'deactivating'):
            result.update(phase='unknown', error_code='operation_requires_private_reconciliation')
    return result


def deployment_status():
    current = Path('/opt/nodia/current')
    require(current.is_symlink() and current.lstat().st_uid == current.lstat().st_gid == 0,
            'current_release_not_managed')
    release = current.resolve(strict=True)
    require(release.parent == Path('/opt/nodia/releases') and
            re.fullmatch(r'backend-[a-f0-9]{12}-[a-f0-9]{12}', release.name), 'invalid_current_release')
    protect(release, directory=True)
    manifest = release / 'release-manifest.json'
    require(protect(manifest, 0o644).st_size <= 32 * 1024 ** 2, 'current_manifest_too_large')
    value = unique_json(manifest.read_bytes())
    source, tree = value.get('source_sha'), value.get('package_tree_sha256')
    require(isinstance(source, str) and re.fullmatch(r'[a-f0-9]{40}', source) and
            isinstance(tree, str) and re.fullmatch(r'[a-f0-9]{64}', tree) and
            value.get('release_id') == release.name, 'invalid_current_identity')
    unresolved = (STATE / 'BLOCKED.json').exists()
    for directory in (STATE / 'attempts').iterdir():
        protect(directory, directory=True)
        state_path = directory / 'state.json'
        if state_path.exists():
            previous = bounded_json(state_path)
            if previous.get('effects_started') is True and previous.get('phase') not in ('complete', 'planned'):
                unresolved = True
    for path in SUBMISSIONS.glob('*.json'):
        if operation_status(path.stem)['phase'] not in ('complete', 'failed'): unresolved = True
    application = {}
    for label, unit, entry in (('api_active', 'nodia-api.service', 'dist/main.js'),
                               ('worker_active', 'nodia-ai-worker.service', 'dist/nodia-ai-worker.js')):
        state = unit_state(unit)
        application[label] = state.get('ActiveState') == 'active'
        if application[label]:
            pid = state.get('MainPID', '')
            require(pid.isdigit() and int(pid) > 1 and state.get('SubState') == 'running' and
                    state.get('Result') == 'success' and state.get('DropInPaths') == '' and
                    state.get('ControlGroup') == '/system.slice/' + unit, 'writer_process_not_verified')
            process = Path('/proc') / pid
            require(process.stat().st_uid == pwd.getpwnam('nodia').pw_uid and
                    (process / 'cwd').resolve(strict=True) == release and
                    os.path.samefile(process / 'exe', '/usr/local/bin/node') and
                    (process / 'cmdline').read_bytes().split(b'\0') ==
                    [b'/usr/local/bin/node', entry.encode(), b''], 'writer_release_identity_mismatch')
    return {'schema_version': 1, 'status': 'deployment_ready', 'user': 'nodia-deploy',
            'forced_command': True, 'privileged_helper_enabled': True, 'deployment_implemented': True,
            'deployment_requested': False, 'current': {'release_id': release.name, 'source_sha': source,
            'package_tree_sha256': tree}, 'blocked': unresolved,
            'application': application}


def incoming_inventory():
    size, count = 0, 0
    for directory in INCOMING.iterdir():
        protect(directory, 0o700, directory=True)
        require(re.fullmatch(r'server-[1-9][0-9]*-[1-9][0-9]*', directory.name), 'unknown_incoming_directory')
        for path in directory.iterdir():
            info = protect(path, 0o600)
            require(re.fullmatch(r'[1-9][0-9]*\.zip(?:\.part)?', path.name), 'unknown_incoming_file')
            size += info.st_size; count += 1
    return size, count


def receive_bytes(fd, output, expected_size, expected_hash, *, total_seconds=240, idle_seconds=20):
    deadline, size, digest = time.monotonic() + total_seconds, 0, hashlib.sha256()
    with selectors.DefaultSelector() as selector:
        selector.register(fd, selectors.EVENT_READ)
        while True:
            remaining = deadline - time.monotonic()
            require(remaining > 0 and selector.select(min(idle_seconds, remaining)), 'upload_timeout')
            block = os.read(fd, min(1024 * 1024, expected_size - size + 1))
            if not block: break
            size += len(block)
            require(size <= expected_size, 'upload_exceeds_declared_size')
            output.write(block); digest.update(block)
    require(size == expected_size and digest.hexdigest() == expected_hash, 'upload_size_or_digest_mismatch')


def upload(message, fd):
    require(not deployment_status()['blocked'], 'prior_update_requires_reconciliation')
    size, count = incoming_inventory()
    require(size + message['bytes'] <= MAX_INCOMING and count < 10, 'incoming_quota_reached_operator_cleanup_required')
    require(shutil.disk_usage(INCOMING).free > message['bytes'] + 2 * 1024 ** 3, 'insufficient_upload_headroom')
    directory = INCOMING / ('server-' + message['run_id'] + '-' + message['run_attempt'])
    if not directory.exists(): directory.mkdir(mode=0o700)
    protect(directory, 0o700, directory=True)
    target = directory / (message['artifact_id'] + '.zip')
    temporary = directory / (message['artifact_id'] + '.zip.part')
    require(not target.exists() and not temporary.exists(), 'upload_already_recorded_no_automatic_replay')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    # Preserve a partial file on failure for operator reconciliation; never execute it.
    with os.fdopen(descriptor, 'wb') as output:
        os.fchmod(output.fileno(), 0o600)
        receive_bytes(fd, output, message['bytes'], message['artifact_zip_sha256'])
        output.flush(); os.fsync(output.fileno())
    os.rename(temporary, target)
    parent = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(parent)
    finally: os.close(parent)
    return {'schema_version': 1, 'status': 'uploaded', 'artifact_id': message['artifact_id'],
            'artifact_zip_sha256': message['artifact_zip_sha256'], 'bytes': message['bytes'],
            'deployment_requested': False}


def submit(message):
    operation_id = message['operation_id']
    record = SUBMISSIONS / (operation_id + '.json')
    if record.exists():
        require(bounded_json(record)['message'] == message, 'operation_id_request_conflict')
        return operation_status(operation_id)  # Pure consultation; never start again.
    status = deployment_status()
    require(not status['blocked'], 'prior_update_requires_reconciliation')
    require(status['application']['api_active'] and status['application']['worker_active'], 'writers_not_active')
    require(status['current']['release_id'] == message['expected_current_release'] and
            status['current']['package_tree_sha256'] == message['expected_current_tree_sha256'],
            'expected_current_version_mismatch')
    artifact_directory = 'server-' + message['run_id'] + '-' + message['run_attempt']
    archive = INCOMING / artifact_directory / (message['artifact_id'] + '.zip')
    require(0 < protect(archive, 0o600).st_size <= MAX_UPLOAD, 'uploaded_artifact_required')
    request = {name: message[name] for name in ('operation_id', 'artifact_id', 'artifact_zip_sha256',
        'source_sha', 'expected_current_release', 'expected_current_tree_sha256')}
    request.update(schema_version=1, artifact_directory=artifact_directory)
    request_path = STATE / 'requests' / (operation_id + '.json')
    require(not request_path.exists(), 'operation_request_already_exists')
    # Durable submission precedes BOTH request creation and systemd invocation.
    save_new(record, {'schema_version': 1, 'message': message,
                     'submitted_at': datetime.datetime.now(datetime.timezone.utc).isoformat()})
    save_new(request_path, request)
    command(['/usr/bin/systemd-run', '--unit=nodia-cd-' + operation_id + '.service',
             '--property=Type=exec', '--property=User=root', '--property=Group=root',
             '--property=UMask=0077', '--property=StandardInput=null',
             '--property=StandardOutput=null', '--property=StandardError=null',
             '--property=Restart=no', '--property=TimeoutStopSec=30',
             '/usr/bin/python3', '-I', str(LIB / 'update-backend.py'), '--request', str(request_path), '--apply'])
    return {'schema_version': 1, 'status': 'submitted', 'operation_id': operation_id,
            'phase': 'submitted', 'deployment_requested': True, 'automatic_retry_allowed': False}


def read_header(fd):
    raw = bytearray()
    deadline = time.monotonic() + 10
    with selectors.DefaultSelector() as selector:
        selector.register(fd, selectors.EVENT_READ)
        while len(raw) <= 8192:
            require(selector.select(max(0, deadline - time.monotonic())), 'receiver_header_timeout')
            byte = os.read(fd, 1)  # Never buffer any ZIP bytes beyond the newline.
            require(byte, 'incomplete_receiver_header')
            if byte == b'\n': return validate_message(unique_json(raw))
            raw.extend(byte)
    raise ValueError('receiver_header_too_large')


def main():
    require(os.geteuid() == 0 and len(sys.argv) == 1 and
            Path(__file__).resolve() == LIB / 'deploy-backend-receiver.py', 'installed_root_receiver_required')
    require(os.environ.get('SUDO_USER') == 'nodia-deploy' and
            os.environ.get('SUDO_UID') == str(pwd.getpwnam('nodia-deploy').pw_uid), 'dedicated_deploy_identity_required')
    os.umask(0o077)
    for directory in (LIB, STATE, INCOMING, SUBMISSIONS, STATE / 'requests'):
        protect(directory, directory=True)
    settings = bounded_json(STATE / 'receiver-settings.json')
    for name, expected in settings['assets'].items():
        path = LIB / name
        require(name in ('deploy-backend-receiver.py', 'deploy-gateway.py') and
                protect(path).st_size < 100 * 1024 and
                hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'receiver_asset_changed')
    require(set(settings['assets']) == {'deploy-backend-receiver.py', 'deploy-gateway.py'}, 'receiver_assets_invalid')
    message = read_header(sys.stdin.fileno())
    lock = STATE / 'receiver.lock'
    protect(lock, 0o600)
    with lock.open('r+b') as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        if message['command'] == 'status':
            result = operation_status(message['operation_id']) if 'operation_id' in message else deployment_status()
        elif message['command'] == 'upload': result = upload(message, sys.stdin.fileno())
        else: result = submit(message)
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    try: main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'receiver_failed_inspect_private_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}), flush=True)
        sys.exit(1)
