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
from itertools import islice
import json
import os
from pathlib import Path
import re
import shutil
import stat
from types import ModuleType

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
RECEIVER = 'deploy-backend-receiver.py'
GATEWAY = 'deploy-gateway.py'
UPLOAD = 'backend_upload.py'
ARCHIVER = 'archive-completed-backend-upload.py'
LIMIT = 1000
DIRECTORY_PATTERN = r'server-([1-9][0-9]{0,19})-([1-9][0-9]{0,5})'
ARTIFACT_PATTERN = r'[1-9][0-9]{0,19}'


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


def read_json(path, maximum=16384):
    raw = read_file(path, maximum=maximum)
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
            set(settings['assets']) in ({RECEIVER, GATEWAY}, {RECEIVER, GATEWAY, UPLOAD, ARCHIVER}),
            'invalid_receiver_settings')
    sources = {}
    for name, digest in settings['assets'].items():
        require(type(digest) is str and re.fullmatch(r'[a-f0-9]{64}', digest), 'invalid_receiver_settings')
        sources[name] = read_file(LIB / name, 0o755 if name == GATEWAY else 0o644, 100 * 1024)
        require(sha(sources[name]) == digest, 'reviewed_receiver_digest_required')
    source = sources[RECEIVER]
    require(sha(source) == expected, 'reviewed_receiver_digest_required')
    module = ModuleType('reviewed_archive_receiver')
    module.__file__ = str(LIB / RECEIVER)
    exec(compile(source, module.__file__, 'exec'), module.__dict__)
    return module, sha(settings_raw)


def state_reference(operation_id):
    directory = STATE / 'attempts' / operation_id
    if not occupied(directory):
        return None, None
    protected(directory, 0o700, directory=True)
    if not occupied(directory / 'state.json'):
        return None, None
    state, digest = read_json(directory / 'state.json')
    require(type(state.get('schema_version')) is int and state['schema_version'] == 1 and
            state.get('operation_id') == operation_id and type(state.get('phase')) is str and
            re.fullmatch(r'[a-z_]{1,60}', state['phase']), 'invalid_archive_reference_state')
    return state['phase'], digest


def operation_state(operation_id):
    phase, digest = state_reference(operation_id)
    require(phase == 'complete',
            'archive_reference_not_complete')
    return digest


def reference_files(directory):
    files = list(islice(directory.iterdir(), LIMIT + 1))
    require(len(files) <= LIMIT, 'archive_reference_limit')
    for path in files:
        require(re.fullmatch(r'[a-f0-9]{32}\.json', path.name), 'unknown_archive_reference')
        protected(path, 0o600)
    return files


def reference_groups(receiver):
    """Validate the complete bounded graph before choosing any physical ZIP."""
    groups, operations = {}, {}
    for folder in ('submissions', 'requests'):
        for path in sorted(reference_files(STATE / folder)):
            value, digest = read_json(path)
            if folder == 'submissions':
                require(set(value) == {'schema_version', 'message', 'submitted_at'} and
                        type(value['schema_version']) is int and value['schema_version'] == 1 and
                        type(value['submitted_at']) is str, 'invalid_archive_submission')
                message = receiver.validate_message(value['message'])
            else:
                require(set(value) == {'schema_version', 'operation_id', 'artifact_id', 'artifact_zip_sha256',
                        'source_sha', 'expected_current_release', 'expected_current_tree_sha256', 'artifact_directory'}
                        and type(value['schema_version']) is int and value['schema_version'] == 1 and
                        type(value['artifact_directory']) is str, 'invalid_archive_request')
                match = re.fullmatch(DIRECTORY_PATTERN, value['artifact_directory'])
                require(match is not None, 'invalid_archive_request')
                message = receiver.validate_message({name: item for name, item in value.items()
                    if name != 'artifact_directory'} | {'command': 'deploy', 'run_id': match[1], 'run_attempt': match[2]})
            require(message['command'] == 'deploy' and message['operation_id'] == path.stem,
                    'invalid_archive_reference')
            previous = operations.get(path.stem)
            if previous is not None:
                require(previous['source_sha'] == message['source_sha'], 'archive_reference_source_conflict')
                require(previous == message, 'archive_request_identity_mismatch')
            operations[path.stem] = message
            key = (message['run_id'], message['run_attempt'], message['artifact_id'])
            group = groups.setdefault(key, {'source_sha': message['source_sha'],
                'digest': message['artifact_zip_sha256'], 'references': {}, 'operations': set(),
                'submissions': set(), 'requests': set(), 'complete': True})
            require(group['digest'] == message['artifact_zip_sha256'], 'archive_reference_digest_conflict')
            require(group['source_sha'] == message['source_sha'], 'archive_reference_source_conflict')
            group['references'][str(path.relative_to(STATE))] = digest
            group['operations'].add(path.stem)
            group[folder].add(path.stem)
    for group in groups.values():
        for operation in sorted(group['operations']):
            phase, digest = state_reference(operation)
            group['complete'] &= phase == 'complete'
            if digest is not None:
                group['references']['attempts/' + operation + '/state.json'] = digest
            # A complete state alone does not override the receiver's effective status.
            if phase == 'complete' and operation in group['submissions']:
                status = receiver.operation_status(operation)
                group['complete'] &= status.get('phase') == 'complete' and status.get('deployment_performed') is True
    return groups


def archive_records():
    """Index all durable intents, including operations aliased to the same ZIP.

    An interrupted transition stops preparation; it is never interpreted as a
    candidate for another rename under a different operation ID.
    """
    records = list(islice((path for path in STATE.iterdir()
                          if path.name.startswith('archive-completed-upload-')), LIMIT + 1))
    require(len(records) <= LIMIT, 'archive_record_limit')
    identities = set()
    for record in sorted(records):
        match = re.fullmatch(r'archive-completed-upload-([a-f0-9]{32})', record.name)
        require(match is not None, 'invalid_archive_record')
        protected(record, 0o700, directory=True)
        names = {path.name for path in islice(record.iterdir(), 3)}
        require(names <= {'intent.json', 'receipt.json'} and 'intent.json' in names, 'invalid_archive_record')
        intent, _ = read_json(record / 'intent.json', 1024 * 1024)
        require(set(intent) == {'schema_version', 'operation_id', 'artifact_directory', 'artifact_id',
                'artifact_zip_sha256', 'bytes', 'source_sha', 'receiver_sha256', 'receiver_settings_sha256',
                'submission_sha256', 'request_sha256', 'state_sha256', 'current', 'archived_relative_path',
                'reference_sha256', 'deployment_requested', 'application_services_restarted',
                'automatic_retry_allowed', 'status', 'started_at'}, 'invalid_archive_record')
        directory, artifact = intent.get('artifact_directory'), intent.get('artifact_id')
        require(type(directory) is str and re.fullmatch(DIRECTORY_PATTERN, directory) and
                type(artifact) is str and re.fullmatch(ARTIFACT_PATTERN, artifact) and
                type(intent.get('schema_version')) is int and intent['schema_version'] == 1 and
                intent.get('operation_id') == match[1] and intent.get('status') == 'archive_intent' and
                type(intent.get('bytes')) is int and 0 < intent['bytes'] <= 768 * 1024 ** 2 and
                type(intent.get('artifact_zip_sha256')) is str and
                re.fullmatch(r'[a-f0-9]{64}', intent['artifact_zip_sha256']) and
                type(intent.get('source_sha')) is str and re.fullmatch(r'[a-f0-9]{40}', intent['source_sha']),
                'invalid_archive_record')
        require(all(type(intent[name]) is str and re.fullmatch(r'[a-f0-9]{64}', intent[name])
                    for name in ('receiver_sha256', 'receiver_settings_sha256', 'submission_sha256',
                                 'request_sha256', 'state_sha256')) and
                type(intent['started_at']) is str and 0 < len(intent['started_at']) <= 100 and
                type(intent['current']) is dict and set(intent['current']) ==
                    {'release_id', 'source_sha', 'package_tree_sha256'} and
                all(type(intent['current'][name]) is str and re.fullmatch(pattern, intent['current'][name])
                    for name, pattern in (('release_id', r'backend-[a-f0-9]{12}-[a-f0-9]{12}'),
                        ('source_sha', r'[a-f0-9]{40}'), ('package_tree_sha256', r'[a-f0-9]{64}'))) and
                type(intent['reference_sha256']) is dict and 0 < len(intent['reference_sha256']) <= LIMIT * 3 and
                all(type(name) is str and re.fullmatch(
                    r'(?:(?:submissions|requests)/[a-f0-9]{32}\.json|attempts/[a-f0-9]{32}/state\.json)', name) and
                    type(digest) is str and re.fullmatch(r'[a-f0-9]{64}', digest)
                    for name, digest in intent['reference_sha256'].items()), 'invalid_archive_record')
        relative = 'archived-incoming/' + directory + '/' + artifact + '.zip'
        require(intent.get('archived_relative_path') == relative and
                all(intent.get(name) is False for name in ('deployment_requested',
                    'application_services_restarted', 'automatic_retry_allowed')), 'invalid_archive_record')
        key = (directory, artifact)
        require(key not in identities, 'archive_duplicate_identity_requires_reconciliation')
        identities.add(key)
        require('receipt.json' in names, 'archive_intent_already_recorded_no_automatic_replay')
        receipt, _ = read_json(record / 'receipt.json', 1024 * 1024)
        require(set(receipt) == (set(intent) - {'started_at'}) | {'completed_at', 'moved'} and
                receipt.get('status') == 'upload_archived' and receipt.get('moved') is True and
                type(receipt.get('completed_at')) is str and 0 < len(receipt['completed_at']) <= 100 and
                all(receipt.get(name) == value for name, value in intent.items()
                    if name not in ('status', 'started_at')), 'invalid_archive_receipt')
        source = STATE / 'incoming' / directory / (artifact + '.zip')
        destination = STATE / relative
        require(not occupied(source) and not occupied(source.with_suffix('.zip.part')),
                'archive_record_source_present_requires_reconciliation')
        for parent in (destination.parent.parent, destination.parent):
            protected(parent, 0o700, directory=True)
        require(protected(destination, 0o600).st_size == intent['bytes'], 'archive_record_destination_mismatch')
    return identities


def validate_environment():
    require(os.geteuid() == 0, 'root_required')
    for directory in (LIB, STATE, INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            protected(parent, directory=True)
    for directory in ('incoming', 'submissions', 'requests', 'attempts'):
        protected(STATE / directory, 0o700, directory=True)


def rename_noreplace(source, destination):
    # Linux atomic no-clobber move on the same filesystem. No link/unlink window.
    libc = ctypes.CDLL(None, use_errno=True)
    require(hasattr(libc, 'renameat2'), 'archive_atomic_noreplace_unavailable')
    libc.renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    libc.renameat2.restype = ctypes.c_int
    if libc.renameat2(-100, os.fsencode(source), -100, os.fsencode(destination), 1) != 0:
        raise OSError(ctypes.get_errno(), 'archive_move_failed_inspect_intent')


def archive(operation_id, artifact_sha256, receiver_sha256, *, apply=False):
    """Legacy operator entry point: acquire receiver then installation lock."""
    validate_environment()
    with ExitStack() as stack:
        for path in (STATE / 'receiver.lock', INSTALL_LOCK):
            require(protected(path, 0o600).st_size == 0, 'invalid_archive_lock')
            stream = stack.enter_context(path.open('r+b'))
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        receiver, receiver_settings_sha = load_receiver(receiver_sha256)
        return archive_locked(operation_id, artifact_sha256, receiver_sha256,
                              receiver, receiver_settings_sha, apply=apply)


def archive_locked(operation_id, artifact_sha256, receiver_sha256, receiver, receiver_settings_sha, apply=False):
    """Archive with receiver.lock and installation.lock already held by caller."""
    require(os.geteuid() == 0, 'root_required')
    require(re.fullmatch(r'[a-f0-9]{32}', operation_id or '') and
            all(re.fullmatch(r'[a-f0-9]{64}', value or '') for value in (artifact_sha256, receiver_sha256,
                receiver_settings_sha)) and type(apply) is bool, 'reviewed_archive_identity_required')
    record = STATE / ('archive-completed-upload-' + operation_id)
    require(not occupied(record), 'archive_intent_already_recorded_no_automatic_replay')
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
    archive_records()
    group = reference_groups(receiver)[(message['run_id'], message['run_attempt'], message['artifact_id'])]
    require(group['complete'], 'archive_reference_not_complete')
    require(group['source_sha'] != before.get('current', {}).get('source_sha'), 'current_upload_cannot_be_archived')
    references = group['references']
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

def incoming_files():
    directories = list(islice((STATE / 'incoming').iterdir(), LIMIT + 1))
    require(len(directories) <= LIMIT, 'archive_incoming_limit')
    files, total, count = [], 0, 0
    for directory in sorted(directories):
        match = re.fullmatch(DIRECTORY_PATTERN, directory.name)
        require(match is not None, 'invalid_archive_incoming_directory')
        protected(directory, 0o700, directory=True)
        entries = list(islice(directory.iterdir(), LIMIT - count + 1))
        require(len(entries) + count <= LIMIT, 'archive_incoming_limit')
        for path in sorted(entries):
            artifact = re.fullmatch(r'(' + ARTIFACT_PATTERN + r')\.zip(\.part)?', path.name)
            require(artifact is not None, 'invalid_archive_incoming_file')
            info = protected(path, 0o600)
            require(0 <= info.st_size <= 768 * 1024 ** 2, 'archive_zip_size_invalid')
            total += info.st_size
            count += 1
            if artifact[2] is None and not occupied(path.with_suffix('.zip.part')):
                files.append(((match[1], match[2], artifact[1]), info.st_size))
    return files, total, count


def ensure_capacity(host, requested_bytes, usage_bytes, usage_files):
    """Prepare quota before stdin; caller holds receiver.lock and counts reservations.

    Only terminal noncurrent incoming ZIPs may move. This does not reclaim disk
    space: both locations share a filesystem. Any incomplete archive transition
    requires reconciliation, without automatically repeating its rename.
    """
    validate_environment()
    require(host.STATE == STATE and host.INCOMING == STATE / 'incoming', 'archive_host_path_mismatch')
    require(type(requested_bytes) is int and 0 < requested_bytes <= host.MAX_UPLOAD and
            type(usage_bytes) is int and usage_bytes >= 0 and type(usage_files) is int and usage_files >= 0 and
            type(host.MAX_INCOMING) is int and host.MAX_INCOMING > 0, 'invalid_archive_capacity')
    require(protected(INSTALL_LOCK, 0o600).st_size == 0, 'invalid_archive_lock')
    with INSTALL_LOCK.open('r+b') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(shutil.disk_usage(host.INCOMING).free > requested_bytes + 2 * 1024 ** 3,
                'insufficient_upload_headroom')
        settings, _ = read_json(STATE / 'receiver-settings.json')
        require(type(settings.get('assets')) is dict, 'invalid_receiver_settings')
        receiver_sha = settings['assets'].get(RECEIVER)
        _, settings_sha = load_receiver(receiver_sha)
        before = host.deployment_status()
        require(before.get('status') == 'deployment_ready' and before.get('blocked') is False and
                before.get('application') == {'api_active': True, 'worker_active': True}, 'archive_gateway_not_ready')
        archive_records()
        groups = reference_groups(host)
        files, physical_bytes, physical_files = incoming_files()
        require(usage_bytes >= physical_bytes and usage_files >= physical_files, 'archive_usage_mismatch')
        result = {'archived': [], 'usage_bytes': usage_bytes, 'usage_files': usage_files}

        def fits(size, count):
            return size + requested_bytes <= host.MAX_INCOMING and count + 1 <= 10

        if fits(usage_bytes, usage_files):
            return result
        candidates = []
        for key, size in files:
            group = groups.get(key)
            if (not group or not group['complete'] or not group['submissions'] or
                    not group['operations'] <= group['requests'] or
                    group['source_sha'] == before.get('current', {}).get('source_sha')):
                continue
            candidates.append((key, size, group))
        # Largest first minimizes the number of moves for both byte and slot
        # constraints. Numeric run/attempt/artifact and source break ties only;
        # dates and age never grant eligibility.
        candidates.sort(key=lambda item: (-item[1], *(int(part) for part in item[0]), item[2]['source_sha']))
        selected, remaining_bytes, remaining_files = [], usage_bytes, usage_files
        for key, size, group in candidates:
            if fits(remaining_bytes, remaining_files):
                break
            operation = min(group['submissions'] & group['requests'])
            selected.append((operation, group['digest'], size))
            remaining_bytes -= size
            remaining_files -= 1
        require(fits(remaining_bytes, remaining_files), 'incoming_quota_reached_operator_cleanup_required')
        # Prove the entire selected batch before creating its first intent.
        for operation, digest, size in selected:
            preview = archive_locked(operation, digest, receiver_sha, host, settings_sha, apply=False)
            require(preview['bytes'] == size, 'archive_zip_changed')
        for operation, digest, size in selected:
            receipt = archive_locked(operation, digest, receiver_sha, host, settings_sha, apply=True)
            result['archived'].append(receipt)
            result['usage_bytes'] -= size
            result['usage_files'] -= 1
        return result


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
