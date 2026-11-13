#!/usr/bin/env python3
"""Operator-only, hash-pinned receiver refresh; never deploys or restarts an app."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile

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


def unique_json(raw):
    def pairs(items):
        value = {}
        for key, item in items:
            require(key not in value, 'duplicate_json_key')
            value[key] = item
        return value
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: require(False, 'invalid_json_number'))


def protected(path, mode=None, directory=False):
    info = path.lstat()
    require(path.resolve(strict=True) == path and info.st_uid == info.st_gid == 0
            and not info.st_mode & 0o022, 'unsafe_refresh_path')
    require(stat.S_ISDIR(info.st_mode) if directory else
            stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'invalid_refresh_path_type')
    require(mode is None or stat.S_IMODE(info.st_mode) == mode, 'invalid_refresh_mode')
    return info


def read_private(path):
    require(0 < protected(path, 0o600).st_size <= 16384, 'refresh_settings_size_invalid')
    return path.read_bytes()


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def replace(path, raw, mode):
    protected(path, mode)
    descriptor, temporary = tempfile.mkstemp(prefix='.receiver-refresh-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            os.fchmod(stream.fileno(), mode)
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        sync_directory(path.parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def refresh(source, expected, previous):
    require(os.geteuid() == 0, 'root_required')
    require(all(re.fullmatch(r'[a-f0-9]{64}', value or '') for value in (expected, previous))
            and expected != previous, 'distinct_reviewed_digests_required')
    # Snapshot untrusted staging bytes once; only reviewed bytes enter root-owned code.
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and
                0 < info.st_size < 100 * 1024, 'invalid_refresh_source')
        candidate = stream.read(100 * 1024)
    require(sha(candidate) == expected and b'\r' not in candidate, 'reviewed_receiver_digest_required')
    compile(candidate, str(LIB / RECEIVER), 'exec')
    for path in (LIB, STATE):
        for parent in reversed((path, *path.parents)):
            protected(parent, directory=True)
    receiver_lock = STATE / 'receiver.lock'
    for lock in (receiver_lock, INSTALL_LOCK):
        protected(lock.parent, directory=True)
        require(protected(lock, 0o600).st_size == 0, 'invalid_refresh_lock')
    with receiver_lock.open('r+b') as receiver_handle, INSTALL_LOCK.open('r+b') as install_handle:
        fcntl.flock(receiver_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(install_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        settings_path = STATE / 'receiver-settings.json'
        settings_raw = read_private(settings_path)
        settings = unique_json(settings_raw)
        require(type(settings) is dict and type(settings.get('schema_version')) is int and
                settings['schema_version'] == 1 and type(settings.get('assets')) is dict and
                set(settings['assets']) == {RECEIVER, GATEWAY}, 'invalid_receiver_settings')
        for name, mode in ((RECEIVER, 0o644), (GATEWAY, 0o755)):
            protected(LIB / name, mode)
            require(sha((LIB / name).read_bytes()) == settings['assets'][name], 'installed_receiver_asset_changed')
        require(settings['assets'][RECEIVER] == previous, 'previous_receiver_digest_mismatch')
        updater_settings_raw = read_private(STATE / 'settings.json')
        updater_settings = unique_json(updater_settings_raw)
        protected(LIB / 'update-backend.py', 0o644)
        require(sha((LIB / 'update-backend.py').read_bytes()) ==
                updater_settings['assets']['update-backend.py'], 'installed_updater_asset_changed')
        require(not (STATE / 'BLOCKED.json').exists(), 'prior_update_requires_reconciliation')
        reviewed = {'__file__': str(LIB / RECEIVER), '__name__': 'reviewed_receiver_check'}
        exec(compile(candidate, str(LIB / RECEIVER), 'exec'), reviewed)
        before = reviewed['deployment_status']()
        require(before.get('status') == 'deployment_ready' and before.get('blocked') is False and
                before.get('application') == {'api_active': True, 'worker_active': True},
                'reviewed_receiver_not_ready')
        # Durable originals make an interrupted two-file refresh inspectable. Never
        # overwrite them or replay after a partial write; the normal receiver fails closed.
        record = STATE / ('receiver-refresh-' + expected)
        record.mkdir(mode=0o700)
        for name, raw in ((RECEIVER, (LIB / RECEIVER).read_bytes()),
                          ('receiver-settings.json', settings_raw)):
            with (record / name).open('xb') as stream:
                os.fchmod(stream.fileno(), 0o600)
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
        sync_directory(record)
        sync_directory(STATE)
        settings['assets'][RECEIVER] = expected
        replace(LIB / RECEIVER, candidate, 0o644)
        replace(settings_path, (json.dumps(settings, sort_keys=True, indent=2) + '\n').encode(), 0o600)
        require(read_private(STATE / 'settings.json') == updater_settings_raw, 'updater_settings_changed')
        require(sha((LIB / RECEIVER).read_bytes()) == expected, 'refreshed_receiver_digest_mismatch')
        status = reviewed['deployment_status']()
        require(status.get('status') == 'deployment_ready' and status.get('blocked') is False and
                status.get('application') == {'api_active': True, 'worker_active': True} and
                status.get('current') == before.get('current'),
                'refreshed_receiver_not_ready')
        return {'schema_version': 1, 'status': 'receiver_refreshed', 'receiver_sha256': expected,
                'current': status['current'], 'application_services_restarted': False,
                'deployment_requested': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--previous-sha256', required=True)
    args = parser.parse_args()
    print(json.dumps(refresh(args.source, args.sha256, args.previous_sha256)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'receiver_refresh_failed_inspect_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
