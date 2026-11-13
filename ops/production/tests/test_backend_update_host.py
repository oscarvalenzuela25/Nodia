"""Untrusted ZIP and installer policy regressions; no systemd/network/production."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
import types
import unittest
from unittest.mock import patch
import zipfile

BASE = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, BASE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


policy = load('policy_fixture', 'backend_update.py')
adapter = load('host_fixture', 'update-backend.py')
installer = load('installer_fixture', 'install-backend-updater.py')


class HostInputTests(unittest.TestCase):
    def setUp(self):
        workspace = BASE.parents[1] / '.tmp' / 'updater-policy-tests'
        workspace.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=workspace, prefix='owned-')
        self.directory = Path(self.temporary.name).resolve()
        assert self.directory.is_relative_to(workspace.resolve())
        self.addCleanup(self.temporary.cleanup)
        self.host = adapter.Host(policy, types.SimpleNamespace(MAX_ARCHIVE=4096, MAX_MANIFEST=8192), {})
        self.host.attempt = self.directory / 'attempt'; self.host.attempt.mkdir()
        self.host.reserve = lambda *_: None
        self.request = {'artifact_id': '456', 'source_sha': 'a' * 40, 'artifact_directory': 'server-123-1'}
        self.release = 'backend-' + 'a' * 12 + '-' + 'b' * 12

    def zip(self, *, extra=None, archive_bytes=b'synthetic-tar', info=None):
        filename = self.directory / '456.zip'
        result = {'release_id': self.release, 'ci': {'run_id': '123', 'run_attempt': '1'}}
        with zipfile.ZipFile(filename, 'w') as archive:
            for name, data in [('artifact-result.json', json.dumps(result).encode()),
                               ('build-metadata.json', b'{}'), (self.release + '.manifest.json', b'{}'),
                               (self.release + '.tar.gz', archive_bytes)]:
                archive.writestr(name, data)
            if extra: archive.writestr(extra, b'injection')
            if info: archive.writestr(info, b'symlink-target')
        self.request['artifact_zip_sha256'] = hashlib.sha256(filename.read_bytes()).hexdigest()
        official = {'id': 456, 'expired': False, 'digest': 'sha256:' + self.request['artifact_zip_sha256'],
                    'name': 'server-' + 'a' * 40 + '-123-1',
                    'workflow_run': {'id': 123, 'head_sha': 'a' * 40, 'head_branch': 'master'}}
        return filename, official

    def test_original_zip_digest_and_server_run_are_required_before_any_child_is_written(self):
        for change in [{'expired': True}, {'digest': 'sha256:' + 'f' * 64}, {'id': 999},
                       {'name': 'client-' + 'a' * 40 + '-123-1'},
                       {'workflow_run': {'id': 123, 'head_sha': 'a' * 40, 'head_branch': 'development'}}]:
            filename, official = self.zip()
            with self.assertRaises(policy.Rejected):
                self.host.extract_authenticated_zip(filename, {**official, **change}, self.request)
            self.assertEqual(list(self.host.attempt.iterdir()), [])

    def test_zip_bytes_cannot_be_replaced_after_the_claimed_digest_is_recorded(self):
        filename, official = self.zip()
        filename.write_bytes(filename.read_bytes() + b'tampered')
        with self.assertRaises(policy.Rejected): self.host.extract_authenticated_zip(filename, official, self.request)
        self.assertEqual(list(self.host.attempt.iterdir()), [])

    def test_exact_four_files_are_streamed_with_bounded_payload(self):
        filename, official = self.zip()
        result = self.host.extract_authenticated_zip(filename, official, self.request)
        self.assertEqual(result['release_id'], self.release)
        self.assertEqual(len(list(self.host.attempt.iterdir())), 4)
        self.assertEqual((self.host.attempt / (self.release + '.tar.gz')).read_bytes(), b'synthetic-tar')

    def test_extra_paths_traversal_and_symlink_entries_are_rejected(self):
        for name in ['../escape', '/absolute', 'nested/child', 'other.env']:
            filename, official = self.zip(extra=name)
            with self.assertRaises(policy.Rejected): self.host.extract_authenticated_zip(filename, official, self.request)
            self.assertEqual(list(self.host.attempt.iterdir()), [])
        link = zipfile.ZipInfo('linked'); link.external_attr = (stat.S_IFLNK | 0o777) << 16
        filename, official = self.zip(info=link)
        with self.assertRaises(policy.Rejected): self.host.extract_authenticated_zip(filename, official, self.request)

    def test_oversized_tar_is_rejected_without_full_payload_extraction(self):
        filename, official = self.zip(archive_bytes=b'x' * 4097)
        with self.assertRaises(policy.Rejected): self.host.extract_authenticated_zip(filename, official, self.request)
        self.assertFalse((self.host.attempt / (self.release + '.tar.gz')).exists())

    def test_foreign_maintenance_flag_is_preserved(self):
        flag = self.directory / 'maintenance'; flag.write_text('foreign-operation\n')
        self.host.request = {'operation_id': 'our-operation'}
        with patch.object(adapter, 'MAINTENANCE', flag), patch.object(adapter, 'protected'):
            with self.assertRaises(policy.Rejected): self.host.maintenance(True)
        self.assertEqual(flag.read_text(), 'foreign-operation\n')

    def test_low_disk_space_fails_before_an_archive_or_backup_is_requested(self):
        host = adapter.Host(policy, None, {})
        with patch.object(adapter.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=1024)):
            with self.assertRaises(policy.Rejected): host.reserve(self.directory, 4096)

    def test_readiness_loop_does_not_swallow_an_operator_interrupt(self):
        self.host.candidate = self.directory
        commands = []
        self.host.command = lambda args, *_: commands.append(args)
        def interrupted(_release): raise policy.Rejected('operator_interrupted')
        self.host.verify_writers = interrupted
        with self.assertRaisesRegex(policy.Rejected, 'operator_interrupted'):
            self.host.start_and_verify()
        self.assertEqual(len(commands), 1)


class InstallerPolicyTests(unittest.TestCase):
    def test_maintenance_hook_preserves_the_reviewed_site_and_only_changes_api_location(self):
        original = (BASE / 'nodia-api.nginx.conf').read_bytes()
        wanted = installer.site_with_hook(original)
        self.assertEqual(wanted.replace(installer.INCLUDE, b''), original)
        self.assertEqual(wanted.count(installer.INCLUDE), 1)
        for unexpected in [b'other site', wanted, original + installer.NEEDLE]:
            with self.assertRaises(ValueError): installer.site_with_hook(unexpected)

    def test_duplicate_json_keys_and_special_numbers_are_rejected(self):
        for raw in [b'{"id":1,"id":2}', b'{"value":NaN}']:
            with self.assertRaises(ValueError): adapter.unique_json(raw)


if __name__ == '__main__': unittest.main()
