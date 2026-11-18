"""Verify the authorized recovery of one failed, committed migration."""

import datetime
import hashlib
import json
from pathlib import Path
import re
import tempfile
from types import SimpleNamespace
import urllib.error
import urllib.request


STATE = Path('/var/lib/nodia-updates')
RELEASES = Path('/opt/nodia/releases')
CURRENT = Path('/opt/nodia/current')
MAINTENANCE = Path('/var/lib/nodia-maintenance/backend')
OPERATION = '8014c78fc35edcaec2e4cb6658167329'
PREVIOUS = 'backend-d4345ea90eb9-6e5f3d002c88'
CANDIDATE = 'backend-b62a9029861f-1d4cda79ea4a'
SOURCE = 'b62a9029861f34539faa62823472ccce8f5ae567'
PREVIOUS_TREE = '6e5f3d002c88c23b87ac5f67f2cd5097f457ece6a2e0cbb8404b0cece7fabc58'
CANDIDATE_TREE = '1d4cda79ea4a58e6372137b25c80b63dd928e6d9c8c265146517feb70cba13f4'
MANIFEST_SHA = '005b532a718382ef0cae011a56d75c0ad4381d593f8405f96255a351c3c4dfc7'
LEDGER_SHA = '634d9db2209e4af8d3ac0df1335510d79b471b8390373654533d9edfd3c98718'
FAILURE_NAME = '554c10a5cc3746dc802367182b2ea69b.json'
FAILURE_SHA = '46c6b995353adfad0470db3f93976fd64726764056a97c7f5d539e4c6d863d32'
ORIGIN = 'https://nodia-1ge.pages.dev'
LOOPBACK = 'http://127.0.0.1:3000/api/v1'
PUBLIC = 'https://166.0.112.187/api/v1'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def json_bytes(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode()


def utc_time(value, require):
    require(type(value) is str and len(value) <= 64, 'invalid_recovery_time')
    timestamp = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(timestamp.utcoffset() == datetime.timedelta(0), 'invalid_recovery_time')
    return timestamp


def require_current(io):
    info = CURRENT.lstat()
    io.require(CURRENT.is_symlink() and info.st_uid == info.st_gid == 0
               and CURRENT.resolve(strict=True) == RELEASES / CANDIDATE, 'recovered_candidate_not_current')
    io.require(not MAINTENANCE.exists() and not MAINTENANCE.is_symlink(), 'maintenance_still_active')


def load_evidence(io, policy, operation):
    """Read and bind the existing recovery records without changing the VPS."""
    io.require(operation == OPERATION, 'reviewed_post_migration_operation_required')
    attempt = STATE / 'attempts' / operation
    diagnostics = STATE / 'diagnostics'
    for directory in (STATE, attempt.parent, attempt, STATE / 'requests', RELEASES,
                      RELEASES / PREVIOUS, RELEASES / CANDIDATE, MAINTENANCE.parent):
        io.protected(directory, directory=True)
    io.protected(diagnostics, 0o700, directory=True)
    require_current(io)

    snapshots = {}

    def read(path, mode=0o600, maximum=16384):
        io.require(0 < io.protected(path, mode).st_size <= maximum, 'recovery_evidence_size_invalid')
        raw = path.read_bytes()
        snapshots[path] = raw
        return raw

    state_raw = read(attempt / 'state.json')
    request_raw = read(attempt / 'request.json')
    blocked_raw = read(STATE / 'BLOCKED.json')
    io.require(read(STATE / 'requests' / (operation + '.json')) == request_raw, 'original_request_copies_differ')
    state = io.unique_json(state_raw)
    request = policy.validate_request(io.unique_json(request_raw))
    io.require(state.get('operation_id') == operation and state.get('phase') == 'failed'
               and state.get('failed_phase') == 'migration_requested'
               and state.get('error_code') == 'host_command_failed_inspect_private_diagnostics'
               and state.get('effects_started') is True and state.get('migration_requested') is True
               and state.get('automatic_retry_allowed') is False and 'migration_result' not in state
               and state.get('candidate_release') == CANDIDATE and state.get('previous_release') == PREVIOUS
               and blocked_raw == policy.blocked_record_bytes(state), 'original_migration_failure_changed')
    io.require(request == {'schema_version': 1, 'operation_id': operation,
                           'artifact_directory': 'server-44206362041-1', 'artifact_id': '14383762946',
                           'artifact_zip_sha256': 'aec99df96cfebcca657ba8576af30e18968923d2f3bcd58080fa9d664b0d4808',
                           'source_sha': SOURCE, 'expected_current_release': PREVIOUS,
                           'expected_current_tree_sha256': PREVIOUS_TREE}, 'original_update_request_changed')

    failure_raw = read(attempt / FAILURE_NAME)
    io.require(sha(failure_raw) == FAILURE_SHA, 'original_schema_diagnostic_changed')
    activation = io.unique_json(read(diagnostics / ('post-migration-activation-' + operation + '.json')))
    folder = activation.get('diagnostics')
    io.require(type(folder) is str and set(activation) == {'release', 'at', 'migrations_requested', 'diagnostics'}
               and activation['release'] == CANDIDATE and activation['migrations_requested'] is False,
               'completed_recovery_activation_required')
    folder = Path(folder)
    io.require(folder.parent == diagnostics and re.fullmatch('post-migration-recovery-' + operation + r'-[a-z0-9_]{8}',
                                                               folder.name), 'invalid_recovery_diagnostic_directory')
    io.protected(folder, 0o700, directory=True)
    intent_raw = read(folder / 'intent.json')
    intent = io.unique_json(intent_raw)
    started_at = intent.get('started_at')
    io.require(intent == {'schema_version': 1, 'status': 'intent_recorded', 'operation_id': operation,
                          'original_state_sha256': sha(state_raw), 'request_sha256': sha(request_raw),
                          'blocked_sha256': sha(blocked_raw), 'release_id': CANDIDATE,
                          'manifest_sha256': MANIFEST_SHA, 'ledger_sha256': LEDGER_SHA,
                          'started_at': started_at, 'migrations_requested': False}, 'recovery_intent_changed')
    preactivation_raw = read(folder / 'preactivation.json')
    preactivation = io.unique_json(preactivation_raw)
    counts = preactivation.get('counts')
    io.require(type(counts) is dict and set(counts) == policy.RUNTIME_COUNTERS
               and all(type(count) is int and count == 0 for count in counts.values())
               and preactivation == {'schema_version': 1, 'status': 'verified', 'mode': 'verify',
                                     'before': 52, 'target': 56, 'pending': 0, 'incremental_migrations': 4,
                                     'ledger_sha256': LEDGER_SHA, 'quiescent': True, 'counts': counts,
                                     'read_only': True, 'client_tls_authorized': True, 'migrations_executed': False,
                                     'entity_columns_present': True, 'entity_tables_checked': 73},
               'physical_schema_proof_missing')
    switched = io.unique_json(read(folder / 'release-switched.json'))
    recovery_raw = read(folder / 'receipt.json')
    recovery = io.unique_json(recovery_raw)
    completed_at = recovery.get('completed_at')
    io.require(set(switched) == {'release', 'at'} and switched['release'] == CANDIDATE
               and utc_time(started_at, io.require) <= utc_time(activation['at'], io.require)
               <= utc_time(switched['at'], io.require) <= utc_time(completed_at, io.require), 'recovery_timeline_invalid')
    io.require(recovery == {'schema_version': 1, 'status': 'service_restored', 'operation_id': operation,
                            'release_id': CANDIDATE, 'ledger_sha256': LEDGER_SHA, 'migration_count': 56,
                            'migrations_executed': False, 'failed_attempt_preserved': True,
                            'backend_public_http': 200, 'cors_verified': True, 'timers_restored': True,
                            'cd_blocked': True, 'completed_at': completed_at}, 'completed_service_recovery_required')

    manifest_raw = read(RELEASES / CANDIDATE / 'release-manifest.json', 0o644, 32 * 1024 ** 2)
    io.require(sha(manifest_raw) == MANIFEST_SHA, 'recovered_candidate_manifest_changed')
    metadata = io.unique_json(read(attempt / 'build-metadata.json', maximum=64 * 1024))
    ci = metadata['ci']
    io.require(metadata.get('source_sha') == SOURCE and metadata.get('release_id') == CANDIDATE
               and metadata.get('package_tree_sha256') == CANDIDATE_TREE and metadata.get('manifest_sha256') == MANIFEST_SHA
               and metadata.get('production_eligible') is True and str(ci.get('run_id')) == '44206362041'
               and str(ci.get('run_attempt')) == '1', 'recovery_artifact_provenance_changed')
    deployed = io.unique_json(read(STATE / 'deployed-backend.json'))
    io.require(deployed == {'schema_version': 1, 'release_id': CANDIDATE, 'source_sha': SOURCE,
                            'package_tree_sha256': CANDIDATE_TREE, 'ci': ci, 'backup': state['backup']},
               'recovered_deployed_record_changed')
    timers = io.unique_json(read(attempt / 'timers-before.json'))
    io.require(timers == state.get('timers_before'), 'original_timer_evidence_changed')
    return SimpleNamespace(attempt=attempt, snapshots=snapshots, timers=timers, state_bytes=state_raw,
                           request_bytes=request_raw, blocked_bytes=blocked_raw, recovery_bytes=recovery_raw,
                           recovery_intent_bytes=intent_raw, manifest_bytes=manifest_raw,
                           migration_failure_bytes=failure_raw, preactivation_bytes=preactivation_raw)


def verify_cors(base, require):
    refresh = urllib.request.Request(base + '/auth/refresh', method='OPTIONS', headers={
        'Origin': ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'})
    with urllib.request.urlopen(refresh, timeout=15) as response:
        methods = response.headers.get('Access-Control-Allow-Methods', '').split(',')
        require(response.url == refresh.full_url and response.status == 204 and 'POST' in {part.strip() for part in methods}
                and response.headers.get('Access-Control-Allow-Origin') == ORIGIN
                and response.headers.get('Access-Control-Allow-Credentials') == 'true', 'cors_preflight_not_verified')
    anonymous = urllib.request.Request(base + '/auth/me', headers={'Origin': ORIGIN})
    try:
        with urllib.request.urlopen(anonymous, timeout=15):
            raise ValueError('anonymous_auth_must_be_denied')
    except urllib.error.HTTPError as response:
        with response:
            require(response.url == anonymous.full_url and response.code == 401
                    and response.headers.get('Access-Control-Allow-Origin') == ORIGIN
                    and response.headers.get('Access-Control-Allow-Credentials') == 'true', 'cors_auth_not_verified')


def prepare_reconciliation(io, updater, policy, stage, receiver, settings, operation):
    """Under both installer locks, build private snapshots with acknowledgment last."""
    evidence = load_evidence(io, policy, operation)
    status = receiver.deployment_status()
    io.require(status.get('status') == 'deployment_ready' and status.get('blocked') is True
               and status.get('application') == {'api_active': True, 'worker_active': True}
               and status.get('current') == {'release_id': CANDIDATE, 'source_sha': SOURCE,
                                             'package_tree_sha256': CANDIDATE_TREE}, 'blocked_candidate_not_ready')
    host = updater.Host(policy, stage, settings)
    host.current, host.candidate = RELEASES / PREVIOUS, RELEASES / CANDIDATE
    io.require(host.manifest(host.current)['package_tree_sha256'] == PREVIOUS_TREE, 'previous_release_tree_changed')
    candidate_manifest = host.manifest(host.candidate)
    io.require(candidate_manifest['source_sha'] == SOURCE and candidate_manifest['package_tree_sha256'] == CANDIDATE_TREE,
               'candidate_release_tree_changed')
    host.backup_environment(host.candidate)
    io.require(type(evidence.timers) is dict and set(evidence.timers) == set(updater.TIMERS), 'original_timer_state_invalid')
    for unit, before in evidence.timers.items():
        actual = host.show(unit)
        host.service_overrides(unit, actual)
        io.require(type(before.get('active')) is bool and actual.get('UnitFileState') == before.get('enabled')
                   and (actual.get('ActiveState') == 'active') == before['active'], 'restored_timer_changed')
    for base in (LOOPBACK, PUBLIC):
        host.http(base, 200)
        verify_cors(base, io.require)
    with tempfile.TemporaryDirectory(prefix='post-migration-reconciliation-', dir=STATE / 'diagnostics') as directory:
        host.attempt = Path(directory)
        evidence.verification_bytes = json_bytes(host.node_action('verify'))
    io.require(load_evidence(io, policy, operation).snapshots == evidence.snapshots, 'recovery_evidence_changed_during_check')
    host.verify_writers(host.candidate)

    receipt = {'schema_version': 1, 'status': 'candidate_restored_after_migration', 'operation_id': operation,
               'state_sha256': sha(evidence.state_bytes), 'request_sha256': sha(evidence.request_bytes),
               'blocked_sha256': sha(evidence.blocked_bytes),
               'current_release_id': CANDIDATE, 'current_manifest_sha256': MANIFEST_SHA,
               'package_tree_sha256': CANDIDATE_TREE, 'ledger_sha256': LEDGER_SHA, 'migration_count': 56,
               'acknowledged_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'new_operation_allowed': True, 'original_operation_retry_allowed': False}
    proof = {}
    records = []
    for field, (filename, digest_field) in policy.POST_MIGRATION_EVIDENCE.items():
        raw = getattr(evidence, field)
        proof[field] = raw
        receipt[digest_field] = sha(raw)
        records.append((evidence.attempt / filename, raw))
    policy.validate_post_migration_reconciliation(receipt, state_bytes=evidence.state_bytes,
        request_bytes=evidence.request_bytes, manifest_bytes=evidence.manifest_bytes,
        blocked_bytes=evidence.blocked_bytes, **proof)
    records.append((evidence.attempt / 'recovered-manifest.json', evidence.manifest_bytes))
    records.append((evidence.attempt / 'post-migration-reconciliation.json', json_bytes(receipt)))
    return records
