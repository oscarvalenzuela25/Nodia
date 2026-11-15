"""Real source bundle round trip, no Docker, account, network or installation."""
import importlib.util
import os
from pathlib import Path
import shutil
import unittest
import uuid

BASE = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AiRuntimeBundleTests(unittest.TestCase):
    @unittest.skipUnless(hasattr(os, 'O_NOFOLLOW'), 'bundle input ownership contract requires Linux')
    def test_current_packager_and_installer_accept_the_teacher_operator_and_reject_changed_bytes(self):
        packager = load('teacher_bundle_packager', BASE / 'ai-runtime/package-ai-runtime.py')
        installer = load('teacher_bundle_installer', BASE / 'ai-runtime/prepare-ai-runtime.py')
        workspace = BASE.parents[1]
        output = workspace / '.tmp' / ('teacher-runtime-bundle-' + uuid.uuid4().hex)
        self.addCleanup(lambda: shutil.rmtree(output) if output.is_dir() else None)
        packaged = packager.package(output)
        manifest, payloads = installer.verified_bundle(output, packaged['manifest_sha256'])
        self.assertIn('prepare-teacher-runtime.py', manifest['files'])
        self.assertEqual(payloads['prepare-teacher-runtime.py'], (BASE / 'ai-runtime/prepare-teacher-runtime.py').read_bytes())
        self.assertEqual(payloads['upgrade-teacher-operators.py'], (BASE / 'ai-runtime/upgrade-teacher-operators.py').read_bytes())
        for name in ('prepare-teacher-runtime.py', 'upgrade-teacher-operators.py'):
            operator = output / name
            original = operator.read_bytes()
            operator.write_bytes(original + b'# synthetic changed operator\n')
            with self.assertRaisesRegex(RuntimeError, 'bundle_digest_mismatch'):
                installer.verified_bundle(output, packaged['manifest_sha256'])
            operator.write_bytes(original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
