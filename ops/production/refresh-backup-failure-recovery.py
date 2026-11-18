#!/usr/bin/env python3
"""Adopt the reviewed pre-migration recovery code on a healthy CD host."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from types import SimpleNamespace


IO_POLICIES = {
    'refresh-production-cd.py': '857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97',
    'refresh-post-migration-cd.py': '494fd9d3867b201eeada312e0c802042df1d36341b488efc0a499a5739183d34',
}
CANDIDATES = {
    'backend_update.py': '53de8fec475821809a5f6ec9a1f9ece9be3a83247a81cd2ade6185e69f00c7ab',
    'update-backend.py': '8e28860e1b6eb52bde96dedbf2589498c5a48c5748ab023e13ff167723d22d7f',
}
MANIFEST = 'backup-failure-recovery.json'


def require(condition, code):
    if not condition:
        raise ValueError(code)


def pinned(path, expected, maximum=100 * 1024):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size < maximum,
                'invalid_reviewed_source')
        raw = stream.read(maximum)
    require(len(raw) == info.st_size and hashlib.sha256(raw).hexdigest() == expected,
            'reviewed_digest_mismatch')
    return raw


def load_bundle(directory, expected):
    modules = []
    for name, digest in IO_POLICIES.items():
        path = directory / name
        scope = {'__file__': str(path), '__name__': 'reviewed_refresh_io'}
        exec(compile(pinned(path, digest), str(path), 'exec'), scope)
        modules.append(SimpleNamespace(**scope))
    io, reuse = modules
    raw = pinned(directory / MANIFEST, expected, 16384)
    manifest = io.unique_json(raw)
    require(type(manifest) is dict and set(manifest) == {
        'schema_version', 'expected_current', 'previous_assets',
    } and type(manifest['schema_version']) is int and manifest['schema_version'] == 1,
            'invalid_recovery_adoption_manifest')
    previous = manifest['previous_assets']
    require(type(previous) is dict and set(previous) == reuse.UPDATER_ASSETS | reuse.RECEIVER_ASSETS and
            all(map(reuse.digest, previous.values())) and
            all(previous[name] != digest for name, digest in CANDIDATES.items()),
            'invalid_previous_assets')
    current = manifest['expected_current']
    require(type(current) is dict and set(current) == {'source_sha', 'package_tree_sha256', 'release_id'} and
            type(current['source_sha']) is str and re.fullmatch(r'[a-f0-9]{40}', current['source_sha']) and
            reuse.digest(current['package_tree_sha256']) and current['release_id'] ==
            'backend-' + current['source_sha'][:12] + '-' + current['package_tree_sha256'][:12],
            'invalid_expected_current')
    sources = {name: pinned(directory / name, digest) for name, digest in CANDIDATES.items()}
    return io, reuse, manifest, raw, sources


def check_host(reuse, receiver, sources, snapshots, settings, current):
    lib = reuse.LIB
    status = receiver.deployment_status()
    require(status.get('status') == 'deployment_ready' and status.get('blocked') is False and
            status.get('current') == current and
            status.get('application') == {'api_active': True, 'worker_active': True},
            'unexpected_production_status')
    receiver.transport_assets()
    receiver.transport_adoption_guard()
    updater = reuse.module(sources['update-backend.py'], lib / 'update-backend.py')
    policy = reuse.module(sources['backend_update.py'], lib / 'backend_update.py')
    stage_path = lib / reuse.STAGE
    stage = reuse.module(snapshots[stage_path][0], stage_path)
    host = updater.Host(policy, stage, settings)
    require(not os.path.lexists(updater.MAINTENANCE), 'maintenance_already_active')
    release = updater.CURRENT.resolve(strict=True)
    host.verify_writers(release)
    host.backup_environment(release)
    host.http('http://127.0.0.1:3000/api/v1', 200)
    host.public_smoke()
    host.public_cors_smoke()
    pids = {unit: host.show(unit)['MainPID'] for unit in updater.SERVICES}
    timers = {unit: host.show(unit)['ActiveState'] for unit in updater.TIMERS}
    return {'current': current, 'application_pids': pids, 'backup_timers': timers, 'blocked': False}


def refresh_locked(io, reuse, manifest, raw, sources, apply):
    lib, state = reuse.LIB, reuse.STATE
    settings_path = state / 'settings.json'
    journal = state / ('backup-failure-recovery-refresh-' + io.sha(raw))
    require(not os.path.lexists(journal), 'refresh_intent_exists_inspect_private_state')
    snapshots, settings = reuse.installed_assets(io, manifest)
    receiver_path = lib / reuse.RECEIVER
    receiver = reuse.module(snapshots[receiver_path][0], receiver_path)
    current = manifest['expected_current']
    before = check_host(reuse, receiver, sources, snapshots, settings[settings_path], current)
    result = {'schema_version': 1, 'manifest_sha256': io.sha(raw), 'assets_sha256': CANDIDATES,
              'deployment_requested': False, 'automatic_retry_allowed': False, **before}
    if not apply:
        return {**result, 'status': 'backup_failure_recovery_dry_run'}

    settings[settings_path]['assets'].update(CANDIDATES)
    writes = {lib / name: (source, 0o644) for name, source in sources.items()}
    writes[settings_path] = (reuse.json_bytes(settings[settings_path]), 0o600)
    journal.mkdir(mode=0o700)
    io.sync_directory(state)
    reuse.save_new(journal / MANIFEST, raw, io)
    for path in writes:
        reuse.save_new(journal / path.name, snapshots[path][0], io)
    reuse.verify_files(io, snapshots)
    for path, (content, mode) in writes.items():
        io.replace(path, content, mode)
    reuse.verify_files(io, {**snapshots, **writes})
    after = check_host(reuse, receiver, sources, snapshots, settings[settings_path], current)
    require(after == before, 'production_baseline_changed_during_adoption')
    result = {**result, 'status': 'backup_failure_recovery_adopted', 'application_services_restarted': False}
    reuse.save_new(journal / 'receipt.json', reuse.json_bytes(result), io)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    require(os.geteuid() == 0, 'root_required')
    io, reuse, manifest, raw, sources = load_bundle(args.bundle, args.manifest_sha256)
    for directory in (reuse.LIB, reuse.STATE, reuse.INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            io.protected(parent, directory=True)
    locks = (reuse.STATE / 'receiver.lock', reuse.INSTALL_LOCK)
    for lock in locks:
        require(io.protected(lock, 0o600).st_size == 0, 'invalid_adoption_lock')
    with locks[0].open('r+b') as receiver_lock, locks[1].open('r+b') as installer_lock:
        for lock in (receiver_lock, installer_lock):
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        print(json.dumps(refresh_locked(io, reuse, manifest, raw, sources, args.apply)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'adoption_failed_inspect_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
