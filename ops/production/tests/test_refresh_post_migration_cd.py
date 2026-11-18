import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


BASE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('refresh_post_migration', BASE / 'refresh-post-migration-cd.py')
refresh = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(refresh)


class RefreshPostMigrationTest(unittest.TestCase):
    def setUp(self):
        self.path = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.lib, self.state = self.path / 'lib', self.path / 'state'
        self.lib.mkdir()
        self.operation = 'a' * 32
        self.attempt = self.state / 'attempts' / self.operation
        self.attempt.mkdir(parents=True, mode=0o700)
        self.attempt.parent.chmod(0o700)
        self.ack = self.attempt / refresh.ACKNOWLEDGMENT
        self.journal = self.state / ('post-migration-cd-refresh-' + self.operation)
        self.enterContext(patch.multiple(refresh, LIB=self.lib, STATE=self.state))
        io_raw = (BASE / refresh.IO).read_bytes()
        self.io = refresh.module(io_raw, BASE / refresh.IO)
        current = {'source_sha': '1' * 40, 'package_tree_sha256': '2' * 64,
                   'release_id': 'backend-' + '1' * 12 + '-' + '2' * 12}
        self.sources = {name: b'# candidate\n' for name in refresh.BUNDLE_FILES}
        self.sources[refresh.IO] = io_raw
        previous = {}
        for name in refresh.UPDATER_ASSETS | refresh.RECEIVER_ASSETS:
            raw = b'# installed\n'
            self.write(self.lib / name, raw, 0o755 if name == refresh.GATEWAY else 0o644)
            previous[name] = refresh.sha(raw)
        for filename, inventory in (('settings.json', refresh.UPDATER_ASSETS),
                                    ('receiver-settings.json', refresh.RECEIVER_ASSETS)):
            self.write(self.state / filename, refresh.json_bytes({'schema_version': 1,
                'assets': {name: previous[name] for name in inventory}, 'other_settings': 'retained'}), 0o600)
        self.manifest = {'schema_version': 1, 'operation_id': self.operation, 'expected_current': current,
                         'assets': {name: refresh.sha(raw) for name, raw in self.sources.items()},
                         'previous_assets': previous}
        self.paths = [self.attempt / 'post-migration-verification.json', self.ack]
        self.original_state = self.attempt / 'state.json'
        self.write(self.original_state, b'failed\n', 0o600)
        self.preview_blocked = False
        self.modules = {
            refresh.RECEIVER: SimpleNamespace(deployment_status=self.status, operation_status=lambda _:
                {'phase': 'failed', 'automatic_retry_allowed': False}, transport_assets=lambda: None,
                transport_adoption_guard=lambda: None),
            refresh.RECONCILE: SimpleNamespace(load_evidence=lambda *_: None,
                prepare_reconciliation=lambda *_: [(self.paths[0], b'verified\n'), (self.ack, b'reconciled\n')]),
        }
        self.enterContext(patch.object(refresh, 'module', side_effect=lambda raw, path: self.modules.get(path.name)))

    def write(self, path, raw, mode):
        path.write_bytes(raw)
        path.chmod(mode)

    def status(self, *, reconciliation_override=None):
        blocked = not self.ack.exists()
        if reconciliation_override:
            self.assertEqual(reconciliation_override, (self.operation, b'reconciled\n'))
            self.assertEqual(self.paths[0].read_bytes(), b'verified\n')
            self.assertFalse(self.ack.exists())
            blocked = self.preview_blocked
        return {'status': 'deployment_ready', 'blocked': blocked, 'current': self.manifest['expected_current'],
                'application': {'api_active': True, 'worker_active': True}}

    def run_refresh(self, *, apply):
        return refresh.refresh_locked(self.io, self.manifest, refresh.json_bytes(self.manifest),
                                      self.sources, apply=apply)

    def test_dry_run_checks_originals_without_publishing_or_replacing_files(self):
        self.assertTrue(self.run_refresh(apply=False)['blocked'])
        self.assertFalse(self.journal.exists())
        self.assertFalse(self.ack.exists())
        self.assertEqual((self.lib / refresh.ACTION).read_bytes(), b'# installed\n')

    def test_changed_installed_bytes_fail_before_creating_intent(self):
        self.write(self.lib / refresh.ACTION, b'# drift\n', 0o644)
        with self.assertRaisesRegex(ValueError, 'installed_asset_differs'):
            self.run_refresh(apply=True)
        self.assertFalse(self.journal.exists())
        self.assertFalse(self.ack.exists())

    def test_reviewed_manifest_pins_all_candidate_bytes(self):
        bundle = self.path / 'bundle'
        bundle.mkdir()
        raw = refresh.json_bytes(self.manifest)
        (bundle / refresh.MANIFEST).write_bytes(raw)
        for name, source in self.sources.items():
            (bundle / name).write_bytes(source)
        with patch.object(refresh, 'module', return_value=self.io):
            self.assertEqual(refresh.load_bundle(bundle, refresh.sha(raw))[3], self.sources)
            (bundle / refresh.ACTION).write_bytes(b'// tampered\n')
            with self.assertRaisesRegex(ValueError, 'reviewed_post_migration_cd_asset_required'):
                refresh.load_bundle(bundle, refresh.sha(raw))

    def test_apply_replaces_both_pin_sets_and_keeps_failed_attempt(self):
        self.assertFalse(self.run_refresh(apply=True)['blocked'])
        for filename, inventory in (('settings.json', refresh.UPDATER_ASSETS),
                                    ('receiver-settings.json', refresh.RECEIVER_ASSETS)):
            settings = self.io.unique_json((self.state / filename).read_bytes())
            for name in inventory:
                self.assertEqual(settings['assets'][name], refresh.sha((self.lib / name).read_bytes()))
            self.assertEqual(settings['other_settings'], 'retained')
        self.assertEqual((self.journal / refresh.ACTION).read_bytes(), b'# installed\n')
        self.assertEqual(self.original_state.read_bytes(), b'failed\n')
        self.assertEqual(self.ack.read_bytes(), b'reconciled\n')

    def test_other_blocker_prevents_acknowledgment_and_apply_cannot_replay(self):
        self.preview_blocked = True
        with self.assertRaisesRegex(ValueError, 'unexpected_production_status'):
            self.run_refresh(apply=True)
        self.assertFalse(self.ack.exists())
        self.assertEqual(self.original_state.read_bytes(), b'failed\n')
        with self.assertRaisesRegex(ValueError, 'refresh_intent_exists'):
            self.run_refresh(apply=True)
