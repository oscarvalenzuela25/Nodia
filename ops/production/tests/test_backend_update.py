"""Policy tests: synthetic ports only; no VPS, DB, systemd or credentials."""
import datetime
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[1] / 'backend_update.py'
spec = importlib.util.spec_from_file_location('backend_update', source)
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def request():
    return {'schema_version': 1, 'operation_id': 'a' * 32, 'artifact_directory': 'server-123-1',
            'artifact_id': '456', 'artifact_zip_sha256': 'b' * 64, 'source_sha': 'c' * 40,
            'expected_current_release': 'backend-' + 'd' * 12 + '-' + 'e' * 12,
            'expected_current_tree_sha256': 'e' * 64}


def reconciliation_fixture(*, state_change=None, request_change=None, recovery_change=None, manifest_change=None):
    """Synthetic immutable recovery evidence, never a production receipt."""
    encode = lambda value: (json.dumps(value, sort_keys=True) + '\n').encode()
    digest = lambda value: hashlib.sha256(value).hexdigest()
    req = {**request(), **(request_change or {})}
    state = {'schema_version':1, 'operation_id':req['operation_id'], 'phase':'failed',
             'failed_phase':'stopping_writers', 'error_code':'writer_shutdown_not_clean',
             'effects_started':True, 'migration_requested':False, 'automatic_retry_allowed':False,
             'previous_release':req['expected_current_release'], **(state_change or {})}
    state_bytes, request_bytes = encode(state), encode(req)
    block = policy.blocked_record_bytes(state)
    manifest = {'schema_version':1, 'release_id':req['expected_current_release'],
                'package_tree_sha256':req['expected_current_tree_sha256'], 'files':[
                    {'path':'dist/migrations/1790000000000-FixtureOne.js','type':'file'},
                    {'path':'dist/migrations/1790000000001-FixtureTwo.js','type':'file'}], **(manifest_change or {})}
    recovery = {'schema_version':1,'status':'complete','operation_id':req['operation_id'],
        'resolution':'same_release_restored_before_migration','started_at':'2026-11-13T17:50:00+00:00',
        'completed_at':'2026-11-13T17:51:00+00:00','state_sha256':digest(state_bytes),
        'blocked_sha256':digest(block),'release_id':req['expected_current_release'],
        'package_tree_sha256':req['expected_current_tree_sha256'],'ledger_sha256':'f'*64,
        'migrations_requested':False,'deployment_performed':False,'cd_unblocked':False,
        'diagnostic_directory':'/var/lib/nodia-updates/diagnostics/current-restore-preflight-'+'1'*32,
        'cors_verified':True,'timers_restored':True,'maintenance_removed':True,'failed_attempt_unchanged':True,
        **(recovery_change or {})}
    recovery_bytes, manifest_bytes = encode(recovery), encode(manifest)
    receipt = {'schema_version':1,'status':'same_release_restored_before_migration',
        'operation_id':req['operation_id'],'state_sha256':digest(state_bytes),
        'request_sha256':digest(request_bytes),'blocked_sha256':digest(block),
        'recovery_receipt_sha256':digest(recovery_bytes),'current_release_id':req['expected_current_release'],
        'current_manifest_sha256':digest(manifest_bytes),'package_tree_sha256':req['expected_current_tree_sha256'],
        'ledger_sha256':recovery['ledger_sha256'],'migration_count':2,'acknowledged_at_utc':'2026-11-13T17:52:00Z',
        'new_operation_allowed':True,'original_operation_retry_allowed':False}
    return receipt, {'state_bytes':state_bytes,'request_bytes':request_bytes,'recovery_bytes':recovery_bytes,
                     'manifest_bytes':manifest_bytes,'blocked_bytes':block}


def post_migration_fixture(*, changes=None):
    """Produce a self-consistent fingerprint for synthetic post-migration evidence."""
    changes = changes or {}

    def encode(value):
        return (json.dumps(value, sort_keys=True) + '\n').encode()

    def digest(raw):
        return hashlib.sha256(raw).hexdigest()

    req = request()
    operation = req['operation_id']
    tree = 'f' * 64
    release = f"backend-{req['source_sha'][:12]}-{tree[:12]}"
    rows = [{'timestamp': '179000000000' + str(index), 'name': 'Fixture' + '179000000000' + str(index)}
            for index in range(3)]
    ledger = digest(json.dumps(rows, separators=(',', ':')).encode())
    state = {'schema_version': 1, 'operation_id': operation, 'phase': 'failed',
             'failed_phase': 'migration_requested', 'error_code': 'host_command_failed_inspect_private_diagnostics',
             'effects_started': True, 'migration_requested': True, 'automatic_retry_allowed': False,
             'previous_release': req['expected_current_release'], 'candidate_release': release,
             **changes.get('state', {})}
    block = policy.blocked_record_bytes(state)
    state_bytes, request_bytes = encode(state), encode(req)
    manifest = {'schema_version': 1, 'release_id': release, 'source_sha': req['source_sha'],
                'package_tree_sha256': tree, 'files': [
                    {'path': f"dist/migrations/{row['timestamp']}-Fixture.js", 'type': 'file', 'sha256': '0' * 64}
                    for row in reversed(rows)], **changes.get('manifest', {})}
    manifest_bytes = encode(manifest)
    intent = {'schema_version': 1, 'status': 'intent_recorded', 'operation_id': operation, 'release_id': release,
              'original_state_sha256': digest(state_bytes), 'request_sha256': digest(request_bytes),
              'blocked_sha256': digest(block), 'manifest_sha256': digest(manifest_bytes), 'ledger_sha256': ledger,
              'started_at': '2026-11-17T10:15:00Z', 'migrations_requested': False, **changes.get('intent', {})}
    recovery = {'schema_version': 1, 'status': 'service_restored', 'operation_id': operation, 'release_id': release,
                'ledger_sha256': ledger, 'migration_count': len(rows), 'migrations_executed': False,
                'failed_attempt_preserved': True, 'backend_public_http': 200, 'cors_verified': True,
                'timers_restored': True, 'cd_blocked': True, 'completed_at': '2026-11-17T10:16:00Z',
                **changes.get('recovery', {})}
    failure = {'schema_version': 1, 'status': 'failed', 'error_code': 'entity_table_or_column_missing',
               'automatic_retry_allowed': False, **changes.get('failure', {})}
    verified = {'schema_version': 1, 'status': 'verified', 'mode': 'verify', 'before': 2,
                'target': len(rows), 'pending': 0, 'incremental_migrations': 1, 'ledger_sha256': ledger,
                'quiescent': True, 'counts': dict.fromkeys(policy.RUNTIME_COUNTERS, 0),
                'read_only': True, 'client_tls_authorized': True, 'migrations_executed': False}
    preactivation = {**verified, 'entity_columns_present': True, 'entity_tables_checked': 3,
                     **changes.get('preactivation', {})}
    verification = {**verified, **changes.get('verification', {})}
    evidence = {'state_bytes': state_bytes, 'request_bytes': request_bytes, 'manifest_bytes': manifest_bytes,
                'blocked_bytes': block, 'recovery_bytes': encode(recovery), 'recovery_intent_bytes': encode(intent),
                'migration_failure_bytes': encode(failure), 'preactivation_bytes': encode(preactivation),
                'verification_bytes': encode(verification)}
    receipt = {'schema_version': 1, 'status': 'candidate_restored_after_migration', 'operation_id': operation,
               'state_sha256': digest(state_bytes), 'request_sha256': digest(request_bytes),
               'blocked_sha256': digest(block), 'current_release_id': release,
               'current_manifest_sha256': digest(manifest_bytes), 'package_tree_sha256': tree,
               'ledger_sha256': ledger, 'migration_count': len(rows), 'acknowledged_at_utc': '2026-11-17T10:17:00Z',
               'new_operation_allowed': True, 'original_operation_retry_allowed': False}
    receipt.update({field: digest(evidence[name]) for name, (_, field) in policy.POST_MIGRATION_EVIDENCE.items()})
    return receipt, evidence


def backup_request_fixture(*, changes=None, request_change=None):
    """Synthetic evidence and pins for the incident-specific validator."""
    changes = changes or {}
    encode = lambda value: (json.dumps(value) + '\n').encode()
    digest = lambda raw: hashlib.sha256(raw).hexdigest()
    req = {**request(), **(request_change or {})}
    operation = req['operation_id']
    candidate = 'backend-' + 'a' * 12 + '-' + 'b' * 12
    state = {'schema_version': 1, 'operation_id': operation, 'phase': 'failed',
             'failed_phase': 'backup_requested', 'error_code': 'host_command_failed_inspect_private_diagnostics',
             'effects_started': True, 'migration_requested': False, 'automatic_retry_allowed': False,
             'previous_release': req['expected_current_release'], 'candidate_release': candidate,
             **changes.get('state', {})}
    state_bytes, request_bytes = encode(state), encode(req)
    blocked = policy.blocked_record_bytes(state)
    timestamps = [str(1790000000000 + index) for index in range(56)]
    manifest = {'schema_version': 1, 'release_id': req['expected_current_release'],
                'package_tree_sha256': req['expected_current_tree_sha256'], 'files': [
                    {'path': f'dist/migrations/{timestamp}-Fixture.js', 'type': 'file', 'sha256': '0' * 64}
                    for timestamp in timestamps]}
    manifest_bytes = encode(manifest)
    _, ledger = policy._compiled_ledger(manifest, lambda condition: None)
    pins = {'state_sha256': digest(state_bytes), 'request_sha256': digest(request_bytes),
            'blocked_sha256': digest(blocked), 'current_manifest_sha256': digest(manifest_bytes),
            'ledger_sha256': ledger}
    availability = {'schema_version': 1, 'operation_id': operation,
                    'current_release': req['expected_current_release'], 'ledger_before': 56,
                    'migration_executed': False, 'failed_state_sha256': pins['state_sha256'],
                    'blocked_sha256': pins['blocked_sha256'], 'request_sha256': pins['request_sha256'],
                    'backup_error_codes': ['nodia_ai:recovery_write_unknown'], 'status': 'api_restored_previous_release',
                    'public_http': 200, 'cors_verified': True, 'timers_restored': True, 'cd_still_blocked': True}
    availability_digest = digest(encode(availability))
    observation = {'schema_version': 1, 'status': 'verified_read_only', 'operation_id': operation,
                   'observed_at_utc': '2026-11-18T16:30:00.000Z', 'catalog_sha256': '1' * 64,
                   'catalog_revision': 9, 'catalog_last_sequence': 3, 'catalog_open': True,
                   'unconfirmed_deletions': 0, 'incident_outcome': 'unknown',
                   'verified_backup': {'backup_id': '00000000-0000-4000-8000-000000000000',
                       'captured_at': '2026-11-18T03:30:00.000Z', 'expires_at': '2026-11-25T03:30:00.000Z',
                       'cipher_bytes': 123, 'cipher_sha256': '2' * 64, 'journal_sequence': 3,
                       **changes.get('backup', {})}, **changes.get('r2', {})}
    recovery = {'schema_version': 1, 'status': 'backup_request_reconciliation_evidence', 'operation_id': operation,
                'availability_receipt': {**availability, **changes.get('availability', {})},
                'availability_receipt_sha256': availability_digest, 'candidate_manifest_sha256': '3' * 64,
                'ledger_inspection': {'schema_version': 1, 'status': 'verified', 'mode': 'inspect', 'before': 56,
                    'target': 57, 'pending': 1, 'incremental_migrations': 1, 'ledger_sha256': ledger,
                    'quiescent': True, 'counts': dict.fromkeys(policy.RUNTIME_COUNTERS, 0), 'read_only': True,
                    'client_tls_authorized': True, 'migrations_executed': False, **changes.get('ledger', {})},
                'r2_observation': observation, **changes.get('evidence', {})}
    recovery_bytes = encode(recovery)
    receipt = {'schema_version': 1, 'status': policy.BACKUP_REQUEST_ACKNOWLEDGMENT, 'operation_id': operation,
               **pins, 'recovery_receipt_sha256': digest(recovery_bytes), 'migration_count': 56,
               'current_release_id': req['expected_current_release'], 'package_tree_sha256': req['expected_current_tree_sha256'],
               'acknowledged_at_utc': '2026-11-18T16:35:00Z', 'new_operation_allowed': True,
               'original_operation_retry_allowed': False, **changes.get('receipt', {})}
    return (receipt, {'state_bytes': state_bytes, 'request_bytes': request_bytes, 'recovery_bytes': recovery_bytes,
                      'manifest_bytes': manifest_bytes, 'blocked_bytes': blocked},
            {'BACKUP_REQUEST_OPERATION': operation, 'BACKUP_REQUEST_PINS': pins,
             'BACKUP_REQUEST_AVAILABILITY_SHA256': availability_digest, 'BACKUP_REQUEST_CANDIDATE': candidate,
             'BACKUP_REQUEST_CANDIDATE_MANIFEST_SHA256': '3' * 64})


class BackupRequestReconciliationTests(unittest.TestCase):
    def test_original_failure_remains_unknown_and_only_new_operations_are_allowed(self):
        receipt, evidence, pins = backup_request_fixture()
        original = copy.deepcopy((receipt, evidence))
        with patch.multiple(policy, **pins):
            self.assertEqual(policy.validate_pre_migration_reconciliation(receipt, **evidence), receipt)
            self.assertEqual(policy.validate_pre_migration_reconciliation(
                receipt, **{**evidence, 'blocked_bytes': None}), receipt)
        self.assertEqual((receipt, evidence), original)
        with self.assertRaises(policy.Rejected):
            policy.validate_pre_migration_reconciliation(receipt, **evidence)

    def test_policy_rejects_broken_binding_or_wrong_pinned_incident(self):
        receipt, evidence, pins = backup_request_fixture()
        with patch.multiple(policy, **pins):
            for field in evidence:
                with self.subTest(field=field), self.assertRaises(policy.Rejected):
                    policy.validate_pre_migration_reconciliation(receipt, **{**evidence, field: evidence[field] + b' '})
            for field in policy.BACKUP_REQUEST_PINS:
                with self.subTest(pin=field), self.assertRaises(policy.Rejected):
                    policy.validate_pre_migration_reconciliation({**receipt, field: '0' * 64}, **evidence)

    def test_hash_consistent_evidence_cannot_invent_backup_success_or_change_migration_history(self):
        for changes in (
            {'state': {'failed_phase': 'stopping_writers'}}, {'state': {'migration_requested': True}},
            {'state': {'backup': {}}}, {'state': {'candidate_release': 'unrelated'}},
            {'availability': {'cd_still_blocked': False}}, {'availability': {'ledger_before': 56.0}},
            {'evidence': {'candidate_manifest_sha256': '4' * 64}},
            {'ledger': {'pending': 0}}, {'ledger': {'client_tls_authorized': False}},
            {'ledger': {'migrations_executed': True}}, {'ledger': {'quiescent': False}},
            {'r2': {'incident_outcome': 'ready_verified'}}, {'r2': {'unconfirmed_deletions': 1}},
            {'r2': {'observed_at_utc': '2026-11-18T16:21:00Z'}}, {'r2': {'catalog_open': False}},
            {'backup': {'journal_sequence': 4}}, {'backup': {'cipher_sha256': ''}},
            {'backup': {'captured_at': '2026-11-10T03:30:00Z', 'expires_at': '2026-11-17T03:30:00Z'}},
            {'receipt': {'original_operation_retry_allowed': True}},
        ):
            receipt, evidence, pins = backup_request_fixture(changes=changes)
            with self.subTest(changes=changes), patch.multiple(policy, **pins), self.assertRaises(policy.Rejected):
                policy.validate_pre_migration_reconciliation(receipt, **evidence)


class ReconciliationPolicyTests(unittest.TestCase):
    def test_only_exact_bound_recovery_evidence_is_accepted_without_mutation_or_replay(self):
        receipt, evidence = reconciliation_fixture()
        original = copy.deepcopy((receipt, evidence))
        self.assertEqual(policy.validate_pre_migration_reconciliation(receipt, **evidence), receipt)
        self.assertEqual(policy.validate_pre_migration_reconciliation(receipt, **{**evidence, 'blocked_bytes':None}), receipt)
        self.assertEqual((receipt, evidence), original)
        self.assertFalse(receipt['original_operation_retry_allowed'])

    def test_missing_unknown_or_wrong_ack_fields_and_replay_permission_are_rejected(self):
        for change in [{'schema_version':True},{'status':'complete'},{'new_operation_allowed':False},
                       {'original_operation_retry_allowed':True},{'operation_id':'b'*32},{'migration_count':3},
                       {'migration_count':True},{'acknowledged_at_utc':'2026-11-13T17:49:00Z'},{'extra':True}]:
            receipt, evidence = reconciliation_fixture(); receipt.update(change)
            with self.subTest(change=change), self.assertRaises(policy.Rejected):
                policy.validate_pre_migration_reconciliation(receipt, **evidence)
        receipt, evidence = reconciliation_fixture(); del receipt['request_sha256']
        with self.assertRaises(policy.Rejected): policy.validate_pre_migration_reconciliation(receipt, **evidence)

    def test_every_original_file_and_the_original_block_bytes_remain_hash_bound(self):
        for field in ('state_bytes','request_bytes','recovery_bytes','manifest_bytes','blocked_bytes'):
            receipt, evidence = reconciliation_fixture(); evidence[field] += b' '
            with self.subTest(field=field), self.assertRaises(policy.Rejected):
                policy.validate_pre_migration_reconciliation(receipt, **evidence)

    def test_a_hash_consistent_but_unrecovered_unknown_or_migration_started_failure_never_passes(self):
        for change in [{'phase':'unknown'},{'effects_started':False},{'migration_requested':True},
                       {'failed_phase':'migration_requested'},{'failed_phase':'backup_requested'},
                       {'error_code':'different_failure'},{'automatic_retry_allowed':True}]:
            receipt, evidence = reconciliation_fixture(state_change=change)
            with self.subTest(change=change), self.assertRaises(policy.Rejected):
                policy.validate_pre_migration_reconciliation(receipt, **evidence)
        for change in [{'cors_verified':False},{'timers_restored':False},{'maintenance_removed':False},
                       {'failed_attempt_unchanged':False},{'migrations_requested':True},{'cd_unblocked':True},
                       {'status':'failed'},{'deployment_performed':True},{'release_id':'backend-'+'9'*12+'-'+'8'*12}]:
            receipt, evidence = reconciliation_fixture(recovery_change=change)
            with self.subTest(change=change), self.assertRaises(policy.Rejected):
                policy.validate_pre_migration_reconciliation(receipt, **evidence)


class PostMigrationReconciliationTests(unittest.TestCase):
    def test_committed_candidate_with_complete_recovery_and_live_activity_is_accepted(self):
        receipt, evidence = post_migration_fixture(changes={'verification': {
            'counts': {**dict.fromkeys(policy.RUNTIME_COUNTERS, 0), 'jobs': 2}, 'quiescent': False,
        }})
        self.assertEqual(policy.validate_post_migration_reconciliation(receipt, **evidence), receipt)
        self.assertEqual(policy.validate_post_migration_reconciliation(
            receipt, **{**evidence, 'blocked_bytes': None}), receipt)
        self.assertFalse(receipt['original_operation_retry_allowed'])

    def test_any_altered_input_bytes_or_replay_permission_blocks_admission(self):
        receipt, evidence = post_migration_fixture()
        for field in evidence:
            with self.subTest(field=field), self.assertRaises(policy.Rejected):
                policy.validate_post_migration_reconciliation(receipt, **{**evidence, field: evidence[field] + b' '})
        with self.assertRaises(policy.Rejected):
            policy.validate_post_migration_reconciliation({**receipt, 'original_operation_retry_allowed': True}, **evidence)

    def test_valid_digests_cannot_acknowledge_an_unknown_or_unverified_commit(self):
        for changes in (
            {'state': {'failed_phase': 'writers_stopped'}}, {'state': {'migration_requested': False}},
            {'state': {'migration_result': {}}}, {'state': {'phase': 'complete'}},
            {'failure': {'error_code': 'migration_ledger_mismatch'}}, {'failure': {'automatic_retry_allowed': 0}},
            {'intent': {'migrations_requested': True}}, {'intent': {'started_at': '2026-11-17T10:17:00Z'}},
            {'recovery': {'status': 'partial'}}, {'recovery': {'timers_restored': False}},
            {'recovery': {'migrations_executed': True}}, {'recovery': {'release_id': 'unrelated'}},
            {'manifest': {'source_sha': 'a' * 40}}, {'manifest': {'files': []}},
            {'preactivation': {'entity_columns_present': False}}, {'preactivation': {'entity_tables_checked': True}},
            {'verification': {'pending': 1}}, {'verification': {'read_only': False}},
            {'verification': {'migrations_executed': True}}, {'verification': {'client_tls_authorized': False}},
            {'verification': {'ledger_sha256': 'f' * 64}}, {'verification': {'quiescent': False}},
        ):
            with self.subTest(changes=changes), self.assertRaises(policy.Rejected):
                receipt, evidence = post_migration_fixture(changes=changes)
                policy.validate_post_migration_reconciliation(receipt, **evidence)


class Ports:
    def __init__(self, fail=None):
        self.events, self.states = [], []
        self.fail = fail
        self.migrations = 0

    def call(self, name):
        self.events.append(name)
        if self.fail == name:
            raise policy.Rejected('synthetic_failure')

    def begin(self, _request, _state): self.call('begin')
    def record(self, state): self.states.append(dict(state))
    def prepare(self, _request):
        self.call('prepare')
        return {'candidate_release': 'synthetic-release'}
    def pause_timers(self):
        self.call('pause_timers')
        return {'backup': True, 'rotate': False}
    def maintenance(self, on): self.call('maintenance_on' if on else 'maintenance_off')
    def backup(self):
        self.call('backup')
        return {'backup_id': 'synthetic-ready-backup'}
    def recover_backup_failure(self, original):
        assert original == {'backup': True, 'rotate': False}
        assert self.states[-1]['availability_recovery'] == 'pending'
        assert self.events[-1] == 'block'
        self.call('recover_backup_failure')
        return 'restored'
    def require_quiescent(self, stopped): self.call('quiet_stopped' if stopped else 'quiet_live')
    def stop_writers(self): self.call('stop_writers')
    def probe_candidate(self): self.call('probe')
    def migrate_once(self):
        self.migrations += 1
        self.call('migrate')
        return {'status': 'migrated'}
    def switch_release(self): self.call('switch')
    def start_and_verify(self): self.call('start_verify')
    def public_smoke(self): self.call('smoke')
    def restore_timers(self, original):
        assert original == {'backup': True, 'rotate': False}
        self.call('restore_timers')
    def finish(self, *_): self.call('finish')
    def block(self, _state): self.call('block')


class UpdatePolicyTests(unittest.TestCase):
    def test_backup_precedes_stop_and_migration_is_single_after_second_quiet_gate(self):
        ports = Ports()
        result = policy.run_update(request(), ports, apply=True)
        self.assertEqual(result['phase'], 'complete')
        self.assertEqual(ports.events, ['begin', 'prepare', 'pause_timers', 'maintenance_on', 'backup',
                         'quiet_live', 'stop_writers', 'quiet_stopped', 'probe', 'migrate', 'switch',
                         'start_verify', 'maintenance_off', 'smoke', 'restore_timers', 'finish'])
        self.assertEqual(ports.migrations, 1)
        self.assertTrue(any(state['phase'] == 'migration_requested' for state in ports.states))

    def test_plan_never_requests_backup_maintenance_or_stop(self):
        ports = Ports()
        self.assertEqual(policy.run_update(request(), ports)['phase'], 'planned')
        self.assertEqual(ports.events, ['begin', 'prepare'])

    def test_failure_never_replays_or_rolls_back_and_preserves_admission_fence(self):
        for point in ['quiet_live', 'stop_writers', 'quiet_stopped', 'probe',
                      'migrate', 'switch', 'start_verify', 'smoke', 'restore_timers']:
            with self.subTest(point=point):
                ports = Ports(fail=point)
                with self.assertRaises(policy.Rejected):
                    policy.run_update(request(), ports, apply=True)
                self.assertEqual(ports.states[-1]['phase'], 'failed')
                self.assertFalse(ports.states[-1]['automatic_retry_allowed'])
                self.assertIn('block', ports.events)
                self.assertEqual(ports.events[-2], 'maintenance_on')
                self.assertNotIn('recover_backup_failure', ports.events)
                self.assertLessEqual(ports.migrations, 1)
                if point in ['quiet_live', 'stop_writers', 'quiet_stopped', 'probe']:
                    self.assertEqual(ports.migrations, 0)

    def test_backup_failure_recovers_availability_after_the_failure_and_fence_are_recorded(self):
        ports = Ports(fail='backup')
        with self.assertRaisesRegex(policy.Rejected, '^synthetic_failure$'):
            policy.run_update(request(), ports, apply=True)
        self.assertEqual(ports.events, ['begin', 'prepare', 'pause_timers', 'maintenance_on', 'backup',
                                        'block', 'recover_backup_failure'])
        self.assertEqual(ports.migrations, 0)
        final = ports.states[-1]
        self.assertEqual(final['phase'], 'failed')
        self.assertEqual(final['failed_phase'], 'backup_requested')
        self.assertEqual(final['error_code'], 'synthetic_failure')
        self.assertFalse(final['migration_requested'])
        self.assertFalse(final['automatic_retry_allowed'])
        self.assertEqual(final['availability_recovery'], 'restored')
        self.assertEqual(final['backup_timers_recovery'], 'restored')

    def test_backup_failure_keeps_maintenance_if_availability_cannot_be_verified(self):
        ports = Ports(fail='backup')
        def unavailable(_timers):
            ports.events.append('recover_backup_failure')
            raise policy.Rejected('cors_preflight_not_verified')
        ports.recover_backup_failure = unavailable
        with self.assertRaisesRegex(policy.Rejected, '^synthetic_failure$'):
            policy.run_update(request(), ports, apply=True)
        self.assertEqual(ports.events[-3:], ['block', 'recover_backup_failure', 'maintenance_on'])
        self.assertEqual(ports.states[-1]['availability_recovery'], 'failed')
        self.assertEqual(ports.states[-1]['availability_recovery_error_code'], 'cors_preflight_not_verified')
        self.assertFalse(ports.states[-1]['automatic_retry_allowed'])

    def test_preflight_failure_has_no_service_effects(self):
        ports = Ports(fail='prepare')
        with self.assertRaises(policy.Rejected): policy.run_update(request(), ports, apply=True)
        self.assertEqual(ports.events, ['begin', 'prepare'])
        self.assertFalse(ports.states[-1]['effects_started'])

    def test_untrusted_paths_types_and_extra_request_keys_fail(self):
        for change in [{'artifact_directory': '../escape'}, {'schema_version': True},
                       {'operation_id': 'repeat'}, {'source_sha': 'master'}, {'unexpected': True}]:
            with self.assertRaises(policy.Rejected): policy.validate_request({**request(), **change})

    def test_backup_requires_fresh_ready_identity_not_old_or_unknown_receipt(self):
        now = datetime.datetime(2026, 11, 12, tzinfo=datetime.timezone.utc)
        receipt = {'schema_version': 1, 'operation': 'backup', 'status': 'ready',
                   'backup_id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cipher_bytes': 100,
                   'cipher_sha256': 'b' * 64, 'encryption_key_id': 'c' * 64, 'journal_sequence': 0,
                   'captured_at': now.isoformat(), 'expires_at': (now + datetime.timedelta(days=7)).isoformat()}
        self.assertEqual(policy.validate_backup_result(receipt, started_at=now, now=now)['backup_id'], receipt['backup_id'])
        for change in [{'status': 'pending'}, {'cipher_bytes': True}, {'cipher_sha256': 'wrong'},
                       {'captured_at': (now - datetime.timedelta(seconds=1)).isoformat()},
                       {'expires_at': now.isoformat()}]:
            with self.assertRaises(policy.Rejected):
                policy.validate_backup_result({**receipt, **change}, started_at=now, now=now)

    def test_backup_json_must_belong_to_one_fresh_post_cursor_invocation(self):
        import json
        fresh = {'_SYSTEMD_INVOCATION_ID': 'a' * 32, 'MESSAGE': json.dumps({'operation': 'backup'})}
        self.assertEqual(policy.fresh_backup_message([fresh], 'b' * 32)['operation'], 'backup')
        for entries, previous in [([], None), ([fresh, fresh], None), ([fresh], 'a' * 32),
                                  ([{**fresh, '_SYSTEMD_INVOCATION_ID': ''}], None)]:
            with self.assertRaises(policy.Rejected): policy.fresh_backup_message(entries, previous)


if __name__ == '__main__': unittest.main()
