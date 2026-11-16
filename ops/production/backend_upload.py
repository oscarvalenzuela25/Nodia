"""Durable v2 byte reception only. Caller holds receiver.lock; this module never deploys."""
import ctypes
import errno
import hashlib
import io
import json
import os
from itertools import islice
import re
import shutil

MAX_CHUNK = 8 * 1024 ** 2
MAX_LEDGERS = 1000
MAX_FILES = 10
HEADROOM = 2 * 1024 ** 3
IDENTITY_FIELDS = ('artifact_id', 'artifact_zip_sha256', 'run_id', 'run_attempt', 'bytes')
EMPTY_SHA256 = hashlib.sha256(b'').hexdigest()


def _occupied(path):
    return path.exists() or path.is_symlink()


def _identity(host, message):
    result = {name: message.get(name) for name in IDENTITY_FIELDS}
    for name in ('artifact_id', 'run_id', 'run_attempt'):
        limit = 5 if name == 'run_attempt' else 19
        host.require(isinstance(result[name], str) and re.fullmatch(r'[1-9][0-9]{0,' + str(limit) + '}', result[name]),
                     'upload_identity_invalid')
    host.require(isinstance(result['artifact_zip_sha256'], str) and
                 re.fullmatch(r'[a-f0-9]{64}', result['artifact_zip_sha256']) and
                 type(result['bytes']) is int and 0 < result['bytes'] <= host.MAX_UPLOAD, 'upload_identity_invalid')
    return result


def _upload_id(identity):
    raw = 'nodia-upload-v2:{run_id}:{run_attempt}:{artifact_id}:{artifact_zip_sha256}:{bytes}'.format(**identity)
    return hashlib.sha256(raw.encode('ascii')).hexdigest()


def _physical(identity):
    return identity['run_id'], identity['run_attempt'], identity['artifact_id']


def _paths(host, identity):
    directory = host.INCOMING / ('server-' + identity['run_id'] + '-' + identity['run_attempt'])
    return directory, directory / (identity['artifact_id'] + '.zip.part'), directory / (identity['artifact_id'] + '.zip')


def _sync(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _mkdir(host, path):
    if not _occupied(path):
        path.mkdir(mode=0o700)
        _sync(path.parent)
    host.protect(path, 0o700, directory=True)


def _stat_identity(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_gid, info.st_nlink,
            info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def _read_file(host, path, maximum, *, digest=True, durable=False):
    before = host.protect(path, 0o600)
    host.require(0 <= before.st_size <= maximum, 'upload_file_size_invalid')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        host.require(_stat_identity(os.fstat(stream.fileno())) == _stat_identity(before), 'upload_file_changed')
        checksum = hashlib.sha256()
        if digest:
            remaining = before.st_size
            while remaining:
                block = stream.read(min(1024 * 1024, remaining))
                host.require(bool(block), 'upload_file_changed')
                checksum.update(block)
                remaining -= len(block)
            host.require(not stream.read(1), 'upload_file_changed')
        if durable:
            os.fsync(stream.fileno())
        host.require(_stat_identity(os.fstat(stream.fileno())) == _stat_identity(before), 'upload_file_changed')
    host.require(_stat_identity(host.protect(path, 0o600)) == _stat_identity(before), 'upload_file_changed')
    return before.st_size, checksum.hexdigest() if digest else None


def _json(host, path):
    try:
        value = host.bounded_json(path)
    except ValueError:
        raise ValueError('upload_ledger_invalid') from None
    host.require(type(value) is dict, 'upload_ledger_invalid')
    return value


def _record_value(identity, status):
    return {'schema_version': 1, 'protocol_version': 2, 'status': status,
            'upload_id': _upload_id(identity), 'identity': identity}


def _records(host):
    root = host.STATE / 'uploads'
    if not _occupied(root):
        return {}
    host.protect(root, 0o700, directory=True)
    entries = list(islice(root.iterdir(), MAX_LEDGERS + 1))
    host.require(len(entries) <= MAX_LEDGERS, 'upload_ledger_limit_reached')
    records, physical = {}, set()
    for directory in entries:
        host.require(re.fullmatch(r'[a-f0-9]{64}', directory.name), 'upload_ledger_invalid')
        host.protect(directory, 0o700, directory=True)
        names = {entry.name for entry in islice(directory.iterdir(), 3)}
        host.require('intent.json' in names and names <= {'intent.json', 'receipt.json'}, 'upload_ledger_invalid')
        intent = _json(host, directory / 'intent.json')
        identity = _identity(host, intent.get('identity') if type(intent.get('identity')) is dict else {})
        host.require(type(intent.get('schema_version')) is int and type(intent.get('protocol_version')) is int and
                     intent == _record_value(identity, 'upload_intent') and directory.name == _upload_id(identity),
                     'upload_ledger_invalid')
        key = _physical(identity)
        host.require(key not in physical, 'upload_identity_conflict')
        physical.add(key)
        receipt = 'receipt.json' in names
        if receipt:
            value = _json(host, directory / 'receipt.json')
            host.require(type(value.get('schema_version')) is int and type(value.get('protocol_version')) is int and
                         value == _record_value(identity, 'upload_verified'),
                         'upload_ledger_invalid')
        records[directory.name] = (identity, receipt)
    return records


def _archive_json(host, path):
    """Archive references may exceed the receiver's small command-state JSON limit."""
    before = host.protect(path, 0o600)
    host.require(0 < before.st_size <= 1024 * 1024, 'upload_archive_record_invalid')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        host.require(_stat_identity(os.fstat(stream.fileno())) == _stat_identity(before), 'upload_file_changed')
        raw = stream.read(before.st_size + 1)
        host.require(len(raw) == before.st_size and
                     _stat_identity(os.fstat(stream.fileno())) == _stat_identity(before), 'upload_file_changed')
    host.require(_stat_identity(host.protect(path, 0o600)) == _stat_identity(before), 'upload_file_changed')

    def pairs(items):
        result = {}
        for key, value in items:
            host.require(key not in result, 'upload_archive_record_invalid')
            result[key] = value
        return result

    try:
        value = json.loads(raw, object_pairs_hook=pairs,
                           parse_constant=lambda _: (_ for _ in ()).throw(ValueError('upload_archive_record_invalid')))
    except (ValueError, UnicodeError):
        raise ValueError('upload_archive_record_invalid') from None
    host.require(type(value) is dict, 'upload_archive_record_invalid')
    return value


def _archive(host, identity, *, digest, missing_ok=False):
    expected_directory = 'server-' + identity['run_id'] + '-' + identity['run_attempt']
    expected_relative = 'archived-incoming/' + expected_directory + '/' + identity['artifact_id'] + '.zip'
    records = list(islice(host.STATE.glob('archive-completed-upload-*'), MAX_LEDGERS + 1))
    host.require(len(records) <= MAX_LEDGERS, 'upload_archive_limit_reached')
    matches = []
    for directory in records:
        host.require(re.fullmatch(r'archive-completed-upload-[a-f0-9]{32}', directory.name), 'upload_archive_record_invalid')
        host.protect(directory, 0o700, directory=True)
        names = {entry.name for entry in islice(directory.iterdir(), 3)}
        host.require('intent.json' in names and names <= {'intent.json', 'receipt.json'}, 'upload_archive_record_invalid')
        intent = _archive_json(host, directory / 'intent.json')
        receipt = directory / 'receipt.json'
        filename = receipt if _occupied(receipt) else directory / 'intent.json'
        host.require(_occupied(filename), 'upload_archive_record_invalid')
        value = _archive_json(host, filename)
        expected_key = (expected_directory, identity['artifact_id'])
        if all((item.get('artifact_directory'), item.get('artifact_id')) != expected_key for item in (intent, value)):
            continue
        host.require(_occupied(receipt) and type(value.get('schema_version')) is int and value['schema_version'] == 1 and
                     value.get('status') == 'upload_archived' and value.get('moved') is True and
                     value.get('operation_id') == directory.name.removeprefix('archive-completed-upload-') and
                     value.get('artifact_zip_sha256') == identity['artifact_zip_sha256'] and
                     type(value.get('bytes')) is int and value['bytes'] == identity['bytes'] and
                     value.get('archived_relative_path') == expected_relative, 'upload_archive_requires_reconciliation')
        expected_keys = {'schema_version', 'operation_id', 'artifact_directory', 'artifact_id',
                         'artifact_zip_sha256', 'bytes', 'source_sha', 'receiver_sha256', 'receiver_settings_sha256',
                         'submission_sha256', 'request_sha256', 'state_sha256', 'current', 'archived_relative_path',
                         'reference_sha256', 'deployment_requested', 'application_services_restarted',
                         'automatic_retry_allowed', 'status', 'started_at'}
        host.require(set(intent) == expected_keys and intent.get('status') == 'archive_intent' and
                     type(intent.get('started_at')) is str and 0 < len(intent['started_at']) <= 100 and
                     set(value) == (expected_keys - {'started_at'}) | {'completed_at', 'moved'} and
                     type(value.get('completed_at')) is str and 0 < len(value['completed_at']) <= 100 and
                     all(value.get(name) == item for name, item in intent.items() if name not in ('status', 'started_at')) and
                     all(value.get(name) is False for name in ('deployment_requested', 'application_services_restarted',
                                                              'automatic_retry_allowed')),
                     'upload_archive_requires_reconciliation')
        host.require(isinstance(value.get('source_sha'), str) and re.fullmatch(r'[a-f0-9]{40}', value['source_sha']) and
                     all(isinstance(value.get(name), str) and re.fullmatch(r'[a-f0-9]{64}', value[name])
                         for name in ('receiver_sha256', 'receiver_settings_sha256', 'submission_sha256',
                                      'request_sha256', 'state_sha256')) and
                     type(value.get('reference_sha256')) is dict and 0 < len(value['reference_sha256']) <= MAX_LEDGERS * 3 and
                     all(isinstance(name, str) and re.fullmatch(
                         r'(?:(?:submissions|requests)/[a-f0-9]{32}\.json|attempts/[a-f0-9]{32}/state\.json)', name) and
                         isinstance(checksum, str) and re.fullmatch(r'[a-f0-9]{64}', checksum)
                         for name, checksum in value['reference_sha256'].items()) and
                     type(value.get('current')) is dict and set(value['current']) ==
                         {'release_id', 'source_sha', 'package_tree_sha256'} and
                     all(isinstance(value['current'][name], str) and re.fullmatch(pattern, value['current'][name])
                         for name, pattern in (('release_id', r'backend-[a-f0-9]{12}-[a-f0-9]{12}'),
                                             ('source_sha', r'[a-f0-9]{40}'), ('package_tree_sha256', r'[a-f0-9]{64}'))),
                     'upload_archive_requires_reconciliation')
        matches.append(value)
    if not matches and missing_ok:
        return False
    host.require(len(matches) == 1, 'upload_archive_requires_reconciliation')
    root = host.STATE / 'archived-incoming'
    host.protect(root, 0o700, directory=True)
    host.protect(root / expected_directory, 0o700, directory=True)
    size, checksum = _read_file(host, root / expected_directory / (identity['artifact_id'] + '.zip'), identity['bytes'], digest=digest)
    host.require(size == identity['bytes'] and (not digest or checksum == identity['artifact_zip_sha256']),
                 'upload_archive_requires_reconciliation')
    return True


def _inspect(host, identity, records, *, digest):
    upload_id = _upload_id(identity)
    directory, partial, complete = _paths(host, identity)
    if _occupied(directory):
        host.protect(directory, 0o700, directory=True)
    found = records.get(upload_id)
    if found is None:
        host.require(not any(_physical(other) == _physical(identity) for other, _ in records.values()), 'upload_identity_conflict')
        host.require(not _occupied(partial) and not _occupied(complete), 'upload_requires_operator_reconciliation')
        return 'absent', 0, EMPTY_SHA256, False
    host.require(found[0] == identity, 'upload_identity_conflict')
    receipt = found[1]
    has_part, has_zip = _occupied(partial), _occupied(complete)
    host.require(not (has_part and has_zip), 'upload_storage_conflict')
    if has_part:
        host.require(not receipt, 'upload_storage_conflict')
        size, checksum = _read_file(host, partial, identity['bytes'], digest=digest)
        if size == identity['bytes']:
            host.require(not digest or checksum == identity['artifact_zip_sha256'], 'upload_digest_mismatch')
        return ('ready' if size == identity['bytes'] else 'receiving'), size, checksum, False
    if has_zip:
        size, checksum = _read_file(host, complete, identity['bytes'], digest=digest)
        host.require(size == identity['bytes'] and (not digest or checksum == identity['artifact_zip_sha256']), 'upload_digest_mismatch')
        return 'verified', size, checksum, receipt
    if _archive(host, identity, digest=digest, missing_ok=not receipt):
        # A complete archive receipt also seals byte reception when finish lost
        # its upload receipt before an independently completed deploy/archive.
        return 'archived', identity['bytes'], identity['artifact_zip_sha256'], True
    return 'receiving', 0, EMPTY_SHA256, False


def _status(identity, phase, offset, prefix, receipt):
    return {'schema_version': 1, 'status': 'upload_status', 'protocol_version': 2,
            'upload_id': _upload_id(identity), 'identity': identity, 'phase': phase,
            'offset': offset, 'prefix_sha256': prefix, 'receipt_recorded': receipt,
            'deployment_requested': False, 'automatic_retry_allowed': False}


def get_status(host, message):
    identity = _identity(host, message)
    return _status(identity, *_inspect(host, identity, _records(host), digest=True))


def reservation_usage(host):
    actual_bytes, actual_files = host.incoming_inventory()
    usage_bytes, usage_files = actual_bytes, actual_files
    records = _records(host)
    for identity, _ in records.values():
        phase, size, _, _ = _inspect(host, identity, records, digest=False)
        if phase in ('receiving', 'ready'):
            usage_bytes += identity['bytes'] - size
            if not _occupied(_paths(host, identity)[1]):
                usage_files += 1
    return usage_bytes, usage_files


def open_upload(host, message, retention):
    identity = _identity(host, message)
    records = _records(host)
    current = _inspect(host, identity, records, digest=True)
    if current[0] != 'absent':
        return _status(identity, *current)
    host.require(host.deployment_status().get('blocked') is False, 'prior_update_requires_reconciliation')
    host.require(len(records) < MAX_LEDGERS, 'upload_ledger_limit_reached')
    usage_bytes, usage_files = reservation_usage(host)
    actual_bytes, _ = host.incoming_inventory()
    host.require(shutil.disk_usage(host.INCOMING).free >= usage_bytes - actual_bytes + identity['bytes'] + HEADROOM,
                 'insufficient_upload_headroom')
    # Even a no-move capacity check must reject a prior interrupted archive;
    # its rename may already have freed quota without a durable receipt.
    retention.ensure_capacity(host, identity['bytes'], usage_bytes, usage_files)
    usage_bytes, usage_files = reservation_usage(host)
    host.require(usage_bytes + identity['bytes'] <= host.MAX_INCOMING and usage_files < MAX_FILES,
                 'incoming_quota_reached_operator_cleanup_required')
    root = host.STATE / 'uploads'
    _mkdir(host, root)
    record = root / _upload_id(identity)
    host.require(not _occupied(record), 'upload_ledger_conflict')
    record.mkdir(mode=0o700)
    _sync(root)
    host.save_new(record / 'intent.json', _record_value(identity, 'upload_intent'))
    directory, partial, _ = _paths(host, identity)
    _mkdir(host, directory)
    descriptor = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        os.fchmod(descriptor, 0o600)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    _sync(directory)
    return get_status(host, message)


def append_upload(host, message, fd):
    identity = _identity(host, message)
    offset, length = message.get('offset'), message.get('chunk_bytes')
    host.require(type(offset) is int and offset >= 0 and type(length) is int and 0 < length <= MAX_CHUNK and
                 offset + length <= identity['bytes'], 'upload_chunk_size_invalid')
    for field in ('prefix_sha256', 'chunk_sha256'):
        host.require(isinstance(message.get(field), str) and re.fullmatch(r'[a-f0-9]{64}', message[field]), 'upload_chunk_digest_invalid')
    before = get_status(host, message)
    host.require(before['phase'] == 'receiving', 'upload_not_receiving')
    host.require(before['offset'] == offset, 'upload_offset_conflict')
    host.require(before['prefix_sha256'] == message['prefix_sha256'], 'upload_prefix_conflict')
    host.require(host.deployment_status().get('blocked') is False, 'prior_update_requires_reconciliation')
    host.require(shutil.disk_usage(host.INCOMING).free >= length + HEADROOM, 'insufficient_upload_headroom')
    buffer = io.BytesIO()
    host.receive_bytes(fd, buffer, length, message['chunk_sha256'])
    host.require(get_status(host, message) == before, 'upload_storage_changed')
    directory, partial, _ = _paths(host, identity)
    if not _occupied(partial):
        host.require(offset == 0, 'upload_storage_conflict')
        _mkdir(host, directory)
        descriptor = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            os.fchmod(descriptor, 0o600)
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        _sync(directory)
    info = host.protect(partial, 0o600)
    descriptor = os.open(partial, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        host.require(_stat_identity(os.fstat(descriptor)) == _stat_identity(info) and info.st_size == offset, 'upload_offset_conflict')
        remaining = memoryview(buffer.getvalue())
        while remaining:
            written = os.write(descriptor, remaining)
            host.require(written > 0, 'upload_append_failed')
            remaining = remaining[written:]
        host.require(os.fstat(descriptor).st_size == offset + length, 'upload_storage_changed')
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    _sync(directory)
    return get_status(host, message)


def rename_noreplace(source, destination):
    libc = ctypes.CDLL(None, use_errno=True)
    if not hasattr(libc, 'renameat2'):
        raise ValueError('upload_atomic_noreplace_unavailable')
    rename = libc.renameat2
    rename.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint)
    rename.restype = ctypes.c_int
    if rename(-100, os.fsencode(source), -100, os.fsencode(destination), 1):
        if ctypes.get_errno() == errno.EEXIST:
            raise ValueError('upload_storage_conflict')
        raise ValueError('upload_finalization_requires_reconciliation')


def finish_upload(host, message):
    identity = _identity(host, message)
    status = get_status(host, message)
    host.require(status['phase'] in ('ready', 'verified', 'archived'), 'upload_not_complete')
    if status['phase'] == 'archived' or status['receipt_recorded']:
        return status
    directory, partial, complete = _paths(host, identity)
    # A full prefix can survive a lost append ACK before its data fsync. Verify
    # and flush the same protected inode before renaming or sealing a receipt.
    size, checksum = _read_file(host, partial if status['phase'] == 'ready' else complete,
                                identity['bytes'], durable=True)
    host.require(size == identity['bytes'] and checksum == identity['artifact_zip_sha256'],
                 'upload_finalization_requires_reconciliation')
    if status['phase'] == 'ready':
        rename_noreplace(partial, complete)
    _sync(directory)
    checked = get_status(host, message)
    host.require(checked['phase'] == 'verified' and checked['offset'] == identity['bytes'] and
                 checked['prefix_sha256'] == identity['artifact_zip_sha256'], 'upload_finalization_requires_reconciliation')
    host.save_new(host.STATE / 'uploads' / _upload_id(identity) / 'receipt.json', _record_value(identity, 'upload_verified'))
    return get_status(host, message)
