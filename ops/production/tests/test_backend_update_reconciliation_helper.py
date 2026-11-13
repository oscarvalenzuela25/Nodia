"""Root-owned disposable reconciliation boundary; fake HTTP/systemd/SQL, actual receipt policy."""
import copy
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('operator_reconciliation', Path(__file__).resolve().parents[1] / 'reconcile-pre-migration-update.py')
helper = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(helper)
POLICY_FILE = Path(__file__).resolve().parents[1] / 'backend_update.py'
policy = helper.module_bytes(POLICY_FILE.read_bytes(), POLICY_FILE, 'actual_reconciliation_policy')


@unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'requires isolated Linux root ownership')
class ReconciliationHelperTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(dir='/root')
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name)
        self.state, self.lib, self.releases = (self.base / name for name in ('state', 'lib', 'releases'))
        for directory in (self.state, self.lib, self.releases):
            directory.mkdir()
        self.current = self.base / 'current'
        self.release = self.releases / helper.RELEASE
        self.release.mkdir()
        self.current.symlink_to(self.release)
        self.attempt = self.state / 'attempts' / helper.OPERATION
        self.attempt.mkdir(parents=True)
        (self.state / 'requests').mkdir()
        (self.state / 'diagnostics').mkdir(mode=0o700)
        self.install_lock = self.base / 'installation.lock'
        for file in (self.install_lock, self.state / 'receiver.lock'):
            self.write(file, b'', 0o600)
        self.settings = {'schema_version': 1, 'assets': {name: 'a' * 64 for name in helper.ASSETS}}
        self.receiver_settings = {'schema_version': 1, 'assets': {name: 'b' * 64 for name in
                                 ('deploy-backend-receiver.py', 'deploy-gateway.py')}}
        self.write(self.state / 'settings.json', self.raw(self.settings))
        self.write(self.state / 'receiver-settings.json', self.raw(self.receiver_settings))
        self.original_state = {'schema_version': 1, 'operation_id': helper.OPERATION, 'phase': 'failed',
            'failed_phase': 'stopping_writers', 'error_code': 'writer_shutdown_not_clean', 'effects_started': True,
            'migration_requested': False, 'automatic_retry_allowed': False, 'previous_release': helper.RELEASE,
            'timers_before': {name: {'active': True, 'enabled': 'enabled'} for name in helper.TIMERS}}
        self.state_bytes = self.raw(self.original_state)
        self.blocked_bytes = policy.blocked_record_bytes(self.original_state)
        self.write(self.attempt / 'state.json', self.state_bytes)
        self.write(self.state / 'BLOCKED.json', self.blocked_bytes)
        self.request = {'schema_version': 1, 'operation_id': helper.OPERATION, 'artifact_directory': 'server-1-1',
            'artifact_id': '1', 'artifact_zip_sha256': 'c' * 64, 'source_sha': 'd' * 40,
            'expected_current_release': helper.RELEASE, 'expected_current_tree_sha256': helper.TREE}
        self.request_bytes = self.raw(self.request)
        self.write(self.state / 'requests' / (helper.OPERATION + '.json'), self.request_bytes)
        self.write(self.attempt / 'request.json', self.request_bytes)
        self.manifest = {'schema_version': 1, 'release_id': helper.RELEASE, 'package_tree_sha256': helper.TREE,
            'files': [{'path': f'dist/migrations/{1000000000000 + i}-Fixture{i}.js', 'type': 'file'} for i in range(45)]}
        self.manifest_bytes = self.raw(self.manifest)
        self.write(self.release / 'release-manifest.json', self.manifest_bytes, 0o644)
        self.recovery = {'schema_version': 1, 'status': 'complete', 'operation_id': helper.OPERATION,
            'resolution': 'same_release_restored_before_migration', 'started_at': '2026-01-01T00:00:00Z',
            'state_sha256': helper.digest(self.state_bytes), 'blocked_sha256': helper.digest(self.blocked_bytes),
            'release_id': helper.RELEASE, 'package_tree_sha256': helper.TREE, 'ledger_sha256': helper.LEDGER_SHA,
            'migrations_requested': False, 'deployment_performed': False, 'cd_unblocked': False,
            'diagnostic_directory': '/var/lib/nodia-updates/diagnostics/current-restore-preflight-' + 'e' * 32,
            'completed_at': '2026-01-01T00:01:00Z', 'cors_verified': True, 'timers_restored': True,
            'maintenance_removed': True, 'failed_attempt_unchanged': True}
        self.recovery_bytes = self.raw(self.recovery)
        self.write(self.state / ('same-release-recovery-' + helper.OPERATION + '.json'), self.recovery_bytes)
        self.inspection = {'status': 'verified', 'mode': 'inspect', 'read_only': True, 'client_tls_authorized': True,
            'migrations_executed': False, 'before': 45, 'target': 45, 'pending': 0, 'ledger_sha256': helper.LEDGER_SHA,
            'quiescent': True, 'counts': {name: 0 for name in helper.COUNTERS}}
        self.calls = []
        self.timer_status = {name: {'ActiveState': 'active', 'UnitFileState': 'enabled'} for name in helper.TIMERS}
        testcase = self
        class Host:
            def manifest(self, current):
                testcase.assertEqual(current, testcase.release)
                return testcase.manifest
            def backup_environment(self, current):
                testcase.calls.append(('backup_environment_read', current))
            def verify_writers(self, current):
                testcase.assertEqual(current, testcase.release)
                testcase.calls.append(('verify_writers', current))
            def http(self, url, status):
                testcase.calls.append(('http_get', url, status))
            def node_action(self, mode):
                testcase.assertEqual(mode, 'inspect')
                testcase.calls.append(('read_only_sql', mode))
                return testcase.inspection
            def show(self, unit):
                return testcase.timer_status[unit]
        def receiver_status():
            receipt = self.acknowledgment
            if receipt.exists():
                policy.validate_pre_migration_reconciliation(json.loads(receipt.read_bytes()), state_bytes=self.state_bytes,
                    request_bytes=self.request_bytes, blocked_bytes=self.blocked_bytes,
                    recovery_bytes=self.recovery_bytes, manifest_bytes=self.manifest_bytes)
            return {'status': 'deployment_ready', 'blocked': not receipt.exists(),
                'application': {'api_active': True, 'worker_active': True},
                'current': {'release_id': helper.RELEASE, 'package_tree_sha256': helper.TREE}}
        self.runtime = SimpleNamespace(host=Host(), policy=policy, receiver=SimpleNamespace(deployment_status=receiver_status))
        self.actual_runtime_loader = helper.load_verified_runtime
        changes = {'STATE': self.state, 'LIB': self.lib, 'CURRENT': self.current, 'RELEASES': self.releases,
            'INSTALL_LOCK': self.install_lock, 'MAINTENANCE': self.base / 'maintenance',
            'STATE_SHA': helper.digest(self.state_bytes), 'BLOCKED_SHA': helper.digest(self.blocked_bytes),
            'MANIFEST_SHA': helper.digest(self.manifest_bytes)}
        for name, value in changes.items():
            context = patch.object(helper, name, value)
            context.start()
            self.addCleanup(context.stop)
        for name, value in [('load_verified_runtime', lambda *args: self.runtime),
                            ('verify_cors', lambda base: self.calls.append(('cors_get', base)))]:
            context = patch.object(helper, name, value)
            context.start()
            self.addCleanup(context.stop)

    @property
    def acknowledgment(self):
        return self.attempt / 'pre-migration-reconciliation.json'

    @property
    def intent(self):
        return self.attempt / 'pre-migration-reconciliation.intent.json'

    @staticmethod
    def raw(value):
        return (json.dumps(value) + '\n').encode()

    def write(self, path, raw, mode=0o600):
        path.write_bytes(raw)
        path.chmod(mode)

    def run_reconcile(self, **changes):
        arguments = {'settings_sha': helper.digest((self.state / 'settings.json').read_bytes()),
            'receiver_settings_sha': helper.digest((self.state / 'receiver-settings.json').read_bytes()),
            'recovery_sha': helper.digest(self.recovery_bytes), 'request_sha': helper.digest(self.request_bytes)}
        return helper.reconcile(**{**arguments, **changes})

    def assert_history_preserved(self):
        self.assertEqual((self.attempt / 'state.json').read_bytes(), self.state_bytes)
        self.assertEqual((self.state / 'BLOCKED.json').read_bytes(), self.blocked_bytes)

    def test_acknowledgment_is_shared_policy_valid_and_preserves_failed_history(self):
        result = self.run_reconcile()
        self.assertEqual(result['status'], 'pre_migration_failure_reconciled')
        self.assertFalse(result['deployment_requested'])
        self.assertFalse(result['original_operation_retry_allowed'])
        receipt = json.loads(self.acknowledgment.read_bytes())
        self.assertTrue(receipt['new_operation_allowed'])
        self.assertFalse(receipt['original_operation_retry_allowed'])
        self.assertEqual(stat.S_IMODE(self.acknowledgment.stat().st_mode), 0o600)
        snapshot = self.attempt / 'recovered-manifest.json'
        self.assertEqual(snapshot.read_bytes(), self.manifest_bytes)
        self.assertEqual(stat.S_IMODE(snapshot.stat().st_mode), 0o600)
        self.assertEqual(json.loads(self.intent.read_bytes())['status'], 'intent_recorded')
        self.assertEqual(sum(call[0] == 'read_only_sql' for call in self.calls), 1)
        self.assertTrue(all(call[0] in {'backup_environment_read', 'verify_writers', 'http_get', 'cors_get', 'read_only_sql'} for call in self.calls))
        self.assert_history_preserved()

    def test_success_or_interrupted_acknowledgment_cannot_be_replayed(self):
        self.run_reconcile()
        with self.assertRaisesRegex(ValueError, 'reconciliation_already_reserved_no_replay'):
            self.run_reconcile()
        self.assert_history_preserved()

    def test_settings_and_original_state_hashes_fail_before_acknowledgment(self):
        with self.assertRaisesRegex(ValueError, 'reviewed_installed_settings_required'):
            self.run_reconcile(settings_sha='f' * 64)
        self.write(self.attempt / 'state.json', self.state_bytes + b' ')
        with self.assertRaisesRegex(ValueError, 'recovered_operation_changed'):
            self.run_reconcile()
        self.assertFalse(self.intent.exists())
        self.assertFalse(self.acknowledgment.exists())

    def test_sql_work_or_wrong_ledger_keeps_intent_without_acknowledgment(self):
        self.inspection['counts']['jobs'] = 1
        with self.assertRaisesRegex(ValueError, 'fresh_read_only_reconciliation_required'):
            self.run_reconcile()
        self.assertTrue(self.intent.exists())
        self.assertFalse(self.acknowledgment.exists())
        with self.assertRaisesRegex(ValueError, 'reconciliation_already_reserved_no_replay'):
            self.run_reconcile()
        self.assert_history_preserved()

    def test_timer_failure_never_acknowledges_or_changes_services(self):
        self.timer_status['nodia-ai-backup.timer']['ActiveState'] = 'inactive'
        with self.assertRaisesRegex(ValueError, 'restored_timer_changed'):
            self.run_reconcile()
        self.assertFalse(self.acknowledgment.exists())
        self.assert_history_preserved()

    def test_cors_failure_leaves_only_intent_and_cannot_replay(self):
        with patch.object(helper, 'verify_cors', side_effect=ValueError('cors_auth_not_verified')):
            with self.assertRaisesRegex(ValueError, 'cors_auth_not_verified'):
                self.run_reconcile()
        self.assertTrue(self.intent.exists())
        self.assertFalse(self.acknowledgment.exists())
        self.assertFalse((self.attempt / 'recovered-manifest.json').exists())
        self.assert_history_preserved()

    def test_partial_manifest_preserves_intent_without_acknowledgment_or_replay(self):
        original = helper.exclusive_bytes
        def interrupted(path, raw, io):
            if path.name == 'recovered-manifest.json':
                self.write(path, raw[:10])
                raise OSError('synthetic manifest write interrupted')
            return original(path, raw, io)
        with patch.object(helper, 'exclusive_bytes', side_effect=interrupted), self.assertRaises(OSError):
            self.run_reconcile()
        self.assertTrue(self.intent.exists())
        self.assertFalse(self.acknowledgment.exists())
        self.assertEqual((self.attempt / 'recovered-manifest.json').read_bytes(), self.manifest_bytes[:10])
        with self.assertRaisesRegex(ValueError, 'reconciliation_already_reserved_no_replay'):
            self.run_reconcile()
        self.assert_history_preserved()

    def test_locks_prevent_concurrent_reconciliation(self):
        for file in (self.install_lock, self.state / 'receiver.lock'):
            with self.subTest(file=file), file.open('r+b') as stream:
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):
                    self.run_reconcile()
        self.assertFalse(self.intent.exists())

    def test_distinct_request_copy_rejects_before_intent(self):
        self.write(self.attempt / 'request.json', self.request_bytes + b' ')
        with self.assertRaisesRegex(ValueError, 'original_request_copies_differ'):
            self.run_reconcile()
        self.assertFalse(self.intent.exists())
        self.assertFalse(self.acknowledgment.exists())
        self.assert_history_preserved()

    def test_runtime_executes_exact_snapshotted_verified_bytes_without_reopening(self):
        sources = {name: b'# synthetic immutable fixture\n' for name in helper.ASSETS}
        sources['update-backend.py'] = b'class Host:\n def __init__(self,*args): pass\n'
        sources['backend_update.py'] = b'def validate_pre_migration_reconciliation(*args,**kwargs): pass\n'
        sources['deploy-backend-receiver.py'] = b'def deployment_status(): return {}\n'
        sources['deploy-gateway.py'] = b'# fixed gateway\n'
        for name, raw in sources.items():
            self.write(self.lib / name, raw, 0o755 if name == 'deploy-gateway.py' else 0o644)
        settings = {'assets': {name: helper.digest(sources[name]) for name in helper.ASSETS}}
        receiver = {'assets': {name: helper.digest(sources[name]) for name in ('deploy-backend-receiver.py', 'deploy-gateway.py')}}
        io = helper.io_policy()
        original = helper.module_bytes
        executed = []
        def execute(raw, filename, module_name):
            self.assertEqual(raw, sources[filename.name])
            if not executed:
                for file in self.lib.iterdir():
                    file.write_bytes(b'# changed after verified snapshot\n')
            executed.append(filename.name)
            return original(raw, filename, module_name)
        with patch.object(helper, 'module_bytes', side_effect=execute):
            loaded = self.actual_runtime_loader(settings, receiver, io)
        self.assertTrue(callable(loaded.policy.validate_pre_migration_reconciliation))
        self.assertEqual(len(executed), 4)

    def test_inspection_requires_actual_zero_integers_and_unchanged_ledger(self):
        for change in ({'ledger_sha256': 'f' * 64}, {'pending': 1}, {'migrations_executed': True},
                       {'read_only': False}, {'counts': {name: False for name in helper.COUNTERS}}):
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, 'fresh_read_only_reconciliation_required'):
                helper.validate_inspection({**copy.deepcopy(self.inspection), **change})


if __name__ == '__main__':
    unittest.main()
