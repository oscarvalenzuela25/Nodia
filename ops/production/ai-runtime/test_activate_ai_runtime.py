"""Actual flock/filesystem regression in an account-free root Linux fixture."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ACTIVATE = load('activate', 'activate-ai-runtime.py')
SAFE = load('safe', 'codex-provision.py')


class SharedOperationLock(unittest.TestCase):
    def test_first_operation_claims_lock_and_refuses_a_concurrent_holder(self):
        with tempfile.TemporaryDirectory(prefix='nodia-lock-qa-', dir='/opt') as directory:
            path = Path(directory) / 'installation.lock'
            first = ACTIVATE.backend_operation_lock(SAFE, path)
            try:
                self.assertTrue(path.exists())
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
                self.assertEqual(path.read_bytes(), b'')
                with self.assertRaises(BlockingIOError):
                    ACTIVATE.backend_operation_lock(SAFE, path)
            finally:
                os.close(first)
            second = ACTIVATE.backend_operation_lock(SAFE, path)
            os.close(second)

    def test_existing_unsafe_lock_is_preserved_and_rejected(self):
        with tempfile.TemporaryDirectory(prefix='nodia-lock-qa-', dir='/opt') as directory:
            path = Path(directory) / 'installation.lock'
            path.write_bytes(b'do not replace')
            path.chmod(0o644)
            with self.assertRaises(RuntimeError):
                ACTIVATE.backend_operation_lock(SAFE, path)
            self.assertEqual(path.read_bytes(), b'do not replace')


if __name__ == '__main__':
    unittest.main()
