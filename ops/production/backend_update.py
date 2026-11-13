"""Pure update policy and ordered effects. Host/systemd adapters live separately."""
import datetime
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
