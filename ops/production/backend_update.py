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


def validate_pre_migration_reconciliation(receipt, *, state_bytes, request_bytes,
                                          recovery_bytes, manifest_bytes, blocked_bytes=None):
    """A root acknowledgment closes one failed history entry; it never replays it.

    Manifest identity is the recovered original release, not the release active
    after a subsequent successful update. Historical recovery evidence stays bound.
    """
    code = 'pre_migration_reconciliation_invalid'
    def check(condition): require(condition, code)
    def digest(raw): return hashlib.sha256(raw).hexdigest()
    def parse(raw, maximum=16384):
        check(type(raw) is bytes and 0 < len(raw) <= maximum)
        def pairs(items):
            result = {}
            for key, value in items:
                check(key not in result); result[key] = value
            return result
        return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs,
                          parse_constant=lambda _: check(False))
    def date(value):
        check(isinstance(value, str) and len(value) <= 64)
        result = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
        check(result.tzinfo is not None and result.utcoffset() == datetime.timedelta(0))
        return result
    try:
        fields = {'schema_version', 'status', 'operation_id', 'state_sha256', 'request_sha256',
                  'blocked_sha256', 'recovery_receipt_sha256', 'current_release_id',
                  'current_manifest_sha256', 'package_tree_sha256', 'ledger_sha256',
                  'migration_count', 'acknowledged_at_utc', 'new_operation_allowed',
                  'original_operation_retry_allowed'}
        check(type(receipt) is dict and set(receipt) == fields and type(receipt['schema_version']) is int and
              receipt['schema_version'] == 1 and receipt['status'] == 'same_release_restored_before_migration' and
              receipt['new_operation_allowed'] is True and receipt['original_operation_retry_allowed'] is False)
        for name in ('state_sha256', 'request_sha256', 'blocked_sha256', 'recovery_receipt_sha256',
                     'current_manifest_sha256', 'package_tree_sha256', 'ledger_sha256'):
            check(isinstance(receipt[name], str) and re.fullmatch(r'[a-f0-9]{64}', receipt[name]))
        operation = receipt['operation_id']
        check(isinstance(operation, str) and re.fullmatch(r'[a-f0-9]{32}', operation))
        state, request = parse(state_bytes), validate_request(parse(request_bytes))
        recovery, manifest = parse(recovery_bytes), parse(manifest_bytes, 32 * 1024 ** 2)
        check(state.get('schema_version') == 1 and type(state.get('schema_version')) is int and
              state.get('operation_id') == request['operation_id'] == operation and state.get('phase') == 'failed' and
              state.get('failed_phase') == 'stopping_writers' and state.get('error_code') == 'writer_shutdown_not_clean' and
              state.get('effects_started') is True and state.get('migration_requested') is False and
              state.get('automatic_retry_allowed') is False and
              state.get('previous_release') == request['expected_current_release'])
        check(receipt['state_sha256'] == digest(state_bytes) and receipt['request_sha256'] == digest(request_bytes) and
              receipt['recovery_receipt_sha256'] == digest(recovery_bytes) and
              receipt['current_manifest_sha256'] == digest(manifest_bytes) and
              receipt['blocked_sha256'] == digest(blocked_record_bytes(state)))
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
        check(date(recovery['started_at']) <= date(recovery['completed_at']) <= date(receipt['acknowledged_at_utc']))
        return receipt
    except (KeyError, TypeError, ValueError, AttributeError):
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
        if state['effects_started']:
            # Technical admission fencing only: never rollback code/data or restart/retry a writer.
            try:
                ports.maintenance(True)
            except Exception:
                state['maintenance_reassertion_failed'] = True
            ports.block(state)
        ports.record(state)
        raise Rejected(state['error_code']) from error
