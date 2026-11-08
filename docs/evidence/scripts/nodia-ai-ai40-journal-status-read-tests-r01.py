"""Atomic checks for status-only retries and unchanged public guard sequencing."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock


def load(name):
    path = Path(__file__).with_name(name)
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


helper = load('nodia-ai-ai40-journal-status-read-r01.py')
policy = load('nodia-ai-ai40-availability-adopt-r01.py')


class StatusReadTests(unittest.TestCase):
    def test_transient_status_only_retries_with_original_result(self):
        expected = {'unconfirmed': 0}
        call = Mock(side_effect=[ValueError('operator_command_failed'), ValueError('operator_command_failed'), expected])
        sleeps, events = [], []
        status = policy.StatusReadJournal(call, events, sleep=sleeps.append)
        self.assertIs(status('status'), expected)
        self.assertEqual(sleeps, [.25, .5])
        self.assertEqual([event['outcome'] for event in events], ['command_failed', 'command_failed', 'ok'])
        self.assertEqual([args.args for args in call.call_args_list], [('status',)] * 3)

    def test_non_status_is_never_retried(self):
        call = Mock(side_effect=ValueError('operator_command_failed'))
        with self.assertRaises(ValueError):
            policy.StatusReadJournal(call, [], sleep=lambda _: self.fail('unexpected sleep'))('backup')
        call.assert_called_once_with('backup')

    def test_failed_status_exhausts_three_without_relaxing(self):
        call = Mock(side_effect=ValueError('operator_command_failed'))
        with self.assertRaisesRegex(ValueError, 'operator_command_failed'):
            policy.StatusReadJournal(call, [], sleep=lambda _: None)('status')
        self.assertEqual(call.call_count, 3)

    def test_validation_error_is_never_retried(self):
        call = Mock(side_effect=ValueError('journal_not_ready'))
        with self.assertRaisesRegex(ValueError, 'journal_not_ready'):
            policy.StatusReadJournal(call, [], sleep=lambda _: self.fail('unexpected sleep'))('status')
        call.assert_called_once()

    def environment(self, sql):
        journal = Mock(side_effect=[ValueError('operator_command_failed'), {'unconfirmed': 0}])
        operator = SimpleNamespace(journal=journal, active_new_processes=Mock(return_value={'api': {'pid': 17}}))
        base = SimpleNamespace(load_helper=lambda: (operator, {}), codex_barrier=Mock(return_value={'pending': 0}), journal_open=lambda op: op.journal('status'))
        def require(value, code):
            if not value: raise ValueError(code)
        public = SimpleNamespace(ACTIVE=Path('/fixture/release'), PROFILE=Path('/fixture/profile'), chat_projection=Mock(return_value=sql), require=require)
        return public, base, operator, journal

    def test_retries_do_not_repeat_other_guards_and_restore_journal(self):
        sql = {'pending_jobs': 0, 'open_attempts': 0, 'retained_slots': 0}
        public, base, operator, journal = self.environment(sql)
        events = []
        result = helper.observe(public, base, lambda original, log: policy.StatusReadJournal(original, log, sleep=lambda _: None), events, {'nodia-api': {'pid': 19}})
        self.assertIs(result['SQL'], sql)
        operator.active_new_processes.assert_called_once()
        base.codex_barrier.assert_called_once_with(operator, public.PROFILE, frozenset({17}))
        public.chat_projection.assert_called_once_with(19)
        self.assertIs(operator.journal, journal)

    def test_sql_quiet_predicate_still_rejects_and_restores_journal(self):
        public, base, operator, journal = self.environment({'pending_jobs': 1, 'open_attempts': 0, 'retained_slots': 0})
        with self.assertRaisesRegex(ValueError, 'operational_sql_not_quiet'):
            helper.observe(public, base, lambda original, log: policy.StatusReadJournal(original, log, sleep=lambda _: None), [], {'nodia-api': {'pid': 19}})
        self.assertIs(operator.journal, journal)


if __name__ == '__main__':
    unittest.main()
