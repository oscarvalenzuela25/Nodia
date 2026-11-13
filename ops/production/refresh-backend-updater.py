#!/usr/bin/env python3
"""Operator refresh of a reviewed updater after a failed, effect-free preflight."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from types import SimpleNamespace

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
ASSET = 'update-backend.py'
ASSETS = {ASSET, 'backend_update.py', 'update-backend-action.mjs',
          'stage-backend-candidate.py', 'probe-backend-dependencies.mjs'}
# Reuse the reviewed root-file/atomic-write boundary, without running its CLI.
IO_SHA256 = '857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97'


def load_bytes(raw, filename, name):
    scope = {'__name__': name, '__file__': str(filename)}
    exec(compile(raw, str(filename), 'exec'), scope)
    return SimpleNamespace(**scope)


def reviewed_source(filename):
    limit = 100 * 1024
    descriptor = os.open(filename, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not (stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size < limit):
            raise ValueError('invalid_reviewed_source')
        raw = stream.read(limit + 1)
    if len(raw) >= limit:
        raise ValueError('reviewed_source_too_large')
    return raw


def io_policy():
    filename = Path(__file__).resolve().parent / 'refresh-production-cd.py'
    raw = reviewed_source(filename)
    if hashlib.sha256(raw).hexdigest() != IO_SHA256:
        raise ValueError('reviewed_refresh_policy_required')
    return load_bytes(raw, filename, 'reviewed_refresh_policy')


def refresh(source, expected, previous, operation):
    io = io_policy()
    must = io.require
    must(os.geteuid() == 0, 'root_required')
    must(all(re.fullmatch(r'[a-f0-9]{64}', value or '') for value in (expected, previous))
         and expected != previous and re.fullmatch(r'[a-f0-9]{32}', operation or ''), 'reviewed_refresh_identity_required')
    candidate = reviewed_source(source)
    must(io.sha(candidate) == expected and b'\r' not in candidate, 'reviewed_updater_digest_required')
    compile(candidate, str(LIB / ASSET), 'exec')
    for directory in (LIB, STATE, INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            io.protected(parent, directory=True)
    locks = (STATE / 'receiver.lock', INSTALL_LOCK)
    for lock in locks:
        must(io.protected(lock, 0o600).st_size == 0, 'invalid_updater_refresh_lock')
    with locks[0].open('r+b') as receiver_lock, locks[1].open('r+b') as installation_lock:
        for lock in (receiver_lock, installation_lock):
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        settings_path = STATE / 'settings.json'
        settings_raw = io.read_private(settings_path)
        settings = io.unique_json(settings_raw)
        must(type(settings) is dict and type(settings.get('assets')) is dict and
             set(settings['assets']) == ASSETS, 'reviewed_updater_assets_required')
        for name, digest in settings['assets'].items():
            io.protected(LIB / name, 0o644)
            must(io.sha((LIB / name).read_bytes()) == digest, 'installed_updater_asset_changed')
        must(settings['assets'][ASSET] == previous, 'previous_updater_digest_mismatch')
        receiver_settings_raw = io.read_private(STATE / 'receiver-settings.json')
        receiver_settings = io.unique_json(receiver_settings_raw)
        must(set(receiver_settings['assets']) == {'deploy-backend-receiver.py', 'deploy-gateway.py'}, 'receiver_assets_required')
        for name, digest in receiver_settings['assets'].items():
            io.protected(LIB / name, 0o755 if name == 'deploy-gateway.py' else 0o644)
            must(io.sha((LIB / name).read_bytes()) == digest, 'installed_receiver_asset_changed')
        attempt = STATE / 'attempts' / operation
        io.protected(attempt.parent, directory=True)
        io.protected(attempt, directory=True)
        state_raw = io.read_private(attempt / 'state.json')
        state = io.unique_json(state_raw)
        must(state.get('operation_id') == operation and state.get('phase') == 'failed' and
             state.get('failed_phase') == 'preparing' and state.get('effects_started') is False and
             state.get('migration_requested') is False, 'effect_free_failed_preflight_required')
        must(not (STATE / 'BLOCKED.json').exists(), 'blocked_update_requires_reconciliation')
        receiver_file = LIB / 'deploy-backend-receiver.py'
        receiver = load_bytes(receiver_file.read_bytes(), receiver_file, 'reviewed_receiver_status')
        before = receiver.deployment_status()
        must(before.get('status') == 'deployment_ready' and before.get('blocked') is False and
             before.get('application') == {'api_active': True, 'worker_active': True}, 'current_backend_not_ready')
        reviewed = load_bytes(candidate, LIB / ASSET, 'reviewed_new_updater')
        host = reviewed.Host(SimpleNamespace(require=must, Rejected=ValueError), None, settings)
        for unit in ('nodia-api.service', 'nodia-ai-worker.service'):
            host.service_overrides(unit, receiver.unit_state(unit))
        record = STATE / ('updater-refresh-' + expected)
        record.mkdir(mode=0o700)
        for name, raw in ((ASSET, (LIB / ASSET).read_bytes()), ('settings.json', settings_raw)):
            with (record / name).open('xb') as stream:
                os.fchmod(stream.fileno(), 0o600)
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
        io.sync_directory(record)
        io.sync_directory(STATE)
        settings['assets'][ASSET] = expected
        io.replace(LIB / ASSET, candidate, 0o644)
        io.replace(settings_path, (json.dumps(settings, sort_keys=True, indent=2) + '\n').encode(), 0o600)
        after = receiver.deployment_status()
        must(after == before and io.sha((LIB / ASSET).read_bytes()) == expected and
             io.read_private(STATE / 'receiver-settings.json') == receiver_settings_raw and
             io.read_private(attempt / 'state.json') == state_raw, 'updater_refresh_verification_failed')
        return {'schema_version': 1, 'status': 'updater_refreshed', 'updater_sha256': expected,
                'current': after['current'], 'failed_operation_preserved': True,
                'application_services_restarted': False, 'deployment_requested': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--previous-sha256', required=True)
    parser.add_argument('--failed-operation', required=True)
    args = parser.parse_args()
    print(json.dumps(refresh(args.source, args.sha256, args.previous_sha256, args.failed_operation)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'updater_refresh_failed_inspect_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
