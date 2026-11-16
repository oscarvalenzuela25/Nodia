"""Disposable root-owned Linux fixtures; no remote IO or service changes."""
import copy
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

# Real receiver policy is exercised against the helper's real durable records.
receiver_spec = importlib.util.spec_from_file_location('refresh_transport_receiver_policy',
    Path(__file__).resolve().parents[1] / 'deploy-backend-receiver.py')
receiver_policy = importlib.util.module_from_spec(receiver_spec)
receiver_spec.loader.exec_module(receiver_policy)

BASE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('refresh_transport_fixture', BASE / 'refresh-upload-transport.py')
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


@unittest.skipUnless(sys.platform == 'linux' and os.geteuid() == 0, 'requires isolated Linux root ownership')
class UploadTransportRefreshTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='upload-transport-refresh-', dir=Path.home())
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lib, self.state, self.bundle = (self.root / name for name in ('lib', 'state', 'bundle'))
        for path in (self.lib, self.state, self.bundle):
            path.mkdir(mode=0o700)
        (self.state / 'attempts').mkdir(mode=0o700)
        self.install = self.root / 'installation.lock'
        for path in (self.install, self.state / 'receiver.lock'):
            self.write(path, b'', 0o600)
        self.io = refresh.io_policy()
        self.status = {'schema_version': 1, 'status': 'deployment_ready', 'blocked': False,
            'application': {'api_active': True, 'worker_active': True},
            'current': {'source_sha': 'a' * 40, 'package_tree_sha256': 'b' * 64,
                        'release_id': 'backend-' + 'a' * 12 + '-' + 'b' * 12}}
        self.units = {unit: {'ActiveState': 'active', 'SubState': 'running', 'Result': 'success',
            'MainPID': str(1000 + index), 'ControlGroup': '/system.slice/' + unit}
            for index, unit in enumerate(refresh.UNITS)}
        receiver = ("if __name__ == '__main__':\n    raise AssertionError('main must never run')\n"
            'def deployment_status():\n    return ' + repr(self.status) +
            '\ndef unit_state(unit):\n    return ' + repr(self.units) + '[unit]\n').encode()
        self.old = {refresh.RECEIVER: receiver, refresh.GATEWAY: b'# Synthetic old gateway.\n'}
        for name, raw in self.old.items():
            self.write(self.lib / name, raw, 0o755 if name == refresh.GATEWAY else 0o644)
        self.settings = {'schema_version': 1, 'operator_field': 'private preserved fixture',
                         'assets': {name: refresh.sha(raw) for name, raw in self.old.items()}}
        self.settings_path = self.state / 'receiver-settings.json'
        self.json(self.settings_path, self.settings)
        self.settings_raw = self.settings_path.read_bytes()
        self.settings_sha = refresh.sha(self.settings_raw)
        updater_assets = {}
        for name in refresh.UPDATER_ASSETS:
            raw = b'# Immutable synthetic updater asset.\n'
            self.write(self.lib / name, raw, 0o644)
            updater_assets[name] = refresh.sha(raw)
        self.json(self.state / 'settings.json', {'schema_version': 1, 'assets': updater_assets,
                  'service_hashes': {'synthetic': 'private unchanged fixture'}})
        self.candidates = {name: (receiver + b'# Synthetic v2 receiver.\n' if name == refresh.RECEIVER else
                          ('# Synthetic reviewed v2 ' + name + '\n').encode()) for name in refresh.ASSETS}
        for name, raw in self.candidates.items():
            self.write(self.bundle / name, raw, 0o666)
        self.manifest = {'schema_version': 1, 'purpose': refresh.PURPOSE,
            'assets': {name: refresh.sha(raw) for name, raw in self.candidates.items()},
            'previous_assets': copy.deepcopy(self.settings['assets']), 'expected_current': self.status['current']}
        self.update_manifest()
        self.capabilities = {'schema_version': 1, 'status': 'upload_capabilities', 'protocol_version': 2,
            'max_chunk_bytes': 8 * 1024 ** 2, 'max_upload_bytes': 768 * 1024 ** 2,
            'incoming_limit_bytes': 2 * 1024 ** 3, 'incoming_limit_files': 10,
            'logical_incoming_bytes': 0, 'logical_incoming_files': 0, 'free_bytes': 10 * 1024 ** 3,
            'retention_policy': 'archive_completed_noncurrent_on_demand', 'retention_deletes_files': False,
            'assets_sha256': self.manifest['assets'], 'deployment_requested': False, 'automatic_retry_allowed': False}
        self.capability_calls = []
        context = patch.multiple(refresh, LIB=self.lib, STATE=self.state, INSTALL_LOCK=self.install)
        context.start()
        self.addCleanup(context.stop)
        real_load = refresh.load_receiver

        def receiver_from_reviewed_bytes(raw):
            module = real_load(raw)
            module.deployment_status = lambda: copy.deepcopy(self.status)
            module.unit_state = lambda unit: copy.deepcopy(self.units[unit])
            def capabilities(message, fd):
                self.capability_calls.append((message, fd))
                return copy.deepcopy(self.capabilities)
            module.upload_command = capabilities
            return module
        context = patch.object(refresh, 'load_receiver', side_effect=receiver_from_reviewed_bytes)
        context.start()
        self.addCleanup(context.stop)

    def write(self, path, raw, mode):
        path.write_bytes(raw)
        path.chmod(mode)

    def json(self, path, value):
        self.write(path, refresh.json_bytes(value), 0o600)

    def update_manifest(self):
        self.json(self.bundle / refresh.MANIFEST, self.manifest)
        self.manifest_sha = refresh.sha((self.bundle / refresh.MANIFEST).read_bytes())
        self.record = self.state / ('transport-refresh-' + self.manifest_sha)

    def run_refresh(self, **kwargs):
        return refresh.refresh(self.bundle, self.manifest_sha, self.settings_sha, **kwargs)

    def original_files(self):
        return {str(path.relative_to(self.root)): (path.read_bytes(), stat.S_IMODE(path.stat().st_mode))
            for directory in (self.lib, self.state) for path in directory.rglob('*') if path.is_file()}

    def test_dry_run_has_zero_writes_and_no_capabilities_side_effects(self):
        originals = self.original_files()
        result = self.run_refresh()
        self.assertEqual(result['status'], 'upload_transport_refresh_dry_run')
        self.assertFalse(result['transport_changed'])
        self.assertFalse(result['capabilities_verified'])
        self.assertFalse(self.record.exists())
        self.assertEqual(self.original_files(), originals)
        self.assertEqual(self.capability_calls, [])
        self.assertNotIn('private', json.dumps(result))

    def test_apply_updates_only_four_assets_and_last_pin_preserving_all_originals(self):
        before = self.original_files()
        result = self.run_refresh(apply=True)
        self.assertEqual(result['status'], 'upload_transport_refreshed')
        self.assertTrue(result['capabilities_verified'])
        self.assertFalse(result['deployment_requested'])
        self.assertFalse(result['deployment_performed'])
        self.assertFalse(result['application_services_restarted'])
        self.assertFalse(result['automatic_retry_allowed'])
        self.assertEqual(result['current'], self.status['current'])
        self.assertEqual(result['application_pids'], {unit: int(value['MainPID']) for unit, value in self.units.items()})
        for name, raw in self.candidates.items():
            self.assertEqual((self.lib / name).read_bytes(), raw)
            self.assertEqual(stat.S_IMODE((self.lib / name).stat().st_mode), 0o755 if name == refresh.GATEWAY else 0o644)
        self.assertEqual(json.loads(self.settings_path.read_bytes()), {**self.settings, 'assets': self.manifest['assets']})
        self.assertEqual((self.record / 'receiver-settings.json').read_bytes(), self.settings_raw)
        self.assertEqual(refresh.sha((self.record / refresh.MANIFEST).read_bytes()), self.manifest_sha)
        metadata = json.loads((self.record / 'originals.json').read_bytes())
        for name in (refresh.UPLOAD, refresh.ARCHIVER):
            self.assertEqual(metadata[name], {'existed': False, 'sha256': None, 'mode': None})
            self.assertFalse((self.record / name).exists())
        for name, raw in self.old.items():
            self.assertEqual((self.record / name).read_bytes(), raw)
        changed = {'lib/' + name for name in refresh.ASSETS} | {'state/receiver-settings.json'}
        for relative, expected in before.items():
            if relative not in changed:
                path = self.root / relative
                self.assertEqual((path.read_bytes(), stat.S_IMODE(path.stat().st_mode)), expected)
        self.assertEqual(json.loads((self.record / 'receipt.json').read_bytes()), result)
        self.assertEqual(len(list(self.record.glob('write-*.json'))), 5)
        self.assertEqual(self.capability_calls, [({'schema_version': 1, 'command': 'capabilities'}, -1)])
        for path in self.record.iterdir():
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.record.stat().st_mode), 0o700)
        with self.assertRaisesRegex(ValueError, 'intent_exists_no_automatic_replay'):
            self.run_refresh(apply=True)

    def test_manifest_and_receiver_settings_exact_cas_and_previous_assets_are_required(self):
        with self.assertRaisesRegex(ValueError, 'reviewed_transport_manifest_required'):
            refresh.refresh(self.bundle, 'f' * 64, self.settings_sha, apply=True)
        with self.assertRaisesRegex(ValueError, 'receiver_settings_cas_mismatch'):
            refresh.refresh(self.bundle, self.manifest_sha, 'f' * 64, apply=True)
        self.manifest['previous_assets'][refresh.GATEWAY] = 'f' * 64
        self.update_manifest()
        with self.assertRaisesRegex(ValueError, 'previous_transport_assets_mismatch'):
            self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())

    def test_all_installed_updater_and_transport_hashes_are_checked_before_writes(self):
        for name in refresh.LEGACY_ASSETS | refresh.UPDATER_ASSETS:
            with self.subTest(name=name):
                path = self.lib / name
                raw = path.read_bytes()
                path.write_bytes(b'# Corrupted installed asset.\n')
                try:
                    with self.assertRaisesRegex(ValueError, 'installed_transport_refresh_asset_changed'):
                        self.run_refresh(apply=True)
                finally:
                    path.write_bytes(raw)
                self.assertFalse(self.record.exists())

    def test_legacy_untracked_new_modules_cannot_be_overwritten(self):
        for name in (refresh.UPLOAD, refresh.ARCHIVER):
            path = self.lib / name
            self.write(path, b'# Preserve untracked operator file.\n', 0o644)
            with self.assertRaisesRegex(ValueError, 'untracked_asset_exists'):
                self.run_refresh(apply=True)
            self.assertEqual(path.read_bytes(), b'# Preserve untracked operator file.\n')
            self.assertFalse(self.record.exists())
            path.unlink()

    def test_both_locks_are_required_in_receiver_then_installation_order(self):
        order, original = [], fcntl.flock
        def flock(fd, operation):
            order.append(Path(os.readlink('/proc/self/fd/' + str(fd))))
            return original(fd, operation)
        with patch.object(refresh.fcntl, 'flock', side_effect=flock):
            self.run_refresh()
        self.assertEqual(order, [self.state / 'receiver.lock', self.install])
        for path in (self.state / 'receiver.lock', self.install):
            with path.open('r+b') as lock:
                original(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):
                    self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())

    def test_historical_block_and_ack_are_preserved_under_effective_status_policy(self):
        self.json(self.state / 'BLOCKED.json', {'historical': True, 'private': 'retained'})
        attempt = self.state / 'attempts' / ('a' * 32)
        attempt.mkdir(mode=0o700)
        self.json(attempt / 'pre-migration-reconciliation.json', {'acknowledged': True, 'private': 'retained'})
        originals = {path: path.read_bytes() for path in (self.state / 'BLOCKED.json',
                     attempt / 'pre-migration-reconciliation.json')}
        result = self.run_refresh(apply=True)
        self.assertFalse(self.status['blocked'])
        for path, raw in originals.items():
            self.assertEqual(path.read_bytes(), raw)
        self.assertNotIn('private', json.dumps(result))

    def test_unhealthy_status_or_source_current_mismatch_stops_before_intent(self):
        for change in ({'blocked': True}, {'application': {'api_active': False, 'worker_active': True}}):
            previous = self.status
            self.status = {**previous, **change}
            try:
                with self.assertRaisesRegex(ValueError, 'backend_not_ready'):
                    self.run_refresh(apply=True)
            finally:
                self.status = previous
        self.manifest['expected_current'] = {'source_sha': 'c' * 40, 'package_tree_sha256': 'b' * 64,
                                          'release_id': 'backend-' + 'c' * 12 + '-' + 'b' * 12}
        self.update_manifest()
        with self.assertRaisesRegex(ValueError, 'current_cas_mismatch'):
            self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())

    def test_failure_between_code_and_pin_preserves_originals_and_blocks_replay(self):
        original = self.io.replace
        def replace(path, raw, mode):
            if path == self.settings_path:
                raise OSError('Synthetic interruption before pin')
            return original(path, raw, mode)
        with patch.object(refresh, 'io_policy', return_value=self.io), patch.object(self.io, 'replace', side_effect=replace):
            with self.assertRaisesRegex(OSError, 'Synthetic interruption'):
                self.run_refresh(apply=True)
        self.assertEqual(self.settings_path.read_bytes(), self.settings_raw)
        self.assertNotEqual(refresh.sha((self.lib / refresh.RECEIVER).read_bytes()), self.settings['assets'][refresh.RECEIVER])
        self.assertEqual((self.record / refresh.RECEIVER).read_bytes(), self.old[refresh.RECEIVER])
        self.assertEqual((self.record / 'receiver-settings.json').read_bytes(), self.settings_raw)
        self.assertFalse((self.record / 'receipt.json').exists())
        self.assertEqual(len(list(self.record.glob('write-*.json'))), 4)
        with self.assertRaisesRegex(ValueError, 'intent_exists_no_automatic_replay'):
            self.run_refresh(apply=True)

    def test_corrupt_candidate_capabilities_never_produce_success_receipt(self):
        self.capabilities['protocol_version'] = 1
        with self.assertRaisesRegex(ValueError, 'capabilities_invalid'):
            self.run_refresh(apply=True)
        self.assertTrue((self.record / 'intent.json').exists())
        self.assertFalse((self.record / 'receipt.json').exists())
        with self.assertRaisesRegex(ValueError, 'intent_exists_no_automatic_replay'):
            self.run_refresh(apply=True)

    def test_pid_change_prevents_success_receipt(self):
        original = self.io.replace
        def replace(path, raw, mode):
            result = original(path, raw, mode)
            if path == self.settings_path:
                self.units[refresh.UNITS[0]]['MainPID'] = '9999'
            return result
        with patch.object(refresh, 'io_policy', return_value=self.io), patch.object(self.io, 'replace', side_effect=replace):
            with self.assertRaisesRegex(ValueError, 'runtime_changed'):
                self.run_refresh(apply=True)
        self.assertFalse((self.record / 'receipt.json').exists())

    def test_ack_mutation_after_writes_prevents_success_receipt(self):
        attempt = self.state / 'attempts' / ('a' * 32)
        attempt.mkdir(mode=0o700)
        ack = attempt / 'pre-migration-reconciliation.json'
        self.json(ack, {'acknowledged': True})
        original = self.io.replace
        def replace(path, raw, mode):
            result = original(path, raw, mode)
            if path == self.settings_path:
                self.json(ack, {'acknowledged': False})
            return result
        with patch.object(refresh, 'io_policy', return_value=self.io), patch.object(self.io, 'replace', side_effect=replace):
            with self.assertRaisesRegex(ValueError, 'original_changed'):
                self.run_refresh(apply=True)
        self.assertFalse((self.record / 'receipt.json').exists())

    def test_bundle_bytes_are_snapshotted_once_and_not_reopened_for_installation(self):
        loader = refresh.load_receiver.side_effect
        count = 0
        def load(raw):
            nonlocal count
            count += 1
            if count == 1:
                for name in refresh.ASSETS:
                    self.write(self.bundle / name, b'raise AssertionError("unreviewed bytes")\n', 0o666)
            return loader(raw)
        with patch.object(refresh, 'load_receiver', side_effect=load):
            self.run_refresh(apply=True)
        for name, raw in self.candidates.items():
            self.assertEqual((self.lib / name).read_bytes(), raw)

    def test_originals_intent_and_absence_metadata_are_synced_before_first_code_write(self):
        events, original_sync, original_replace = [], self.io.sync_directory, self.io.replace
        def sync(path):
            events.append(('sync', path))
            return original_sync(path)
        def replace(path, raw, mode):
            events.append(('replace', path))
            self.assertEqual((self.record / refresh.RECEIVER).read_bytes(), self.old[refresh.RECEIVER])
            self.assertEqual((self.record / 'receiver-settings.json').read_bytes(), self.settings_raw)
            self.assertTrue((self.record / 'originals.json').is_file())
            return original_replace(path, raw, mode)
        with patch.object(refresh, 'io_policy', return_value=self.io), patch.object(self.io, 'sync_directory', side_effect=sync), patch.object(self.io, 'replace', side_effect=replace):
            self.run_refresh(apply=True)
        first_code_sync = events.index(('sync', self.lib))
        self.assertIn(('sync', self.record), events[:first_code_sync])
        self.assertIn(('sync', self.state), events[:first_code_sync])
        self.assertEqual([path for kind, path in events if kind == 'replace'][-1], self.settings_path)

    def test_source_symlinks_hardlinks_invalid_utf8_crlf_and_oversize_are_rejected(self):
        source = self.bundle / refresh.GATEWAY
        original = source.read_bytes()
        source.unlink()
        other = self.root / 'other.py'
        self.write(other, original, 0o666)
        source.symlink_to(other)
        with self.assertRaises(OSError):
            self.run_refresh(apply=True)
        source.unlink()
        os.link(other, source)
        with self.assertRaisesRegex(ValueError, 'invalid_transport_refresh_source'):
            self.run_refresh(apply=True)
        source.unlink()
        for raw, code in ((b'# invalid \xff\n', 'transport_source_utf8_required'),
                          (b'# CRLF\r\n', 'reviewed_transport_asset_required'),
                          (b'x' * (refresh.SOURCE_LIMIT + 1), 'invalid_transport_refresh_source')):
            self.write(source, raw, 0o666)
            self.manifest['assets'][refresh.GATEWAY] = refresh.sha(raw)
            self.update_manifest()
            with self.assertRaisesRegex(ValueError, code):
                self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())

    def test_root_path_symlink_private_modes_and_io_pin_are_enforced(self):
        with patch.object(refresh, 'IO_SHA256', 'f' * 64):
            with self.assertRaisesRegex(ValueError, 'reviewed_refresh_policy_required'):
                self.run_refresh(apply=True)
        self.settings_path.chmod(0o644)
        with self.assertRaisesRegex(ValueError, 'invalid_refresh_mode'):
            self.run_refresh(apply=True)
        self.settings_path.chmod(0o600)
        link = self.root / 'linked-lib'
        link.symlink_to(self.lib, target_is_directory=True)
        with patch.object(refresh, 'LIB', link):
            with self.assertRaisesRegex(ValueError, 'unsafe_refresh_path'):
                self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())

    def test_another_manifest_cannot_bypass_an_incomplete_transport_record(self):
        prior = self.state / ('transport-refresh-' + 'f' * 64)
        prior.mkdir(mode=0o700)
        self.json(prior / 'intent.json', {'schema_version': 1, 'status': 'synthetic interruption'})
        with self.assertRaisesRegex(ValueError, 'prior_intent_requires_reconciliation'):
            self.run_refresh(apply=True)
        self.assertFalse(self.record.exists())

    def test_already_four_asset_installation_updates_with_all_originals_preserved(self):
        for name in (refresh.UPLOAD, refresh.ARCHIVER):
            raw = ('# Old pinned ' + name + '\n').encode()
            self.old[name] = raw
            self.write(self.lib / name, raw, 0o644)
            self.settings['assets'][name] = refresh.sha(raw)
        self.json(self.settings_path, self.settings)
        self.settings_raw = self.settings_path.read_bytes()
        self.settings_sha = refresh.sha(self.settings_raw)
        self.manifest['previous_assets'] = copy.deepcopy(self.settings['assets'])
        self.update_manifest()
        result = self.run_refresh(apply=True)
        self.assertTrue(result['transport_changed'])
        for name, raw in self.old.items():
            self.assertEqual((self.record / name).read_bytes(), raw)


    def test_receiver_barrier_rejects_coherent_pins_without_final_adoption_receipt(self):
        self.run_refresh(apply=True)
        with patch.object(receiver_policy, 'STATE', self.state):
            receiver_policy.transport_adoption_guard()
            (self.record / 'receipt.json').unlink()
            with self.assertRaisesRegex(ValueError, 'upload_transport_refresh_requires_reconciliation'):
                receiver_policy.transport_adoption_guard()


if __name__ == '__main__':
    unittest.main()
