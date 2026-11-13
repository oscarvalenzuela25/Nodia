"""Diagnostic redaction and bounded read-only operation inventory."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('inspect_operation', Path(__file__).resolve().parents[1] / 'inspect-backend-operation.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RedactionTests(unittest.TestCase):
    def test_only_bounded_public_codes_are_exposed(self):
        secret = 'SYNTHETIC_PRIVATE_VALUE_NOT_FOR_OUTPUT'
        raw = (json.dumps({'status': 'failed', 'error_code': 'database_update_action_failed',
                           'database_sqlstate': '42501', 'password': secret, 'message': secret,
                           'checks': {'postgres': 'failed', 'private': secret}}) + '\n' +
               'private connection string ' + secret + ' ENOTFOUND\n').encode()
        result = module.diagnostic(raw)
        self.assertNotIn(secret, json.dumps(result))
        self.assertEqual(result['hints'], ['ENOTFOUND'])
        self.assertEqual(result['records'], [{'status': 'failed', 'error_code': 'database_update_action_failed',
                                             'database_sqlstate': '42501', 'checks': {'postgres': 'failed'}}])

    def test_unsafe_types_and_noncode_values_are_not_returned(self):
        self.assertEqual(module.codes({'error_code': 'postgresql://private', 'effects_started': 'false',
                                       'database_sqlstate': 'secret!', 'status': ['failed']}), {})
        self.assertEqual(module.codes([]), {})

    def test_raw_traceback_is_not_exposed_and_records_are_bounded(self):
        raw = ('Traceback private/path/secret\n' + '\n'.join(json.dumps({'status': 'failed'}) for _ in range(250))).encode()
        result = module.diagnostic(raw)
        self.assertEqual(len(result['records']), 20)
        self.assertNotIn('private/path', json.dumps(result))


@unittest.skipUnless(os.name == 'posix' and os.geteuid() == 0, 'requires disposable Linux root ownership')
class ProtectedAttemptTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir='/root')
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name)
        self.operation = 'a' * 32
        self.attempt = self.state / 'attempts' / self.operation
        self.attempt.mkdir(parents=True, mode=0o700)
        self.state_file = self.attempt / 'state.json'
        self.state_file.write_text(json.dumps({'operation_id': self.operation, 'phase': 'failed', 'effects_started': False}))
        self.state_file.chmod(0o600)
        self.context = patch.object(module, 'STATE', self.state)
        self.context.start()
        self.addCleanup(self.context.stop)

    def test_reads_codes_without_changing_any_file_or_reading_archive(self):
        log = self.attempt / ('b' * 32 + '.json')
        log.write_text('{"status":"failed","error_code":"synthetic_rejection"}\n')
        log.chmod(0o600)
        (self.attempt / 'large-private.tar.gz').write_bytes(b'not inspected')
        before = {file.name: (file.read_bytes(), file.stat().st_mtime_ns) for file in self.attempt.iterdir()}
        value = module.inspect(self.operation)
        self.assertEqual(value['attempt'], {'phase': 'failed', 'effects_started': False})
        self.assertEqual(list(value['diagnostics']), [log.name])
        self.assertFalse(value['mutations_requested'])
        self.assertEqual(before, {file.name: (file.read_bytes(), file.stat().st_mtime_ns) for file in self.attempt.iterdir()})

    def test_symlink_and_oversized_logs_are_rejected(self):
        log = self.attempt / 'last-command.log'
        log.symlink_to(self.state_file)
        with self.assertRaisesRegex(ValueError, 'unsafe_diagnostic_path'):
            module.inspect(self.operation)
        log.unlink()
        log.write_bytes(b'x' * (module.LIMIT + 1))
        log.chmod(0o600)
        with self.assertRaisesRegex(ValueError, 'diagnostic_file_too_large'):
            module.inspect(self.operation)

    def test_invalid_identity_or_writable_file_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'invalid_operation_id'):
            module.inspect('../x')
        self.state_file.chmod(0o666)
        with self.assertRaisesRegex(ValueError, 'unsafe_diagnostic_path'):
            module.inspect(self.operation)


if __name__ == '__main__':
    unittest.main()
