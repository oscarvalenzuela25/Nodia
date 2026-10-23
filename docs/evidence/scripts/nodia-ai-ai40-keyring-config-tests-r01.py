"""Offline AI-40 public keyring transport admission; no account/service/network calls."""
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

if sys.platform == 'win32':
    sys.modules.setdefault('fcntl', types.ModuleType('fcntl'))
    sys.modules.setdefault('pwd', types.ModuleType('pwd'))
source = Path(__file__).with_name('nodia-ai-ai40-keyring-config-r01.py')
spec = importlib.util.spec_from_file_location('ai40_keyring_config', source)
d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)


class PublicKeyringTransport(unittest.TestCase):
    values = {'DBUS_SESSION_BUS_ADDRESS': 'unix:path=/run/user/10000/bus', 'XDG_RUNTIME_DIR': '/run/user/10000'}

    def transport(self, change=None, socket=True, owner=10000, directory_owner=10000):
        values = dict(self.values); values.update(change or {})
        def metadata(path):
            if path.name == 'bus':
                return types.SimpleNamespace(st_mode=(stat.S_IFSOCK if socket else stat.S_IFREG) | 0o660, st_uid=owner)
            return types.SimpleNamespace(st_mode=stat.S_IFDIR | 0o700, st_uid=directory_owner)
        with patch.object(Path, 'lstat', metadata), patch.object(Path, 'resolve', lambda path: path):
            return d.validated_transport(values, 10000)

    def test_public_bus_and_xdg_resolve_to_actual_owned_socket(self):
        self.assertEqual(self.transport(), self.values)

    def test_empty_regular_bus_descriptor_is_never_a_socket(self):
        with self.assertRaisesRegex(ValueError, 'keyring_bus_socket_invalid'):
            self.transport(socket=False)

    def test_foreign_socket_and_runtime_owners_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'keyring_bus_socket_invalid'):
            self.transport(owner=10001)
        with self.assertRaisesRegex(ValueError, 'keyring_runtime_directory_invalid'):
            self.transport(directory_owner=10001)

    def test_wrong_old_transport_and_unrecognized_environment_keys_are_rejected(self):
        for change in ({'DBUS_SESSION_BUS_ADDRESS': 'unix:path=/run/nodia-runtime/bus'}, {'XDG_RUNTIME_DIR': '/tmp/foreign'}, {'AUTH_TOKEN': 'synthetic secret'}):
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, 'keyring_transport_environment_invalid'):
                self.transport(change)

    def test_environment_reads_emit_only_two_public_transport_fields(self):
        raw = b'PRIVATE_SYNTHETIC=not-exported\0DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/10000/bus\0XDG_RUNTIME_DIR=/run/user/10000\0'
        with patch.object(Path, 'read_bytes', return_value=raw):
            result = d.public_env(829)
        self.assertEqual(result, self.values)
        self.assertNotIn('PRIVATE_SYNTHETIC', json.dumps(result))

    def test_duplicate_public_environment_values_are_not_guessed(self):
        with patch.object(Path, 'read_bytes', return_value=b'XDG_RUNTIME_DIR=/run/user/10000\0XDG_RUNTIME_DIR=/tmp/other\0'), self.assertRaisesRegex(ValueError, 'duplicate_public_environment_key'):
            d.public_env(829)

    def test_payload_sets_only_two_public_variables_in_two_owned_dropins(self):
        self.assertEqual(d.dropin_payload(self.values), b'[Service]\nEnvironment="DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/10000/bus"\nEnvironment="XDG_RUNTIME_DIR=/run/user/10000"\n')
        self.assertEqual([path.name for path in d.DROPINS], ['zz-ai40-codex-keyring.conf', 'zz-ai40-codex-keyring.conf'])
        self.assertEqual(len(d.DROPINS), 2)

    def test_payload_refuses_systemd_injection_and_mismatched_socket_user(self):
        for values in ({**self.values, 'XDG_RUNTIME_DIR': '/run/user/10000\nExecStart=evil'}, {**self.values, 'DBUS_SESSION_BUS_ADDRESS': 'unix:path=/run/user/10001/bus'}):
            with self.subTest(values=values), self.assertRaisesRegex(ValueError, 'dropin_environment_invalid'):
                d.dropin_payload(values)

    def test_base_driver_requires_exact_frozen_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'fake.py'; path.write_bytes(b'raise Exception("must not import")')
            with self.assertRaisesRegex(ValueError, 'base_driver_pin_mismatch'):
                d.load_base(path)

    def test_quiet_order_closes_api_then_worker_and_checks_native_before_writes(self):
        calls = []
        a = types.SimpleNamespace(checked=lambda argv, **_: calls.append(argv), stopped=lambda _: True, wait_quiet=lambda *_args, **_kwargs: 'drained')
        base = types.SimpleNamespace(validated_quiet=lambda value: calls.append(('quiet', value)) or value, codex_barrier=lambda *_: calls.append(('codex', 'zero')))
        result = d.stop_consumers(base, a, {'quiet': lambda: 'stopped'})
        self.assertEqual(result, 'drained')
        self.assertEqual(calls, [['systemctl', 'stop', 'nodia-api'], ('quiet', 'drained'), ['systemctl', 'stop', 'nodia-ai-worker'], ('quiet', 'stopped'), ('codex', 'zero')])

    def test_sql_unknown_leaves_worker_draining_without_start_or_force(self):
        calls = []
        a = types.SimpleNamespace(checked=lambda argv, **_: calls.append(argv), stopped=lambda _: True, wait_quiet=lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError('consumer_work_not_drained')))
        with self.assertRaisesRegex(ValueError, 'consumer_work_not_drained'):
            d.stop_consumers(types.SimpleNamespace(validated_quiet=lambda value: value), a, {})
        self.assertEqual(calls, [['systemctl', 'stop', 'nodia-api']])

    def test_native_pending_prevents_dropin_transition_after_both_stops(self):
        calls = []
        a = types.SimpleNamespace(checked=lambda argv, **_: calls.append(argv), stopped=lambda _: True, wait_quiet=lambda *_args, **_kwargs: {})
        base = types.SimpleNamespace(validated_quiet=lambda value: value, codex_barrier=lambda *_: (_ for _ in ()).throw(ValueError('codex_pending_do_not_downgrade_or_stop')))
        with self.assertRaisesRegex(ValueError, 'codex_pending_do_not_downgrade_or_stop'):
            d.stop_consumers(base, a, {'quiet': lambda: {}})
        self.assertFalse(any(argv[:2] == ['systemctl', 'start'] for argv in calls))



    def test_status_transport_retries_only_bounded_reads_and_records_no_raw_errors(self):
        events, sleeps, calls = [], [], []
        outcomes = [ValueError('operator_command_failed'), subprocess.TimeoutExpired('private synthetic arguments', 20), {'valid': 'fixture response'}]
        def original(command):
            calls.append(command); result = outcomes.pop(0)
            if isinstance(result, Exception): raise result
            return result
        wrapped = d.StatusReadJournal(original, events, sleep=sleeps.append)
        self.assertEqual(wrapped('status'), {'valid': 'fixture response'})
        self.assertEqual(calls, ['status', 'status', 'status'])
        self.assertEqual(sleeps, [0.25, 0.5])
        self.assertEqual([event['outcome'] for event in events], ['command_failed', 'timeout', 'ok'])
        self.assertNotIn('private synthetic', json.dumps(events))

    def test_status_exhaustion_stops_after_three_attempts_without_false_success(self):
        events, calls = [], []
        def original(command):
            calls.append(command); raise ValueError('operator_command_failed')
        with self.assertRaisesRegex(ValueError, 'operator_command_failed'):
            d.StatusReadJournal(original, events, sleep=lambda _: None)('status')
        self.assertEqual(calls, ['status'] * 3)
        self.assertEqual(len(events), 3)
        self.assertFalse(any(event['outcome'] == 'ok' for event in events))

    def test_journal_mutation_never_retries_even_for_same_transport_failure(self):
        for command in ('bootstrap', 'close', 'delete', 'PUT', 'generation'):
            calls, events = [], []
            def original(value):
                calls.append(value); raise ValueError('operator_command_failed')
            with self.subTest(command=command), self.assertRaisesRegex(ValueError, 'operator_command_failed'):
                d.StatusReadJournal(original, events, sleep=lambda _: self.fail('mutation slept'))(command)
            self.assertEqual(calls, [command]); self.assertEqual(events, [])

    def test_status_validation_json_or_business_failure_is_not_retried(self):
        errors = [ValueError('journal_status_invalid'), ValueError('journal_not_ready'), json.JSONDecodeError('invalid synthetic JSON', '', 0), RuntimeError('private synthetic error')]
        for error in errors:
            calls, events = [], []
            def original(value):
                calls.append(value); raise error
            with self.subTest(error=type(error).__name__), self.assertRaises(type(error)):
                d.StatusReadJournal(original, events, sleep=lambda _: self.fail('validation slept'))('status')
            self.assertEqual(calls, ['status']); self.assertEqual(len(events), 1)
            self.assertEqual(events[0]['outcome'], 'validation_or_other_error')
            self.assertNotIn(str(error), json.dumps(events))

    def test_original_response_is_returned_without_fabricating_or_normalizing_values(self):
        response = {'unconfirmed': 1, 'coverage_closed_at': 'fixture invalid business state'}
        calls, events = [], []
        def original(command): calls.append(command); return response
        wrapped = d.StatusReadJournal(original, events, sleep=lambda _: self.fail('successful read slept'))
        self.assertIs(wrapped('status'), response)
        self.assertEqual(calls, ['status'])
        self.assertEqual(events, [{'call': 1, 'attempt': 1, 'outcome': 'ok'}])


if __name__ == '__main__':
    unittest.main()
