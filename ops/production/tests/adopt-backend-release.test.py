"""Temporary filesystem fixtures only; no systemd, SQL, network or production paths."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, filename)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

adopt = module('adoption_fixture', ROOT / 'adopt-backend-release.py')
stage = module('adoption_stage_fixture', ROOT / 'stage-backend-candidate.py')
sha = lambda data: hashlib.sha256(data).hexdigest()


def fixture_source(root):
    root.mkdir(mode=0o755)
    (root / 'nested').mkdir(mode=0o755)
    (root / 'nested' / 'main.js').write_bytes(b'// synthetic immutable fixture\n')
    (root / 'nested' / 'main.js').chmod(0o644)
    os.symlink('nested/main.js', root / 'entry')
    files = [{'path': 'entry', 'type': 'symlink', 'target': 'nested/main.js', 'sha256': sha(b'nested/main.js')},
             {'path': 'nested/main.js', 'type': 'file', 'bytes': len((root / 'nested/main.js').read_bytes()),
              'mode': '0644', 'sha256': sha((root / 'nested/main.js').read_bytes())}]
    tree = sha(json.dumps(files, separators=(',', ':')).encode())
    manifest = {'source_provenance': 'git_archive', 'deployment_eligible': True, 'source_sha': adopt.SOURCE_SHA,
                'package_tree_sha256': tree, 'release_id': 'backend-' + adopt.SOURCE_SHA[:12] + '-' + tree[:12], 'files': files}
    encoded = (json.dumps(manifest, indent=2) + '\n').encode()
    (root / 'release-manifest.json').write_bytes(encoded)
    (root / 'release-manifest.json').chmod(0o644)
    return manifest, encoded, adopt.plan_from_manifest(manifest, encoded, stage)


class AdoptionFixtures(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='nodia-adoption-fixture-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.candidate = self.root / 'candidate'
        self.manifest, self.encoded, self.plan = fixture_source(self.candidate)

    def test_copy_preserves_candidate_bytes_links_modes_and_single_file_links(self):
        target = self.root / 'release'
        previous = os.umask(0o077)
        try:
            adopt.copy_verified_release(self.candidate, target, self.plan, stage, require_root=False)
        finally:
            os.umask(previous)
        for path in (self.candidate, target):
            stage.verify_tree(path, self.plan, require_root=False)
            self.assertEqual((path / 'nested/main.js').stat().st_nlink, 1)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o755)
            self.assertEqual(os.readlink(path / 'entry'), 'nested/main.js')
        self.assertNotEqual((self.candidate / 'nested/main.js').stat().st_ino, (target / 'nested/main.js').stat().st_ino)
        self.assertEqual((self.candidate / 'release-manifest.json').read_bytes(), self.encoded)

    def test_existing_target_current_and_partial_copy_are_preserved_without_overwrite(self):
        target = self.root / 'release'
        target.mkdir()
        sentinel = target / 'sentinel'
        sentinel.write_text('preserve')
        with self.assertRaisesRegex(ValueError, 'target_exists'):
            adopt.copy_verified_release(self.candidate, target, self.plan, stage, require_root=False)
        self.assertEqual(sentinel.read_text(), 'preserve')
        current = self.root / 'current'
        os.symlink(self.candidate, current)
        with self.assertRaisesRegex(ValueError, 'current_exists'):
            adopt.create_current_exclusive(target, current)
        self.assertEqual(current.resolve(), self.candidate)
        partial = self.root / 'partial'
        def failed_copy(source, destination, **kwargs):
            destination.mkdir(mode=0o700)
            (destination / 'partial.json').write_text('preserve partial')
            raise OSError('synthetic interrupted copy')
        with patch.object(adopt.shutil, 'copytree', failed_copy), self.assertRaises(OSError):
            adopt.copy_verified_release(self.candidate, partial, self.plan, stage, require_root=False)
        self.assertTrue((partial / 'partial.json').exists())
        self.assertTrue(self.candidate.exists())

    def test_current_is_created_exclusively_only_after_verified_copy(self):
        target, current = self.root / 'release', self.root / 'current'
        adopt.copy_verified_release(self.candidate, target, self.plan, stage, require_root=False)
        adopt.create_current_exclusive(target, current)
        self.assertEqual(os.readlink(current), str(target))
        self.assertEqual(current.resolve(), target)
        with self.assertRaisesRegex(ValueError, 'current_exists'):
            adopt.create_current_exclusive(target, current)

    def test_plan_closure_rejects_conflicts_escaping_links_and_manifest_byte_changes(self):
        for mutate in (lambda value: value['files'].append(copy.deepcopy(value['files'][0])),
                       lambda value: value['files'][0].update(target='../outside', sha256=sha(b'../outside')),
                       lambda value: value['files'][1].update(path='entry/main.js')):
            changed = copy.deepcopy(self.manifest); mutate(changed)
            changed['package_tree_sha256'] = sha(json.dumps(changed['files'], separators=(',', ':')).encode())
            with self.assertRaises((ValueError, stage.Rejected)):
                adopt.plan_from_manifest(changed, json.dumps(changed).encode(), stage)
        with self.assertRaisesRegex(ValueError, 'manifest_bytes_mismatch'):
            adopt.plan_from_manifest(self.manifest, b'{}', stage)
        (self.candidate / 'nested/main.js').write_text('changed immutable source')
        with self.assertRaisesRegex(stage.Rejected, 'hash_mismatch'):
            adopt.copy_verified_release(self.candidate, self.root / 'release', self.plan, stage, require_root=False)
        self.assertFalse((self.root / 'release').exists())

    def test_marker_is_creation_exclusive_and_exact_modes_survive_restrictive_umask(self):
        previous = os.umask(0o077)
        try:
            for name, mode in [('private.json', 0o600), ('public.json', 0o644)]:
                path = self.root / name
                adopt.write_receipt(path, {'phase': 'copying_release'}, None, exclusive=True, mode=mode)
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), mode)
                with self.assertRaises(FileExistsError):
                    adopt.write_receipt(path, {'phase': 'changed'}, None, exclusive=True, mode=mode)
                self.assertEqual(json.loads(path.read_bytes()), {'phase': 'copying_release'})
        finally:
            os.umask(previous)

    def test_receipts_must_bind_completed_database_backup_and_same_archive(self):
        result = {'status': 'verified', 'source_sha': self.manifest['source_sha'], 'release_id': self.manifest['release_id'],
                  'migrations_verified': 45, 'entity_tables_verified': 68, 'users': 1, 'core_assignments': 4,
                  'provider_credentials': 0, 'client_tls_authorized': True, 'postcheck_read_only': True,
                  'application_started': False, 'worker_started': False}
        installed = {'phase': 'complete', 'source_sha': self.manifest['source_sha'], 'release_id': self.manifest['release_id'],
                     'archive_sha256': 'a' * 64, 'result': result}
        configured = {'phase': 'complete', 'configured': True, 'source_sha': self.manifest['source_sha'],
                      'tree_sha256': self.manifest['package_tree_sha256'], 'release_id': self.manifest['release_id'],
                      'postgres_client_major': 16, 'configuration_owner': 900, 'configuration_mode': '0600',
                      'public_key_owner': 900, 'public_key_mode': '0400', 'application_started': False, 'worker_started': False,
                      'backup_requested': False, 'remote_calls_requested': False, 'key_id': 'b' * 64,
                      'custody': {'format': 'NODCFG01', 'purpose': 'nodia_configuration_custody', 'plaintext_exported': False,
                                  'postgres_dump': False, 'cipher_sha256': 'c' * 64, 'key_id': 'b' * 64}}
        stage_receipt = {'archive_sha256': 'a' * 64}
        adopt.validate_receipts(installed, installed, configured, configured, self.manifest, stage_receipt)
        for change in ({'phase': 'preparing'}, {'tree_sha256': 'd' * 64}, {'postgres_client_major': 18},
                       {'application_started': True}, {'configured': False}):
            modified = {**configured, **change}
            with self.assertRaises(ValueError):
                adopt.validate_receipts(installed, installed, modified, modified, self.manifest, stage_receipt)
        with self.assertRaisesRegex(ValueError, 'receipts_disagree'):
            adopt.validate_receipts(installed, installed, configured, {**configured, 'key_id': 'd' * 64}, self.manifest, stage_receipt)
        with self.assertRaisesRegex(ValueError, 'installation_required'):
            adopt.validate_receipts(installed, installed, configured, configured, self.manifest, {'archive_sha256': 'd' * 64})


@unittest.skipUnless(os.geteuid() == 0 and os.environ.get('NODIA_ADOPTION_ROOT_FIXTURE') == '1',
                     'Explicit local root fixture only; never invokes main or production paths')
class RootFilesystemFixture(unittest.TestCase):
    setUp = AdoptionFixtures.setUp

    def test_root_owned_copy_and_empty_root_lock_are_validated_by_real_stage(self):
        target = self.root / 'root-release'
        adopt.copy_verified_release(self.candidate, target, self.plan, stage)
        stage.verify_tree(target, self.plan)
        lock = self.root / 'empty.lock'
        descriptor = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            self.assertEqual(os.fstat(descriptor).st_size, 0)
            adopt.validate_lock(descriptor)
            os.fchmod(descriptor, 0o644)
            with self.assertRaisesRegex(ValueError, 'unsafe_installation_lock'):
                adopt.validate_lock(descriptor)
        finally:
            os.close(descriptor)


if __name__ == '__main__':
    unittest.main()
