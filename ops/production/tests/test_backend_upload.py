"""Byte-ledger crash boundaries on disposable Linux root files; no application commands."""
import hashlib
import importlib.util
import os
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

BASE = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, BASE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


upload = load('upload_fixture', 'backend_upload.py')
receiver = load('upload_receiver_fixture', 'deploy-backend-receiver.py') if sys.platform == 'linux' else None


@unittest.skipUnless(sys.platform == 'linux' and os.geteuid() == 0, 'requires isolated Linux root ownership')
class BackendUploadTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='upload-v2-', dir=Path.home())
        self.addCleanup(temporary.cleanup)
        self.state = Path(temporary.name)
        self.incoming = self.state / 'incoming'
        self.incoming.mkdir(mode=0o700)
        self.data = b'Synthetic verified ZIP bytes; never executed.'
        self.message = self.identity(self.data)
        self.host = SimpleNamespace(STATE=self.state, INCOMING=self.incoming, MAX_UPLOAD=768 * 1024 ** 2,
                                    MAX_INCOMING=2 * 1024 ** 3, require=receiver.require,
                                    protect=receiver.protect, bounded_json=receiver.bounded_json,
                                    save_new=receiver.save_new, receive_bytes=receiver.receive_bytes,
                                    deployment_status=Mock(return_value={'blocked': False}),
                                    incoming_inventory=self.inventory)
        self.retention = SimpleNamespace(ensure_capacity=Mock())
        disk = patch.object(upload.shutil, 'disk_usage', return_value=SimpleNamespace(free=16 * 1024 ** 3))
        disk.start()
        self.addCleanup(disk.stop)

    def identity(self, data, artifact='456', run='123'):
        return {'artifact_id': artifact, 'artifact_zip_sha256': hashlib.sha256(data).hexdigest(),
                'run_id': run, 'run_attempt': '1', 'bytes': len(data)}

    def inventory(self):
        size, count = 0, 0
        for directory in self.incoming.iterdir():
            receiver.protect(directory, 0o700, directory=True)
            for filename in directory.iterdir():
                size += receiver.protect(filename, 0o600).st_size
                count += 1
        return size, count

    def paths(self, message=None):
        return upload._paths(self.host, message or self.message)

    def ledger(self, message=None):
        return self.state / 'uploads' / upload._upload_id(message or self.message)

    def open(self, message=None):
        return upload.open_upload(self.host, message or self.message, self.retention)

    def append(self, data, message=None, **changes):
        message = message or self.message
        current = upload.get_status(self.host, message)
        request = {**message, 'offset': current['offset'], 'prefix_sha256': current['prefix_sha256'],
                   'chunk_bytes': len(data), 'chunk_sha256': hashlib.sha256(data).hexdigest(), **changes}
        read, write = os.pipe()
        try:
            os.write(write, data)
            os.close(write)
            write = None
            return upload.append_upload(self.host, request, read)
        finally:
            os.close(read)
            if write is not None:
                os.close(write)

    def finish(self):
        return upload.finish_upload(self.host, self.message)

    def completed(self):
        self.open()
        self.append(self.data)
        return self.finish()

    def snapshot(self):
        return {str(path.relative_to(self.state)): (path.read_bytes() if path.is_file() else None,
                stat.S_IMODE(path.lstat().st_mode), path.lstat().st_ino, path.lstat().st_mtime_ns)
                for path in self.state.rglob('*')}

    def write(self, filename, data):
        filename.write_bytes(data)
        filename.chmod(0o600)

    def archive(self, operation='a' * 32):
        root = self.state / 'archived-incoming'
        root.mkdir(mode=0o700, exist_ok=True)
        directory = root / 'server-123-1'
        directory.mkdir(mode=0o700, exist_ok=True)
        _, _, source = self.paths()
        if source.exists():
            source.rename(directory / '456.zip')
        record = self.state / ('archive-completed-upload-' + operation)
        record.mkdir(mode=0o700)
        value = {'schema_version': 1, 'status': 'upload_archived', 'moved': True,
                 'operation_id': operation, 'artifact_directory': 'server-123-1',
                 'artifact_id': '456', 'artifact_zip_sha256': self.message['artifact_zip_sha256'],
                 'bytes': len(self.data), 'archived_relative_path': 'archived-incoming/server-123-1/456.zip',
                 'source_sha': 'c' * 40, 'receiver_sha256': 'd' * 64, 'receiver_settings_sha256': 'e' * 64,
                 'submission_sha256': 'f' * 64, 'request_sha256': '1' * 64, 'state_sha256': '2' * 64,
                 'reference_sha256': {'submissions/' + operation + '.json': 'f' * 64},
                 'current': {'release_id': 'backend-' + 'a' * 12 + '-' + 'b' * 12,
                             'source_sha': 'a' * 40, 'package_tree_sha256': 'b' * 64},
                 'deployment_requested': False, 'application_services_restarted': False,
                 'automatic_retry_allowed': False, 'completed_at': '2026-11-16T00:00:00Z'}
        receiver.save_new(record / 'intent.json', {name: item for name, item in {
            **value, 'status': 'archive_intent', 'started_at': '2026-11-16T00:00:00Z'}.items()
            if name not in ('completed_at', 'moved')})
        receiver.save_new(record / 'receipt.json', value)
        return record, value

    def test_status_absent_is_exact_read_only_contract(self):
        before = self.snapshot()
        result = upload.get_status(self.host, self.message)
        self.assertEqual(set(result), {'schema_version', 'status', 'protocol_version', 'upload_id', 'identity',
                                      'phase', 'offset', 'prefix_sha256', 'receipt_recorded',
                                      'deployment_requested', 'automatic_retry_allowed'})
        expected = 'nodia-upload-v2:123:1:456:' + self.message['artifact_zip_sha256'] + ':' + str(len(self.data))
        self.assertEqual(result['upload_id'], hashlib.sha256(expected.encode('ascii')).hexdigest())
        self.assertEqual(result['phase'], 'absent')
        self.assertEqual(result['offset'], 0)
        self.assertEqual(result['prefix_sha256'], hashlib.sha256(b'').hexdigest())
        self.assertIs(result['deployment_requested'], False)
        self.assertIs(result['automatic_retry_allowed'], False)
        self.assertEqual(before, self.snapshot())

    def test_ack_lost_can_query_then_finish_without_repeated_bytes(self):
        self.open()
        original = upload.get_status
        count = 0

        def status(*args):
            nonlocal count
            count += 1
            if count == 4:  # append helper query, preflight, after receive, then lost response
                raise OSError('synthetic lost ACK')
            return original(*args)

        with patch.object(upload, 'get_status', side_effect=status):
            with self.assertRaisesRegex(OSError, 'lost ACK'):
                self.append(self.data)
        before = self.snapshot()
        result = upload.get_status(self.host, self.message)
        self.assertEqual(result['phase'], 'ready')
        self.assertEqual(result['offset'], len(self.data))
        self.assertEqual(before, self.snapshot())
        self.assertEqual(self.finish()['phase'], 'verified')
        self.assertEqual(self.paths()[2].read_bytes(), self.data)
        self.assertEqual(self.finish()['receipt_recorded'], True)

    def test_partial_actual_write_resumes_only_missing_suffix(self):
        self.open()
        original = os.write
        calls = 0

        def interrupted(descriptor, data):
            nonlocal calls
            calls += 1
            if calls == 1:  # test pipe writer
                return original(descriptor, data)
            if calls == 2:
                return original(descriptor, data[:7])
            raise OSError('synthetic power loss')

        inode = self.paths()[1].stat().st_ino
        with patch.object(upload.os, 'write', side_effect=interrupted):
            with self.assertRaisesRegex(OSError, 'power loss'):
                self.append(self.data)
        result = upload.get_status(self.host, self.message)
        self.assertEqual(result['offset'], 7)
        self.assertEqual(result['prefix_sha256'], hashlib.sha256(self.data[:7]).hexdigest())
        self.assertEqual(self.append(self.data[7:])['phase'], 'ready')
        self.assertEqual(self.paths()[1].stat().st_ino, inode)
        self.assertEqual(self.paths()[1].read_bytes(), self.data)

    def test_prefix_and_offset_cas_reject_before_any_write(self):
        self.open()
        self.append(self.data[:5])
        before = self.snapshot()
        for changes, code in [({'offset': 0}, 'upload_offset_conflict'),
                              ({'prefix_sha256': '0' * 64}, 'upload_prefix_conflict')]:
            with self.subTest(code=code), self.assertRaisesRegex(ValueError, '^' + code + '$'):
                self.append(self.data[5:8], **changes)
        self.assertEqual(before, self.snapshot())

    def test_bad_hash_short_and_excess_input_have_no_disk_effect(self):
        self.open()
        before = self.snapshot()
        for changes in ({'chunk_sha256': '0' * 64}, {'chunk_bytes': 4}, {'chunk_bytes': 2}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.append(b'abc', **changes)
            self.assertEqual(before, self.snapshot())

    def test_append_requires_headroom_and_effective_unblocked_before_receiving(self):
        self.open()
        before = self.snapshot()
        receive = Mock(side_effect=AssertionError('must reject before consuming bytes'))
        with patch.object(self.host, 'receive_bytes', receive):
            with patch.object(upload.shutil, 'disk_usage', return_value=SimpleNamespace(free=upload.HEADROOM)):
                with self.assertRaisesRegex(ValueError, '^insufficient_upload_headroom$'):
                    self.append(b'x')
            self.host.deployment_status.return_value = {'blocked': True}
            with self.assertRaisesRegex(ValueError, '^prior_update_requires_reconciliation$'):
                self.append(b'x')
        receive.assert_not_called()
        self.assertEqual(before, self.snapshot())

    def test_intent_before_file_crash_reserves_then_recovers(self):
        original = os.open

        def fail_part(filename, *args, **kwargs):
            if str(filename).endswith('.zip.part'):
                raise OSError('synthetic before bytes')
            return original(filename, *args, **kwargs)

        with patch.object(upload.os, 'open', side_effect=fail_part):
            with self.assertRaisesRegex(OSError, 'before bytes'):
                self.open()
        self.assertTrue((self.ledger() / 'intent.json').exists())
        self.assertFalse(self.paths()[1].exists())
        self.assertEqual(upload.reservation_usage(self.host), (len(self.data), 1))
        before = self.snapshot()
        self.assertEqual(self.open()['phase'], 'receiving')
        self.assertEqual(before, self.snapshot())
        with self.assertRaises(ValueError):
            self.append(b'abc', chunk_sha256='0' * 64)
        self.assertFalse(self.paths()[1].exists())
        self.assertEqual(self.append(self.data)['phase'], 'ready')

    def test_physical_identity_cannot_gain_second_reservation_without_files(self):
        self.open()
        self.paths()[1].unlink()
        changed = self.identity(b'other bytes')
        before = self.snapshot()
        for action in (lambda: self.open(changed), lambda: upload.get_status(self.host, changed)):
            with self.assertRaisesRegex(ValueError, '^upload_identity_conflict$'):
                action()
        self.assertEqual(before, self.snapshot())
        directory = self.state / 'uploads' / upload._upload_id(changed)
        directory.mkdir(mode=0o700)
        receiver.save_new(directory / 'intent.json', upload._record_value(changed, 'upload_intent'))
        with self.assertRaisesRegex(ValueError, '^upload_identity_conflict$'):
            upload.reservation_usage(self.host)

    def test_reservations_count_total_not_just_received_bytes(self):
        self.open()
        self.append(self.data[:4])
        second = self.identity(b'second reservation', artifact='457')
        self.open(second)
        self.assertEqual(upload.reservation_usage(self.host), (len(self.data) + second['bytes'], 2))
        self.host.MAX_INCOMING = len(self.data) + second['bytes']
        self.retention.ensure_capacity.reset_mock()
        third = self.identity(b'x', artifact='458')
        with self.assertRaisesRegex(ValueError, '^incoming_quota_reached_operator_cleanup_required$'):
            self.open(third)
        self.retention.ensure_capacity.assert_called_once_with(self.host, 1, self.host.MAX_INCOMING, 2)
        self.assertFalse(self.ledger(third).exists())

    def test_existing_completed_upload_counts_actual_once(self):
        self.completed()
        self.assertEqual(upload.reservation_usage(self.host), (len(self.data), 1))

    def test_headroom_includes_remaining_existing_reservations(self):
        self.open()
        self.retention.ensure_capacity.reset_mock()
        second = self.identity(b'next', artifact='457')
        with patch.object(upload.shutil, 'disk_usage', return_value=SimpleNamespace(
                free=upload.HEADROOM + len(self.data) + second['bytes'] - 1)):
            with self.assertRaisesRegex(ValueError, '^insufficient_upload_headroom$'):
                self.open(second)
        self.assertFalse(self.ledger(second).exists())
        self.retention.ensure_capacity.assert_not_called()

    def test_prior_archive_guard_rejects_even_when_new_reservation_fits(self):
        before = self.snapshot()
        self.retention.ensure_capacity.side_effect = ValueError('archive_intent_already_recorded_no_automatic_replay')
        with self.assertRaisesRegex(ValueError, '^archive_intent_already_recorded_no_automatic_replay$'):
            self.open()
        self.retention.ensure_capacity.assert_called_once_with(self.host, len(self.data), 0, 0)
        self.assertEqual(before, self.snapshot())
        self.assertFalse(self.ledger().exists())
        self.assertFalse(self.paths()[1].exists())

    def test_effective_blocked_status_gates_open_but_historical_file_does_not(self):
        self.write(self.state / 'BLOCKED.json', b'{"historical":true}\n')
        self.host.deployment_status.return_value = {'blocked': True}
        with self.assertRaisesRegex(ValueError, '^prior_update_requires_reconciliation$'):
            self.open()
        self.assertFalse((self.state / 'uploads').exists())
        self.host.deployment_status.return_value = {'blocked': False}
        self.assertEqual(self.open()['phase'], 'receiving')

    def test_legacy_files_or_orphan_ledgers_never_adopt_or_reset(self):
        directory, partial, _ = self.paths()
        directory.mkdir(mode=0o700)
        self.write(partial, b'legacy')
        before = self.snapshot()
        for action in (self.open, lambda: upload.get_status(self.host, self.message)):
            with self.assertRaisesRegex(ValueError, '^upload_requires_operator_reconciliation$'):
                action()
        self.assertEqual(before, self.snapshot())
        root = self.state / 'uploads'
        root.mkdir(mode=0o700)
        (root / ('a' * 64)).mkdir(mode=0o700)
        with self.assertRaisesRegex(ValueError, '^upload_ledger_invalid$'):
            upload.reservation_usage(self.host)

    def test_malformed_immutable_record_and_bound_fail_closed(self):
        self.open()
        filename = self.ledger() / 'intent.json'
        self.write(filename, b'{"identity":{},"schema_version":1}\n')
        with self.assertRaises(ValueError):
            upload.get_status(self.host, self.message)
        with patch.object(upload, 'MAX_LEDGERS', 0):
            with self.assertRaisesRegex(ValueError, '^upload_ledger_limit_reached$'):
                upload.reservation_usage(self.host)

    def test_finish_crash_after_rename_seals_without_second_rename(self):
        self.open()
        self.append(self.data)
        with patch.object(upload, '_sync', side_effect=OSError('synthetic after rename')):
            with self.assertRaisesRegex(OSError, 'after rename'):
                self.finish()
        self.assertFalse(self.paths()[1].exists())
        self.assertEqual(upload.get_status(self.host, self.message)['phase'], 'verified')
        self.assertFalse(upload.get_status(self.host, self.message)['receipt_recorded'])
        with patch.object(upload, 'rename_noreplace', side_effect=AssertionError('must not rename twice')):
            self.assertTrue(self.finish()['receipt_recorded'])

    def test_finish_crash_before_rename_preserves_ready_prefix(self):
        self.open()
        self.append(self.data)
        before = self.snapshot()
        with patch.object(upload, 'rename_noreplace', side_effect=OSError('synthetic before rename')):
            with self.assertRaisesRegex(OSError, 'before rename'):
                self.finish()
        self.assertEqual(before, self.snapshot())
        self.assertEqual(self.finish()['phase'], 'verified')

    def test_finish_flushes_full_prefix_after_append_data_fsync_failure_before_rename(self):
        self.open()
        with patch.object(upload.os, 'fsync', side_effect=OSError('synthetic append fsync failure')):
            with self.assertRaisesRegex(OSError, 'append fsync failure'):
                self.append(self.data)
        self.assertEqual(upload.get_status(self.host, self.message)['phase'], 'ready')
        self.assertEqual(self.paths()[1].read_bytes(), self.data)
        events = []
        inode = self.paths()[1].stat().st_ino
        original_fsync, original_rename, original_save = os.fsync, upload.rename_noreplace, self.host.save_new

        def fsync(descriptor):
            if os.fstat(descriptor).st_ino == inode:
                self.assertEqual(os.fstat(descriptor).st_size, len(self.data))
                events.append('file_fsync')
            return original_fsync(descriptor)

        def rename(source, destination):
            events.append('rename')
            return original_rename(source, destination)

        def save(filename, value):
            events.append('receipt')
            return original_save(filename, value)

        with patch.object(upload.os, 'fsync', side_effect=fsync), \
                patch.object(upload, 'rename_noreplace', side_effect=rename), \
                patch.object(self.host, 'save_new', side_effect=save):
            self.assertTrue(self.finish()['receipt_recorded'])
        self.assertEqual(events[:3], ['file_fsync', 'rename', 'receipt'])

    def test_unsealed_destination_data_fsync_failure_never_creates_receipt(self):
        self.open()
        self.append(self.data)
        upload.rename_noreplace(self.paths()[1], self.paths()[2])
        with patch.object(upload.os, 'fsync', side_effect=OSError('synthetic final data fsync failure')):
            with self.assertRaisesRegex(OSError, 'final data fsync failure'):
                self.finish()
        self.assertEqual(self.paths()[2].read_bytes(), self.data)
        self.assertFalse((self.ledger() / 'receipt.json').exists())
        events = []
        inode = self.paths()[2].stat().st_ino
        original_fsync, original_save = os.fsync, self.host.save_new

        def fsync(descriptor):
            if os.fstat(descriptor).st_ino == inode:
                events.append('file_fsync')
            return original_fsync(descriptor)

        def save(filename, value):
            events.append('receipt')
            return original_save(filename, value)

        with patch.object(upload.os, 'fsync', side_effect=fsync), \
                patch.object(upload, 'rename_noreplace', side_effect=AssertionError('must not rename twice')), \
                patch.object(self.host, 'save_new', side_effect=save):
            self.assertTrue(self.finish()['receipt_recorded'])
        self.assertEqual(events[:2], ['file_fsync', 'receipt'])

    def test_finish_noreplace_preserves_racing_destination(self):
        self.open()
        self.append(self.data)
        original = upload.rename_noreplace

        def racing(source, destination):
            self.write(destination, b'other retained file')
            return original(source, destination)

        with patch.object(upload, 'rename_noreplace', side_effect=racing):
            with self.assertRaisesRegex(ValueError, '^upload_storage_conflict$'):
                self.finish()
        self.assertEqual(self.paths()[1].read_bytes(), self.data)
        self.assertEqual(self.paths()[2].read_bytes(), b'other retained file')
        with self.assertRaisesRegex(ValueError, '^upload_storage_conflict$'):
            upload.get_status(self.host, self.message)

    def test_full_digest_mismatch_preserves_bytes_without_receipt(self):
        self.open()
        wrong = b'x' * len(self.data)
        with self.assertRaisesRegex(ValueError, '^upload_digest_mismatch$'):
            self.append(wrong)
        with self.assertRaisesRegex(ValueError, '^upload_digest_mismatch$'):
            self.finish()
        self.assertEqual(self.paths()[1].read_bytes(), wrong)
        self.assertFalse((self.ledger() / 'receipt.json').exists())

    def test_archive_status_uses_exact_existing_receipt_and_derived_path(self):
        self.completed()
        self.archive()
        before = self.snapshot()
        result = upload.get_status(self.host, self.message)
        self.assertEqual(result['phase'], 'archived')
        self.assertEqual(self.finish(), result)
        self.assertEqual(upload.reservation_usage(self.host), (0, 0))
        self.assertEqual(before, self.snapshot())

    def test_missing_or_ambiguous_archive_record_never_adopts_bytes(self):
        self.completed()
        self.paths()[2].unlink()
        with self.assertRaisesRegex(ValueError, '^upload_archive_requires_reconciliation$'):
            upload.get_status(self.host, self.message)
        self.archive()
        self.write(self.state / 'archived-incoming/server-123-1/456.zip', self.data)
        self.archive('b' * 32)
        with self.assertRaisesRegex(ValueError, '^upload_archive_requires_reconciliation$'):
            upload.get_status(self.host, self.message)

    def test_archive_path_hash_and_incomplete_record_fail_closed(self):
        self.completed()
        record, value = self.archive()
        filename = record / 'receipt.json'
        filename.unlink()
        with self.assertRaisesRegex(ValueError, '^upload_archive_requires_reconciliation$'):
            upload.get_status(self.host, self.message)
        receiver.save_new(filename, {**value, 'archived_relative_path': '../outside.zip'})
        with self.assertRaisesRegex(ValueError, '^upload_archive_requires_reconciliation$'):
            upload.get_status(self.host, self.message)
        filename.unlink()
        receiver.save_new(filename, value)
        self.write(self.state / 'archived-incoming/server-123-1/456.zip', b'x' * len(self.data))
        with self.assertRaisesRegex(ValueError, '^upload_archive_requires_reconciliation$'):
            upload.get_status(self.host, self.message)

    def test_chunk_bounds_and_unsafe_partial_do_not_modify_target(self):
        self.open()
        before = self.snapshot()
        for changes in ({'chunk_bytes': upload.MAX_CHUNK + 1}, {'offset': True},
                        {'chunk_bytes': True}, {'prefix_sha256': None}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.append(b'x', **changes)
        self.assertEqual(before, self.snapshot())
        self.paths()[1].unlink()
        outside = self.state / 'retained'
        self.write(outside, b'retained')
        self.paths()[1].symlink_to(outside)
        with self.assertRaises(ValueError):
            self.append(b'x')
        self.assertEqual(outside.read_bytes(), b'retained')


if __name__ == '__main__':
    unittest.main()
