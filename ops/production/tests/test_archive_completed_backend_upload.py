"""Root-only temporary files and mocked service observations; no VPS or services."""
import copy
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

BASE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('archive_upload_fixture', BASE / 'archive-completed-backend-upload.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


@unittest.skipUnless(os.geteuid() == 0, 'Requires isolated Linux root fixtures')
class ArchiveCompletedUploadTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='nodia-archive-fixture-', dir=Path.home())
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.lib, self.state = self.root / 'lib', self.root / 'state'
        self.install = self.root / 'installation.lock'
        for directory in (self.lib, self.state):
            directory.mkdir(mode=0o700)
        for name in ('incoming', 'submissions', 'requests', 'attempts'):
            (self.state / name).mkdir(mode=0o700)
        self.write(self.install, b'', 0o600)
        self.write(self.state / 'receiver.lock', b'', 0o600)
        source = (BASE / 'deploy-backend-receiver.py').read_bytes()
        self.receiver_sha = hashlib.sha256(source).hexdigest()
        self.write(self.lib / archive.RECEIVER, source, 0o644)
        gateway = b'# Synthetic gateway fixture; never executed.\n'
        self.write(self.lib / archive.GATEWAY, gateway, 0o755)
        self.json(self.state / 'receiver-settings.json', {'schema_version': 1, 'assets': {
            archive.RECEIVER: self.receiver_sha, archive.GATEWAY: hashlib.sha256(gateway).hexdigest()}})
        self.operation = 'a' * 32
        self.data = b'original synthetic Actions ZIP\x00\xff'
        self.digest = hashlib.sha256(self.data).hexdigest()
        self.message = {'schema_version': 1, 'command': 'deploy', 'operation_id': self.operation,
                        'artifact_id': '456', 'artifact_zip_sha256': self.digest, 'run_id': '123', 'run_attempt': '1',
                        'source_sha': 'b' * 40, 'expected_current_release': 'backend-' + 'c' * 12 + '-' + 'd' * 12,
                        'expected_current_tree_sha256': 'd' * 64}
        self.ready = {'schema_version': 1, 'status': 'deployment_ready', 'blocked': False,
                      'application': {'api_active': True, 'worker_active': True},
                      'current': {'source_sha': 'e' * 40, 'release_id': 'backend-' + 'e' * 12 + '-' + 'f' * 12,
                                  'package_tree_sha256': 'f' * 64}}
        self.record_operation(self.operation)
        directory = self.state / 'incoming/server-123-1'
        directory.mkdir(mode=0o700)
        self.source = directory / '456.zip'
        self.write(self.source, self.data, 0o600)
        self.destination = self.state / 'archived-incoming/server-123-1/456.zip'
        self.record = self.state / ('archive-completed-upload-' + self.operation)
        self.pins = {str(path.relative_to(self.state)): path.read_bytes()
                     for folder in ('submissions', 'requests', 'attempts')
                     for path in (self.state / folder).rglob('*.json')}
        self.fixed = patch.multiple(archive, LIB=self.lib, STATE=self.state, INSTALL_LOCK=self.install)
        self.fixed.start()
        self.addCleanup(self.fixed.stop)
        real_load = archive.load_receiver

        def load(expected):
            module, pin = real_load(expected)
            module.LIB, module.STATE, module.SUBMISSIONS = self.lib, self.state, self.state / 'submissions'
            module.deployment_status = lambda: copy.deepcopy(self.ready)
            return module, pin
        self.receiver_load = load
        self.loaded = patch.object(archive, 'load_receiver', side_effect=load)
        self.loaded.start()
        self.addCleanup(self.loaded.stop)

    def write(self, path, data, mode):
        path.write_bytes(data)
        path.chmod(mode)

    def json(self, path, value):
        self.write(path, (json.dumps(value, sort_keys=True) + '\n').encode(), 0o600)

    def record_operation(self, operation, phase='complete', *, submission=True):
        message = {**self.message, 'operation_id': operation}
        if submission:
            self.json(self.state / 'submissions' / (operation + '.json'), {
                'schema_version': 1, 'message': message, 'submitted_at': '2026-11-15T00:00:00+00:00'})
        request = {name: message[name] for name in ('operation_id', 'artifact_id', 'artifact_zip_sha256',
                   'source_sha', 'expected_current_release', 'expected_current_tree_sha256')}
        request.update(schema_version=1, artifact_directory='server-123-1')
        self.json(self.state / 'requests' / (operation + '.json'), request)
        directory = self.state / 'attempts' / operation
        directory.mkdir(mode=0o700)
        self.json(directory / 'state.json', {'schema_version': 1, 'operation_id': operation,
                                           'phase': phase, 'effects_started': True})

    def run_archive(self, **kwargs):
        return archive.archive(self.operation, self.digest, self.receiver_sha, **kwargs)

    def assert_originals(self):
        for relative, raw in self.pins.items():
            self.assertEqual((self.state / relative).read_bytes(), raw)

    def test_default_dry_run_does_not_create_archive_or_intent(self):
        result = self.run_archive()
        self.assertEqual(result['status'], 'archive_dry_run')
        self.assertFalse(result['moved'])
        self.assertFalse(result['automatic_retry_allowed'])
        self.assertEqual(self.source.read_bytes(), self.data)
        self.assertFalse(self.destination.parent.parent.exists())
        self.assertFalse(self.record.exists())
        self.assert_originals()

    def test_apply_moves_exact_bytes_and_preserves_all_historical_records(self):
        result = self.run_archive(apply=True)
        self.assertEqual(result['status'], 'upload_archived')
        self.assertTrue(result['moved'])
        self.assertFalse(result['deployment_requested'])
        self.assertFalse(result['application_services_restarted'])
        self.assertFalse(result['automatic_retry_allowed'])
        self.assertFalse(self.source.exists())
        self.assertEqual(self.destination.read_bytes(), self.data)
        self.assertEqual(self.destination.stat().st_mode & 0o777, 0o600)
        self.assertEqual(json.loads((self.record / 'receipt.json').read_bytes()), result)
        self.assertEqual(json.loads((self.record / 'intent.json').read_bytes())['artifact_zip_sha256'], self.digest)
        self.assert_originals()
        with self.assertRaisesRegex(ValueError, 'already_recorded_no_automatic_replay'):
            self.run_archive(apply=True)
        self.assertEqual(self.destination.read_bytes(), self.data)

    def test_failed_unknown_and_planned_target_operations_are_never_archived(self):
        path = self.state / 'attempts' / self.operation / 'state.json'
        for phase in ('failed', 'unknown', 'planned', 'preparing'):
            with self.subTest(phase=phase):
                self.json(path, {'schema_version': 1, 'operation_id': self.operation, 'phase': phase})
                with patch.object(archive, 'load_receiver') as load:
                    original = self.receiver_load(self.receiver_sha)
                    original[0].operation_status = lambda _: {'phase': phase, 'deployment_performed': False}
                    load.return_value = original
                    with self.assertRaisesRegex(ValueError, 'archive_operation_not_complete'):
                        self.run_archive(apply=True)
                self.assertEqual(self.source.read_bytes(), self.data)
                self.assertFalse(self.record.exists())

    def test_current_source_and_unhealthy_or_blocked_gateway_are_rejected(self):
        for change, code in (({'blocked': True}, 'archive_gateway_not_ready'),
                             ({'application': {'api_active': True, 'worker_active': False}}, 'archive_gateway_not_ready'),
                             ({'current': {'source_sha': self.message['source_sha']}}, 'current_upload_cannot_be_archived')):
            with self.subTest(change=change):
                original = copy.deepcopy(self.ready)
                self.ready.update(change)
                with self.assertRaisesRegex(ValueError, code):
                    self.run_archive(apply=True)
                self.ready = original
                self.assertFalse(self.record.exists())

    def test_another_incomplete_submission_using_the_zip_blocks_archive(self):
        self.record_operation('1' * 32, phase='failed')
        with self.assertRaisesRegex(ValueError, 'archive_reference_not_complete'):
            self.run_archive(apply=True)
        self.assertFalse(self.record.exists())

    def test_an_incomplete_manual_request_using_the_zip_blocks_archive(self):
        self.record_operation('2' * 32, phase='planned', submission=False)
        with self.assertRaisesRegex(ValueError, 'archive_reference_not_complete'):
            self.run_archive(apply=True)
        self.assertFalse(self.record.exists())

    def test_completed_shared_references_are_preserved_when_archiving_the_single_zip(self):
        self.record_operation('3' * 32)
        snapshots = {str(path.relative_to(self.state)): path.read_bytes()
                     for folder in ('submissions', 'requests', 'attempts')
                     for path in (self.state / folder).rglob('*.json')}
        self.assertEqual(self.run_archive(apply=True)['status'], 'upload_archived')
        for relative, raw in snapshots.items():
            self.assertEqual((self.state / relative).read_bytes(), raw)

    def test_digest_request_and_receiver_pins_fail_before_intent(self):
        with self.assertRaisesRegex(ValueError, 'archive_zip_digest_mismatch'):
            self.write(self.source, b'changed', 0o600)
            self.run_archive(apply=True)
        self.write(self.source, self.data, 0o600)
        with self.assertRaisesRegex(ValueError, 'reviewed_receiver_digest_required'):
            archive.archive(self.operation, self.digest, '0' * 64, apply=True)
        path = self.state / 'requests' / (self.operation + '.json')
        request = json.loads(path.read_bytes())
        self.json(path, {**request, 'source_sha': '0' * 40})
        with self.assertRaisesRegex(ValueError, 'archive_request_identity_mismatch'):
            self.run_archive(apply=True)
        self.assertFalse(self.record.exists())

    def test_partial_symlink_hardlink_and_public_source_are_rejected(self):
        partial = self.source.with_suffix('.zip.part')
        self.write(partial, b'partial', 0o600)
        with self.assertRaisesRegex(ValueError, 'archive_partial_requires_reconciliation'):
            self.run_archive(apply=True)
        partial.unlink()
        self.source.unlink()
        original = self.root / 'original.zip'
        self.write(original, self.data, 0o600)
        self.source.symlink_to(original)
        with self.assertRaisesRegex(ValueError, 'unsafe_archive_path'):
            self.run_archive(apply=True)
        self.source.unlink()
        os.link(original, self.source)
        with self.assertRaisesRegex(ValueError, 'invalid_archive_path_type'):
            self.run_archive(apply=True)
        self.source.unlink()
        self.write(self.source, self.data, 0o644)
        with self.assertRaisesRegex(ValueError, 'invalid_archive_mode'):
            self.run_archive(apply=True)
        self.assertFalse(self.record.exists())

    def test_existing_destination_is_preserved_and_does_not_create_intent(self):
        self.destination.parent.parent.mkdir(mode=0o700)
        self.destination.parent.mkdir(mode=0o700)
        self.write(self.destination, b'previous archive', 0o600)
        with self.assertRaisesRegex(ValueError, 'archive_destination_already_exists'):
            self.run_archive(apply=True)
        self.assertEqual(self.destination.read_bytes(), b'previous archive')
        self.assertEqual(self.source.read_bytes(), self.data)
        self.assertFalse(self.record.exists())

    def test_interruption_after_intent_requires_inspection_without_moving_or_replaying(self):
        with patch.object(archive, 'rename_noreplace', side_effect=RuntimeError('Synthetic interruption')):
            with self.assertRaisesRegex(RuntimeError, 'Synthetic interruption'):
                self.run_archive(apply=True)
        intent = (self.record / 'intent.json').read_bytes()
        self.assertEqual(self.source.read_bytes(), self.data)
        self.assertFalse(self.destination.exists())
        with self.assertRaisesRegex(ValueError, 'already_recorded_no_automatic_replay'):
            self.run_archive(apply=True)
        self.assertEqual((self.record / 'intent.json').read_bytes(), intent)

    def test_interruption_after_move_keeps_archive_and_intent_without_false_receipt(self):
        actual = archive.rename_noreplace
        def interrupt(source, destination):
            actual(source, destination)
            raise RuntimeError('Synthetic interruption after rename')
        with patch.object(archive, 'rename_noreplace', side_effect=interrupt):
            with self.assertRaisesRegex(RuntimeError, 'Synthetic interruption after rename'):
                self.run_archive(apply=True)
        self.assertEqual(self.destination.read_bytes(), self.data)
        self.assertFalse(self.source.exists())
        self.assertTrue((self.record / 'intent.json').exists())
        self.assertFalse((self.record / 'receipt.json').exists())
        with self.assertRaisesRegex(ValueError, 'already_recorded_no_automatic_replay'):
            self.run_archive(apply=True)
        self.assert_originals()

    def test_atomic_move_never_overwrites_a_destination_created_after_the_intent(self):
        actual = archive.rename_noreplace
        def collide(source, destination):
            self.write(destination, b'preserve conflicting destination', 0o600)
            actual(source, destination)
        with patch.object(archive, 'rename_noreplace', side_effect=collide):
            with self.assertRaises(FileExistsError):
                self.run_archive(apply=True)
        self.assertEqual(self.source.read_bytes(), self.data)
        self.assertEqual(self.destination.read_bytes(), b'preserve conflicting destination')
        self.assertTrue((self.record / 'intent.json').exists())
        self.assertFalse((self.record / 'receipt.json').exists())

    def test_both_receiver_and_install_locks_must_be_available(self):
        for path in (self.state / 'receiver.lock', self.install):
            with self.subTest(path=path.name), path.open('r+b') as stream:
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):
                    self.run_archive(apply=True)
                self.assertFalse(self.record.exists())

    def test_relatime_update_during_read_is_not_mistaken_for_changed_zip_bytes(self):
        original = self.source.stat()
        os.utime(self.source, ns=(1, original.st_mtime_ns))
        result = self.run_archive(apply=True)
        self.assertEqual(result['status'], 'upload_archived')
        self.assertEqual(self.destination.read_bytes(), self.data)

    def test_hash_changed_receiver_is_rejected_before_its_code_can_execute(self):
        source = self.lib / archive.RECEIVER
        source.write_bytes(source.read_bytes() + b'\nraise AssertionError("unreviewed code executed")\n')
        with self.assertRaisesRegex(ValueError, 'reviewed_receiver_digest_required'):
            self.run_archive(apply=True)
        self.assertFalse(self.record.exists())


if __name__ == '__main__':
    unittest.main()
