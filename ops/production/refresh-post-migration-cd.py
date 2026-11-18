#!/usr/bin/env python3
"""Install a reviewed updater/receiver bundle and acknowledge a recovered attempt."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile
from types import SimpleNamespace

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
RECEIVER = 'deploy-backend-receiver.py'
UPDATER = 'update-backend.py'
POLICY = 'backend_update.py'
ACTION = 'update-backend-action.mjs'
STAGE = 'stage-backend-candidate.py'
GATEWAY = 'deploy-gateway.py'
RECONCILE = 'reconcile-post-migration-update.py'
IO = 'refresh-production-cd.py'
MANIFEST = 'post-migration-cd.json'
ACKNOWLEDGMENT = 'post-migration-reconciliation.json'
UPDATER_ASSETS = {UPDATER, POLICY, ACTION, STAGE, 'probe-backend-dependencies.mjs'}
RECEIVER_ASSETS = {RECEIVER, GATEWAY, 'backend_upload.py', 'archive-completed-backend-upload.py'}
REFRESH_FILES = (ACTION, POLICY, UPDATER, RECEIVER)
BUNDLE_FILES = {*REFRESH_FILES, IO, RECONCILE}
IO_SHA256 = '857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97'


def require(condition, code):
    if not condition:
        raise ValueError(code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def digest(value):
    return type(value) is str and re.fullmatch(r'[a-f0-9]{64}', value) is not None


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()


def snapshot(path, maximum=100 * 1024):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and
                0 < info.st_size < maximum, 'invalid_reconciliation_bundle_file')
        raw = stream.read(maximum)
    require(len(raw) == info.st_size, 'reconciliation_bundle_file_changed')
    return raw


def module(raw, path):
    scope = {'__file__': str(path), '__name__': 'reviewed_post_migration_' + path.stem}
    exec(compile(raw, str(path), 'exec'), scope)
    return SimpleNamespace(**scope)


def load_bundle(directory, expected):
    require(digest(expected), 'reviewed_manifest_sha256_required')
    raw = snapshot(directory / MANIFEST, 16384)
    require(sha(raw) == expected, 'reconciliation_manifest_changed')
    io_raw = snapshot(directory / IO)
    require(sha(io_raw) == IO_SHA256, 'reviewed_io_policy_required')
    io = module(io_raw, directory / IO)
    manifest = io.unique_json(raw)
    require(type(manifest) is dict and set(manifest) == {
        'schema_version', 'operation_id', 'expected_current', 'assets', 'previous_assets'
    } and type(manifest['schema_version']) is int and manifest['schema_version'] == 1 and
        type(manifest['operation_id']) is str and re.fullmatch(r'[a-f0-9]{32}', manifest['operation_id']),
        'invalid_post_migration_cd_manifest')
    for name, inventory in (('assets', BUNDLE_FILES), ('previous_assets', UPDATER_ASSETS | RECEIVER_ASSETS)):
        values = manifest[name]
        require(type(values) is dict and set(values) == inventory and all(map(digest, values.values())),
                'invalid_post_migration_cd_asset_inventory')
    current = manifest['expected_current']
    require(type(current) is dict and set(current) == {'source_sha', 'package_tree_sha256', 'release_id'} and
            type(current['source_sha']) is str and re.fullmatch(r'[a-f0-9]{40}', current['source_sha']) and
            digest(current['package_tree_sha256']) and current['release_id'] ==
            'backend-' + current['source_sha'][:12] + '-' + current['package_tree_sha256'][:12],
            'invalid_expected_current')
    sources = {name: snapshot(directory / name) for name in BUNDLE_FILES - {IO}}
    sources[IO] = io_raw
    for name, source in sources.items():
        require(sha(source) == manifest['assets'][name] and b'\r' not in source and
                not source.startswith(b'\xef\xbb\xbf'), 'reviewed_post_migration_cd_asset_required')
        source.decode('utf-8')
        if name.endswith('.py'):
            compile(source, name, 'exec')
    return io, manifest, raw, sources


def save_new(path, raw, io):
    descriptor, temporary = tempfile.mkstemp(prefix='.post-migration-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            os.fchmod(stream.fileno(), 0o600)
            os.fchown(stream.fileno(), 0, 0)
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        # Publish a complete record atomically without overwriting any prior evidence.
        os.link(temporary, path)
    finally:
        os.unlink(temporary)
    io.sync_directory(path.parent)


def installed_assets(io, manifest):
    snapshots = {}
    settings = {}
    for filename, names in (('settings.json', UPDATER_ASSETS), ('receiver-settings.json', RECEIVER_ASSETS)):
        path = STATE / filename
        raw = io.read_private(path)
        snapshots[path] = (raw, 0o600)
        value = io.unique_json(raw)
        require(type(value) is dict and type(value.get('schema_version')) is int and
                value['schema_version'] == 1 and type(value.get('assets')) is dict and
                value['assets'] == {name: manifest['previous_assets'][name] for name in names},
                'installed_asset_pins_differ_from_reviewed_baseline')
        settings[path] = value
    for name, expected in manifest['previous_assets'].items():
        path = LIB / name
        mode = 0o755 if name == GATEWAY else 0o644
        io.protected(path, mode)
        raw = snapshot(path)
        require(sha(raw) == expected, 'installed_asset_differs_from_reviewed_baseline')
        snapshots[path] = (raw, mode)
    return snapshots, settings


def verify_files(io, expected):
    for path, (raw, mode) in expected.items():
        io.protected(path, mode)
        require(snapshot(path) == raw, 'reconciliation_asset_changed')


def check_status(receiver, manifest, *, blocked, override=None):
    status = receiver.deployment_status(**({'reconciliation_override': override} if override else {}))
    require(status.get('status') == 'deployment_ready' and status.get('blocked') is blocked and
            status.get('current') == manifest['expected_current'] and
            status.get('application') == {'api_active': True, 'worker_active': True},
            'unexpected_production_status')
    operation = receiver.operation_status(manifest['operation_id'])
    require(operation.get('phase') == 'failed' and operation.get('automatic_retry_allowed') is False,
            'original_failed_operation_not_verified')
    return status['current']


def refresh_locked(io, manifest, manifest_raw, sources, *, apply):
    operation = manifest['operation_id']
    attempt = STATE / 'attempts' / operation
    io.protected(attempt.parent, 0o700, directory=True)
    io.protected(attempt, 0o700, directory=True)
    journal = STATE / ('post-migration-cd-refresh-' + operation)
    require(not journal.exists() and not journal.is_symlink(), 'refresh_intent_exists_inspect_private_state')
    ack = attempt / ACKNOWLEDGMENT
    require(not ack.exists() and not ack.is_symlink(), 'reconciliation_already_exists')
    snapshots, settings = installed_assets(io, manifest)
    old_receiver = module(snapshots[LIB / RECEIVER][0], LIB / RECEIVER)
    current = check_status(old_receiver, manifest, blocked=True)
    reconciliation = module(sources[RECONCILE], LIB / RECONCILE)
    policy = module(sources[POLICY], LIB / POLICY)
    reconciliation.load_evidence(io, policy, operation)
    verify_files(io, snapshots)
    result = {'schema_version': 1, 'operation_id': operation, 'current': current,
              'manifest_sha256': sha(manifest_raw), 'deployment_requested': False,
              'application_services_restarted': False, 'automatic_retry_allowed': False}
    if not apply:
        return {**result, 'status': 'post_migration_cd_dry_run', 'blocked': True}

    for settings_path, value in settings.items():
        for name in value['assets'].keys() & set(REFRESH_FILES):
            value['assets'][name] = manifest['assets'][name]
    writes = {LIB / name: (sources[name], 0o644) for name in REFRESH_FILES}
    writes.update({path: (json_bytes(value), 0o600) for path, value in settings.items()})
    journal.mkdir(mode=0o700)
    io.sync_directory(STATE)
    save_new(journal / MANIFEST, manifest_raw, io)
    for path in writes:
        save_new(journal / path.name, snapshots[path][0], io)
    verify_files(io, snapshots)
    for path, (raw, mode) in writes.items():
        io.replace(path, raw, mode)
    expected = {**snapshots, **writes}
    verify_files(io, expected)
    receiver = module(sources[RECEIVER], LIB / RECEIVER)
    receiver.transport_assets()
    receiver.transport_adoption_guard()
    check_status(receiver, manifest, blocked=True)
    updater = module(sources[UPDATER], LIB / UPDATER)
    stage = module(snapshots[LIB / STAGE][0], LIB / STAGE)
    records = reconciliation.prepare_reconciliation(
        io, updater, policy, stage, receiver, settings[STATE / 'settings.json'], operation)
    require(records and records[-1][0] == ack and all(path.parent == attempt for path, _ in records),
            'invalid_acknowledgment_plan')
    for path, raw in records[:-1]:
        save_new(path, raw, io)
    ack_raw = records[-1][1]
    # Exercise the actual admission check against every other attempt before making
    # this acknowledgment visible to deploy clients.
    check_status(receiver, manifest, blocked=False, override=(operation, ack_raw))
    verify_files(io, expected)
    save_new(ack, ack_raw, io)
    return {**result, 'status': 'post_migration_cd_reconciled', 'blocked': False,
            'original_operation_retry_allowed': False}


def refresh(bundle, expected, *, apply=False):
    require(os.geteuid() == 0, 'root_required')
    io, manifest, manifest_raw, sources = load_bundle(bundle, expected)
    for directory in (LIB, STATE, INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            io.protected(parent, directory=True)
    locks = (STATE / 'receiver.lock', INSTALL_LOCK)
    for lock in locks:
        require(io.protected(lock, 0o600).st_size == 0, 'invalid_reconciliation_lock')
    with locks[0].open('r+b') as receiver_lock, locks[1].open('r+b') as installer_lock:
        for lock in (receiver_lock, installer_lock):
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return refresh_locked(io, manifest, manifest_raw, sources, apply=apply)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    print(json.dumps(refresh(args.bundle, args.manifest_sha256, apply=args.apply)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'post_migration_cd_refresh_failed_inspect_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
