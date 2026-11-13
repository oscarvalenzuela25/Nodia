"""Input boundary regressions: no root, daemon, network or provider required."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('prepare', Path(__file__).with_name('prepare-ai-runtime.py'))
PREPARE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREPARE)


class BundleBoundary(unittest.TestCase):
    def test_public_code_remains_readable_under_private_setup_umask(self):
        with tempfile.TemporaryDirectory(prefix='nodia-directory-qa-', dir='/opt') as directory:
            previous = os.umask(0o077)
            try:
                public, private = Path(directory) / 'code', Path(directory) / 'state'
                PREPARE.create_root_directory(public, 0o755)
                PREPARE.create_root_directory(private, 0o700)
                self.assertEqual(public.stat().st_mode & 0o777, 0o755)
                self.assertEqual(private.stat().st_mode & 0o777, 0o700)
                PREPARE.create_root_directory(public, 0o755)
            finally:
                os.umask(previous)

    def test_token_is_one_literal_hex_value_not_shell(self):
        token = 'a' * 64
        self.assertEqual(PREPARE.service_token(('GEMINI_SERVICE_TOKEN="' + token + '"\n').encode()), token)
        self.assertEqual(PREPARE.service_token(('GEMINI_SERVICE_TOKEN=' + token + '\n').encode()), token)
        for raw in [b'GEMINI_SERVICE_TOKEN=$(touch /tmp/unsafe)\n', b'GEMINI_SERVICE_TOKEN=\n',
                    ('GEMINI_SERVICE_TOKEN=' + token + '\nGEMINI_SERVICE_TOKEN=' + token).encode()]:
            with self.subTest(raw=raw), self.assertRaises(RuntimeError):
                PREPARE.service_token(raw)

    def archive(self, name, kind=tarfile.REGTYPE):
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode='w') as archive:
            for filename, item_type in [('Dockerfile', tarfile.REGTYPE), ('antigravity-cli.lock.json', tarfile.REGTYPE), (name, kind)]:
                info = tarfile.TarInfo(filename)
                info.type = item_type
                if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                    info.linkname = '/etc/passwd'
                archive.addfile(info)
        output.seek(0)
        return tarfile.open(fileobj=output, mode='r:')

    def test_rejects_traversal_links_and_operational_profile_context(self):
        for name, kind in [('../outside', tarfile.REGTYPE), ('/etc/outside', tarfile.REGTYPE),
                           ('link', tarfile.SYMTYPE), ('hardlink', tarfile.LNKTYPE),
                           ('.env', tarfile.REGTYPE), ('session_state/work.json', tarfile.REGTYPE),
                           ('agentic_profile/token', tarfile.REGTYPE), ('Dockerfile', tarfile.REGTYPE)]:
            with self.subTest(name=name, kind=kind), self.archive(name, kind) as package, self.assertRaisesRegex(RuntimeError, 'native_context_unsafe'):
                PREPARE.archive_members(package)

    def test_accepts_public_source_configuration_examples(self):
        with self.archive('.env.example') as package:
            self.assertEqual(len(PREPARE.archive_members(package)), 3)

    def test_rejects_manifest_digest_before_trusting_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'manifest.json').write_bytes(b'{}')
            with self.assertRaisesRegex(RuntimeError, 'manifest_digest_mismatch'):
                PREPARE.verified_bundle(root, '0' * 64)

    def test_rejects_verified_manifest_with_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = {'../outside': '0' * 64, **{f'file{i}.py': '0' * 64 for i in range(5)}}
            raw = json.dumps({'schema_version': 1, 'source_sha': 'a' * 40, 'files': files}).encode()
            (root / 'manifest.json').write_bytes(raw)
            with self.assertRaisesRegex(RuntimeError, 'manifest_path_invalid'):
                PREPARE.verified_bundle(root, hashlib.sha256(raw).hexdigest())


if __name__ == '__main__':
    unittest.main()
