#!/usr/bin/env python3
"""Operator-only CAS adoption of a reviewed upload-v2 bundle; dry-run by default.

Never deploys, restarts services, changes updater policy, or retries an interrupted
refresh. Original bytes and a durable five-write journal precede installation.
"""
import argparse
import datetime
import fcntl
import hashlib
from itertools import islice
import json
import os
from pathlib import Path
import re
import stat
import sys
from types import SimpleNamespace

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
RECEIVER = 'deploy-backend-receiver.py'
GATEWAY = 'deploy-gateway.py'
UPLOAD = 'backend_upload.py'
ARCHIVER = 'archive-completed-backend-upload.py'
ASSETS = {RECEIVER, GATEWAY, UPLOAD, ARCHIVER}
LEGACY_ASSETS = {RECEIVER, GATEWAY}
UPDATER_ASSETS = {'update-backend.py', 'backend_update.py', 'update-backend-action.mjs',
                  'stage-backend-candidate.py', 'probe-backend-dependencies.mjs'}
UNITS = ('nodia-api.service', 'nodia-ai-worker.service')
MANIFEST = 'upload-transport.json'
PURPOSE = 'nodia-upload-transport-v2'
IO_SHA256 = '857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97'
SOURCE_LIMIT = 100 * 1024
RECORD_LIMIT = 1000


def require(condition, code):
    if not condition:
        raise ValueError(code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def digest(value):
    return type(value) is str and re.fullmatch(r'[a-f0-9]{64}', value) is not None


def occupied(path):
    return path.exists() or path.is_symlink()


def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mode, info.st_uid,
            info.st_gid, info.st_nlink, info.st_mtime_ns, info.st_ctime_ns)


def snapshot(path, *, maximum=SOURCE_LIMIT, io=None, mode=None):
    protected = io.protected(path, mode) if io else None
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                0 < before.st_size <= maximum, 'invalid_transport_refresh_source')
        require(protected is None or identity(before) == identity(protected), 'transport_refresh_source_changed')
        raw = stream.read(maximum + 1)
        require(identity(os.fstat(stream.fileno())) == identity(before) and len(raw) == before.st_size,
                'transport_refresh_source_changed')
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


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode('utf-8')


def load_bytes(raw, filename, name):
    scope = {'__name__': name, '__file__': str(filename)}
    exec(compile(raw, str(filename), 'exec'), scope)
    return SimpleNamespace(**scope)


def io_policy():
    filename = Path(__file__).resolve().with_name('refresh-production-cd.py')
    raw = snapshot(filename)
    require(sha(raw) == IO_SHA256, 'reviewed_refresh_policy_required')
    return load_bytes(raw, filename, 'reviewed_upload_transport_io')


def load_receiver(raw):
    return load_bytes(raw, LIB / RECEIVER, 'reviewed_upload_transport_receiver')


def validate_current(value):
    require(type(value) is dict and set(value) == {'source_sha', 'package_tree_sha256', 'release_id'} and
            type(value['source_sha']) is str and re.fullmatch(r'[a-f0-9]{40}', value['source_sha']) and
            digest(value['package_tree_sha256']) and value['release_id'] ==
                'backend-' + value['source_sha'][:12] + '-' + value['package_tree_sha256'][:12],
            'invalid_transport_refresh_current')


def bundle_snapshot(bundle, expected):
    require(digest(expected), 'reviewed_transport_manifest_required')
    bundle = Path(bundle).absolute()
    require(bundle.resolve(strict=True) == bundle and bundle.is_dir(), 'invalid_transport_bundle_path')
    names = {path.name for path in islice(bundle.iterdir(), 7)}
    require(names == ASSETS | {MANIFEST}, 'invalid_transport_bundle_files')
    raw = snapshot(bundle / MANIFEST, maximum=16384)
    require(sha(raw) == expected and b'\r' not in raw and not raw.startswith(b'\xef\xbb\xbf'),
            'reviewed_transport_manifest_required')
    manifest = unique_json(raw.decode('utf-8'))
    require(type(manifest) is dict and set(manifest) ==
            {'schema_version', 'purpose', 'assets', 'previous_assets', 'expected_current'} and
            type(manifest['schema_version']) is int and manifest['schema_version'] == 1 and
            manifest['purpose'] == PURPOSE and type(manifest['assets']) is dict and
            set(manifest['assets']) == ASSETS and type(manifest['previous_assets']) is dict and
            set(manifest['previous_assets']) in (LEGACY_ASSETS, ASSETS) and
            all(digest(value) for assets in (manifest['assets'], manifest['previous_assets'])
                for value in assets.values()), 'invalid_transport_manifest')
    validate_current(manifest['expected_current'])
    sources = {name: snapshot(bundle / name) for name in sorted(ASSETS)}
    # Snapshot all four files before executing any candidate bytes. Later writes
    # use these same immutable snapshots, never reopen the unprivileged bundle.
    for name, source in sources.items():
        require(sha(source) == manifest['assets'][name] and b'\r' not in source and
                not source.startswith(b'\xef\xbb\xbf'), 'reviewed_transport_asset_required')
        try:
            source.decode('utf-8')
        except UnicodeDecodeError:
            raise ValueError('transport_source_utf8_required') from None
        compile(source, str(LIB / name), 'exec')
    return manifest, sources, raw


def settings(raw, expected_assets, io):
    value = io.unique_json(raw)
    require(type(value) is dict and type(value.get('schema_version')) is int and value['schema_version'] == 1 and
            type(value.get('assets')) is dict and set(value['assets']) == expected_assets and
            all(digest(item) for item in value['assets'].values()), 'invalid_transport_refresh_settings')
    return value


def ready_status(receiver):
    status = receiver.deployment_status()
    require(type(status) is dict and type(status.get('schema_version')) is int and status['schema_version'] == 1 and
            status.get('status') == 'deployment_ready' and status.get('blocked') is False and
            status.get('application') == {'api_active': True, 'worker_active': True}, 'transport_refresh_backend_not_ready')
    validate_current(status.get('current'))
    pids = {}
    for unit in UNITS:
        observed = receiver.unit_state(unit)
        pid = observed.get('MainPID')
        require(observed.get('ActiveState') == 'active' and observed.get('SubState') == 'running' and
                observed.get('Result') == 'success' and observed.get('ControlGroup') == '/system.slice/' + unit and
                type(pid) is str and pid.isdigit() and int(pid) > 1, 'transport_refresh_writer_identity_invalid')
        pids[unit] = int(pid)
    return status, pids


def reconciliation_files(io):
    result = set()
    blocked = STATE / 'BLOCKED.json'
    if occupied(blocked):
        result.add(blocked)
    attempts = STATE / 'attempts'
    io.protected(attempts, 0o700, directory=True)
    directories = list(islice(attempts.iterdir(), RECORD_LIMIT + 1))
    require(len(directories) <= RECORD_LIMIT, 'transport_refresh_reconciliation_limit')
    for directory in directories:
        require(re.fullmatch(r'[a-f0-9]{32}', directory.name), 'invalid_transport_refresh_attempt')
        io.protected(directory, 0o700, directory=True)
        acknowledgment = directory / 'pre-migration-reconciliation.json'
        if occupied(acknowledgment):
            result.add(acknowledgment)
    return result


def check_records(io, record):
    require(not occupied(record), 'transport_refresh_intent_exists_no_automatic_replay')
    previous = list(islice((path for path in STATE.iterdir()
                           if path.name.startswith('transport-refresh-')), RECORD_LIMIT + 1))
    require(len(previous) <= RECORD_LIMIT, 'transport_refresh_record_limit')
    for path in previous:
        require(re.fullmatch(r'transport-refresh-[a-f0-9]{64}', path.name), 'invalid_transport_refresh_record')
        io.protected(path, 0o700, directory=True)
        require(occupied(path / 'receipt.json'), 'transport_refresh_prior_intent_requires_reconciliation')
        receipt = io.unique_json(snapshot(path / 'receipt.json', maximum=16384, io=io, mode=0o600))
        require(type(receipt) is dict and receipt.get('status') == 'upload_transport_refreshed' and
                receipt.get('manifest_sha256') == path.name.removeprefix('transport-refresh-') and
                receipt.get('transport_changed') is True, 'invalid_transport_refresh_record')


def save_new(path, raw, io, mode=0o600):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), mode)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    io.sync_directory(path.parent)


def verify_unchanged(snapshots, absent, reconciliation, io):
    for path, (raw, mode) in snapshots.items():
        require(snapshot(path, io=io, mode=mode) == raw, 'transport_refresh_original_changed')
    require(all(not occupied(path) for path in absent), 'transport_refresh_untracked_asset_exists')
    require(reconciliation_files(io) == reconciliation, 'transport_refresh_reconciliation_changed')


def validate_capabilities(receiver, assets):
    value = receiver.upload_command({'schema_version': 1, 'command': 'capabilities'}, -1)
    require(type(value) is dict and set(value) == {'schema_version', 'status', 'protocol_version',
            'max_chunk_bytes', 'max_upload_bytes', 'incoming_limit_bytes', 'incoming_limit_files',
            'logical_incoming_bytes', 'logical_incoming_files', 'free_bytes', 'retention_policy',
            'retention_deletes_files', 'assets_sha256', 'deployment_requested', 'automatic_retry_allowed'} and
            type(value['schema_version']) is int and value['schema_version'] == 1 and
            type(value['protocol_version']) is int and value['protocol_version'] == 2 and
            value['status'] == 'upload_capabilities' and
            type(value['max_chunk_bytes']) is int and value['max_chunk_bytes'] == 8 * 1024 ** 2 and
            type(value['max_upload_bytes']) is int and value['max_upload_bytes'] == 768 * 1024 ** 2 and
            type(value['incoming_limit_bytes']) is int and value['incoming_limit_bytes'] == 2 * 1024 ** 3 and
            type(value['incoming_limit_files']) is int and value['incoming_limit_files'] == 10 and
            all(type(value[name]) is int and value[name] >= 0 for name in
                ('logical_incoming_bytes', 'logical_incoming_files', 'free_bytes')) and
            value['retention_policy'] == 'archive_completed_noncurrent_on_demand' and
            value['retention_deletes_files'] is False and value['assets_sha256'] == assets and
            value['deployment_requested'] is False and value['automatic_retry_allowed'] is False,
            'transport_refresh_capabilities_invalid')
    return sha(json_bytes(value))


def refresh(bundle, manifest_sha, expected_receiver_settings_sha, *, apply=False):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'isolated_linux_root_required')
    require(digest(manifest_sha) and digest(expected_receiver_settings_sha) and type(apply) is bool,
            'reviewed_transport_identity_required')
    manifest, candidates, manifest_raw = bundle_snapshot(bundle, manifest_sha)
    io = io_policy()
    for directory in (LIB, STATE, INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            io.protected(parent, directory=True)
    locks = (STATE / 'receiver.lock', INSTALL_LOCK)
    for path in locks:
        require(io.protected(path, 0o600).st_size == 0, 'invalid_transport_refresh_lock')
    with locks[0].open('r+b') as receiver_lock, locks[1].open('r+b') as installation_lock:
        for stream in (receiver_lock, installation_lock):
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        record = STATE / ('transport-refresh-' + manifest_sha)
        check_records(io, record)
        settings_path, updater_path = STATE / 'receiver-settings.json', STATE / 'settings.json'
        settings_raw = snapshot(settings_path, maximum=16384, io=io, mode=0o600)
        require(sha(settings_raw) == expected_receiver_settings_sha, 'receiver_settings_cas_mismatch')
        installed = settings(settings_raw, set(manifest['previous_assets']), io)
        require(installed['assets'] == manifest['previous_assets'], 'previous_transport_assets_mismatch')
        updater_raw = snapshot(updater_path, maximum=16384, io=io, mode=0o600)
        updater = settings(updater_raw, UPDATER_ASSETS, io)
        snapshots = {settings_path: (settings_raw, 0o600), updater_path: (updater_raw, 0o600)}
        for assets in (installed['assets'], updater['assets']):
            for name, expected in assets.items():
                mode = 0o755 if name == GATEWAY else 0o644
                source = snapshot(LIB / name, io=io, mode=mode)
                require(sha(source) == expected, 'installed_transport_refresh_asset_changed')
                snapshots[LIB / name] = (source, mode)
        absent = {LIB / name for name in ASSETS - set(installed['assets'])}
        require(all(not occupied(path) for path in absent), 'transport_refresh_untracked_asset_exists')
        reconciliation = reconciliation_files(io)
        for path in reconciliation:
            snapshots[path] = (snapshot(path, maximum=16384, io=io, mode=0o600), 0o600)
        receiver = load_receiver(snapshots[LIB / RECEIVER][0])
        candidate = load_receiver(candidates[RECEIVER])
        before, pids = ready_status(receiver)
        candidate_before, candidate_pids = ready_status(candidate)
        require(before['current'] == manifest['expected_current'], 'transport_refresh_current_cas_mismatch')
        require(candidate_before == before and candidate_pids == pids, 'transport_refresh_candidate_status_mismatch')
        installed['assets'] = manifest['assets']
        next_settings = json_bytes(installed)
        require(len(next_settings) <= 16384, 'refreshed_receiver_settings_too_large')
        evidence = {'schema_version': 1, 'manifest_sha256': manifest_sha,
            'previous_assets_sha256': manifest['previous_assets'], 'assets_sha256': manifest['assets'],
            'previous_receiver_settings_sha256': expected_receiver_settings_sha,
            'receiver_settings_sha256': sha(next_settings), 'updater_settings_sha256': sha(updater_raw),
            'reconciliation_evidence_sha256': sha(json_bytes({str(path.relative_to(STATE)): sha(snapshots[path][0])
                                                            for path in sorted(reconciliation)})),
            'current': before['current'], 'application_pids': pids, 'deployment_requested': False,
            'deployment_performed': False, 'application_services_restarted': False, 'automatic_retry_allowed': False}
        verify_unchanged(snapshots, absent, reconciliation, io)
        if not apply:
            return {**evidence, 'status': 'upload_transport_refresh_dry_run', 'transport_changed': False,
                    'capabilities_verified': False}
        # New modules first, receiver/gateway next, receiver-settings LAST. The
        # receiver lock spans all five writes, and mismatched pins fail closed.
        writes = [(LIB / name, candidates[name], 0o755 if name == GATEWAY else 0o644)
                  for name in (UPLOAD, ARCHIVER, RECEIVER, GATEWAY)] + [(settings_path, next_settings, 0o600)]
        originals = {path.name: {'existed': path in snapshots,
            'sha256': sha(snapshots[path][0]) if path in snapshots else None,
            'mode': snapshots[path][1] if path in snapshots else None} for path, _, _ in writes}
        record.mkdir(mode=0o700)
        io.sync_directory(STATE)
        save_new(record / 'intent.json', json_bytes({**evidence, 'status': 'upload_transport_refresh_intent',
            'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'writes': [{'name': path.name, 'sha256': sha(raw), 'mode': mode} for path, raw, mode in writes]}), io)
        save_new(record / MANIFEST, manifest_raw, io)
        save_new(record / 'originals.json', json_bytes(originals), io)
        for path, _, _ in writes:
            if path in snapshots:
                save_new(record / path.name, snapshots[path][0], io)
        io.sync_directory(record)
        io.sync_directory(STATE)
        verify_unchanged(snapshots, absent, reconciliation, io)
        for index, (path, raw, mode) in enumerate(writes, 1):
            if path in absent:
                save_new(path, raw, io, mode)
            else:
                io.replace(path, raw, mode)
            save_new(record / ('write-' + str(index) + '.json'), json_bytes({'schema_version': 1,
                'name': path.name, 'sha256': sha(raw), 'completed': True}), io)
        expected_after = {**snapshots, **{path: (raw, mode) for path, raw, mode in writes}}
        verify_unchanged(expected_after, set(), reconciliation, io)
        after, after_pids = ready_status(candidate)
        require(after == before and after_pids == pids, 'transport_refresh_runtime_changed')
        capabilities_sha = validate_capabilities(candidate, manifest['assets'])
        final_status, final_pids = ready_status(candidate)
        require(final_status == before and final_pids == pids, 'transport_refresh_runtime_changed')
        verify_unchanged(expected_after, set(), reconciliation, io)
        receipt = {**evidence, 'status': 'upload_transport_refreshed', 'transport_changed': True,
            'capabilities_verified': True, 'capabilities_sha256': capabilities_sha,
            'completed_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        save_new(record / 'receipt.json', json_bytes(receipt), io)
        return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', required=True, type=Path)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--expected-receiver-settings-sha256', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    print(json.dumps(refresh(args.bundle, args.manifest_sha256,
                             args.expected_receiver_settings_sha256, apply=args.apply)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'upload_transport_refresh_failed_inspect_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
