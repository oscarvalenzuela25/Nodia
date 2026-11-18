"""Exercise recovery evidence from the one-time activation through the admission policy."""

import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


helper = load_module('post_migration_reconciliation', 'reconcile-post-migration-update.py')
policy = load_module('post_migration_policy', 'backend_update.py')


def require(condition, code):
    if not condition:
        raise ValueError(code)


class PostMigrationReconciliationHelperTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        base = Path(temporary.name)
        self.state = base / 'state'
        self.attempt = self.state / 'attempts' / helper.OPERATION
        self.attempt.mkdir(parents=True)
        self.requests = self.state / 'requests'
        self.requests.mkdir()
        self.diagnostics = self.state / 'diagnostics'
        self.recovery = self.diagnostics / ('post-migration-recovery-' + helper.OPERATION + '-abc12_34')
        self.recovery.mkdir(parents=True)
        releases = base / 'releases'
        self.previous = releases / helper.PREVIOUS
        self.candidate = releases / helper.CANDIDATE
        for directory in (self.previous, self.candidate):
            directory.mkdir(parents=True)

        migrations = [{'path': f'dist/migrations/{1000000000000 + index}-Fixture{index}.js',
                       'type': 'file', 'sha256': 'f' * 64} for index in range(56)]
        ledger = [{'timestamp': str(1000000000000 + index), 'name': f'Fixture{index}{1000000000000 + index}'}
                  for index in range(56)]
        ledger_sha = hashlib.sha256(json.dumps(ledger, separators=(',', ':')).encode()).hexdigest()
        manifest = {'schema_version': 1, 'release_id': helper.CANDIDATE, 'source_sha': helper.SOURCE,
                    'package_tree_sha256': helper.CANDIDATE_TREE, 'files': migrations}
        manifest_raw = self.write(self.candidate / 'release-manifest.json', manifest)
        manifest_sha = helper.sha(manifest_raw)
        self.start_patch(helper, STATE=self.state, RELEASES=releases, LEDGER_SHA=ledger_sha, MANIFEST_SHA=manifest_sha,
                         MAINTENANCE=base / 'maintenance' / 'backend', require_current=Mock(), verify_cors=Mock())
        self.io = SimpleNamespace(require=require, unique_json=json.loads, protected=lambda path, *_, **__: path.stat())
        helper.MAINTENANCE.parent.mkdir()

        backup = {'backup_id': '11111111-1111-4111-8111-111111111111', 'cipher_sha256': 'a' * 64,
                  'captured_at': '2026-01-01T00:00:00Z', 'journal_sequence': 0}
        self.timers = {name: {'active': True, 'enabled': 'enabled'}
                       for name in ('nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer')}
        state = {'schema_version': 1, 'operation_id': helper.OPERATION, 'phase': 'failed',
                 'failed_phase': 'migration_requested', 'error_code': 'host_command_failed_inspect_private_diagnostics',
                 'effects_started': True, 'migration_requested': True, 'automatic_retry_allowed': False,
                 'previous_release': helper.PREVIOUS, 'candidate_release': helper.CANDIDATE,
                 'backup': backup, 'timers_before': self.timers}
        state_raw = self.write(self.attempt / 'state.json', state)
        blocked = policy.blocked_record_bytes(state)
        (self.state / 'BLOCKED.json').write_bytes(blocked)
        request = {'schema_version': 1, 'operation_id': helper.OPERATION,
                   'artifact_directory': 'server-44206362041-1', 'artifact_id': '14383762946',
                   'artifact_zip_sha256': 'aec99df96cfebcca657ba8576af30e18968923d2f3bcd58080fa9d664b0d4808',
                   'source_sha': helper.SOURCE, 'expected_current_release': helper.PREVIOUS,
                   'expected_current_tree_sha256': helper.PREVIOUS_TREE}
        request_raw = self.write(self.attempt / 'request.json', request)
        self.request_path = self.requests / (helper.OPERATION + '.json')
        self.request_path.write_bytes(request_raw)
        failure = {'schema_version': 1, 'status': 'failed', 'error_code': 'entity_table_or_column_missing',
                   'automatic_retry_allowed': False}
        failure_raw = (json.dumps(failure, separators=(',', ':')) + '\n').encode()
        self.assertEqual(helper.sha(failure_raw), helper.FAILURE_SHA)
        (self.attempt / helper.FAILURE_NAME).write_bytes(failure_raw)

        self.activation = self.diagnostics / ('post-migration-activation-' + helper.OPERATION + '.json')
        self.write(self.activation, {'release': helper.CANDIDATE, 'at': '2026-01-01T00:02:00Z',
                                     'migrations_requested': False, 'diagnostics': str(self.recovery)})
        self.write(self.recovery / 'intent.json', {'schema_version': 1, 'status': 'intent_recorded',
                   'operation_id': helper.OPERATION, 'original_state_sha256': helper.sha(state_raw),
                   'request_sha256': helper.sha(request_raw), 'blocked_sha256': helper.sha(blocked),
                   'release_id': helper.CANDIDATE, 'manifest_sha256': manifest_sha, 'ledger_sha256': ledger_sha,
                   'started_at': '2026-01-01T00:01:00Z', 'migrations_requested': False})
        verification = {'schema_version': 1, 'status': 'verified', 'mode': 'verify', 'before': 52, 'target': 56,
                        'pending': 0, 'incremental_migrations': 4, 'ledger_sha256': ledger_sha, 'quiescent': True,
                        'counts': dict.fromkeys(policy.RUNTIME_COUNTERS, 0), 'read_only': True,
                        'client_tls_authorized': True, 'migrations_executed': False}
        self.write(self.recovery / 'preactivation.json', {**verification, 'entity_columns_present': True,
                                                         'entity_tables_checked': 73})
        self.write(self.recovery / 'release-switched.json', {'release': helper.CANDIDATE, 'at': '2026-01-01T00:03:00Z'})
        self.write(self.recovery / 'receipt.json', {'schema_version': 1, 'status': 'service_restored',
                   'operation_id': helper.OPERATION, 'release_id': helper.CANDIDATE, 'ledger_sha256': ledger_sha,
                   'migration_count': 56, 'migrations_executed': False, 'failed_attempt_preserved': True,
                   'backend_public_http': 200, 'cors_verified': True, 'timers_restored': True, 'cd_blocked': True,
                   'completed_at': '2026-01-01T00:04:00Z'})
        current_identity = {'release_id': helper.CANDIDATE, 'source_sha': helper.SOURCE,
                            'package_tree_sha256': helper.CANDIDATE_TREE}
        ci = {'run_id': '44206362041', 'run_attempt': '1'}
        self.write(self.attempt / 'build-metadata.json', {**current_identity, 'ci': ci, 'manifest_sha256': manifest_sha,
                   'production_eligible': True})
        self.write(self.attempt / 'timers-before.json', self.timers)
        self.write(self.state / 'deployed-backend.json', {**current_identity, 'schema_version': 1,
                                                        'ci': ci, 'backup': backup})

        self.host = Mock()
        self.host.manifest.side_effect = lambda directory: manifest if directory == self.candidate else {
            'package_tree_sha256': helper.PREVIOUS_TREE}
        self.host.show.return_value = {'UnitFileState': 'enabled', 'ActiveState': 'active'}
        self.host.node_action.return_value = {**verification, 'quiescent': False,
                                              'counts': {**verification['counts'], 'jobs': 1}}
        self.updater = SimpleNamespace(Host=Mock(return_value=self.host), TIMERS=tuple(self.timers))
        self.receiver = Mock()
        self.receiver.deployment_status.return_value = {'status': 'deployment_ready', 'blocked': True,
            'current': current_identity, 'application': {'api_active': True, 'worker_active': True}}

    def start_patch(self, target, **changes):
        patches = patch.multiple(target, **changes)
        patches.start()
        self.addCleanup(patches.stop)

    def write(self, path, value):
        raw = helper.json_bytes(value)
        path.write_bytes(raw)
        return raw

    def prepare(self):
        return helper.prepare_reconciliation(self.io, self.updater, policy, None, self.receiver, {}, helper.OPERATION)

    def test_binds_receipt_to_preserved_history_and_fresh_read_only_evidence(self):
        before = set(self.state.rglob('*'))
        records = self.prepare()
        self.assertEqual(set(self.state.rglob('*')), before)
        self.host.node_action.assert_called_once_with('verify')
        self.host.verify_writers.assert_called_once_with(self.candidate)
        self.assertEqual(self.host.http.call_count, 2)
        self.assertEqual(helper.verify_cors.call_count, 2)
        last, raw = records[-1]
        receipt = json.loads(raw)
        self.assertEqual(last, self.attempt / 'post-migration-reconciliation.json')
        self.assertIs(receipt['original_operation_retry_allowed'], False)
        self.assertEqual(receipt['blocked_sha256'], helper.sha((self.state / 'BLOCKED.json').read_bytes()))
        self.assertEqual(set(path.name for path, _ in records[:-1]), {
            'recovered-manifest.json', *(name for name, _ in policy.POST_MIGRATION_EVIDENCE.values())})

    def test_rejects_detached_diagnostic_path_before_live_verification(self):
        pointer = json.loads(self.activation.read_bytes())
        pointer['diagnostics'] = str(self.recovery.parent.parent / self.recovery.name)
        self.write(self.activation, pointer)
        with self.assertRaisesRegex(ValueError, 'invalid_recovery_diagnostic_directory'):
            self.prepare()
        self.host.node_action.assert_not_called()

    def test_rejects_live_ledger_mismatch(self):
        self.host.node_action.return_value['ledger_sha256'] = '0' * 64
        with self.assertRaisesRegex(policy.Rejected, 'post_migration_reconciliation_invalid'):
            self.prepare()

    def test_rechecks_original_evidence_before_returning_acknowledgment(self):
        def change_receipt(_):
            receipt = self.recovery / 'receipt.json'
            receipt.write_bytes(receipt.read_bytes() + b'\n')
            return self.host.node_action.return_value

        self.host.node_action.side_effect = change_receipt
        with self.assertRaisesRegex(ValueError, 'recovery_evidence_changed_during_check'):
            self.prepare()


if __name__ == '__main__':
    unittest.main()
