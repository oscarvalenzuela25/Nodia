"""Restore-attestation and Nginx transaction rules; no root, remote, reload or network."""
import datetime
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('backend_proxy', Path(__file__).resolve().parents[1] / 'enable-backend-proxy.py')
proxy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(proxy)
NOW = datetime.datetime(2026, 11, 11, 22, tzinfo=datetime.timezone.utc)


def attestation():
    return {'schema_version': 1, 'status': 'verified_isolated_restore', 'source_sha': proxy.SOURCE_SHA,
            'package_tree_sha256': proxy.TREE_SHA, 'backup_id': 'a0000000-0000-4000-8000-000000000001',
            'cipher_sha256': 'a' * 64, 'restore_receipt_sha256': 'b' * 64, 'data_fingerprint_matched': True,
            'migrations_verified': 45, 'entity_tables_verified': 68, 'quarantine_prepare_verified': True,
            'source_database_restored': False, 'evidence_origin': 'offhost_isolated_docker_restore',
            'operator_attestation': True, 'verified_at_utc': (NOW - datetime.timedelta(hours=1)).isoformat()}


class RestoreGateTests(unittest.TestCase):
    def test_exact_fresh_offhost_operator_attestation(self):
        value = attestation()
        self.assertEqual(proxy.validate_restore(value, now=NOW), value)

    def test_each_required_gate_unknown_field_and_wrong_identity_are_rejected(self):
        for key in attestation():
            value = attestation()
            del value[key]
            with self.assertRaises(ValueError):
                proxy.validate_restore(value, now=NOW)
        for changes in ({'operator_attestation': False}, {'data_fingerprint_matched': False}, {'quarantine_prepare_verified': False},
                        {'source_database_restored': True}, {'migrations_verified': 44}, {'entity_tables_verified': 67},
                        {'schema_version': True}, {'source_sha': '0' * 40}, {'package_tree_sha256': '0' * 64},
                        {'backup_id': 'foreign'}, {'restore_receipt_sha256': 'bad'}, {'extra': 'unexpected'},
                        {'evidence_origin': 'local_assumption'}):
            with self.assertRaises(ValueError):
                proxy.validate_restore({**attestation(), **changes}, now=NOW)

    def test_stale_future_naive_and_invalid_dates_fail_closed(self):
        for value in ((NOW - datetime.timedelta(days=1)).isoformat(), (NOW + datetime.timedelta(seconds=1)).isoformat(),
                      '2026-11-11T21:00:00', 'invalid', None):
            with self.assertRaises((ValueError, TypeError)):
                proxy.validate_restore({**attestation(), 'verified_at_utc': value}, now=NOW)

    def test_duplicate_json_keys_and_unreviewed_site_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate_json_key'):
            proxy.unique_json('{"status":"one","status":"two"}')
        self.assertFalse(proxy.existing_site_reviewed(proxy.BASELINE_SHA, 'b' * 64))
        self.assertTrue(proxy.existing_site_reviewed('b' * 64, 'b' * 64))
        with self.assertRaisesRegex(ValueError, 'existing_site_not_reviewed'):
            proxy.existing_site_reviewed('a' * 64, 'b' * 64)


class TransactionTests(unittest.TestCase):
    def exercise(self, fail_at=None, rollback_fails=False):
        observed = {'site': b'old', 'events': [], 'tests': 0, 'reloads': 0}

        def write(value):
            if rollback_fails and value == b'old':
                raise OSError('synthetic rollback write failure')
            observed['site'] = value
            observed['events'].append(('write', value))
            if fail_at == 'write_after_replace' and value == b'new':
                raise OSError('synthetic fsync failure after replacement')

        def test():
            observed['tests'] += 1
            observed['events'].append(('test', observed['site']))
            if fail_at == 'syntax' and observed['site'] == b'new':
                raise ValueError('synthetic syntax failure')

        def reload():
            observed['reloads'] += 1
            observed['events'].append(('reload', observed['site']))
            if fail_at == 'reload' and observed['site'] == b'new':
                raise ValueError('synthetic reload failure')

        def probe():
            observed['events'].append(('probe', observed['site']))
            if fail_at == 'probe':
                raise ValueError('synthetic probe failure')

        expected = 'proxy_change_failed_rollback_incomplete' if rollback_fails else 'proxy_change_failed_previous_site_restored'
        if fail_at:
            with self.assertRaisesRegex(ValueError, expected):
                proxy.apply_candidate(b'old', b'new', write=write, test=test, reload=reload, probe=probe)
        else:
            proxy.apply_candidate(b'old', b'new', write=write, test=test, reload=reload, probe=probe)
        return observed

    def test_success_validates_before_reload_and_probes(self):
        result = self.exercise()
        self.assertEqual(result['site'], b'new')
        self.assertEqual([kind for kind, _ in result['events']], ['write', 'test', 'reload', 'probe'])

    def test_syntax_reload_probe_and_fsync_failure_restore_original(self):
        for failure in ('syntax', 'reload', 'probe', 'write_after_replace'):
            with self.subTest(failure=failure):
                result = self.exercise(failure)
                self.assertEqual(result['site'], b'old')
                self.assertEqual(result['events'][-1], ('reload', b'old'))

    def test_failed_rollback_is_never_reported_as_recovered(self):
        self.exercise('syntax', rollback_fails=True)

    def test_read_only_probe_allows_graceful_reload_then_stops_at_bound(self):
        observed = []
        def becoming_ready():
            observed.append('GET')
            if len(observed) < 2:
                raise ValueError('old worker response')
        proxy.await_read_only_probe(becoming_ready, sleep=lambda _: None, attempts=3)
        self.assertEqual(observed, ['GET', 'GET'])
        observed.clear()
        def unavailable():
            observed.append('GET')
            raise ValueError('unavailable')
        with self.assertRaisesRegex(ValueError, 'unavailable'):
            proxy.await_read_only_probe(unavailable, sleep=lambda _: None, attempts=3)
        self.assertEqual(len(observed), 3)


if __name__ == '__main__':
    unittest.main()
