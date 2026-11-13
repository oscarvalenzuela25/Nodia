"""No network, systemd, root, real configuration or provider calls."""
import copy
import importlib.util
import contextlib
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / 'bootstrap-recovery-journal.py'
SPEC = importlib.util.spec_from_file_location('bootstrap_recovery_journal', MODULE)
journal = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(journal)


def status(**changes):
    value = {'operation': 'status', 'coverage_from': '2026-11-11T20:00:00.000Z',
             'updated_at': '2026-11-11T20:00:00.000Z', 'first_sequence': 1, 'last_sequence': 0,
             'entries': 0, 'unconfirmed': 0, 'coverage_closed_at': None,
             'backups': 0, 'expired_backups': 0, 'release_authorized': False}
    value.update(changes)
    return {'exit_code': 0, 'stdout': json.dumps(value), 'stderr': ''}


MISSING = {'exit_code': 1, 'stdout': '', 'stderr': 'nodia_ai:recovery_journal_missing\n'}
UNKNOWN = {'exit_code': 1, 'stdout': '', 'stderr': 'nodia_ai:recovery_write_unknown\n'}


class JournalBootstrapTests(unittest.TestCase):
    def test_raw_diagnostic_is_private_bounded_and_not_printed(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(journal, 'PRIVATE', Path(temporary)):
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                journal.private_diagnostic('journal-last-stderr.log', b'synthetic-secret-' * 100, 32)
            target = Path(temporary) / 'journal-last-stderr.log'
            self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
            self.assertEqual(target.stat().st_nlink, 1)
            self.assertLessEqual(target.stat().st_size, 64)
            self.assertEqual(stdout.getvalue(), '')
            journal.private_diagnostic('journal-last-stderr.log', b'replacement', 32)
            self.assertEqual(target.read_bytes(), b'replacement')
            self.assertEqual(len(list(Path(temporary).iterdir())), 1)

    def test_diagnostic_cannot_follow_symlink_or_choose_public_path(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(journal, 'PRIVATE', Path(temporary)):
            target = Path(temporary) / 'public.json'
            target.write_bytes(b'preserve')
            (Path(temporary) / 'journal-last-stderr.log').symlink_to(target)
            with self.assertRaises(journal.Rejected):
                journal.private_diagnostic('journal-last-stderr.log', b'secret', 32)
            with self.assertRaises(journal.Rejected):
                journal.private_diagnostic('../public.json', b'secret', 32)
            self.assertEqual(target.read_bytes(), b'preserve')

    def test_classifies_only_pristine_open_snapshot(self):
        self.assertEqual(journal.classify_status(status()), 'empty_open')
        self.assertEqual(journal.classify_status(MISSING), 'missing')
        self.assertEqual(journal.classify_status(UNKNOWN), 'unknown')
        self.assertEqual(journal.classify_status(status(coverage_closed_at='2026-11-11T20:00:00.000Z')), 'closed')
        for changes in ({'entries': 1}, {'backups': 1}, {'last_sequence': 1}, {'first_sequence': 2}, {'unconfirmed': 1}):
            with self.subTest(changes=changes):
                self.assertEqual(journal.classify_status(status(**changes)), 'not_empty')

    def test_bad_or_secret_bearing_status_is_not_ready(self):
        for result in (status(extra='secret'), status(release_authorized=True), status(entries=False),
                       status(coverage_from='invalid'), status(updated_at='2026-11-10T20:00:00.000Z'),
                       status(updated_at='2099-11-11T20:00:00.000Z'),
                       {'exit_code': 0, 'stdout': None, 'stderr': ''},
                       {'exit_code': 0, 'stdout': '{}', 'stderr': ''}, {'exit_code': 1, 'stdout': '', 'stderr': '404'}):
            with self.subTest(result=result):
                self.assertEqual(journal.classify_status(result), 'unknown')

    def test_stderr_with_success_never_qualifies_readiness(self):
        result = status()
        result['stderr'] = 'nodia_ai:recovery_read_unavailable'
        self.assertEqual(journal.classify_status(result), 'unknown')

    def test_unique_put_requires_durable_marker_first(self):
        calls = []
        observed = iter([copy.deepcopy(MISSING), status()])
        result = journal.initialize_once(lambda: next(observed), lambda: calls.append('durable_intent'),
                                         lambda: calls.append('put'), prior_intent=False)
        self.assertEqual(calls, ['durable_intent', 'put'])
        self.assertEqual(result['status'], 'ready')
        self.assertTrue(result['put_requested_this_run'])

    def test_marker_failure_prevents_put(self):
        def failed_marker():
            raise OSError('synthetic fsync failure')
        calls = []
        with self.assertRaises(OSError):
            journal.initialize_once(lambda: MISSING, failed_marker, lambda: calls.append('put'), prior_intent=False)
        self.assertEqual(calls, [])

    def test_prior_intent_and_missing_never_resends(self):
        calls = []
        result = journal.initialize_once(lambda: MISSING, lambda: calls.append('marker'), lambda: calls.append('put'), prior_intent=True)
        self.assertEqual(calls, [])
        self.assertEqual(result['reason'], 'prior_write_unresolved')

    def test_unknown_then_missing_is_not_retryable(self):
        calls = []
        observations = iter([MISSING, UNKNOWN])
        result = journal.initialize_once(lambda: next(observations), lambda: calls.append('marker'), lambda: calls.append('put'), prior_intent=False)
        self.assertEqual(result['reason'], 'write_unresolved')
        repeated = journal.initialize_once(lambda: MISSING, lambda: calls.append('marker'), lambda: calls.append('put'), prior_intent=True)
        self.assertEqual(repeated['reason'], 'prior_write_unresolved')
        self.assertEqual(calls, ['marker', 'put'])

    def test_existing_valid_era_is_adopted_without_put_or_marker(self):
        for previous in (False, True):
            calls = []
            result = journal.initialize_once(status, lambda: calls.append('marker'), lambda: calls.append('put'), prior_intent=previous)
            self.assertEqual(result['status'], 'ready')
            self.assertTrue(result['adopted_existing'])
            self.assertEqual(calls, [])

    def test_closed_nonempty_or_unknown_never_bootstrap(self):
        for observed in (status(backups=1), status(coverage_closed_at='2026-11-11T20:00:00.000Z'), UNKNOWN):
            calls = []
            result = journal.initialize_once(lambda: observed, lambda: calls.append('marker'), lambda: calls.append('put'), prior_intent=False)
            self.assertEqual(result['status'], 'blocked')
            self.assertEqual(calls, [])

    def test_lost_bootstrap_response_can_only_be_adopted_by_read(self):
        calls = []
        observations = iter([MISSING, status()])
        def timeout():
            calls.append('put')
            raise journal.subprocess.TimeoutExpired('synthetic', 1)
        result = journal.initialize_once(lambda: next(observations), lambda: calls.append('marker'), timeout, prior_intent=False)
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(calls, ['marker', 'put'])


if __name__ == '__main__':
    unittest.main()
