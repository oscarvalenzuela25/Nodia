"""Filesystem-only regression fixtures; no root/systemd/network/database operations."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / 'stage-backend-candidate.py'
SPEC = importlib.util.spec_from_file_location('stage_backend_candidate', MODULE)
stage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(stage)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def archive_fixture(*, links=None, extras=None, wrong_payload=False, git_release=False, change_manifest=None):
    payload = b'{}'
    files = [{'path': 'package.json', 'type': 'file', 'bytes': len(payload), 'mode': '0644', 'sha256': sha(payload)}]
    for name, target in (links or {}).items():
        files.append({'path': name, 'type': 'symlink', 'target': target, 'sha256': sha(target.encode())})
    tree = sha(json.dumps(files, separators=(',', ':')).encode())
    manifest = {key: {} for key in stage.MANIFEST_KEYS}
    manifest.update(schema_version=1, release_id=f'backend-candidate-{"a" * 12}-{tree[:12]}',
                    source_sha='a' * 40, package_tree_sha256=tree, files=files,
                    source_provenance='workspace_documentation_candidate', deployment_eligible=False,
                    source={'source_provenance': 'workspace_documentation_candidate', 'deployment_eligible': False, 'source_sha': 'a' * 40},
                    checks={'status': 'passed', 'source_sha': 'a' * 40})
    if git_release:
        manifest.update(release_id=f'backend-{"a" * 12}-{tree[:12]}', source_provenance='git_archive', deployment_eligible=True,
                        source={'source_sha': 'a' * 40, 'archive_sha256': 'b' * 64,
                                'source_manifest_sha256': 'c' * 64, 'snapshot_tree_sha256': 'd' * 64,
                                'files_verified': 1, 'source_provenance': 'git_archive',
                                'deployment_eligible': True, 'overlay': []})
    if change_manifest:
        change_manifest(manifest)
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as archive:
        root = tarfile.TarInfo('./')
        root.type, root.mode = tarfile.DIRTYPE, 0o755
        archive.addfile(root)
        for name, content in [('package.json', b'[]' if wrong_payload else payload),
                              ('release-manifest.json', json.dumps(manifest).encode())]:
            member = tarfile.TarInfo('./' + name)
            member.size, member.mode = len(content), 0o644
            archive.addfile(member, io.BytesIO(content))
        for name, target in (links or {}).items():
            member = tarfile.TarInfo('./' + name)
            member.type, member.linkname, member.mode = tarfile.SYMTYPE, target, 0o777
            archive.addfile(member)
        for member in extras or []:
            archive.addfile(member, io.BytesIO(b'x' * member.size) if member.isreg() else None)
    output.seek(0)
    return output


class StagingFixtures(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='nodia-stage-fixture-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def plan(self, *, allow_git_release=False, **kwargs):
        archive = tarfile.open(fileobj=archive_fixture(**kwargs), mode='r:gz')
        self.addCleanup(archive.close)
        return archive, stage.read_plan(archive, allow_git_release=allow_git_release)

    def probe_unit(self):
        directory = self.root / 'units'
        directory.mkdir()
        previous = stage.UNIT_DIRECTORY
        stage.UNIT_DIRECTORY = directory
        self.addCleanup(setattr, stage, 'UNIT_DIRECTORY', previous)
        unit = 'nodia-backend-check-' + 'a' * 32 + '.service'
        filename = directory / unit
        filename.write_text('[Service]\nType=oneshot\n')
        return unit, filename

    def test_complete_inventory_extracts_privately_and_detects_later_tampering(self):
        nested = tarfile.TarInfo('./nested')
        nested.type, nested.mode = tarfile.DIRTYPE, 0o755
        archive, plan = self.plan(links={'tool': 'package.json'}, extras=[nested])
        destination = self.root / 'candidate'
        destination.mkdir(mode=0o700)
        previous = os.umask(0o077)
        try:
            stage.extract_verified(archive, plan, destination, root_owner=False)
        finally:
            os.umask(previous)
        self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE((destination / 'nested').stat().st_mode), 0o755)
        self.assertEqual((destination / 'package.json').read_bytes(), b'{}')
        self.assertEqual(os.readlink(destination / 'tool'), 'package.json')
        destination.chmod(0o755)
        stage.verify_tree(destination, plan, require_root=False)
        (destination / 'package.json').write_bytes(b'[]')
        with self.assertRaisesRegex(stage.Rejected, 'candidate_file_hash_mismatch'):
            stage.verify_tree(destination, plan, require_root=False)

    def test_exact_git_release_requires_opt_in_and_still_extracts_only_to_fixture(self):
        with self.assertRaisesRegex(stage.Rejected, 'git_release_opt_in_required'):
            self.plan(git_release=True)
        archive, plan = self.plan(git_release=True, allow_git_release=True)
        self.assertEqual(plan['manifest']['source_provenance'], 'git_archive')
        self.assertIs(plan['manifest']['deployment_eligible'], True)
        destination = self.root / 'isolated-artifact'
        destination.mkdir(mode=0o700)
        stage.extract_verified(archive, plan, destination, root_owner=False)
        destination.chmod(0o755)
        stage.verify_tree(destination, plan, require_root=False)
        self.assertEqual((destination / 'package.json').read_bytes(), b'{}')
        # The flag only controls archive admission; staging keeps the same isolated destination.
        self.assertEqual(stage.CANDIDATES, Path('/opt/nodia/candidates'))

    def test_git_release_rejects_overlay_incomplete_identity_and_crossed_provenance(self):
        changes = [
            lambda value: value['source'].update(overlay=[{'path': 'draft.md'}]),
            lambda value: value['source'].update(source_sha='a' * 12),
            lambda value: value['checks'].update(source_sha='b' * 40),
            lambda value: value['source'].update(source_provenance='workspace_documentation_candidate'),
            lambda value: value['source'].update(deployment_eligible=False),
            lambda value: value.update(deployment_eligible=False),
            lambda value: value.update(release_id=value['release_id'].replace('backend-', 'backend-candidate-')),
            lambda value: value['source'].update(unexpected='forbidden'),
            lambda value: value['source'].pop('source_manifest_sha256'),
            lambda value: value['source'].update(files_verified=True),
            lambda value: value['source'].update(archive_sha256='truncated'),
            lambda value: value.update(unexpected='forbidden'),
        ]
        for change in changes:
            with self.subTest(change=changes.index(change)), self.assertRaises(stage.Rejected):
                self.plan(git_release=True, allow_git_release=True, change_manifest=change)

    def test_candidate_identity_cannot_claim_release_eligibility_even_with_opt_in(self):
        for change in (
            lambda value: value.update(deployment_eligible=True),
            lambda value: value.update(release_id=value['release_id'].replace('backend-candidate-', 'backend-')),
            lambda value: value['source'].update(source_sha='b' * 40),
            lambda value: value['checks'].update(source_sha='b' * 40),
        ):
            with self.assertRaises(stage.Rejected):
                self.plan(allow_git_release=True, change_manifest=change)

    def test_paths_cannot_escape_and_duplicate_normalized_names_are_rejected(self):
        for name in ('../escaped', '/absolute', './a/../../escaped', 'a\\escaped', './package.json'):
            with self.subTest(name=name):
                member = tarfile.TarInfo(name)
                member.size, member.mode = 1, 0o644
                with self.assertRaises(stage.Rejected):
                    self.plan(extras=[member])
        self.assertFalse((self.root / 'escaped').exists())

    def test_hardlinks_special_members_and_unlisted_files_are_rejected(self):
        for kind in (tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.CHRTYPE, tarfile.REGTYPE):
            with self.subTest(kind=kind):
                member = tarfile.TarInfo('./unlisted')
                member.type, member.mode = kind, 0o644
                member.linkname = 'package.json'
                with self.assertRaises(stage.Rejected):
                    self.plan(extras=[member])

    def test_links_cannot_cycle_or_escape_after_resolving_an_earlier_link(self):
        for links in ({'a': 'b', 'b': 'a'}, {'escape': '../outside'},
                      {'alias': '.', 'escape': 'alias/../outside'}, {'missing': 'absent'}):
            with self.subTest(links=links), self.assertRaises(stage.Rejected):
                self.plan(links=links)

    def test_payload_digest_mismatch_fails_before_adoption_and_preserves_other_files(self):
        archive, plan = self.plan(wrong_payload=True)
        destination = self.root / 'candidate'
        destination.mkdir(mode=0o700)
        sentinel = self.root / 'sentinel'
        sentinel.write_text('untouched')
        with self.assertRaisesRegex(stage.Rejected, 'archive_file_hash_mismatch'):
            stage.extract_verified(archive, plan, destination, root_owner=False)
        self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o700)
        self.assertEqual(sentinel.read_text(), 'untouched')
        with self.assertRaisesRegex(stage.Rejected, 'invalid_staging_directory'):
            stage.extract_verified(archive, plan, destination, root_owner=False)

    def test_uploaded_bytes_are_copied_before_parse_and_symlinks_are_rejected(self):
        upload, private = self.root / 'upload', self.root / 'private'
        upload.mkdir()
        private.mkdir(mode=0o700)
        old_upload, old_private = stage.UPLOAD, stage.PRIVATE
        stage.UPLOAD, stage.PRIVATE = upload, private
        self.addCleanup(setattr, stage, 'UPLOAD', old_upload)
        self.addCleanup(setattr, stage, 'PRIVATE', old_private)
        source = upload / 'candidate.tar.gz'
        source.write_bytes(b'original fixture')
        copied = stage.copy_uploaded(source, sha(source.read_bytes()))
        source.write_bytes(b'changed after immutable snapshot')
        self.assertEqual(copied.read_bytes(), b'original fixture')
        self.assertEqual(stat.S_IMODE(copied.stat().st_mode), 0o600)
        os.symlink(source, upload / 'linked.tar.gz')
        with self.assertRaises((stage.Rejected, OSError)):
            stage.copy_uploaded(upload / 'linked.tar.gz', sha(source.read_bytes()))
        with self.assertRaisesRegex(stage.Rejected, 'archive_sha256_mismatch'):
            stage.copy_uploaded(source, 'f' * 64)
        self.assertEqual(source.read_bytes(), b'changed after immutable snapshot')

    def test_probe_output_is_closed_and_cannot_publish_dynamic_errors_or_mutations(self):
        value = {'schema_version': 1, 'status': 'verified', 'application_started': False,
                 'migrations_executed': False, 'mutations_requested': False,
                 'checks': {'local_configuration': 'passed',
                            'postgres': {'status': 'passed', 'database_matched': True,
                                         'server_version_num': 160014, 'transaction_read_only': True,
                                         'client_tls_authorized': True, 'client_tls_protocol': 'TLSv1.3', 'backend_tls': True},
                            'redis': {'status': 'passed', 'authenticated_ping': True},
                            'r2': {'status': 'passed', 'head_bucket': True}}}
        self.assertEqual(stage.validate_probe_result(json.dumps(value).encode()), value)
        for changed in (value | {'password': 'synthetic-fixture'}, value | {'application_started': True}):
            with self.assertRaises(stage.Rejected):
                stage.validate_probe_result(json.dumps(changed).encode())
        failed = value | {'status': 'failed', 'failed_component': 'configuration', 'error_code': 'configuration_invalid',
                          'checks': {'local_configuration': 'not_run', 'postgres': {'status': 'not_run'},
                                     'redis': {'status': 'not_run'}, 'r2': {'status': 'not_run'}}}
        self.assertEqual(stage.validate_probe_result(json.dumps(failed).encode()), failed)
        with self.assertRaises(stage.Rejected):
            stage.validate_probe_result(json.dumps(failed | {'error_code': 'dynamic-synthetic-secret'}).encode())

    def test_failure_cleanup_removes_only_the_fresh_recorded_inode_and_preserves_candidates(self):
        candidates = self.root / 'candidates'
        candidates.mkdir()
        previous = stage.CANDIDATES
        stage.CANDIDATES = candidates
        self.addCleanup(setattr, stage, 'CANDIDATES', previous)
        existing = candidates / 'existing-candidate'
        existing.mkdir()
        (existing / 'sentinel').write_text('untouched')
        fresh = Path(tempfile.mkdtemp(prefix='.candidate-stage-', dir=candidates))
        info = fresh.lstat()
        identity = (info.st_dev, info.st_ino, info.st_uid)
        (fresh / 'partial-file').write_text('synthetic partial extraction')
        with self.assertRaisesRegex(stage.Rejected, 'unsafe_staging_cleanup'):
            stage.cleanup_staging(fresh, (info.st_dev, info.st_ino + 1, info.st_uid), root_owner=False)
        self.assertTrue(fresh.exists())
        stage.cleanup_staging(fresh, identity, root_owner=False)
        self.assertFalse(fresh.exists())
        self.assertEqual((existing / 'sentinel').read_text(), 'untouched')
        with self.assertRaisesRegex(stage.Rejected, 'unsafe_staging_cleanup'):
            stage.cleanup_staging(existing, (existing.stat().st_dev, existing.stat().st_ino, existing.stat().st_uid), root_owner=False)
        self.assertEqual((existing / 'sentinel').read_text(), 'untouched')

    def test_already_unloaded_unit_cleanup_uses_postconditions_not_reset_failed_returncode(self):
        unit, filename = self.probe_unit()
        calls = []

        def runner(command, **_):
            calls.append(command)
            if command[1] == 'show':
                return SimpleNamespace(returncode=0, stdout='LoadState=not-found\nActiveState=inactive\nMainPID=0\nFragmentPath=\n')
            return SimpleNamespace(returncode=1 if command[1] in ('stop', 'reset-failed') else 0, stdout='')

        stage.cleanup_probe_unit(unit, filename, runner=runner)
        self.assertFalse(filename.exists())
        self.assertEqual([call[1] for call in calls], ['stop', 'reset-failed', 'daemon-reload', 'show'])

    def test_cleanup_rejects_a_unit_that_remains_active(self):
        unit, filename = self.probe_unit()

        def runner(command, **_):
            if command[1] == 'show':
                return SimpleNamespace(returncode=0, stdout=f'LoadState=loaded\nActiveState=active\nMainPID=42\nFragmentPath={filename}\n')
            return SimpleNamespace(returncode=1 if command[1] == 'stop' else 0, stdout='')

        with self.assertRaisesRegex(stage.Rejected, 'probe_unit_cleanup_failed'):
            stage.cleanup_probe_unit(unit, filename, runner=runner)

    def test_cleanup_timeout_is_not_hidden_by_an_eventually_absent_unit(self):
        unit, filename = self.probe_unit()

        def runner(command, **_):
            if command[1] == 'stop':
                raise subprocess.TimeoutExpired(command, 20)
            if command[1] == 'show':
                return SimpleNamespace(returncode=0, stdout='LoadState=not-found\nActiveState=inactive\nMainPID=0\nFragmentPath=\n')
            return SimpleNamespace(returncode=0, stdout='')

        with self.assertRaisesRegex(stage.Rejected, 'probe_unit_cleanup_failed'):
            stage.cleanup_probe_unit(unit, filename, runner=runner)

    def test_cleanup_rejects_a_unit_file_that_cannot_be_removed(self):
        unit, filename = self.probe_unit()

        def runner(command, **_):
            if command[1] == 'show':
                return SimpleNamespace(returncode=0, stdout='LoadState=not-found\nActiveState=inactive\nMainPID=0\nFragmentPath=\n')
            return SimpleNamespace(returncode=0, stdout='')

        with patch.object(Path, 'unlink', side_effect=PermissionError), self.assertRaisesRegex(stage.Rejected, 'probe_unit_cleanup_failed'):
            stage.cleanup_probe_unit(unit, filename, runner=runner)
        self.assertTrue(filename.exists())


if __name__ == '__main__':
    unittest.main()
