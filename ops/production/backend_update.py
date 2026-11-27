"""Pure update policy and ordered effects. Host/systemd adapters live separately."""
import datetime
import hashlib
import json
import re


class Rejected(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Rejected(code)


def validate_request(value):
    fields = {'schema_version', 'operation_id', 'artifact_directory', 'artifact_id', 'artifact_zip_sha256',
              'source_sha', 'expected_current_release', 'expected_current_tree_sha256'}
    require(isinstance(value, dict) and set(value) == fields and type(value['schema_version']) is int and
            value['schema_version'] == 1, 'invalid_update_request')
    patterns = {'operation_id': r'[a-f0-9]{32}', 'artifact_directory': r'server-[1-9][0-9]*-[1-9][0-9]*',
                'artifact_id': r'[1-9][0-9]{0,19}', 'artifact_zip_sha256': r'[a-f0-9]{64}', 'source_sha': r'[a-f0-9]{40}',
                'expected_current_release': r'backend-[a-f0-9]{12}-[a-f0-9]{12}',
                'expected_current_tree_sha256': r'[a-f0-9]{64}'}
    require(all(isinstance(value[name], str) and re.fullmatch(pattern, value[name])
                for name, pattern in patterns.items()), 'invalid_update_request_identity')
    return value


def blocked_record_bytes(state):
    """The unchanged original BLOCKED wire format, also bound by reconciliation."""
    return (json.dumps({'operation_id': state['operation_id'], 'failed_phase': state['failed_phase'],
                        'error_code': state['error_code']}) + '\n').encode()


def _evidence_json(raw, check, maximum=16384):
    check(type(raw) is bytes and 0 < len(raw) <= maximum)

    def pairs(items):
        result = {}
        for key, value in items:
            check(key not in result)
            result[key] = value
        return result

    return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
                      parse_constant=lambda _: check(False))


def _evidence_date(value, check):
    check(isinstance(value, str) and len(value) <= 64)
    result = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    check(result.tzinfo is not None and result.utcoffset() == datetime.timedelta(0))
    return result


RECONCILIATION_DIGESTS = ('state_sha256', 'request_sha256', 'blocked_sha256', 'recovery_receipt_sha256',
                          'current_manifest_sha256', 'package_tree_sha256', 'ledger_sha256')
RECONCILIATION_FIELDS = frozenset(RECONCILIATION_DIGESTS) | {
    'schema_version', 'status', 'operation_id', 'current_release_id', 'migration_count',
    'acknowledged_at_utc', 'new_operation_allowed', 'original_operation_retry_allowed',
}
QUIESCENCE_ACKNOWLEDGMENT = 'quiescence_reconciled_before_migration'
QUIESCENCE_OPERATION = '4f74fce53e7101cddfa0484ed6711ca7'
QUIESCENCE_REQUEST_SOURCE = 'da680ac8c802c2054f5f888b0bba28b441c2504b'
QUIESCENCE_CURRENT_SOURCE = '6aa8b7ace5336c9dd36cd62a6f5832d8b87221ce'
QUIESCENCE_CURRENT_RELEASE = 'backend-6aa8b7ace533-e6edfae54f09'
QUIESCENCE_CANDIDATE = 'backend-da680ac8c802-3e1c9413cba1'
QUIESCENCE_MIGRATION_COUNT = 87
QUIESCENCE_AVAILABILITY_SHA256 = '0a164b8804963be46a8fe67bd4ae7c387f964d8e586849b305422adce67b4d43'
QUIESCENCE_PINS = {
    'state_sha256': 'a05caae4f6ed9fa45aef29fd273c0d19e47ad19c4d06f9abbeb2bd6e52c1b4bb',
    'request_sha256': '88d7e86323539893e6473889e0d81e533f41f29839a0d59af192d4ea3870cb61',
    'blocked_sha256': '3cf7f9dbeb1c761b2400f7a88ac87a48815645cd0ee8f0b8d2931d280e313b98',
    'current_manifest_sha256': '9d2cedc4f6c0853542b7ed49553bea048a8003320dd36633d57d1fecf8a4567d',
    'package_tree_sha256': 'e6edfae54f095d111a42cac9c0bac22a599cf7e1c1a0fb44f5ee50cd9d21a3d4',
    'ledger_sha256': 'a387f48e7379eca355dc0cb99a131c5f51e7076dffd9ab893d99640e65f83417',
}
QUIESCENCE_WRITERS = ('nodia-api.service', 'nodia-ai-worker.service')
QUIESCENCE_TIMERS = ('nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer')
QUIESCENCE_FRESH_SECONDS = 120
BACKUP_REQUEST_ACKNOWLEDGMENT = 'backup_request_reconciled_before_migration'
BACKUP_REQUEST_OPERATION = '1d6e3f19410a3cec6d2b97c958c44471'
BACKUP_REQUEST_CANDIDATE = 'backend-8017dbc63189-6422a361f0c7'
BACKUP_REQUEST_PINS = {
    'state_sha256': 'f025691958f67b9b34cde6e2146687626482ec3b822ffbb248253fcc042c65d3',
    'request_sha256': 'f993a57fa97c50b14fccac4156f8a189bdbfd368eed5ddb62537ff919e45814f',
    'blocked_sha256': '08d5b8f02a1d0852976871c238d75dbd8e32b89e629ef4efaa16ce8f2361d1cb',
    'current_manifest_sha256': 'cf8140420f9624526ec81248b8dd6c0daf472215c28d10c61b4359df0294e0b7',
    'ledger_sha256': '634d9db2209e4af8d3ac0df1335510d79b471b8390373654533d9edfd3c98718',
}
BACKUP_REQUEST_CANDIDATE_MANIFEST_SHA256 = '03d4fe06a5ff9e7c347b41f8ee2b8f8829dac7851ce96db1e8fe3b18d858c6df'
BACKUP_REQUEST_AVAILABILITY_SHA256 = 'd8c3f6fbc60047ec4b470ac8dee0439ce0a81d86066f4ef1dceee28ea19caa07'


def _check_acknowledgment(receipt, status, check, extra_digests=()):
    check(type(receipt) is dict and set(receipt) == RECONCILIATION_FIELDS.union(extra_digests) and
          type(receipt['schema_version']) is int and receipt['schema_version'] == 1 and
          receipt['status'] == status and receipt['new_operation_allowed'] is True and
          receipt['original_operation_retry_allowed'] is False)
    for name in (*RECONCILIATION_DIGESTS, *extra_digests):
        check(isinstance(receipt[name], str) and re.fullmatch(r'[a-f0-9]{64}', receipt[name]))
    operation = receipt['operation_id']
    check(isinstance(operation, str) and re.fullmatch(r'[a-f0-9]{32}', operation))
    return operation


def _check_evidence_digest(receipt, evidence, check):
    for name, raw in evidence.items():
        check(receipt[name] == hashlib.sha256(raw).hexdigest())


def validate_pre_migration_reconciliation(receipt, *, state_bytes, request_bytes,
                                          recovery_bytes, manifest_bytes, blocked_bytes=None):
    """A root acknowledgment closes one failed history entry; it never replays it.

    Manifest identity is the recovered original release, not the release active
    after a subsequent successful update. Historical recovery evidence stays bound.
    """
    if type(receipt) is dict and receipt.get('status') == BACKUP_REQUEST_ACKNOWLEDGMENT:
        return _validate_backup_request_reconciliation(
            receipt, state_bytes, request_bytes, recovery_bytes, manifest_bytes, blocked_bytes)
    if type(receipt) is dict and receipt.get('status') == QUIESCENCE_ACKNOWLEDGMENT:
        return _validate_quiescence_reconciliation(
            receipt, state_bytes, request_bytes, recovery_bytes, manifest_bytes, blocked_bytes)
    code = 'pre_migration_reconciliation_invalid'
    def check(condition): require(condition, code)
    try:
        operation = _check_acknowledgment(receipt, 'same_release_restored_before_migration', check)
        state = _evidence_json(state_bytes, check)
        request = validate_request(_evidence_json(request_bytes, check))
        recovery = _evidence_json(recovery_bytes, check)
        manifest = _evidence_json(manifest_bytes, check, 32 * 1024 ** 2)
        check(state.get('schema_version') == 1 and type(state.get('schema_version')) is int and
              state.get('operation_id') == request['operation_id'] == operation and state.get('phase') == 'failed' and
              state.get('failed_phase') == 'stopping_writers' and state.get('error_code') == 'writer_shutdown_not_clean' and
              state.get('effects_started') is True and state.get('migration_requested') is False and
              state.get('automatic_retry_allowed') is False and
              state.get('previous_release') == request['expected_current_release'])
        _check_evidence_digest(receipt, {'state_sha256': state_bytes, 'request_sha256': request_bytes,
            'recovery_receipt_sha256': recovery_bytes, 'current_manifest_sha256': manifest_bytes,
            'blocked_sha256': blocked_record_bytes(state)}, check)
        if blocked_bytes is not None:
            check(type(blocked_bytes) is bytes and blocked_bytes == blocked_record_bytes(state))
        recovery_fields = {'schema_version', 'status', 'operation_id', 'resolution', 'started_at', 'state_sha256',
                           'blocked_sha256', 'release_id', 'package_tree_sha256', 'ledger_sha256',
                           'migrations_requested', 'deployment_performed', 'cd_unblocked', 'diagnostic_directory',
                           'completed_at', 'cors_verified', 'timers_restored', 'maintenance_removed',
                           'failed_attempt_unchanged'}
        check(type(recovery) is dict and set(recovery) == recovery_fields and
              type(recovery['schema_version']) is int and recovery['schema_version'] == 1 and
              recovery['status'] == 'complete' and recovery['operation_id'] == operation and
              recovery['resolution'] == receipt['status'] and
              recovery['migrations_requested'] is False and recovery['deployment_performed'] is False and
              recovery['cd_unblocked'] is False and all(recovery[name] is True for name in
                  ('cors_verified', 'timers_restored', 'maintenance_removed', 'failed_attempt_unchanged')))
        check(isinstance(recovery['diagnostic_directory'], str) and re.fullmatch(
            r'/var/lib/nodia-updates/diagnostics/current-restore-preflight-[a-f0-9]{32}', recovery['diagnostic_directory']))
        for name in ('state_sha256', 'blocked_sha256', 'ledger_sha256', 'package_tree_sha256'):
            check(recovery[name] == receipt[name])
        check(receipt['current_release_id'] == recovery['release_id'] == request['expected_current_release'] and
              receipt['package_tree_sha256'] == request['expected_current_tree_sha256'] and
              manifest.get('release_id') == receipt['current_release_id'] and type(manifest.get('schema_version')) is int and
              manifest['schema_version'] == 1 and
              manifest.get('package_tree_sha256') == receipt['package_tree_sha256'])
        files = manifest.get('files')
        check(isinstance(files, list) and all(isinstance(item, dict) for item in files))
        migrations = [item['path'] for item in files if isinstance(item.get('path'), str) and
                      re.fullmatch(r'dist/migrations/[0-9]{13}-[A-Za-z][A-Za-z0-9_]*\.js', item['path']) and
                      item.get('type') == 'file']
        check(type(receipt['migration_count']) is int and receipt['migration_count'] >= 2 and
              len(migrations) == len(set(migrations)) == receipt['migration_count'])
        check(_evidence_date(recovery['started_at'], check) <= _evidence_date(recovery['completed_at'], check)
              <= _evidence_date(receipt['acknowledged_at_utc'], check))
        return receipt
    except (KeyError, TypeError, ValueError, AttributeError):
        raise Rejected(code) from None


POST_MIGRATION_EVIDENCE = {
    'recovery_bytes': ('post-migration-recovery-receipt.json', 'recovery_receipt_sha256'),
    'recovery_intent_bytes': ('post-migration-recovery-intent.json', 'recovery_intent_sha256'),
    'migration_failure_bytes': ('post-migration-failure.json', 'migration_failure_sha256'),
    'preactivation_bytes': ('post-migration-preactivation.json', 'preactivation_sha256'),
    'verification_bytes': ('post-migration-verification.json', 'verification_sha256'),
}
RUNTIME_COUNTERS = frozenset({'jobs', 'runs', 'executions', 'steps', 'slots', 'api_dispatches',
                              'teacher_jobs', 'teacher_attempts', 'generation_operations'})
LEDGER_VERIFICATION_FIELDS = frozenset({'schema_version', 'status', 'mode', 'before', 'target', 'pending',
                                        'incremental_migrations', 'ledger_sha256', 'quiescent', 'counts',
                                        'read_only', 'client_tls_authorized', 'migrations_executed'})


def _compiled_ledger(manifest, check):
    check(type(manifest['files']) is list and all(type(file) is dict for file in manifest['files']))
    ledger = []
    for file in manifest['files']:
        path = file['path']
        check(type(path) is str)
        if not re.fullmatch(r'dist/migrations/[^/]+\.js', path):
            continue
        match = re.fullmatch(r'dist/migrations/([0-9]{13})-([A-Za-z][A-Za-z0-9_]*)\.js', path)
        check(match and file['type'] == 'file' and re.fullmatch(r'[a-f0-9]{64}', file['sha256']))
        timestamp, name = match.groups()
        ledger.append({'timestamp': timestamp, 'name': name + timestamp})
    ledger.sort(key=lambda row: row['timestamp'])
    check(len(ledger) == len({row['timestamp'] for row in ledger}))
    # Key order and separators match JSON.stringify in the Node verification action.
    digest = hashlib.sha256(json.dumps(ledger, separators=(',', ':')).encode()).hexdigest()
    return len(ledger), digest


def _check_backup_request_r2(result, operation, acknowledged_at, check):
    check(type(result) is dict and set(result) == {
        'schema_version', 'status', 'operation_id', 'observed_at_utc', 'catalog_sha256',
        'catalog_revision', 'catalog_last_sequence', 'catalog_open', 'unconfirmed_deletions',
        'incident_outcome', 'verified_backup',
    } and type(result['schema_version']) is int and result['schema_version'] == 1 and
          result['status'] == 'verified_read_only' and result['operation_id'] == operation and
          result['catalog_open'] is True and result['incident_outcome'] == 'unknown' and
          type(result['unconfirmed_deletions']) is int and result['unconfirmed_deletions'] == 0 and
          re.fullmatch(r'[a-f0-9]{64}', result['catalog_sha256']) and
          all(type(result[field]) is int and result[field] >= 0
              for field in ('catalog_revision', 'catalog_last_sequence')))
    observed = _evidence_date(result['observed_at_utc'], check)
    check(_evidence_date('2026-11-18T16:22:10Z', check) <= observed <= acknowledged_at)
    backup = result['verified_backup']
    check(type(backup) is dict and set(backup) == {
        'backup_id', 'captured_at', 'expires_at', 'cipher_bytes', 'cipher_sha256', 'journal_sequence',
    } and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', backup['backup_id']) and
          re.fullmatch(r'[a-f0-9]{64}', backup['cipher_sha256']) and
          type(backup['cipher_bytes']) is int and backup['cipher_bytes'] > 0 and
          type(backup['journal_sequence']) is int and 0 <= backup['journal_sequence'] <= result['catalog_last_sequence'])
    captured = _evidence_date(backup['captured_at'], check)
    expires = _evidence_date(backup['expires_at'], check)
    check(captured <= observed and acknowledged_at < expires and expires - captured == datetime.timedelta(days=7))


def _validate_backup_request_reconciliation(receipt, state_bytes, request_bytes, recovery_bytes, manifest_bytes, blocked_bytes):
    """Close this admission block, preserving the original external write as unknown."""
    code = 'backup_request_reconciliation_invalid'

    def check(condition):
        require(condition, code)

    try:
        operation = _check_acknowledgment(receipt, BACKUP_REQUEST_ACKNOWLEDGMENT, check)
        check(operation == BACKUP_REQUEST_OPERATION and all(receipt[name] == digest for name, digest in BACKUP_REQUEST_PINS.items()))
        state = _evidence_json(state_bytes, check)
        request = validate_request(_evidence_json(request_bytes, check))
        check(type(state['schema_version']) is int and state['schema_version'] == 1 and
              state['operation_id'] == request['operation_id'] == operation and state['phase'] == 'failed' and
              state['failed_phase'] == 'backup_requested' and
              state['error_code'] == 'host_command_failed_inspect_private_diagnostics' and
              state['effects_started'] is True and state['migration_requested'] is False and
              state['automatic_retry_allowed'] is False and 'backup' not in state and 'migration_result' not in state and
              state['previous_release'] == request['expected_current_release'] == receipt['current_release_id'] and
              state['candidate_release'] == BACKUP_REQUEST_CANDIDATE)
        expected_block = blocked_record_bytes(state)
        _check_evidence_digest(receipt, {
            'state_sha256': state_bytes, 'request_sha256': request_bytes, 'blocked_sha256': expected_block,
            'current_manifest_sha256': manifest_bytes, 'recovery_receipt_sha256': recovery_bytes,
        }, check)
        check(blocked_bytes is None or (type(blocked_bytes) is bytes and blocked_bytes == expected_block))
        manifest = _evidence_json(manifest_bytes, check, 32 * 1024 ** 2)
        check(type(manifest['schema_version']) is int and manifest['schema_version'] == 1 and
              manifest['release_id'] == receipt['current_release_id'] and
              manifest['package_tree_sha256'] == receipt['package_tree_sha256'] == request['expected_current_tree_sha256'] and
              type(receipt['migration_count']) is int and receipt['migration_count'] == 56 and
              _compiled_ledger(manifest, check) == (56, receipt['ledger_sha256']))
        evidence = _evidence_json(recovery_bytes, check)
        check(type(evidence) is dict and set(evidence) == {
            'schema_version', 'status', 'operation_id', 'availability_receipt', 'availability_receipt_sha256',
            'candidate_manifest_sha256', 'ledger_inspection', 'r2_observation',
        } and type(evidence['schema_version']) is int and evidence['schema_version'] == 1 and
              evidence['status'] == 'backup_request_reconciliation_evidence' and evidence['operation_id'] == operation and
              evidence['availability_receipt_sha256'] == BACKUP_REQUEST_AVAILABILITY_SHA256 and
              evidence['candidate_manifest_sha256'] == BACKUP_REQUEST_CANDIDATE_MANIFEST_SHA256)
        availability = evidence['availability_receipt']
        expected_availability = {
            'schema_version': 1, 'operation_id': operation, 'current_release': receipt['current_release_id'],
            'ledger_before': 56, 'migration_executed': False, 'failed_state_sha256': receipt['state_sha256'],
            'blocked_sha256': receipt['blocked_sha256'], 'request_sha256': receipt['request_sha256'],
            'backup_error_codes': ['nodia_ai:recovery_write_unknown'], 'status': 'api_restored_previous_release',
            'public_http': 200, 'cors_verified': True, 'timers_restored': True, 'cd_still_blocked': True,
        }
        check(json.dumps(availability, sort_keys=True) == json.dumps(expected_availability, sort_keys=True) and
              hashlib.sha256((json.dumps(expected_availability) + '\n').encode()).hexdigest() == BACKUP_REQUEST_AVAILABILITY_SHA256)
        result = evidence['ledger_inspection']
        check(type(result) is dict and set(result) == LEDGER_VERIFICATION_FIELDS and
              all(type(result[field]) is int for field in ('schema_version', 'before', 'target', 'pending', 'incremental_migrations')) and
              (result['schema_version'], result['before'], result['target'], result['pending'], result['incremental_migrations']) == (1, 56, 57, 1, 1) and
              result['status'] == 'verified' and result['mode'] == 'inspect' and result['ledger_sha256'] == receipt['ledger_sha256'] and
              result['quiescent'] is True and result['read_only'] is True and result['client_tls_authorized'] is True and
              result['migrations_executed'] is False and type(result['counts']) is dict and set(result['counts']) == RUNTIME_COUNTERS and
              all(type(value) is int and value == 0 for value in result['counts'].values()))
        _check_backup_request_r2(evidence['r2_observation'], operation, _evidence_date(receipt['acknowledged_at_utc'], check), check)
        return receipt
    except (KeyError, TypeError, ValueError, AttributeError, RecursionError):
        raise Rejected(code) from None


def _check_quiescence_inspection(result, receipt, check, *, fresh):
    fields = LEDGER_VERIFICATION_FIELDS if fresh else LEDGER_VERIFICATION_FIELDS - {
        'schema_version', 'status', 'mode', 'incremental_migrations',
    }
    check(type(result) is dict and set(result) == fields and
          result['read_only'] is True and result['client_tls_authorized'] is True and
          result['migrations_executed'] is False and result['ledger_sha256'] == receipt['ledger_sha256'] and
          all(type(result[name]) is int for name in ('before', 'target', 'pending')) and
          result['before'] == result['target'] == receipt['migration_count'] and result['pending'] == 0)
    counts = result['counts']
    check(type(counts) is dict and set(counts) == RUNTIME_COUNTERS and
          all(type(value) is int and value >= 0 for value in counts.values()) and
          result['quiescent'] is (not any(counts.values())))
    if fresh:
        check(type(result['schema_version']) is int and result['schema_version'] == 1 and
              result['status'] == 'verified' and result['mode'] == 'inspect' and
              type(result['incremental_migrations']) is int and result['incremental_migrations'] == 0 and
              result['quiescent'] is True)


def _check_quiescence_availability(availability, receipt, state, evidence, check):
    stable_fields = ('operation_id', 'release_id', 'candidate_release', 'package_tree_sha256',
                     'current_manifest_sha256', 'writer_identities', 'originals', 'ledger_sha256', 'migration_count')
    true_flags = {'maintenance_removed', 'timers_restored', 'cors_verified', 'originals_preserved'}
    false_flags = {'migrations_requested', 'deployment_performed', 'cd_unblocked',
                   'original_operation_retry_allowed', 'writers_restarted'}
    check(type(availability) is dict and set(availability) == set(stable_fields) | true_flags | false_flags | {
        'schema_version', 'status', 'observed_pin', 'quiescence', 'diagnostic_directory',
        'started_at_utc', 'completed_at_utc',
    } and type(availability['schema_version']) is int and availability['schema_version'] == 1 and
          availability['status'] == 'same_release_availability_restored' and
          all(availability[name] is True for name in true_flags) and
          all(availability[name] is False for name in false_flags))
    digest = hashlib.sha256((json.dumps(availability, sort_keys=True, indent=2) + '\n').encode()).hexdigest()
    check(evidence['availability_receipt_sha256'] == digest == QUIESCENCE_AVAILABILITY_SHA256)
    stable = {name: availability[name] for name in stable_fields}
    pin = hashlib.sha256(json.dumps(stable, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    check(availability['observed_pin'] == pin and
          availability['release_id'] == receipt['current_release_id'] and
          availability['candidate_release'] == state['candidate_release'] and
          all(availability[name] == receipt[name] for name in
              ('operation_id', 'package_tree_sha256', 'current_manifest_sha256', 'ledger_sha256', 'migration_count')) and
          type(availability['migration_count']) is int and re.fullmatch(
              r'/var/lib/nodia-updates/diagnostics/quiescence-availability-[a-f0-9]{32}',
              availability['diagnostic_directory']))
    originals = availability['originals']
    check(type(originals) is dict and set(originals) == {
        'state', 'request', 'attempt_request', 'blocked', 'timers', 'settings', 'receiver_settings', 'deployed',
    } and all(re.fullmatch(r'[a-f0-9]{64}', value) for value in originals.values()) and
          originals['state'] == receipt['state_sha256'] and
          originals['request'] == originals['attempt_request'] == receipt['request_sha256'] and
          originals['blocked'] == receipt['blocked_sha256'])
    timers = {name: {'active': state['timers_before'][name]['active'], 'enabled': state['timers_before'][name]['enabled']}
              for name in QUIESCENCE_TIMERS}
    check(originals['timers'] == hashlib.sha256((json.dumps(timers) + '\n').encode()).hexdigest())
    writers = availability['writer_identities']
    check(type(writers) is dict and set(writers) == set(QUIESCENCE_WRITERS) and
          all(type(value) is dict and set(value) == {'pid', 'invocation'} and
              type(value['pid']) is int and value['pid'] > 1 and re.fullmatch(r'[a-f0-9]{32}', value['invocation'])
              for value in writers.values()) and len({value['pid'] for value in writers.values()}) == len(writers) and
          len({value['invocation'] for value in writers.values()}) == len(writers) and writers == evidence['writer_identities'])
    _check_quiescence_inspection(availability['quiescence'], receipt, check, fresh=False)


def _validate_quiescence_reconciliation(receipt, state_bytes, request_bytes, recovery_bytes, manifest_bytes, blocked_bytes):
    # The reviewed pre-stop failure requires an independent post-recovery SQL observation.
    code = 'quiescence_reconciliation_invalid'

    def check(condition):
        require(condition, code)

    try:
        operation = _check_acknowledgment(receipt, QUIESCENCE_ACKNOWLEDGMENT, check)
        check(operation == QUIESCENCE_OPERATION and all(receipt[name] == digest for name, digest in QUIESCENCE_PINS.items()))
        state = _evidence_json(state_bytes, check)
        request = validate_request(_evidence_json(request_bytes, check))
        manifest = _evidence_json(manifest_bytes, check, 32 * 1024 ** 2)
        check(type(state) is dict and set(state) == {
            'schema_version', 'operation_id', 'phase', 'failed_phase', 'error_code', 'effects_started',
            'migration_requested', 'automatic_retry_allowed', 'previous_release', 'candidate_release',
            'timers_before', 'backup',
        } and type(state['schema_version']) is int and state['schema_version'] == 1 and
              state['operation_id'] == request['operation_id'] == operation and state['phase'] == 'failed' and
              state['failed_phase'] == 'waiting_for_quiescence' and
              state['error_code'] == 'live_or_unconfirmed_runtime_work' and
              state['effects_started'] is True and state['migration_requested'] is False and
              state['automatic_retry_allowed'] is False and request['source_sha'] == QUIESCENCE_REQUEST_SOURCE and
              state['previous_release'] == request['expected_current_release'] == QUIESCENCE_CURRENT_RELEASE and
              state['candidate_release'] == QUIESCENCE_CANDIDATE and
              re.fullmatch('backend-' + request['source_sha'][:12] + r'-[a-f0-9]{12}', state['candidate_release']) and
              state['candidate_release'] != state['previous_release'])
        backup = state['backup']
        check(type(backup) is dict and set(backup) == {'backup_id', 'cipher_sha256', 'captured_at', 'journal_sequence'} and
              re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', backup['backup_id']) and
              re.fullmatch(r'[a-f0-9]{64}', backup['cipher_sha256']) and
              type(backup['journal_sequence']) is int and backup['journal_sequence'] >= 0)
        timers = state['timers_before']
        check(type(timers) is dict and set(timers) == set(QUIESCENCE_TIMERS) and all(
            type(value) is dict and set(value) == {'active', 'enabled'} and type(value['active']) is bool and
            isinstance(value['enabled'], str) and re.fullmatch(r'[a-z-]{1,32}', value['enabled'])
            for value in timers.values()))

        expected_block = blocked_record_bytes(state)
        _check_evidence_digest(receipt, {
            'state_sha256': state_bytes, 'request_sha256': request_bytes, 'blocked_sha256': expected_block,
            'current_manifest_sha256': manifest_bytes, 'recovery_receipt_sha256': recovery_bytes,
        }, check)
        check(blocked_bytes is None or (type(blocked_bytes) is bytes and blocked_bytes == expected_block))
        check(type(manifest['schema_version']) is int and manifest['schema_version'] == 1 and
              manifest['release_id'] == receipt['current_release_id'] == state['previous_release'] and
              manifest['source_sha'] == QUIESCENCE_CURRENT_SOURCE and
              manifest['package_tree_sha256'] == receipt['package_tree_sha256'] == request['expected_current_tree_sha256'] and
              manifest['release_id'] == 'backend-' + manifest['source_sha'][:12] + '-' + manifest['package_tree_sha256'][:12] and
              type(receipt['migration_count']) is int and receipt['migration_count'] == QUIESCENCE_MIGRATION_COUNT and
              _compiled_ledger(manifest, check) == (receipt['migration_count'], receipt['ledger_sha256']))

        evidence = _evidence_json(recovery_bytes, check)
        check(type(evidence) is dict and set(evidence) == {
            'schema_version', 'status', 'operation_id', 'availability_receipt', 'availability_receipt_sha256',
            'ledger_inspection', 'ledger_observed_at_utc', 'writer_identities',
        } and type(evidence['schema_version']) is int and evidence['schema_version'] == 1 and
              evidence['operation_id'] == operation and evidence['status'] == 'quiescence_reconciliation_evidence')
        availability = evidence['availability_receipt']
        _check_quiescence_availability(availability, receipt, state, evidence, check)
        _check_quiescence_inspection(evidence['ledger_inspection'], receipt, check, fresh=True)
        observed_at = _evidence_date(evidence['ledger_observed_at_utc'], check)
        acknowledged_at = _evidence_date(receipt['acknowledged_at_utc'], check)
        check(_evidence_date(backup['captured_at'], check) <= _evidence_date(availability['started_at_utc'], check) <=
              _evidence_date(availability['completed_at_utc'], check) <= observed_at <= acknowledged_at and
              acknowledged_at - observed_at <= datetime.timedelta(seconds=QUIESCENCE_FRESH_SECONDS))
        return receipt
    except (KeyError, TypeError, ValueError, AttributeError, RecursionError, OverflowError):
        raise Rejected(code) from None


def _check_ledger_verification(result, receipt, check, *, preactivation=False):
    extra = {'entity_columns_present', 'entity_tables_checked'} if preactivation else set()
    check(type(result) is dict and set(result) == LEDGER_VERIFICATION_FIELDS | extra and
          type(result['schema_version']) is int and result['schema_version'] == 1 and
          result['status'] == 'verified' and result['mode'] == 'verify' and
          result['read_only'] is True and result['client_tls_authorized'] is True and
          result['migrations_executed'] is False and result['ledger_sha256'] == receipt['ledger_sha256'])
    check(all(type(result[name]) is int for name in ('before', 'target', 'pending', 'incremental_migrations')) and
          result['target'] == receipt['migration_count'] and 2 <= result['before'] < result['target'] and
          result['pending'] == 0 and result['incremental_migrations'] == result['target'] - result['before'])
    counts = result['counts']
    check(type(counts) is dict and set(counts) == RUNTIME_COUNTERS and
          all(type(count) is int and count >= 0 for count in counts.values()) and
          result['quiescent'] is (not any(counts.values())))
    if preactivation:
        check(result['quiescent'] is True and result['entity_columns_present'] is True and
              type(result['entity_tables_checked']) is int and result['entity_tables_checked'] > 0)


def validate_post_migration_reconciliation(receipt, *, state_bytes, request_bytes, recovery_bytes,
                                           manifest_bytes, recovery_intent_bytes, migration_failure_bytes,
                                           preactivation_bytes, verification_bytes, blocked_bytes=None):
    """Reconcile a verified candidate after the original commit and schema-verifier failure."""
    code = 'post_migration_reconciliation_invalid'

    def check(condition):
        require(condition, code)

    try:
        operation = _check_acknowledgment(receipt, 'candidate_restored_after_migration', check, (
            'recovery_intent_sha256', 'migration_failure_sha256', 'preactivation_sha256', 'verification_sha256'))
        state = _evidence_json(state_bytes, check)
        request = validate_request(_evidence_json(request_bytes, check))
        manifest = _evidence_json(manifest_bytes, check, 32 * 1024 ** 2)
        failure = _evidence_json(migration_failure_bytes, check)
        intent = _evidence_json(recovery_intent_bytes, check)
        recovery = _evidence_json(recovery_bytes, check)
        preactivation = _evidence_json(preactivation_bytes, check)
        verification = _evidence_json(verification_bytes, check)
        check(type(state['schema_version']) is int and state['schema_version'] == 1 and
              state['operation_id'] == request['operation_id'] == operation and state['phase'] == 'failed' and
              state['failed_phase'] == 'migration_requested' and
              state['error_code'] == 'host_command_failed_inspect_private_diagnostics' and
              state['effects_started'] is True and state['migration_requested'] is True and
              state['automatic_retry_allowed'] is False and 'migration_result' not in state and
              state['previous_release'] == request['expected_current_release'])
        expected_block = blocked_record_bytes(state)
        _check_evidence_digest(receipt, {
            'state_sha256': state_bytes, 'request_sha256': request_bytes, 'blocked_sha256': expected_block,
            'current_manifest_sha256': manifest_bytes, 'recovery_receipt_sha256': recovery_bytes,
            'recovery_intent_sha256': recovery_intent_bytes, 'migration_failure_sha256': migration_failure_bytes,
            'preactivation_sha256': preactivation_bytes, 'verification_sha256': verification_bytes,
        }, check)
        check(blocked_bytes is None or (type(blocked_bytes) is bytes and blocked_bytes == expected_block))
        check(failure == {'schema_version': 1, 'status': 'failed', 'error_code': 'entity_table_or_column_missing',
                          'automatic_retry_allowed': False} and type(failure['schema_version']) is int and
              failure['automatic_retry_allowed'] is False)
        release = receipt['current_release_id']
        tree = receipt['package_tree_sha256']
        ledger = receipt['ledger_sha256']
        source = request['source_sha']
        check(release == f'backend-{source[:12]}-{tree[:12]}' and
              release == state['candidate_release'] != state['previous_release'] and
              release == manifest['release_id'] and tree == manifest['package_tree_sha256'] and
              manifest['source_sha'] == source and type(manifest['schema_version']) is int and
              manifest['schema_version'] == 1)
        check(type(receipt['migration_count']) is int and
              _compiled_ledger(manifest, check) == (receipt['migration_count'], ledger))
        check(type(intent) is dict and intent == {
            'schema_version': 1, 'status': 'intent_recorded', 'operation_id': operation,
            'original_state_sha256': receipt['state_sha256'], 'request_sha256': receipt['request_sha256'],
            'blocked_sha256': receipt['blocked_sha256'], 'release_id': release,
            'manifest_sha256': receipt['current_manifest_sha256'], 'ledger_sha256': ledger,
            'started_at': intent.get('started_at'), 'migrations_requested': False,
        } and type(intent['schema_version']) is int and intent['migrations_requested'] is False)
        check(type(recovery) is dict and recovery == {
            'schema_version': 1, 'status': 'service_restored', 'operation_id': operation, 'release_id': release,
            'ledger_sha256': ledger, 'migration_count': receipt['migration_count'], 'migrations_executed': False,
            'failed_attempt_preserved': True, 'backend_public_http': 200, 'cors_verified': True,
            'timers_restored': True, 'cd_blocked': True, 'completed_at': recovery.get('completed_at'),
        } and all(type(recovery[name]) is int for name in ('schema_version', 'migration_count', 'backend_public_http')) and
              recovery['migrations_executed'] is False and all(recovery[name] is True for name in
                  ('failed_attempt_preserved', 'cors_verified', 'timers_restored', 'cd_blocked')))
        check(_evidence_date(intent['started_at'], check) <= _evidence_date(recovery['completed_at'], check)
              <= _evidence_date(receipt['acknowledged_at_utc'], check))
        _check_ledger_verification(preactivation, receipt, check, preactivation=True)
        _check_ledger_verification(verification, receipt, check)
        check(preactivation['before'] == verification['before'])
        return receipt
    except (KeyError, TypeError, ValueError, AttributeError, RecursionError):
        raise Rejected(code) from None


def validate_backup_result(value, *, started_at, now):
    require(isinstance(value, dict) and value.get('schema_version') == 1 and value.get('operation') == 'backup' and
            value.get('status') == 'ready' and isinstance(value.get('backup_id'), str) and
            re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', value['backup_id']) and
            type(value.get('cipher_bytes')) is int and value['cipher_bytes'] > 0 and
            isinstance(value.get('cipher_sha256'), str) and re.fullmatch(r'[a-f0-9]{64}', value['cipher_sha256']) and
            isinstance(value.get('encryption_key_id'), str) and re.fullmatch(r'[a-f0-9]{64}', value['encryption_key_id']) and
            type(value.get('journal_sequence')) is int and value['journal_sequence'] >= 0,
            'backup_ready_receipt_invalid')
    try:
        captured = datetime.datetime.fromisoformat(value['captured_at'].replace('Z', '+00:00'))
        expires = datetime.datetime.fromisoformat(value['expires_at'].replace('Z', '+00:00'))
        require(captured.tzinfo is not None and expires.tzinfo is not None and
                started_at <= captured <= now and expires > now, 'backup_ready_time_invalid')
    except (KeyError, TypeError, ValueError) as error:
        raise Rejected('backup_ready_time_invalid') from error
    return {name: value[name] for name in ('backup_id', 'cipher_sha256', 'captured_at', 'journal_sequence')}


def fresh_backup_message(entries, previous_invocation=None):
    """Caller supplies only entries after the cursor captured before starting the unit."""
    import json
    matches = []
    for entry in entries:
        try: message = json.loads(entry.get('MESSAGE', ''))
        except (TypeError, ValueError): continue
        if isinstance(message, dict) and message.get('operation') == 'backup':
            invocation = entry.get('_SYSTEMD_INVOCATION_ID', '')
            require(isinstance(invocation, str) and re.fullmatch(r'[a-f0-9]{32}', invocation) and
                    invocation != previous_invocation, 'fresh_backup_invocation_required')
            matches.append(message)
    require(len(matches) == 1, 'unique_backup_ready_receipt_required')
    return matches[0]


def run_update(request, ports, *, apply=False):
    """Write intent before each effect. A failed/unknown effect is never replayed here."""
    validate_request(request)
    state = {'schema_version': 1, 'operation_id': request['operation_id'], 'phase': 'preparing',
             'effects_started': False, 'migration_requested': False, 'automatic_retry_allowed': False}
    ports.begin(request, state)  # Reject existing attempts and unresolved prior effects.

    def phase(name):
        state['phase'] = name
        ports.record(state)

    try:
        prepared = ports.prepare(request)
        state['candidate_release'] = prepared['candidate_release']
        state['previous_release'] = request['expected_current_release']
        phase('preflight_verified')
        if not apply:
            phase('planned')
            return {**state, 'deployment_performed': False}
        state['effects_started'] = True
        phase('pausing_timers')
        timer_state = ports.pause_timers()
        state['timers_before'] = timer_state
        phase('enabling_maintenance')
        ports.maintenance(True)
        phase('backup_requested')
        state['backup'] = ports.backup()
        phase('waiting_for_quiescence')
        ports.require_quiescent(stopped=False)
        phase('stopping_writers')
        ports.stop_writers()
        phase('writers_stopped')
        ports.require_quiescent(stopped=True)
        ports.probe_candidate()
        state['migration_requested'] = True
        phase('migration_requested')
        state['migration_result'] = ports.migrate_once()
        phase('migration_verified')
        ports.switch_release()
        phase('release_switched')
        ports.start_and_verify()
        phase('writers_verified')
        ports.maintenance(False)
        ports.public_smoke()
        ports.restore_timers(timer_state)
        ports.finish(request, prepared, state)
        phase('complete')
        return {**state, 'deployment_performed': True}
    except Exception as error:
        state['failed_phase'] = state['phase']
        state['phase'] = 'failed'
        state['error_code'] = str(error) if isinstance(error, Rejected) else 'update_failed_inspect_private_diagnostics'
        backup_failed = state['failed_phase'] == 'backup_requested' and state['migration_requested'] is False
        if backup_failed:
            # Admission remains blocked independently of the HTTP maintenance flag.
            state['availability_recovery'] = 'pending'
            ports.record(state)
            ports.block(state)
            try:
                state['backup_timers_recovery'] = ports.recover_backup_failure(state['timers_before'])
            except Exception as recovery_error:
                state['availability_recovery'] = 'failed'
                code = str(recovery_error) if isinstance(recovery_error, Rejected) else ''
                state['availability_recovery_error_code'] = (
                    code if re.fullmatch(r'[a-z0-9_]{1,100}', code) else 'availability_recovery_failed')
            else:
                state['availability_recovery'] = 'restored'
        if state['effects_started']:
            # Technical admission fencing only: never rollback code/data or restart/retry a writer.
            if state.get('availability_recovery') != 'restored':
                try:
                    ports.maintenance(True)
                except Exception:
                    state['maintenance_reassertion_failed'] = True
            if not backup_failed:
                ports.block(state)
        ports.record(state)
        raise Rejected(state['error_code']) from error
