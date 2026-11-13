"""Policy tests: synthetic ports only; no VPS, DB, systemd or credentials."""
import datetime
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

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
        for point in ['backup', 'quiet_live', 'stop_writers', 'quiet_stopped', 'probe',
                      'migrate', 'switch', 'start_verify', 'smoke', 'restore_timers']:
            with self.subTest(point=point):
                ports = Ports(fail=point)
                with self.assertRaises(policy.Rejected):
                    policy.run_update(request(), ports, apply=True)
                self.assertEqual(ports.states[-1]['phase'], 'failed')
                self.assertFalse(ports.states[-1]['automatic_retry_allowed'])
                self.assertIn('block', ports.events)
                self.assertEqual(ports.events[-2], 'maintenance_on')
                self.assertLessEqual(ports.migrations, 1)
                if point in ['backup', 'quiet_live', 'stop_writers', 'quiet_stopped', 'probe']:
                    self.assertEqual(ports.migrations, 0)

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
