#!/usr/bin/env python3
"""Reconcile the reviewed Market backup failure without replaying its operation."""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
from types import SimpleNamespace
import urllib.error
import urllib.request


LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
RELEASES = Path('/opt/nodia/releases')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
OPERATION = '1d6e3f19410a3cec6d2b97c958c44471'
CURRENT_IDENTITY = {
    'release_id': 'backend-69aeecc7dc98-10287555d45c',
    'source_sha': '69aeecc7dc989a06f0cedbffa2434d60072d75af',
    'package_tree_sha256': '10287555d45cc1c0ada35ab2b98648978db4c135a88005d0ab5e76fc97af2b7e',
}
CANDIDATE = 'backend-8017dbc63189-6422a361f0c7'
MANIFEST = 'backup-request-cd.json'
UPDATER = 'update-backend.py'
POLICY = 'backend_update.py'
RECEIVER = 'deploy-backend-receiver.py'
STAGE = 'stage-backend-candidate.py'
IO = 'refresh-production-cd.py'
REFRESH = 'refresh-post-migration-cd.py'
R2 = 'market-r2-read-only.mjs'
ACKNOWLEDGMENT = 'pre-migration-reconciliation.json'
ASSETS = {UPDATER, POLICY, IO, REFRESH, R2}
FIXED_ASSETS = {
    IO: '857d9203ea243f2049ffbf55864f35a3853238d18b3a086b803c41989289bc97',
    REFRESH: '494fd9d3867b201eeada312e0c802042df1d36341b488efc0a499a5739183d34',
    R2: 'bac7c73b3bc877d637bb36dead32cd103d7d2d763f7095d983cec0623b86a83f',
}
ORIGIN = 'https://nodia-1ge.pages.dev'
PUBLIC = 'https://166.0.112.187/api/v1'
LOOPBACK = 'http://127.0.0.1:3000/api/v1'


def require(condition, code):
    if not condition:
        raise ValueError(code)


def load_pinned(directory, filename, expected, maximum=100 * 1024):
    require(type(expected) is str and re.fullmatch(r'[a-f0-9]{64}', expected), 'reviewed_digest_required')
    descriptor = os.open(directory / filename, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size < maximum,
                'invalid_bundle_file')
        raw = stream.read(maximum)
    require(len(raw) == info.st_size and hashlib.sha256(raw).hexdigest() == expected,
            'bundle_file_changed')
    require(b'\r' not in raw, 'expected_lf_bundle_file')
    raw.decode('utf-8')
    return raw


def module(raw, filename):
    scope = {'__file__': str(filename), '__name__': 'reviewed_backup_request_refresh'}
    exec(compile(raw, str(filename), 'exec'), scope)
    return SimpleNamespace(**scope)


def load_bundle(directory, expected):
    io = module(load_pinned(directory, IO, FIXED_ASSETS[IO]), directory / IO)
    reusable = module(load_pinned(directory, REFRESH, FIXED_ASSETS[REFRESH]), directory / REFRESH)
    manifest_raw = load_pinned(directory, MANIFEST, expected, 16384)
    manifest = io.unique_json(manifest_raw)
    require(type(manifest) is dict and set(manifest) == {
        'schema_version', 'operation_id', 'expected_current', 'assets', 'previous_assets',
    } and type(manifest['schema_version']) is int and manifest['schema_version'] == 1 and
        manifest['operation_id'] == OPERATION and manifest['expected_current'] == CURRENT_IDENTITY,
        'exact_backup_failure_manifest_required')
    for label, inventory in (('assets', ASSETS), ('previous_assets', reusable.UPDATER_ASSETS | reusable.RECEIVER_ASSETS)):
        hashes = manifest[label]
        require(type(hashes) is dict and set(hashes) == inventory and all(map(reusable.digest, hashes.values())),
                'invalid_backup_failure_bundle_inventory')
    require(all(manifest['assets'][name] == digest for name, digest in FIXED_ASSETS.items()),
            'fixed_helper_digest_changed')
    sources = {name: load_pinned(directory, name, manifest['assets'][name]) for name in (UPDATER, POLICY, R2)}
    return io, reusable, manifest, manifest_raw, sources


def verify_cors(base):
    refresh = urllib.request.Request(base + '/auth/refresh', method='OPTIONS', headers={
        'Origin': ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
    with urllib.request.urlopen(refresh, timeout=15) as response:
        methods = {method.strip() for method in response.headers.get('Access-Control-Allow-Methods', '').split(',')}
        require(response.url == refresh.full_url and response.status == 204 and 'POST' in methods and
                response.headers.get('Access-Control-Allow-Origin') == ORIGIN and
                response.headers.get('Access-Control-Allow-Credentials') == 'true', 'cors_preflight_not_verified')
    anonymous = urllib.request.Request(base + '/auth/me', headers={'Origin': ORIGIN})
    try:
        with urllib.request.urlopen(anonymous, timeout=15):
            raise ValueError('anonymous_auth_must_be_denied')
    except urllib.error.HTTPError as error:
        with error:
            require(error.url == anonymous.full_url and error.code == 401 and
                    error.headers.get('Access-Control-Allow-Origin') == ORIGIN and
                    error.headers.get('Access-Control-Allow-Credentials') == 'true', 'cors_auth_not_verified')


def read_r2(io, updater, source, cwd):
    completed = subprocess.run(['/usr/sbin/runuser', '-u', 'nodia', '--', '/usr/local/bin/node', '--input-type=module'],
                               input=source, capture_output=True, timeout=55, cwd=cwd, env={
                                   **updater.SAFE_ENV, 'NODE_ENV': 'production', 'HOME': '/var/lib/nodia/home',
                               })
    require(completed.returncode == 0 and 0 < len(completed.stdout) <= 16384 and not completed.stderr,
            'readonly_r2_probe_failed')
    result = io.unique_json(completed.stdout)
    methods = result.get('methods')
    require(result.get('status') == 'r2_read_completed' and type(methods) is list and methods[:3] == ['GET', 'HEAD', 'GET'] and
            all(method in ('GET', 'HEAD') for method in methods), 'r2_readonly_methods_not_verified')
    return result['proof']


def read_originals(io, reusable, attempt, current, candidate):
    paths = {
        'state': attempt / 'state.json', 'request': attempt / 'request.json',
        'submitted': STATE / 'requests' / (OPERATION + '.json'), 'blocked': STATE / 'BLOCKED.json',
        'timers': attempt / 'timers-before.json',
        'availability': STATE / 'diagnostics' / ('market-availability-' + OPERATION) / 'receipt.json',
        'manifest': current / 'release-manifest.json', 'candidate_manifest': candidate / 'release-manifest.json',
    }
    originals = {}
    for key, filename in paths.items():
        mode = 0o644 if key in ('manifest', 'candidate_manifest') else 0o600
        io.protected(filename.parent, directory=True)
        io.protected(filename, mode)
        raw = reusable.snapshot(filename, 32 * 1024 ** 2 if mode == 0o644 else 16384)
        originals[key] = (filename, raw, mode)
    return originals


def verify_evidence_files(io, reusable, expected):
    for filename, (raw, mode) in expected.items():
        io.protected(filename, mode)
        maximum = 32 * 1024 ** 2 if filename.name in ('release-manifest.json', 'recovered-manifest.json') else 100 * 1024
        require(reusable.snapshot(filename, maximum) == raw, 'reconciliation_evidence_changed')


def prepare_evidence(io, reusable, manifest, sources, snapshots, settings):
    updater = reusable.module(sources[UPDATER], LIB / UPDATER)
    policy = reusable.module(sources[POLICY], LIB / POLICY)
    stage = reusable.module(snapshots[LIB / STAGE][0], LIB / STAGE)
    host = updater.Host(policy, stage, settings)
    host.current = RELEASES / manifest['expected_current']['release_id']
    host.candidate = RELEASES / CANDIDATE
    attempt = STATE / 'attempts' / OPERATION
    originals = read_originals(io, reusable, attempt, host.current, host.candidate)
    originals_by_path = {filename: (raw, mode) for filename, raw, mode in originals.values()}
    raw = {name: value[1] for name, value in originals.items()}
    require(io.unique_json(raw['request']) == io.unique_json(raw['submitted']), 'original_copies_differ')
    require(io.sha(raw['availability']) == policy.BACKUP_REQUEST_AVAILABILITY_SHA256 and
            io.sha(raw['candidate_manifest']) == policy.BACKUP_REQUEST_CANDIDATE_MANIFEST_SHA256 and
            io.sha(raw['manifest']) == policy.BACKUP_REQUEST_PINS['current_manifest_sha256'], 'reviewed_evidence_changed')
    require(host.manifest(host.current)['package_tree_sha256'] == CURRENT_IDENTITY['package_tree_sha256'], 'current_tree_changed')
    host.manifest(host.candidate)
    host.verify_writers(host.current)
    host.backup_environment(host.current)
    require(not updater.MAINTENANCE.exists() and not updater.MAINTENANCE.is_symlink(), 'maintenance_still_active')
    timers = io.unique_json(raw['timers'])
    require(type(timers) is dict and set(timers) == set(updater.TIMERS) and timers == io.unique_json(raw['state']).get('timers_before'),
            'original_timer_evidence_changed')
    for unit, before in timers.items():
        actual = host.show(unit)
        host.service_overrides(unit, actual)
        require(type(before.get('active')) is bool and actual.get('UnitFileState') == before.get('enabled') and
                (actual.get('ActiveState') == 'active') == before['active'], 'restored_timer_changed')
    for base in (LOOPBACK, PUBLIC):
        host.http(base, 200)
        verify_cors(base)
    io.protected(STATE / 'diagnostics', directory=True)
    with tempfile.TemporaryDirectory(prefix='backup-request-reconciliation-', dir=STATE / 'diagnostics') as directory:
        host.attempt = Path(directory)
        ledger = host.node_action('inspect')
    observation = read_r2(io, updater, sources[R2], host.current)
    host.verify_writers(host.current)
    evidence = reusable.json_bytes({
        'schema_version': 1, 'status': 'backup_request_reconciliation_evidence', 'operation_id': OPERATION,
        'availability_receipt': io.unique_json(raw['availability']), 'availability_receipt_sha256': io.sha(raw['availability']),
        'candidate_manifest_sha256': io.sha(raw['candidate_manifest']), 'ledger_inspection': ledger, 'r2_observation': observation,
    })
    receipt = {
        'schema_version': 1, 'status': policy.BACKUP_REQUEST_ACKNOWLEDGMENT, 'operation_id': OPERATION,
        'current_release_id': host.current.name, 'package_tree_sha256': CURRENT_IDENTITY['package_tree_sha256'],
        'state_sha256': io.sha(raw['state']), 'request_sha256': io.sha(raw['request']), 'blocked_sha256': io.sha(raw['blocked']),
        'current_manifest_sha256': io.sha(raw['manifest']), 'ledger_sha256': ledger.get('ledger_sha256'), 'migration_count': 56,
        'recovery_receipt_sha256': io.sha(evidence), 'acknowledged_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'new_operation_allowed': True, 'original_operation_retry_allowed': False,
    }
    policy.validate_pre_migration_reconciliation(receipt, state_bytes=raw['state'], request_bytes=raw['request'],
                                                 recovery_bytes=evidence, manifest_bytes=raw['manifest'], blocked_bytes=raw['blocked'])
    return host, originals_by_path, raw['manifest'], evidence, reusable.json_bytes(receipt), observation


def refresh_locked(io, reusable, manifest, manifest_raw, sources, *, apply):
    attempt = STATE / 'attempts' / OPERATION
    io.protected(attempt.parent, 0o700, directory=True)
    io.protected(attempt, 0o700, directory=True)
    journal = STATE / ('backup-request-cd-refresh-' + OPERATION)
    ack = attempt / ACKNOWLEDGMENT
    publication = (attempt / 'recovered-manifest.json', STATE / ('same-release-recovery-' + OPERATION + '.json'), ack)
    require(all(not path.exists() and not path.is_symlink() for path in (journal, *publication)),
            'reconciliation_intent_exists_inspect_private_state')
    snapshots, settings = reusable.installed_assets(io, manifest)
    receiver = reusable.module(snapshots[LIB / RECEIVER][0], LIB / RECEIVER)
    receiver.transport_assets()
    receiver.transport_adoption_guard()
    current = reusable.check_status(receiver, manifest, blocked=True)
    settings_path = STATE / 'settings.json'
    original_settings = settings[settings_path]
    host, originals, recovered_manifest, evidence, ack_raw, observation = prepare_evidence(
        io, reusable, manifest, sources, snapshots, original_settings)
    verify_evidence_files(io, reusable, {**snapshots, **originals})
    result = {'schema_version': 1, 'operation_id': OPERATION, 'current': current,
              'manifest_sha256': io.sha(manifest_raw), 'r2_observation_sha256': io.sha(reusable.json_bytes(observation)),
              'verified_backup_captured_at': observation['verified_backup']['captured_at'], 'original_backup_outcome': 'unknown',
              'deployment_requested': False, 'application_services_restarted': False, 'automatic_retry_allowed': False}
    if not apply:
        return {**result, 'status': 'backup_request_cd_dry_run', 'blocked': True}

    next_settings = {**original_settings, 'assets': {**original_settings['assets'],
                     **{name: manifest['assets'][name] for name in (UPDATER, POLICY)}}}
    writes = {LIB / name: (sources[name], 0o644) for name in (POLICY, UPDATER)}
    writes[settings_path] = (reusable.json_bytes(next_settings), 0o600)
    journal.mkdir(mode=0o700)
    io.sync_directory(STATE)
    reusable.save_new(journal / MANIFEST, manifest_raw, io)
    for path in writes:
        reusable.save_new(journal / path.name, snapshots[path][0], io)
    verify_evidence_files(io, reusable, {**snapshots, **originals})
    for path, (contents, mode) in writes.items():
        io.replace(path, contents, mode)
    expected = {**snapshots, **originals, **writes}
    verify_evidence_files(io, reusable, expected)
    reusable.check_status(receiver, manifest, blocked=True)
    for path, contents in zip(publication[:-1], (recovered_manifest, evidence), strict=True):
        reusable.save_new(path, contents, io)
        expected[path] = (contents, 0o600)
    override = (OPERATION, ack_raw)
    require(host.prior_updates_blocked(reconciliation_override=override) is False, 'updater_preview_blocked')
    reusable.check_status(receiver, manifest, blocked=False, override=override)
    verify_evidence_files(io, reusable, expected)
    reusable.save_new(ack, ack_raw, io)
    require(host.prior_updates_blocked() is False, 'updater_reconciliation_not_visible')
    reusable.check_status(receiver, manifest, blocked=False)
    return {**result, 'status': 'backup_request_cd_reconciled', 'blocked': False, 'original_operation_retry_allowed': False}


def refresh(bundle, expected, *, apply=False):
    require(os.geteuid() == 0, 'root_required')
    io, reusable, manifest, manifest_raw, sources = load_bundle(bundle, expected)
    for directory in (LIB, STATE, INSTALL_LOCK.parent):
        for parent in reversed((directory, *directory.parents)):
            io.protected(parent, directory=True)
    locks = (STATE / 'receiver.lock', INSTALL_LOCK)
    for lock in locks:
        require(io.protected(lock, 0o600).st_size == 0, 'invalid_reconciliation_lock')
    with locks[0].open('r+b') as receiver_lock, locks[1].open('r+b') as installer_lock:
        for lock in (receiver_lock, installer_lock):
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return refresh_locked(io, reusable, manifest, manifest_raw, sources, apply=apply)


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
        code = str(error) if re.fullmatch(r'[a-z0-9_]{1,100}', str(error)) else 'backup_request_cd_refresh_failed_inspect_state'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code, 'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
