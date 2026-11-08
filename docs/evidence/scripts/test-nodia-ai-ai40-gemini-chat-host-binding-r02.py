"""Reuse legacy host-rule regressions; add observed app source permission cases."""
import io
from pathlib import Path
import stat
from types import SimpleNamespace
import unittest
from unittest.mock import patch


here = Path(__file__).parent
scope = {'__name__': 'host_binding_shared_tests', '__file__': str(here / 'test-nodia-ai-ai40-gemini-chat-host-binding-r01.py')}
exec(compile(Path(scope['__file__']).read_bytes(), scope['__file__'], 'exec'), scope)
p = scope['load']('nodia-ai-ai40-gemini-chat-host-binding-r02')
h = scope['load']('attach-nodia-gemini-chat-cgroup-r02')
scope['p'], scope['h'] = p, h


class Buffer(io.BytesIO):
    def fileno(self):
        return 42


class SourcePermissionTests(unittest.TestCase):
    def metadata(self, *, mode=0o664, uid=10001, gid=10001):
        raw = b'explicit synthetic pinned source fixture'
        info = SimpleNamespace(st_mode=stat.S_IFREG | mode, st_uid=uid, st_gid=gid, st_nlink=1, st_size=len(raw))
        return raw, info

    def invoke(self, *, mode=0o664, uid=10001, gid=10001, changed=False, default=False):
        raw, info = self.metadata(mode=mode, uid=uid, gid=gid)
        expected = p.sha(raw)
        with patch.object(p.os, 'open', return_value=42), patch.object(p.os, 'O_NOFOLLOW', 0x20000, create=True), \
                patch.object(p.os, 'fdopen', return_value=Buffer(raw + (b'changed' if changed else b''))), \
                patch.object(p.os, 'fstat', return_value=info), patch.object(p, 'SOURCES', {'native_attempts.py': expected}):
            if default:
                return p.read_file(Path('/fixture/native_attempts.py'), uid=uid)
            return p.read_pinned_source(Path('/fixture/native_attempts.py'), expected)

    def test_observed_0644_and_0664_sources_of_same_service_pass_exact_sha(self):
        self.assertEqual(self.invoke(mode=0o644), self.invoke(mode=0o664))

    def test_foreign_gid_cannot_use_same_uid_group_write_exception(self):
        with self.assertRaisesRegex(RuntimeError, 'source_file_identity_unsafe'):
            self.invoke(gid=10002)

    def test_root_owned_source_cannot_use_exception(self):
        with self.assertRaisesRegex(RuntimeError, 'source_file_identity_unsafe'):
            self.invoke(uid=0, gid=0)

    def test_world_writable_source_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'source_file_identity_unsafe'):
            self.invoke(mode=0o666)

    def test_changed_pinned_source_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'original_native_source_changed'):
            self.invoke(changed=True)

    def test_root_files_keep_general_no_group_write_guard(self):
        with self.assertRaisesRegex(RuntimeError, 'file_identity_unsafe'):
            self.invoke(uid=0, gid=0, default=True)

    def test_native_ledger_keeps_general_no_group_write_guard(self):
        with self.assertRaisesRegex(RuntimeError, 'file_identity_unsafe'):
            self.invoke(default=True)


if __name__ == '__main__':
    suite = unittest.TestSuite()
    for case in (scope['BindingTests'], scope['ClosureTests'], SourcePermissionTests):
        suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(case))
    raise SystemExit(not unittest.TextTestRunner().run(suite).wasSuccessful())
