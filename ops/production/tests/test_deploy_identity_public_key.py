"""Format-level fixtures only; no host account, SSH connection or credentials."""
import base64
import hashlib
import importlib.util
from pathlib import Path
import struct
import unittest

source = Path(__file__).resolve().parents[1] / 'bootstrap-deploy-identity.py'
spec = importlib.util.spec_from_file_location('deploy_identity', source)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class PublicKeyFormatTests(unittest.TestCase):
    def setUp(self):
        # Synthetic wire-format bytes, not a real deployed key.
        self.blob = struct.pack('>I', 11) + b'ssh-ed25519' + struct.pack('>I', 32) + bytes(range(32))
        self.line = b'ssh-ed25519 ' + base64.b64encode(self.blob) + b' synthetic-fixture'

    def test_windows_linux_and_no_terminator_keep_same_authorized_key_and_fingerprint(self):
        expected = helper.public_key(self.line)
        for ending in (b'', b'\n', b'\r\n'):
            with self.subTest(ending=ending):
                self.assertEqual(helper.public_key(self.line + ending), expected)

    def test_parser_does_not_change_original_bytes_or_raw_digest(self):
        raw = self.line + b'\r\n'
        original_digest = hashlib.sha256(raw).hexdigest()
        helper.public_key(raw)
        self.assertTrue(raw.endswith(b'\r\n'))
        self.assertEqual(hashlib.sha256(raw).hexdigest(), original_digest)
        self.assertNotEqual(original_digest, hashlib.sha256(self.line + b'\n').hexdigest())

    def test_extra_lines_embedded_cr_and_lone_cr_are_rejected(self):
        for raw in (self.line + b'\r', self.line + b'\n\n', self.line + b'\r\n\r\n',
                    self.line + b'\n' + self.line, self.line.replace(b' ', b'\r', 1),
                    self.line + b'\r\ncommand=unsafe'):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    helper.public_key(raw)

    def test_key_options_wrong_algorithm_invalid_wire_blob_and_oversize_are_rejected(self):
        for raw in (b'command="sh" ' + self.line, self.line.replace(b'ssh-ed25519', b'ssh-rsa', 1),
                    b'ssh-ed25519 ' + base64.b64encode(b'wrong-blob'), b'x' * 1024):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    helper.public_key(raw)


if __name__ == '__main__':
    unittest.main()
