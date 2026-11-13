"""Policy tests: synthetic ports only; no VPS, DB, systemd or credentials."""
import datetime
import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[1] / 'backend_update.py'
spec = importlib.util.spec_from_file_location('backend_update', source)
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def request():
    return {'schema_version': 1, 'operation_id': 'a' * 32, 'artifact_directory': 'server-123-1',
            'artifact_id': '456', 'artifact_zip_sha256': 'b' * 64, 'source_sha': 'c' * 40,
            'expected_current_release': 'backend-' + 'd' * 12 + '-' + 'e' * 12,
            'expected_current_tree_sha256': 'e' * 64}


class Ports:
    def __init__(self, fail=None):
        self.events, self.states = [], []
        self.fail = fail
        self.migrations = 0

    def call(self, name):
        self.events.append(name)
        if self.fail == name:
            raise policy.Rejected('synthetic_failure')

    def begin(self, _request, _state): self.call('begin')
    def record(self, state): self.states.append(dict(state))
    def prepare(self, _request):
        self.call('prepare')
        return {'candidate_release': 'synthetic-release'}
    def pause_timers(self):
        self.call('pause_timers')
        return {'backup': True, 'rotate': False}
    def maintenance(self, on): self.call('maintenance_on' if on else 'maintenance_off')
    def backup(self):
        self.call('backup')
        return {'backup_id': 'synthetic-ready-backup'}
    def require_quiescent(self, stopped): self.call('quiet_stopped' if stopped else 'quiet_live')
    def stop_writers(self): self.call('stop_writers')
    def probe_candidate(self): self.call('probe')
    def migrate_once(self):
        self.migrations += 1
        self.call('migrate')
        return {'status': 'migrated'}
    def switch_release(self): self.call('switch')
    def start_and_verify(self): self.call('start_verify')
    def public_smoke(self): self.call('smoke')
    def restore_timers(self, original):
        assert original == {'backup': True, 'rotate': False}
        self.call('restore_timers')
    def finish(self, *_): self.call('finish')
    def block(self, _state): self.call('block')


class UpdatePolicyTests(unittest.TestCase):
    def test_backup_precedes_stop_and_migration_is_single_after_second_quiet_gate(self):
        ports = Ports()
        result = policy.run_update(request(), ports, apply=True)
        self.assertEqual(result['phase'], 'complete')
        self.assertEqual(ports.events, ['begin', 'prepare', 'pause_timers', 'maintenance_on', 'backup',
                         'quiet_live', 'stop_writers', 'quiet_stopped', 'probe', 'migrate', 'switch',
                         'start_verify', 'maintenance_off', 'smoke', 'restore_timers', 'finish'])
        self.assertEqual(ports.migrations, 1)
        self.assertTrue(any(state['phase'] == 'migration_requested' for state in ports.states))

    def test_plan_never_requests_backup_maintenance_or_stop(self):
        ports = Ports()
        self.assertEqual(policy.run_update(request(), ports)['phase'], 'planned')
        self.assertEqual(ports.events, ['begin', 'prepare'])

    def test_failure_never_replays_or_rolls_back_and_preserves_admission_fence(self):
        for point in ['backup', 'quiet_live', 'stop_writers', 'quiet_stopped', 'probe',
                      'migrate', 'switch', 'start_verify', 'smoke', 'restore_timers']:
            with self.subTest(point=point):
                ports = Ports(fail=point)
                with self.assertRaises(policy.Rejected):
                    policy.run_update(request(), ports, apply=True)
                self.assertEqual(ports.states[-1]['phase'], 'failed')
                self.assertFalse(ports.states[-1]['automatic_retry_allowed'])
                self.assertIn('block', ports.events)
                self.assertEqual(ports.events[-2], 'maintenance_on')
                self.assertLessEqual(ports.migrations, 1)
                if point in ['backup', 'quiet_live', 'stop_writers', 'quiet_stopped', 'probe']:
                    self.assertEqual(ports.migrations, 0)

    def test_preflight_failure_has_no_service_effects(self):
        ports = Ports(fail='prepare')
        with self.assertRaises(policy.Rejected): policy.run_update(request(), ports, apply=True)
        self.assertEqual(ports.events, ['begin', 'prepare'])
        self.assertFalse(ports.states[-1]['effects_started'])

    def test_untrusted_paths_types_and_extra_request_keys_fail(self):
        for change in [{'artifact_directory': '../escape'}, {'schema_version': True},
                       {'operation_id': 'repeat'}, {'source_sha': 'master'}, {'unexpected': True}]:
            with self.assertRaises(policy.Rejected): policy.validate_request({**request(), **change})

    def test_backup_requires_fresh_ready_identity_not_old_or_unknown_receipt(self):
        now = datetime.datetime(2026, 11, 12, tzinfo=datetime.timezone.utc)
        receipt = {'schema_version': 1, 'operation': 'backup', 'status': 'ready',
                   'backup_id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cipher_bytes': 100,
                   'cipher_sha256': 'b' * 64, 'encryption_key_id': 'c' * 64, 'journal_sequence': 0,
                   'captured_at': now.isoformat(), 'expires_at': (now + datetime.timedelta(days=7)).isoformat()}
        self.assertEqual(policy.validate_backup_result(receipt, started_at=now, now=now)['backup_id'], receipt['backup_id'])
        for change in [{'status': 'pending'}, {'cipher_bytes': True}, {'cipher_sha256': 'wrong'},
                       {'captured_at': (now - datetime.timedelta(seconds=1)).isoformat()},
                       {'expires_at': now.isoformat()}]:
            with self.assertRaises(policy.Rejected):
                policy.validate_backup_result({**receipt, **change}, started_at=now, now=now)

    def test_backup_json_must_belong_to_one_fresh_post_cursor_invocation(self):
        import json
        fresh = {'_SYSTEMD_INVOCATION_ID': 'a' * 32, 'MESSAGE': json.dumps({'operation': 'backup'})}
        self.assertEqual(policy.fresh_backup_message([fresh], 'b' * 32)['operation'], 'backup')
        for entries, previous in [([], None), ([fresh, fresh], None), ([fresh], 'a' * 32),
                                  ([{**fresh, '_SYSTEMD_INVOCATION_ID': ''}], None)]:
            with self.assertRaises(policy.Rejected): policy.fresh_backup_message(entries, previous)


if __name__ == '__main__': unittest.main()
