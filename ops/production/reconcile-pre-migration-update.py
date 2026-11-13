#!/usr/bin/env python3
"""Acknowledge one recovered pre-migration failure. Never deploy, replay or edit its history."""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from types import SimpleNamespace
import urllib.error
import urllib.request

LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
CURRENT = Path('/opt/nodia/current')
RELEASES = Path('/opt/nodia/releases')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
MAINTENANCE = Path('/var/lib/nodia-maintenance/backend')
OPERATION = 'f452dfa82420d710757945a652f0b172'
RELEASE = 'backend-f01b49333688-ff33b6fdbbbc'
TREE = 'ff33b6fdbbbc05167745da9c2fde5f3d19355baf51d51214bbc7121cb6ea1e6f'
STATE_SHA = '88d2f1c263ac47465dbaa1123e96f714e769ad5ae95a4b8d4c7dbd7e241e8475'
BLOCKED_SHA = '4a0eb040aca6b8abfd5a44aecd8e29c33477e19a628d322f08ea6c8f53fb0d88'
MANIFEST_SHA = 'cf9fe8f3ac74522a60c9438ad54ebca21c2bafb2189107e15eeae7a460fc4ceb'
LEDGER_SHA = '83c8bc91c7250c10e9bbb6dff0ee9492a6e62e0f8a01993330ee2fd70b32562b'
IO_SHA = '857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97'
ASSETS = {'update-backend.py', 'backend_update.py', 'update-backend-action.mjs',
          'stage-backend-candidate.py', 'probe-backend-dependencies.mjs'}
COUNTERS = {'jobs', 'runs', 'executions', 'steps', 'slots', 'api_dispatches',
            'teacher_jobs', 'teacher_attempts', 'generation_operations'}
TIMERS = {'nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer'}


def require(condition, code):
    if not condition:
        raise ValueError(code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def bounded_source(path, maximum=100 * 1024):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size < maximum,
                'invalid_reconciliation_source')
        raw = stream.read(maximum + 1)
    require(len(raw) < maximum, 'reconciliation_source_too_large')
    return raw


def module_bytes(raw, filename, name):
    scope = {'__file__': str(filename), '__name__': name}
    exec(compile(raw, str(filename), 'exec'), scope)
    return SimpleNamespace(**scope)


def io_policy():
    filename = Path(__file__).resolve().with_name('refresh-production-cd.py')
    raw = bounded_source(filename)
    require(digest(raw) == IO_SHA, 'reviewed_io_policy_required')
    return module_bytes(raw, filename, 'reviewed_reconciliation_io')


def exclusive_bytes(path, raw, io):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        os.fchmod(stream.fileno(), 0o600)
        os.fchown(stream.fileno(), 0, 0)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    io.sync_directory(path.parent)


def exclusive_json(path, value, io):
    exclusive_bytes(path, (json.dumps(value, sort_keys=True, indent=2) + '\n').encode(), io)


def load_verified_runtime(settings, receiver_settings, io):
    snapshots = {}
    for assets in (settings['assets'], receiver_settings['assets']):
        for name, expected in assets.items():
            require(re.fullmatch(r'[a-f0-9]{64}', expected or '') is not None, 'asset_digest_invalid')
            io.protected(LIB / name, 0o755 if name == 'deploy-gateway.py' else 0o644)
            snapshots[name] = bounded_source(LIB / name)
            require(digest(snapshots[name]) == expected, 'installed_reconciliation_asset_changed')
    updater = module_bytes(snapshots['update-backend.py'], LIB / 'update-backend.py', 'reviewed_reconciliation_host')
    policy = module_bytes(snapshots['backend_update.py'], LIB / 'backend_update.py', 'reviewed_reconciliation_policy')
    stage = module_bytes(snapshots['stage-backend-candidate.py'], LIB / 'stage-backend-candidate.py', 'reviewed_reconciliation_stage')
    receiver = module_bytes(snapshots['deploy-backend-receiver.py'], LIB / 'deploy-backend-receiver.py', 'reviewed_reconciliation_receiver')
    require(callable(getattr(policy, 'validate_pre_migration_reconciliation', None)), 'reconciliation_policy_not_installed')
    return SimpleNamespace(host=updater.Host(policy, stage, settings), policy=policy, receiver=receiver)


def validate_inspection(value):
    require(type(value) is dict and value.get('status') == 'verified' and value.get('mode') == 'inspect'
            and value.get('read_only') is True and value.get('client_tls_authorized') is True
            and value.get('migrations_executed') is False and value.get('before') == value.get('target') == 45
            and value.get('pending') == 0 and value.get('ledger_sha256') == LEDGER_SHA
            and value.get('quiescent') is True and type(value.get('counts')) is dict
            and set(value['counts']) == COUNTERS
            and all(type(count) is int and count == 0 for count in value['counts'].values()),
            'fresh_read_only_reconciliation_required')


def verify_cors(base):
    origin = 'https://nodia-1ge.pages.dev'
    request = urllib.request.Request(base + '/auth/refresh', method='OPTIONS', headers={
        'Origin': origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
    with urllib.request.urlopen(request, timeout=15) as response:
        require(response.url == request.full_url and response.status == 204
                and response.headers.get('Access-Control-Allow-Origin') == origin
                and response.headers.get('Access-Control-Allow-Credentials') == 'true'
                and 'POST' in {part.strip() for part in response.headers.get('Access-Control-Allow-Methods', '').split(',')},
                'cors_preflight_not_verified')
    request = urllib.request.Request(base + '/auth/me', headers={'Origin': origin})
    try:
        with urllib.request.urlopen(request, timeout=15):
            raise ValueError('anonymous_auth_must_be_denied')
    except urllib.error.HTTPError as response:
        try:
            require(response.url == request.full_url and response.code == 401
                    and response.headers.get('Access-Control-Allow-Origin') == origin
                    and response.headers.get('Access-Control-Allow-Credentials') == 'true', 'cors_auth_not_verified')
        finally:
            response.close()


def reconcile(settings_sha, receiver_settings_sha, recovery_sha, request_sha):
    require(os.geteuid() == 0, 'root_required')
    require(all(re.fullmatch(r'[a-f0-9]{64}', value or '') for value in
                (settings_sha, receiver_settings_sha, recovery_sha, request_sha)), 'reviewed_reconciliation_pins_required')
    io = io_policy()
    for directory in (LIB, STATE, INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            io.protected(parent, directory=True)
    locks = (STATE / 'receiver.lock', INSTALL_LOCK)
    for lock in locks:
        require(io.protected(lock, 0o600).st_size == 0, 'invalid_reconciliation_lock')
    with locks[0].open('r+b') as receiver_lock, locks[1].open('r+b') as installation_lock:
        for handle in (receiver_lock, installation_lock):
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        settings_raw = io.read_private(STATE / 'settings.json')
        receiver_raw = io.read_private(STATE / 'receiver-settings.json')
        require(digest(settings_raw) == settings_sha and digest(receiver_raw) == receiver_settings_sha,
                'reviewed_installed_settings_required')
        settings, receiver_settings = io.unique_json(settings_raw), io.unique_json(receiver_raw)
        require(type(settings) is dict and type(settings.get('schema_version')) is int and settings['schema_version'] == 1 and type(settings.get('assets')) is dict
                and set(settings['assets']) == ASSETS, 'updater_assets_invalid')
        require(type(receiver_settings) is dict and type(receiver_settings.get('schema_version')) is int and receiver_settings['schema_version'] == 1
                and type(receiver_settings.get('assets')) is dict
                and set(receiver_settings['assets']) == {'deploy-backend-receiver.py', 'deploy-gateway.py'},
                'receiver_assets_invalid')
        attempt = STATE / 'attempts' / OPERATION
        io.protected(attempt.parent, directory=True)
        io.protected(attempt, directory=True)
        io.protected(STATE / 'requests', directory=True)
        state_raw = io.read_private(attempt / 'state.json')
        request_raw = io.read_private(STATE / 'requests' / (OPERATION + '.json'))
        require(io.read_private(attempt / 'request.json') == request_raw, 'original_request_copies_differ')
        blocked_raw = io.read_private(STATE / 'BLOCKED.json')
        recovery_path = STATE / ('same-release-recovery-' + OPERATION + '.json')
        recovery_raw = io.read_private(recovery_path)
        require((digest(state_raw), digest(blocked_raw), digest(request_raw), digest(recovery_raw)) ==
                (STATE_SHA, BLOCKED_SHA, request_sha, recovery_sha), 'recovered_operation_changed')
        state, request, recovery = map(io.unique_json, (state_raw, request_raw, recovery_raw))
        require(state.get('operation_id') == OPERATION and state.get('phase') == 'failed'
                and state.get('failed_phase') == 'stopping_writers' and state.get('error_code') == 'writer_shutdown_not_clean'
                and state.get('effects_started') is True and state.get('migration_requested') is False,
                'exact_pre_migration_failure_required')
        require(recovery.get('status') == 'complete' and recovery.get('operation_id') == OPERATION
                and recovery.get('cors_verified') is True and recovery.get('timers_restored') is True
                and recovery.get('maintenance_removed') is True and recovery.get('failed_attempt_unchanged') is True,
                'completed_same_release_recovery_required')
        require(CURRENT.is_symlink() and CURRENT.lstat().st_uid == CURRENT.lstat().st_gid == 0, 'current_not_managed')
        current = CURRENT.resolve(strict=True)
        require(current.name == RELEASE and current.parent == RELEASES, 'restored_release_changed')
        io.protected(current, directory=True)
        manifest_path = current / 'release-manifest.json'
        require(io.protected(manifest_path, 0o644).st_size < 32 * 1024 * 1024, 'manifest_size_invalid')
        manifest_raw = manifest_path.read_bytes()
        require(digest(manifest_raw) == MANIFEST_SHA, 'restored_manifest_changed')
        runtime = load_verified_runtime(settings, receiver_settings, io)
        host = runtime.host
        require(host.manifest(current)['package_tree_sha256'] == TREE, 'restored_tree_changed')
        host.backup_environment(current)
        require(not MAINTENANCE.exists() and not MAINTENANCE.is_symlink(), 'maintenance_still_active')
        acknowledgment = attempt / 'pre-migration-reconciliation.json'
        intent = attempt / 'pre-migration-reconciliation.intent.json'
        recovered_manifest = attempt / 'recovered-manifest.json'
        require(not acknowledgment.exists() and not acknowledgment.is_symlink()
                and not intent.exists() and not intent.is_symlink()
                and not recovered_manifest.exists() and not recovered_manifest.is_symlink(), 'reconciliation_already_reserved_no_replay')
        directory = STATE / 'diagnostics'
        io.protected(directory, 0o700, directory=True)
        diagnostic = directory / ('reconciliation-' + os.urandom(16).hex())
        diagnostic.mkdir(mode=0o700)
        io.sync_directory(directory)
        host.attempt = diagnostic
        host.current = host.candidate = current
        now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
        exclusive_json(intent, {'schema_version': 1, 'operation_id': OPERATION, 'status': 'intent_recorded',
            'state_sha256': STATE_SHA, 'request_sha256': request_sha, 'blocked_sha256': BLOCKED_SHA,
            'recovery_receipt_sha256': recovery_sha, 'started_at_utc': now()}, io)
        host.verify_writers(current)
        host.http('http://127.0.0.1:3000/api/v1', 200)
        host.http('https://166.0.112.187/api/v1', 200)
        verify_cors('http://127.0.0.1:3000/api/v1')
        verify_cors('https://166.0.112.187/api/v1')
        validate_inspection(host.node_action('inspect'))
        require(type(state.get('timers_before')) is dict and set(state['timers_before']) == TIMERS,
                'original_timer_snapshot_invalid')
        for unit, before in state['timers_before'].items():
            actual = host.show(unit)
            require(type(before.get('active')) is bool and actual.get('UnitFileState') == before.get('enabled')
                    and (actual.get('ActiveState') == 'active') == before['active'], 'restored_timer_changed')
        require(CURRENT.resolve(strict=True) == current and manifest_path.read_bytes() == manifest_raw
                and io.read_private(attempt / 'state.json') == state_raw and io.read_private(STATE / 'BLOCKED.json') == blocked_raw
                and io.read_private(STATE / 'requests' / (OPERATION + '.json')) == request_raw
                and io.read_private(attempt / 'request.json') == request_raw
                and io.read_private(recovery_path) == recovery_raw
                and io.read_private(STATE / 'settings.json') == settings_raw
                and io.read_private(STATE / 'receiver-settings.json') == receiver_raw
                and not MAINTENANCE.exists() and not MAINTENANCE.is_symlink(), 'reconciliation_context_changed')
        receipt = {'schema_version': 1, 'status': 'same_release_restored_before_migration', 'operation_id': OPERATION,
            'state_sha256': STATE_SHA, 'request_sha256': request_sha, 'blocked_sha256': BLOCKED_SHA,
            'recovery_receipt_sha256': recovery_sha, 'current_release_id': RELEASE,
            'current_manifest_sha256': MANIFEST_SHA, 'package_tree_sha256': TREE, 'ledger_sha256': LEDGER_SHA,
            'migration_count': 45, 'acknowledged_at_utc': now(), 'new_operation_allowed': True,
            'original_operation_retry_allowed': False}
        runtime.policy.validate_pre_migration_reconciliation(receipt, state_bytes=state_raw, request_bytes=request_raw,
            recovery_bytes=recovery_raw, manifest_bytes=manifest_raw, blocked_bytes=blocked_raw)
        host.verify_writers(current)
        exclusive_bytes(recovered_manifest, manifest_raw, io)
        exclusive_json(acknowledgment, receipt, io)
        result = runtime.receiver.deployment_status()
        require(result.get('status') == 'deployment_ready' and result.get('blocked') is False
                and result.get('application') == {'api_active': True, 'worker_active': True}
                and result.get('current', {}).get('release_id') == RELEASE
                and result.get('current', {}).get('package_tree_sha256') == TREE, 'reconciled_status_not_ready')
        return {'schema_version': 1, 'status': 'pre_migration_failure_reconciled', 'operation_id': OPERATION,
            'current': result['current'], 'failed_state_preserved': True, 'blocked_record_preserved': True,
            'deployment_requested': False, 'original_operation_retry_allowed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--settings-sha256', required=True)
    parser.add_argument('--receiver-settings-sha256', required=True)
    parser.add_argument('--recovery-sha256', required=True)
    parser.add_argument('--request-sha256', required=True)
    args = parser.parse_args()
    print(json.dumps(reconcile(args.settings_sha256, args.receiver_settings_sha256, args.recovery_sha256, args.request_sha256)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'reconciliation_failed_inspect_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code, 'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
