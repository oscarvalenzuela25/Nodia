import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


BASE = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, BASE / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


refresh = load('refresh-backup-request-cd')
io = load('refresh-production-cd')
reusable = load('refresh-post-migration-cd')


class BackupRequestRefreshTest(unittest.TestCase):
    def setUp(self):
        root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.lib, self.state = root / 'lib', root / 'state'
        self.lib.mkdir()
        self.attempt = self.state / 'attempts' / refresh.OPERATION
        self.attempt.mkdir(parents=True, mode=0o700)
        self.attempt.parent.chmod(0o700)
        self.ack = self.attempt / refresh.ACKNOWLEDGMENT
        self.journal = self.state / ('backup-request-cd-refresh-' + refresh.OPERATION)
        self.blocked = self.state / 'BLOCKED.json'
        self.receipt = self.state / ('same-release-recovery-' + refresh.OPERATION + '.json')
        self.archive = self.attempt / 'recovered-manifest.json'
        self.write(self.blocked, b'original block\n', 0o600)
        self.enterContext(patch.multiple(refresh, LIB=self.lib, STATE=self.state))
        self.enterContext(patch.multiple(reusable, LIB=self.lib, STATE=self.state))
        self.sources = {refresh.UPDATER: b'# new host\n', refresh.POLICY: b'# new policy\n', refresh.R2: b'// read only\n'}
        old_assets = {}
        for filename in reusable.UPDATER_ASSETS | reusable.RECEIVER_ASSETS:
            raw = b'# installed\n'
            self.write(self.lib / filename, raw, 0o755 if filename == reusable.GATEWAY else 0o644)
            old_assets[filename] = io.sha(raw)
        for filename, inventory in (('settings.json', reusable.UPDATER_ASSETS), ('receiver-settings.json', reusable.RECEIVER_ASSETS)):
            self.write(self.state / filename, reusable.json_bytes({
                'schema_version': 1, 'assets': {name: old_assets[name] for name in inventory}, 'other': 'retained',
            }), 0o600)
        self.manifest = {
            'operation_id': refresh.OPERATION, 'expected_current': refresh.CURRENT_IDENTITY,
            'previous_assets': old_assets, 'assets': {name: io.sha(raw) for name, raw in self.sources.items()},
        }
        self.events = []
        self.block_preview = False
        receiver = SimpleNamespace(deployment_status=self.receiver_status, operation_status=lambda _: {
            'phase': 'failed', 'automatic_retry_allowed': False,
        }, transport_assets=lambda: None, transport_adoption_guard=lambda: None)
        self.enterContext(patch.object(reusable, 'module', return_value=receiver))
        self.enterContext(patch.object(refresh, 'prepare_evidence', return_value=(
            SimpleNamespace(prior_updates_blocked=self.host_status), {self.blocked: (b'original block\n', 0o600)},
            b'm' * (200 * 1024), b'private evidence\n', b'reviewed acknowledgment\n',
            {'verified_backup': {'captured_at': '2026-11-18T12:00:00Z'}},
        )))

    def write(self, path, raw, mode):
        path.write_bytes(raw)
        path.chmod(mode)

    def preview(self, override, gate):
        if override is None:
            return not self.ack.exists()
        self.assertEqual(override, (refresh.OPERATION, b'reviewed acknowledgment\n'))
        self.assertFalse(self.ack.exists())
        self.assertEqual(self.receipt.read_bytes(), b'private evidence\n')
        self.assertEqual(len(self.archive.read_bytes()), 200 * 1024)
        self.events.append(gate)
        return self.block_preview and gate == 'receiver'

    def host_status(self, *, reconciliation_override=None):
        return self.preview(reconciliation_override, 'host')

    def receiver_status(self, *, reconciliation_override=None):
        return {'status': 'deployment_ready', 'blocked': self.preview(reconciliation_override, 'receiver'),
                'current': refresh.CURRENT_IDENTITY, 'application': {'api_active': True, 'worker_active': True}}

    def run_refresh(self, *, apply):
        return refresh.refresh_locked(io, reusable, self.manifest, reusable.json_bytes(self.manifest), self.sources, apply=apply)

    def test_dryrun_keeps_all_originals(self):
        self.assertTrue(self.run_refresh(apply=False)['blocked'])
        for path in (self.journal, self.ack, self.receipt, self.archive):
            self.assertFalse(path.exists())
        self.assertFalse(self.events)
        self.assertEqual((self.lib / refresh.POLICY).read_bytes(), b'# installed\n')

    def test_apply_updates_pinned_host_and_policy_and_publishes_ack_after_both_gates(self):
        original_receiver = (self.state / 'receiver-settings.json').read_bytes()
        self.assertFalse(self.run_refresh(apply=True)['blocked'])
        self.assertEqual(self.events, ['host', 'receiver'])
        self.assertEqual(self.ack.read_bytes(), b'reviewed acknowledgment\n')
        self.assertEqual(self.blocked.read_bytes(), b'original block\n')
        self.assertEqual((self.state / 'receiver-settings.json').read_bytes(), original_receiver)
        self.assertEqual((self.lib / refresh.RECEIVER).read_bytes(), b'# installed\n')
        settings = io.unique_json((self.state / 'settings.json').read_bytes())
        for name in (refresh.UPDATER, refresh.POLICY):
            self.assertEqual(settings['assets'][name], io.sha(self.sources[name]))
            self.assertEqual((self.journal / name).read_bytes(), b'# installed\n')
        self.assertEqual(settings['other'], 'retained')

    def test_failed_receiver_preview_preserves_block_and_prevents_automatic_reexecution(self):
        self.block_preview = True
        with self.assertRaisesRegex(ValueError, 'unexpected_production_status'):
            self.run_refresh(apply=True)
        self.assertFalse(self.ack.exists())
        self.assertEqual(self.blocked.read_bytes(), b'original block\n')
        with self.assertRaisesRegex(ValueError, 'reconciliation_intent_exists'):
            self.run_refresh(apply=True)


class R2ProbeTest(unittest.TestCase):
    def test_r2_proof_rejects_any_write_method(self):
        host = SimpleNamespace(SAFE_ENV={})
        for methods in (['GET', 'HEAD', 'GET', 'PUT'], ['GET', 'GET']):
            with self.subTest(methods=methods), patch.object(refresh.subprocess, 'run', return_value=SimpleNamespace(
                returncode=0, stderr=b'', stdout=json.dumps({'status': 'r2_read_completed', 'methods': methods, 'proof': {}}).encode(),
            )):
                with self.assertRaisesRegex(ValueError, 'r2_readonly_methods_not_verified'):
                    refresh.read_r2(io, host, b'// pinned probe', BASE)
