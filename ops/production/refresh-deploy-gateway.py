#!/usr/bin/env python3
"""Hash-pinned, operator-only gateway refresh. Dry-run by default; no deploy or restart."""
import argparse
import datetime
import fcntl
import hashlib
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
GATEWAY = 'deploy-gateway.py'
RECEIVER = 'deploy-backend-receiver.py'
UPDATER_ASSETS = {'update-backend.py', 'backend_update.py', 'update-backend-action.mjs',
                  'stage-backend-candidate.py', 'probe-backend-dependencies.mjs'}
UNITS = ('nodia-api.service', 'nodia-ai-worker.service')
IO_SHA256 = '857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97'
CANDIDATE_SHA256 = '6b794263ad129ff45ed8752374d55a9c69cde789ae903a33cc2097fd91406e9f'
SOURCE_LIMIT = 100 * 1024


def require(condition, code):
    if not condition:
        raise ValueError(code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def occupied(path):
    return path.exists() or path.is_symlink()


def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mode, info.st_nlink,
            info.st_mtime_ns, info.st_ctime_ns)


def snapshot(path, *, maximum=SOURCE_LIMIT, io=None, mode=None):
    protected = io.protected(path, mode) if io else None
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and
                0 < before.st_size < maximum, 'invalid_gateway_refresh_source')
        require(protected is None or identity(before) == identity(protected), 'gateway_refresh_source_changed')
        raw = stream.read(maximum + 1)
        require(identity(os.fstat(stream.fileno())) == identity(before), 'gateway_refresh_source_changed')
    require(len(raw) < maximum and len(raw) == before.st_size, 'gateway_refresh_source_size_changed')
    return raw


def load_bytes(raw, filename, name):
    scope = {'__name__': name, '__file__': str(filename)}
    exec(compile(raw, str(filename), 'exec'), scope)
    return SimpleNamespace(**scope)


def io_policy():
    filename = Path(__file__).resolve().with_name('refresh-production-cd.py')
    raw = snapshot(filename)
    require(sha(raw) == IO_SHA256, 'reviewed_refresh_policy_required')
    return load_bytes(raw, filename, 'reviewed_gateway_refresh_io')


def load_receiver(raw):
    return load_bytes(raw, LIB / RECEIVER, 'reviewed_gateway_receiver_status')


def validate_settings(raw, assets, io):
    value = io.unique_json(raw)
    require(type(value) is dict and type(value.get('schema_version')) is int and value['schema_version'] == 1 and
            type(value.get('assets')) is dict and set(value['assets']) == assets and
            all(isinstance(digest, str) and re.fullmatch(r'[a-f0-9]{64}', digest)
                for digest in value['assets'].values()), 'invalid_gateway_refresh_settings')
    return value


def ready_status(receiver):
    status = receiver.deployment_status()
    current = status.get('current')
    require(status.get('schema_version') == 1 and status.get('status') == 'deployment_ready' and
            status.get('blocked') is False and
            status.get('application') == {'api_active': True, 'worker_active': True} and
            type(current) is dict and isinstance(current.get('source_sha'), str) and
            re.fullmatch(r'[a-f0-9]{40}', current['source_sha']) and
            isinstance(current.get('package_tree_sha256'), str) and
            re.fullmatch(r'[a-f0-9]{64}', current['package_tree_sha256']) and
            current.get('release_id') == 'backend-' + current['source_sha'][:12] + '-' + current['package_tree_sha256'][:12],
            'gateway_refresh_backend_not_ready')
    # The installed receiver owns historical BLOCKED/ACK reconciliation and service policy.
    pids = {}
    for unit in UNITS:
        observed = receiver.unit_state(unit)
        pid = observed.get('MainPID', '')
        require(observed.get('ActiveState') == 'active' and observed.get('SubState') == 'running' and
                observed.get('Result') == 'success' and observed.get('ControlGroup') == '/system.slice/' + unit and
                isinstance(pid, str) and pid.isdigit() and int(pid) > 1, 'gateway_refresh_writer_identity_invalid')
        pids[unit] = int(pid)
    return status, pids


def save_new(path, raw, io):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    io.sync_directory(path.parent)


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode('utf-8')


def verify_unchanged(snapshots, io):
    for path, (raw, mode) in snapshots.items():
        require(snapshot(path, io=io, mode=mode) == raw, 'gateway_refresh_original_changed')


def refresh(source, expected, previous, expected_receiver_settings_sha256, *, apply=False):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'isolated_linux_root_required')
    require(all(isinstance(value, str) and re.fullmatch(r'[a-f0-9]{64}', value)
                for value in (expected, previous, expected_receiver_settings_sha256)) and
            expected == CANDIDATE_SHA256 and expected != previous and type(apply) is bool,
            'reviewed_gateway_identity_required')
    candidate = snapshot(source)
    try:
        candidate.decode('utf-8')
    except UnicodeDecodeError:
        raise ValueError('gateway_source_utf8_required') from None
    require(sha(candidate) == expected and b'\r' not in candidate, 'reviewed_gateway_digest_required')
    compile(candidate, str(LIB / GATEWAY), 'exec')  # Never execute staged candidate code.
    io = io_policy()
    for directory in (LIB, STATE, INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            io.protected(parent, directory=True)
    locks = (STATE / 'receiver.lock', INSTALL_LOCK)
    for lock in locks:
        require(io.protected(lock, 0o600).st_size == 0, 'invalid_gateway_refresh_lock')
    with locks[0].open('r+b') as receiver_lock, locks[1].open('r+b') as installation_lock:
        for stream in (receiver_lock, installation_lock):
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        record = STATE / ('gateway-refresh-' + expected)
        require(not occupied(record), 'gateway_refresh_intent_exists_no_automatic_replay')
        settings_path = STATE / 'receiver-settings.json'
        settings_raw = snapshot(settings_path, maximum=16385, io=io, mode=0o600)
        require(sha(settings_raw) == expected_receiver_settings_sha256, 'receiver_settings_cas_mismatch')
        settings = validate_settings(settings_raw, {RECEIVER, GATEWAY}, io)
        updater_path = STATE / 'settings.json'
        updater_raw = snapshot(updater_path, maximum=16385, io=io, mode=0o600)
        updater = validate_settings(updater_raw, UPDATER_ASSETS, io)
        snapshots = {settings_path: (settings_raw, 0o600), updater_path: (updater_raw, 0o600)}
        for assets in (settings['assets'], updater['assets']):
            for name, digest in assets.items():
                mode = 0o755 if name == GATEWAY else 0o644
                raw = snapshot(LIB / name, io=io, mode=mode)
                require(sha(raw) == digest, 'installed_gateway_refresh_asset_changed')
                snapshots[LIB / name] = (raw, mode)
        require(settings['assets'][GATEWAY] == previous, 'previous_gateway_digest_mismatch')
        blocked = STATE / 'BLOCKED.json'
        if occupied(blocked):
            snapshots[blocked] = (snapshot(blocked, maximum=16385, io=io, mode=0o600), 0o600)
        receiver = load_receiver(snapshots[LIB / RECEIVER][0])
        before, pids = ready_status(receiver)
        settings['assets'][GATEWAY] = expected
        next_settings = json_bytes(settings)
        require(len(next_settings) <= 16384, 'refreshed_receiver_settings_too_large')
        evidence = {'schema_version': 1, 'gateway_sha256': expected, 'previous_gateway_sha256': previous,
                    'receiver_sha256': sha(snapshots[LIB / RECEIVER][0]),
                    'previous_receiver_settings_sha256': expected_receiver_settings_sha256,
                    'receiver_settings_sha256': sha(next_settings), 'updater_settings_sha256': sha(updater_raw),
                    'blocked_evidence_sha256': sha(snapshots[blocked][0]) if blocked in snapshots else None,
                    'current': before['current'], 'application_pids': pids,
                    'deployment_requested': False, 'deployment_performed': False,
                    'application_services_restarted': False, 'automatic_retry_allowed': False}
        verify_unchanged(snapshots, io)
        if not apply:
            return {**evidence, 'status': 'gateway_refresh_dry_run', 'gateway_changed': False}
        record.mkdir(mode=0o700)
        io.sync_directory(STATE)
        save_new(record / 'intent.json', json_bytes({**evidence, 'status': 'gateway_refresh_intent',
                 'started_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}), io)
        for name, raw in ((GATEWAY, snapshots[LIB / GATEWAY][0]), ('receiver-settings.json', settings_raw)):
            save_new(record / name, raw, io)
        io.sync_directory(record)
        io.sync_directory(STATE)
        verify_unchanged(snapshots, io)
        io.replace(LIB / GATEWAY, candidate, 0o755)
        io.replace(settings_path, next_settings, 0o600)
        expected_after = {**snapshots, LIB / GATEWAY: (candidate, 0o755), settings_path: (next_settings, 0o600)}
        verify_unchanged(expected_after, io)
        require(occupied(blocked) == (blocked in snapshots), 'gateway_refresh_block_evidence_changed')
        after, after_pids = ready_status(receiver)
        require(after == before and after_pids == pids, 'gateway_refresh_runtime_changed')
        receipt = {**evidence, 'status': 'gateway_refreshed', 'gateway_changed': True,
                   'completed_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        save_new(record / 'receipt.json', json_bytes(receipt), io)
        return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--previous-sha256', required=True)
    parser.add_argument('--expected-receiver-settings-sha256', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    print(json.dumps(refresh(args.source, args.sha256, args.previous_sha256,
                             args.expected_receiver_settings_sha256, apply=args.apply)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'gateway_refresh_failed_inspect_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
