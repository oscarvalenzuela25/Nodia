"""Private recovery metadata uses bounded handles and rejects aliasing."""
import test_support
import os
from pathlib import Path
import tempfile
import unittest

from private_state_json import read_private_json


class PrivateStateJsonTests(unittest.TestCase):
    def setUp(self):
        self.directory = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.file = self.directory / "receipt.json"

    def write(self, raw):
        self.file.write_bytes(raw)
        self.file.chmod(0o600)

    def test_private_regular_object_and_missing_file(self):
        self.assertIsNone(read_private_json(self.directory, self.file.name))
        self.write(b'{"kind":"manual_invoice"}')
        self.assertEqual(read_private_json(self.directory, self.file.name), {"kind": "manual_invoice"})

    def test_duplicate_keys_nonfinite_and_oversized_records_are_not_recovery_proofs(self):
        for raw in (b'{"kind":"foreign","kind":"manual_invoice"}', b'{"count":NaN}', b" " * 4097):
            with self.subTest(raw_length=len(raw)):
                self.write(raw)
                with self.assertRaises(ValueError):
                    read_private_json(self.directory, self.file.name)

    def test_hardlinked_proof_is_rejected(self):
        self.write(b'{"kind":"manual_invoice"}')
        os.link(self.file, self.directory / "alias.json")
        with self.assertRaises(ValueError):
            read_private_json(self.directory, self.file.name)

    @unittest.skipIf(os.name == "nt", "POSIX ownership/mode and no-follow semantics")
    def test_readable_by_other_users_and_symlink_are_rejected(self):
        self.write(b'{"kind":"manual_invoice"}')
        self.file.chmod(0o644)
        with self.assertRaises(ValueError):
            read_private_json(self.directory, self.file.name)
        self.file.chmod(0o600)
        (self.directory / "alias.json").symlink_to(self.file)
        with self.assertRaises(OSError):
            read_private_json(self.directory, "alias.json")
