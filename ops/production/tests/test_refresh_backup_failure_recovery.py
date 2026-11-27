import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


BASE = Path(__file__).resolve().parents[1]
RECOVERY_COMMIT = '907407843d6c9460d80fbd2daf44665a9d6aee6c'
RECOVERY_FIXTURES = {
    'update-backend.py': 'NODIA_BACKUP_RECOVERY_TEST_FIXTURE',
    'backend_update.py': 'NODIA_BACKUP_RECOVERY_TEST_POLICY_FIXTURE',
}
SPEC = importlib.util.spec_from_file_location(
    'refresh_backup_failure', BASE / 'refresh-backup-failure-recovery.py')
refresh = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(refresh)


def reviewed_recovery_asset(name):
    # Keep the original candidate pair that the historical recovery operator pins.
    if name not in RECOVERY_FIXTURES:
        return (BASE / name).read_bytes()
    fixture = os.environ.get(RECOVERY_FIXTURES[name])
    if fixture:
        return Path(fixture).read_bytes()
    return subprocess.check_output([
        'git', '-C', str(BASE), 'show', f'{RECOVERY_COMMIT}:ops/production/{name}',
    ])


class RefreshBackupFailureTest(unittest.TestCase):
    def setUp(self):
        path = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.bundle = path / 'bundle'
        self.lib, self.state = path / 'lib', path / 'state'
        for directory in (self.bundle, self.lib, self.state):
            directory.mkdir()
        for name in refresh.IO_POLICIES.keys() | refresh.CANDIDATES.keys():
            data = reviewed_recovery_asset(name)
            (self.bundle / name).write_bytes(data)
        self.updater_assets = set(refresh.CANDIDATES) | {
            'update-backend-action.mjs', 'stage-backend-candidate.py', 'probe-backend-dependencies.mjs'}
        receiver_assets = {'deploy-backend-receiver.py', 'deploy-gateway.py',
                           'backend_upload.py', 'archive-completed-backend-upload.py'}
        self.previous_code = {}
        for name in self.updater_assets | receiver_assets:
            code = ('# Old ' + name + '\n').encode()
            self.write(self.lib / name, code, 0o755 if name == 'deploy-gateway.py' else 0o644)
            self.previous_code[name] = code
        self.current = {'release_id': 'backend-' + '1' * 12 + '-' + '2' * 12,
                        'source_sha': '1' * 40, 'package_tree_sha256': '2' * 64}
        previous = {name: refresh.hashlib.sha256(code).hexdigest() for name, code in self.previous_code.items()}
        self.manifest = {'schema_version': 1, 'previous_assets': previous, 'expected_current': self.current}
        raw = json.dumps(self.manifest).encode()
        self.expected_hash = refresh.hashlib.sha256(raw).hexdigest()
        (self.bundle / refresh.MANIFEST).write_bytes(raw)
        self.io, self.reuse, self.manifest, self.raw, self.sources = refresh.load_bundle(self.bundle, self.expected_hash)
        self.reuse.LIB, self.reuse.STATE = self.lib, self.state
        self.reuse.installed_assets.__globals__.update(LIB=self.lib, STATE=self.state)
        for name, assets in (('settings.json', self.updater_assets), ('receiver-settings.json', receiver_assets)):
            self.write(self.state / name, self.reuse.json_bytes({
                'schema_version': 1, 'assets': {filename: previous[filename] for filename in assets},
                'other_setting': 'preserved',
            }), 0o600)
        self.settings = self.state / 'settings.json'
        self.journal = self.state / ('backup-failure-recovery-refresh-' + self.expected_hash)
        self.host_status = {'current': self.current, 'application_pids': {'api': '11'},
                            'backup_timers': {'backup': 'active'}, 'blocked': False}

    def write(self, path, raw, mode):
        path.write_bytes(raw)
        path.chmod(mode)

    def run_refresh(self, apply):
        return refresh.refresh_locked(self.io, self.reuse, self.manifest, self.raw, self.sources, apply)

    def test_dry_run_preserves_files_and_writes_no_intent(self):
        with patch.object(refresh, 'check_host', return_value=self.host_status):
            self.assertEqual(self.run_refresh(False)['status'], 'backup_failure_recovery_dry_run')
        self.assertFalse(self.journal.exists())
        self.assertEqual((self.lib / 'backend_update.py').read_bytes(), self.previous_code['backend_update.py'])

    def test_apply_updates_two_files_and_pins_and_keeps_originals(self):
        receiver_settings = self.state / 'receiver-settings.json'
        originals = {name: self.previous_code[name] for name in refresh.CANDIDATES}
        receiver_before = receiver_settings.read_bytes()
        updater_before = self.settings.read_bytes()
        with patch.object(refresh, 'check_host', return_value=self.host_status) as check:
            self.assertEqual(self.run_refresh(True)['status'], 'backup_failure_recovery_adopted')
            self.assertEqual(check.call_count, 2)
            with self.assertRaisesRegex(ValueError, 'refresh_intent_exists'):
                self.run_refresh(True)
        for name, digest in refresh.CANDIDATES.items():
            self.assertEqual((self.journal / name).read_bytes(), originals[name])
            self.assertEqual(self.io.sha((self.lib / name).read_bytes()), digest)
            self.assertEqual(json.loads(self.settings.read_bytes())['assets'][name], digest)
        self.assertEqual((self.journal / self.settings.name).read_bytes(), updater_before)
        self.assertEqual(receiver_settings.read_bytes(), receiver_before)
        self.assertEqual(json.loads(self.settings.read_bytes())['other_setting'], 'preserved')
        self.assertEqual(json.loads((self.journal / 'receipt.json').read_bytes())['application_pids'], {'api': '11'})

    def test_rejects_drift_before_mutations(self):
        self.write(self.lib / 'update-backend-action.mjs', b'// drift\n', 0o644)
        with self.assertRaisesRegex(ValueError, 'installed_asset_differs'):
            self.run_refresh(True)
        self.assertFalse(self.journal.exists())

    def test_rejects_tampered_candidate(self):
        (self.bundle / 'backend_update.py').write_bytes(b'# tampered\n')
        with self.assertRaisesRegex(ValueError, 'reviewed_digest_mismatch'):
            refresh.load_bundle(self.bundle, self.expected_hash)
