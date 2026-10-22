"""Filesystem-only observer controls. Optional argv: observer.py parser.py."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from uuid import uuid4

root = Path(__file__).resolve().parents[3] if len(sys.argv) < 3 else None
helper = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).with_name('nodia-ai-ai36-c05-live-owned-log-observer-v2.py')
parser = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else root / 'nodia-gemini-microservice/native_cli_diagnostics.py'
spec = importlib.util.spec_from_file_location('owned_observer_control', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OwnedObserverTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory(prefix='nodia-observer-offline-'))
        self.base = Path(self.temp)
        self.home = self.base / 'profile'
        self.state = self.base / 'state'
        self.home.mkdir()
        self.state.mkdir()
        attempt = str(uuid4())
        self.config = {'schema_version': 1, 'attempt_id': attempt, 'operation_ref': attempt,
            'resource_key': 'gemini-profile:' + 'a' * 64, 'session_generation': 'b' * 32,
            'marker_path': str(self.state / ('a' * 64 + '.unknown')),
            'profile_home': str(self.home), 'parser_path': str(parser),
            'parser_sha256': module.PARSER_SHA256, 'maximum_seconds': 5,
            'expected_policy': {'tools': [{'name': 'fixture_read', 'description': 'Synthetic only',
                'input_schema': {'type': 'object', 'additionalProperties': False}}],
                'rpc_budget': 128, 'tool_budget': 12, 'timeout_seconds': 5,
                'cli_json_string_arguments': True, 'documents': [],
                'context_budget': {'schema_version': 1, 'initial_utf8_bytes': 100, 'maximum_utf8_bytes': 262144}}}
        self.observer = module.Observer(self.config)

    def owned(self, name='nodia-mcp-fixture'):
        marker = {key: self.config[key] for key in ('attempt_id', 'resource_key', 'session_generation', 'operation_ref')}
        Path(self.config['marker_path']).write_text(json.dumps(marker), encoding='utf-8')
        directory = self.home / name
        (directory / 'bridge').mkdir(parents=True)
        (directory / 'bridge/manifest.json').write_text(json.dumps(self.config['expected_policy']), encoding='utf-8')
        (directory / 'cli.log').write_text('private-synthetic-content\nHTTP status 503 RESOURCE_EXHAUSTED\n', encoding='utf-8')
        return directory

    def test_owned_log_uses_pinned_fd_and_exports_only_closed_structure(self):
        self.observer.bootstrap()
        self.owned()
        self.observer.sample()
        result = self.observer.result('requested_stop')
        self.assertEqual(result['samples'][0]['http_statuses'], [503])
        self.assertEqual(result['samples'][0]['provider_error_indicators'], ['RESOURCE_EXHAUSTED'])
        self.assertEqual(set(result['samples'][0]), {'observed_at_utc', 'elapsed_ms', 'file_size_at_sample',
            'bytes_read', 'byte_window_truncated', 'interpretation', 'transport_indicators',
            'provider_error_indicators', 'http_statuses'})
        self.assertNotIn(self.temp, json.dumps(result))
        self.assertNotIn('private-synthetic-content', json.dumps(result))

    def test_baseline_and_ambiguous_directory_are_rejected(self):
        (self.home / 'nodia-mcp-old').mkdir()
        with self.assertRaisesRegex(module.GuardError, 'baseline_not_empty'):
            self.observer.bootstrap()
        (self.home / 'nodia-mcp-old').rmdir()
        self.observer.bootstrap()
        self.owned()
        (self.home / 'nodia-mcp-other').mkdir()
        with self.assertRaisesRegex(module.GuardError, 'ambiguous_directory'):
            self.observer.sample()

    def test_stale_and_foreign_marker_cannot_authorize_a_read(self):
        self.observer.bootstrap()
        self.owned()
        self.observer.started_ns += 10**12
        with self.assertRaisesRegex(module.GuardError, 'stale_marker'):
            self.observer.sample()
        self.observer.started_ns = 0
        Path(self.config['marker_path']).write_text(json.dumps({**self.observer.expected_marker, 'attempt_id': str(uuid4())}))
        with self.assertRaisesRegex(module.GuardError, 'foreign_marker'):
            self.observer.sample()
        self.assertEqual(self.observer.samples, [])

    def test_foreign_owner_and_additional_owner_are_rejected(self):
        self.observer.bootstrap()
        self.owned()
        self.observer.owner += 1
        with self.assertRaisesRegex(module.GuardError, 'foreign_owner'):
            self.observer.sample()
        self.observer.owner -= 1
        (self.state / 'other.unknown').write_text('private-foreign-marker')
        with self.assertRaisesRegex(module.GuardError, 'foreign_active_owner'):
            self.observer.sample()

    def test_exact_policy_and_marker_field_sets_are_required(self):
        self.observer.bootstrap()
        directory = self.owned()
        manifest = directory / 'bridge/manifest.json'
        manifest.write_text(json.dumps({**self.config['expected_policy'], 'tool_budget': 13}))
        with self.assertRaisesRegex(module.GuardError, 'policy_mismatch'):
            self.observer.sample()
        manifest.write_text(json.dumps(self.config['expected_policy']))
        Path(self.config['marker_path']).write_text(json.dumps({**self.observer.expected_marker, 'extra': 'private'}))
        with self.assertRaisesRegex(module.GuardError, 'foreign_marker'):
            self.observer.sample()

    def test_marker_change_after_classification_discards_the_sample(self):
        self.observer.bootstrap()
        self.owned()
        classify = self.observer.classify
        def changed(windows):
            value = classify(windows)
            Path(self.config['marker_path']).write_text(json.dumps({**self.observer.expected_marker, 'operation_ref': str(uuid4())}))
            return value
        self.observer.classify = changed
        with self.assertRaisesRegex(module.GuardError, 'foreign_marker'):
            self.observer.sample()
        self.assertEqual(self.observer.samples, [])

    def test_replaced_log_is_detected_before_sample_publication(self):
        if os.name == 'nt':
            self.skipTest('POSIX replacement of an open inode requires Linux execution')
        self.observer.bootstrap()
        directory = self.owned()
        log = directory / 'cli.log'
        original = os.open
        def replaced(path, flags, *args, **kwargs):
            fd = original(path, flags, *args, **kwargs)
            if Path(path) == log:
                log.rename(directory / 'previous.log')
                log.write_text('HTTP status 429 private-foreign-data')
            return fd
        with patch.object(module.os, 'open', side_effect=replaced):
            with self.assertRaisesRegex(module.GuardError, 'identity_changed'):
                self.observer.sample()
        self.assertEqual(self.observer.samples, [])

    def test_symlinks_are_not_read(self):
        self.observer.bootstrap()
        directory = self.owned()
        log = directory / 'cli.log'
        target = self.base / 'unrelated-private.log'
        target.write_text('private-foreign-target')
        log.unlink()
        try:
            log.symlink_to(target)
        except OSError:
            self.skipTest('Windows symlink privilege unavailable; Linux execution required')
        with self.assertRaisesRegex(module.GuardError, 'unsafe_log'):
            self.observer.sample()

    def test_linux_nofollow_rejects_swap_to_symlink_before_open(self):
        if not hasattr(os, 'O_NOFOLLOW'):
            self.skipTest('Kernel O_NOFOLLOW requires Linux execution')
        self.observer.bootstrap()
        directory = self.owned()
        log = directory / 'cli.log'
        foreign = self.base / 'foreign.log'
        foreign.write_text('private-foreign-file HTTP status 429')
        original = os.open
        def swapped(path, flags, *args, **kwargs):
            if Path(path) == log:
                self.assertTrue(flags & os.O_NOFOLLOW)
                log.unlink()
                log.symlink_to(foreign)
            return original(path, flags, *args, **kwargs)
        with patch.object(module.os, 'open', side_effect=swapped):
            with self.assertRaises(OSError):
                self.observer.sample()
        self.assertEqual(self.observer.samples, [])

    def test_linux_aba_path_swap_cannot_change_the_pinned_fd_content(self):
        if os.name == 'nt':
            self.skipTest('POSIX open-inode ABA control requires Linux execution')
        self.observer.bootstrap()
        directory = self.owned()
        log = directory / 'cli.log'
        original = os.open
        def swapped(path, flags, *args, **kwargs):
            fd = original(path, flags, *args, **kwargs)
            if Path(path) == log:
                held = directory / 'held.log'
                log.rename(held)
                log.write_text('private-foreign-ABA HTTP status 429')
                log.unlink()
                held.rename(log)
            return fd
        with patch.object(module.os, 'open', side_effect=swapped):
            self.observer.sample()
        self.assertEqual(self.observer.samples[0]['http_statuses'], [503])
        self.assertNotIn('private-foreign-ABA', json.dumps(self.observer.samples))

    def test_disappearance_stops_and_oversized_metadata_is_rejected(self):
        self.observer.bootstrap()
        self.owned()
        self.observer.sample()
        Path(self.config['marker_path']).unlink()
        with self.assertRaisesRegex(module.GuardError, 'ownership_ended'):
            self.observer.sample()

    def test_large_log_reads_only_the_existing_bounded_windows(self):
        self.observer.bootstrap()
        directory = self.owned()
        (directory / 'cli.log').write_bytes(b'HTTP status 401\n' + b'x'*300000 + b'\nHTTP status 504\n')
        self.observer.sample()
        sample = self.observer.samples[0]
        self.assertLessEqual(sample['bytes_read'], 131072)
        self.assertTrue(sample['byte_window_truncated'])
        self.assertEqual(sample['http_statuses'], [401, 504])

    def test_oversized_marker_is_rejected(self):
        self.observer.bootstrap()
        self.owned()
        Path(self.config['marker_path']).write_bytes(b'x'*4097)
        with self.assertRaisesRegex(module.GuardError, 'oversize_file'):
            self.observer.sample()

    def test_config_field_set_is_closed(self):
        with self.assertRaisesRegex(module.GuardError, 'invalid_config'):
            module.Observer({**self.config, 'private_extra': 'not_allowed'})

    def test_stdin_stop_shuts_down_the_owned_process_without_mutation(self):
        process = subprocess.Popen([sys.executable, str(helper)], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            process.stdin.write(json.dumps(self.config)+'\n')
            process.stdin.flush()
            ready = json.loads(process.stdout.readline())
            self.assertEqual(ready['kind'], 'ready')
            process.stdin.write(json.dumps({'kind': 'stop', 'attempt_id': self.config['attempt_id']})+'\n')
            process.stdin.flush()
            result = json.loads(process.stdout.readline())
            process.wait(timeout=2)
            self.assertEqual(result['reason'], 'requested_stop')
            self.assertEqual(result['provider_requests'], 0)
            self.assertNotIn(self.temp, json.dumps(result))
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            for stream in (process.stdin, process.stdout, process.stderr):
                stream.close()

    def lifecycle(self, action):
        process = subprocess.Popen([sys.executable, '-I', '-B', str(helper)], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            process.stdin.write(json.dumps(self.config)+'\n')
            process.stdin.flush()
            self.assertEqual(json.loads(process.stdout.readline())['kind'], 'ready')
            action(process)
            result = json.loads(process.stdout.readline())
            # Deliberately do not close a still-open stdin before shutdown.
            process.wait(timeout=3)
            self.assertEqual(process.returncode, 0)
            self.assertEqual(process.stderr.read(), '')
            return result
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            for stream in (process.stdin, process.stdout, process.stderr):
                if not stream.closed:
                    stream.close()

    def test_ownership_ended_with_stdin_open_exits_without_a_reader_thread(self):
        def ended(process):
            self.owned()
            time.sleep(0.35)
            Path(self.config['marker_path']).unlink()
        result = self.lifecycle(ended)
        self.assertEqual((result['state'], result['reason']), ('stopped', 'ownership_ended'))

    def test_control_eof_is_a_normal_owned_shutdown(self):
        result = self.lifecycle(lambda process: process.stdin.close())
        self.assertEqual((result['state'], result['reason']), ('stopped', 'control_eof'))

    def test_invalid_or_foreign_stop_is_closed_and_rejected(self):
        for command in ({'kind': 'stop', 'attempt_id': str(uuid4())},
                        {'kind': 'stop', 'attempt_id': self.config['attempt_id'], 'extra': True}):
            with self.subTest(command_fields=sorted(command)):
                def send(process):
                    process.stdin.write(json.dumps(command)+'\n')
                    process.stdin.flush()
                result = self.lifecycle(send)
                self.assertEqual((result['state'], result['reason']), ('rejected', 'invalid_stop'))

    def test_partial_control_at_eof_is_rejected(self):
        def partial(process):
            process.stdin.write('{"kind":"stop"')
            process.stdin.close()
        result = self.lifecycle(partial)
        self.assertEqual(result['reason'], 'invalid_stop')


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]], verbosity=1)
