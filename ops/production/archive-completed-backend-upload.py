#!/usr/bin/env python3
"""Operator-only reversible archive of one completed, noncurrent backend ZIP.

Dry-run by default. An exclusive durable intent precedes the move; interruptions
require operator inspection and never permit automatic replay or overwrite.
"""
import argparse
from contextlib import ExitStack
import ctypes
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from types import ModuleType

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
RECEIVER = 'deploy-backend-receiver.py'
GATEWAY = 'deploy-gateway.py'


def require(condition, code):
    if not condition:
        raise ValueError(code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def occupied(path):
    return path.exists() or path.is_symlink()


def file_identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns,
            info.st_mode, info.st_uid, info.st_gid, info.st_nlink)


def protected(path, mode=None, directory=False):
    info = path.lstat()
    require(path.resolve(strict=True) == path and info.st_uid == info.st_gid == 0
            and not info.st_mode & 0o022, 'unsafe_archive_path')
    require(stat.S_ISDIR(info.st_mode) if directory else
            stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'invalid_archive_path_type')
    require(mode is None or stat.S_IMODE(info.st_mode) == mode, 'invalid_archive_mode')
    return info


def read_file(path, mode=0o600, maximum=16384):
    info = protected(path, mode)
    require(0 < info.st_size <= maximum, 'archive_input_size_invalid')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        require(file_identity(os.fstat(stream.fileno())) == file_identity(info), 'archive_input_changed')
        raw = stream.read(maximum + 1)
    require(len(raw) == info.st_size, 'archive_input_changed')
    return raw


def unique_json(raw):
    def pairs(items):
        value = {}
        for name, item in items:
            require(name not in value, 'duplicate_json_key')
            value[name] = item
        return value
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: require(False, 'invalid_json_number'))


def read_json(path):
    raw = read_file(path)
    value = unique_json(raw)
    require(type(value) is dict, 'archive_object_required')
    return value, sha(raw)


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def save_new(path, value):
    raw = (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
    require(len(raw) <= 1024 * 1024, 'archive_record_too_large')
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    sync_directory(path.parent)


def zip_digest(path):
    info = protected(path, 0o600)
    require(0 < info.st_size <= 768 * 1024 ** 2, 'archive_zip_size_invalid')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        require(file_identity(os.fstat(stream.fileno())) == file_identity(info), 'archive_zip_changed')
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        require(file_identity(os.fstat(stream.fileno())) == file_identity(info), 'archive_zip_changed')
    return info.st_size, digest


def load_receiver(expected):
    settings_raw = read_file(STATE / 'receiver-settings.json')
    settings = unique_json(settings_raw)
    require(type(settings) is dict and type(settings.get('schema_version')) is int and
            settings['schema_version'] == 1 and type(settings.get('assets')) is dict and
            set(settings['assets']) == {RECEIVER, GATEWAY}, 'invalid_receiver_settings')
    source = read_file(LIB / RECEIVER, 0o644, 100 * 1024)
    gateway = read_file(LIB / GATEWAY, 0o755, 100 * 1024)
    require(sha(source) == expected == settings['assets'][RECEIVER] and
            sha(gateway) == settings['assets'][GATEWAY], 'reviewed_receiver_digest_required')
    module = ModuleType('reviewed_archive_receiver')
    module.__file__ = str(LIB / RECEIVER)
    exec(compile(source, module.__file__, 'exec'), module.__dict__)
    return module, sha(settings_raw)


def operation_state(operation_id):
    directory = STATE / 'attempts' / operation_id
    protected(directory, 0o700, directory=True)
    state, digest = read_json(directory / 'state.json')
    require(type(state.get('schema_version')) is int and state['schema_version'] == 1 and
            state.get('operation_id') == operation_id and state.get('phase') == 'complete',
            'archive_reference_not_complete')
    return digest


def reference_files(directory):
    files = list(directory.iterdir())
    require(len(files) <= 1000, 'archive_reference_limit')
    for path in files:
        require(re.fullmatch(r'[a-f0-9]{32}\.json', path.name), 'unknown_archive_reference')
        protected(path, 0o600)
    return files


def rename_noreplace(source, destination):
    # Linux atomic no-clobber move on the same filesystem. No link/unlink window.
    libc = ctypes.CDLL(None, use_errno=True)
    require(hasattr(libc, 'renameat2'), 'archive_atomic_noreplace_unavailable')
    libc.renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    libc.renameat2.restype = ctypes.c_int
    if libc.renameat2(-100, os.fsencode(source), -100, os.fsencode(destination), 1) != 0:
        raise OSError(ctypes.get_errno(), 'archive_move_failed_inspect_intent')


def archive(operation_id, artifact_sha256, receiver_sha256, *, apply=False):
    require(os.geteuid() == 0, 'root_required')
    require(re.fullmatch(r'[a-f0-9]{32}', operation_id or '') and
            all(re.fullmatch(r'[a-f0-9]{64}', value or '') for value in (artifact_sha256, receiver_sha256)) and
            type(apply) is bool, 'reviewed_archive_identity_required')
    for directory in (LIB, STATE, INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            protected(parent, directory=True)
    for directory in ('incoming', 'submissions', 'requests', 'attempts'):
        protected(STATE / directory, 0o700, directory=True)
    with ExitStack() as stack:
        for path in (STATE / 'receiver.lock', INSTALL_LOCK):
            require(protected(path, 0o600).st_size == 0, 'invalid_archive_lock')
            stream = stack.enter_context(path.open('r+b'))
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        record = STATE / ('archive-completed-upload-' + operation_id)
        require(not occupied(record), 'archive_intent_already_recorded_no_automatic_replay')
        receiver, receiver_settings_sha = load_receiver(receiver_sha256)
        before = receiver.deployment_status()
        require(before.get('status') == 'deployment_ready' and before.get('blocked') is False and
                before.get('application') == {'api_active': True, 'worker_active': True}, 'archive_gateway_not_ready')
        submission, submission_sha = read_json(STATE / 'submissions' / (operation_id + '.json'))
        require(set(submission) == {'schema_version', 'message', 'submitted_at'} and
                type(submission['schema_version']) is int and submission['schema_version'] == 1,
                'invalid_archive_submission')
        message = receiver.validate_message(submission['message'])
        require(message['command'] == 'deploy' and message['operation_id'] == operation_id and
                message['artifact_zip_sha256'] == artifact_sha256, 'archive_submission_identity_mismatch')
        require(message['source_sha'] != before.get('current', {}).get('source_sha'), 'current_upload_cannot_be_archived')
        status = receiver.operation_status(operation_id)
        require(status.get('phase') == 'complete' and status.get('deployment_performed') is True,
                'archive_operation_not_complete')
        state_sha = operation_state(operation_id)
        artifact_directory = 'server-' + message['run_id'] + '-' + message['run_attempt']
        expected_request = {name: message[name] for name in ('operation_id', 'artifact_id', 'artifact_zip_sha256',
                            'source_sha', 'expected_current_release', 'expected_current_tree_sha256')}
        expected_request.update(schema_version=1, artifact_directory=artifact_directory)
        request, request_sha = read_json(STATE / 'requests' / (operation_id + '.json'))
        require(request == expected_request, 'archive_request_identity_mismatch')
        references = {}
        for path in reference_files(STATE / 'submissions'):
            value, digest = read_json(path)
            other = receiver.validate_message(value.get('message'))
            require(other.get('command') == 'deploy' and other.get('operation_id') == path.stem,
                    'invalid_archive_reference')
            if (other['run_id'], other['run_attempt'], other['artifact_id']) == (message['run_id'], message['run_attempt'], message['artifact_id']):
                require(other['artifact_zip_sha256'] == artifact_sha256, 'archive_reference_digest_conflict')
                references[str(path.relative_to(STATE))] = digest
                references['attempts/' + path.stem + '/state.json'] = operation_state(path.stem)
        for path in reference_files(STATE / 'requests'):
            other, digest = read_json(path)
            if (other.get('artifact_directory'), other.get('artifact_id')) == (artifact_directory, message['artifact_id']):
                require(other.get('artifact_zip_sha256') == artifact_sha256 and other.get('operation_id') == path.stem,
                        'archive_reference_digest_conflict')
                references[str(path.relative_to(STATE))] = digest
                references['attempts/' + path.stem + '/state.json'] = operation_state(path.stem)
        source_directory = STATE / 'incoming' / artifact_directory
        protected(source_directory, 0o700, directory=True)
        source = source_directory / (message['artifact_id'] + '.zip')
        require(not occupied(source.with_suffix('.zip.part')), 'archive_partial_requires_reconciliation')
        size, digest = zip_digest(source)
        require(digest == artifact_sha256, 'archive_zip_digest_mismatch')
        destination_root = STATE / 'archived-incoming'
        destination_directory = destination_root / artifact_directory
        for directory in (destination_root, destination_directory):
            if occupied(directory):
                protected(directory, 0o700, directory=True)
        destination = destination_directory / source.name
        require(not occupied(destination), 'archive_destination_already_exists')
        closest = destination_directory if destination_directory.exists() else destination_root if destination_root.exists() else STATE
        require(source_directory.stat().st_dev == closest.stat().st_dev, 'archive_same_filesystem_required')
        identity = {'schema_version': 1, 'operation_id': operation_id, 'artifact_directory': artifact_directory,
                    'artifact_id': message['artifact_id'], 'artifact_zip_sha256': digest, 'bytes': size,
                    'source_sha': message['source_sha'], 'receiver_sha256': receiver_sha256,
                    'receiver_settings_sha256': receiver_settings_sha, 'submission_sha256': submission_sha,
                    'request_sha256': request_sha, 'state_sha256': state_sha, 'current': before['current'],
                    'archived_relative_path': str(destination.relative_to(STATE)),
                    'reference_sha256': references, 'deployment_requested': False,
                    'application_services_restarted': False, 'automatic_retry_allowed': False}
        if not apply:
            return {**identity, 'status': 'archive_dry_run', 'moved': False}
        record.mkdir(mode=0o700)
        sync_directory(STATE)
        save_new(record / 'intent.json', {**identity, 'status': 'archive_intent',
                 'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat()})
        for directory in (destination_root, destination_directory):
            if not occupied(directory):
                directory.mkdir(mode=0o700)
                sync_directory(directory.parent)
            protected(directory, 0o700, directory=True)
        require(source_directory.stat().st_dev == destination_directory.stat().st_dev, 'archive_same_filesystem_required')
        rename_noreplace(source, destination)
        sync_directory(source_directory)
        sync_directory(destination_directory)
        require(zip_digest(destination) == (size, digest) and not occupied(source), 'archive_moved_file_mismatch')
        for relative, expected in references.items():
            require(sha(read_file(STATE / relative)) == expected, 'archive_original_reference_changed')
        after = receiver.deployment_status()
        require(after == before, 'archive_deployment_status_changed')
        receipt = {**identity, 'status': 'upload_archived', 'moved': True,
                   'completed_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        save_new(record / 'receipt.json', receipt)
        return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--operation-id', required=True)
    parser.add_argument('--artifact-sha256', required=True)
    parser.add_argument('--receiver-sha256', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    print(json.dumps(archive(args.operation_id, args.artifact_sha256, args.receiver_sha256, apply=args.apply)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'upload_archive_failed_inspect_intent'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
