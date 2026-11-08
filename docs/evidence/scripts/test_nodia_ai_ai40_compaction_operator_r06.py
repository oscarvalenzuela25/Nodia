"""Pure receipt-policy regressions; no Linux runtime, SQL, account or provider is imported."""
import copy
import importlib.util
from pathlib import Path
import re
import unittest

path = Path(__file__).with_name('nodia-ai-ai40-compaction-operator-r06.py')
spec = importlib.util.spec_from_file_location('compaction_operator', path)
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)
SELECTION = {'connection_id': '1', 'mode': 'token_plan_agentic', 'model_id': 'synthetic-only', 'effort_id': None}


def receipt(mode='live'):
 proof = {'attempt_id': 'attempt-a', 'terminal_proof_id': 'proof-a', 'process_closed': True,
  'outcome': 'completed', 'exact_native_ack_settled': True, 'journal_acknowledged': True,
  'exact_native_process_absent': True, 'owned_native_process_group_empty': True, 'image_staging_entries': 0}
 child = {'schema': 'nodia-ai-ai40-compaction-child-r06-v1', 'status': 'passed', 'selection': SELECTION,
  'release_manifest_sha256': operator.RELEASE_SHA, 'fixture_sql_safe_to_remove': True,
  'production_stage_handler_used': True, 'readiness_overridden': False, 'executable_overridden': False,
  'publication_overridden': False, 'runtime_policy_overridden': False, 'operational_database_accessed': False,
  'dry_bootstrap_complete_before_account_or_dispatch': mode == 'bootstrap', 'total_provider_dispatches': 0 if mode == 'bootstrap' else 3,
  'source_metrics': {'source_text_utf8_bytes': 159744, 'actual_SQL_loader_complete': True,
    'prepared_transport': 'plain_text', 'source_hash': 'a'*64, 'prepared_prompt_utf8_bytes': 164000, 'assembly_ceiling_utf8_bytes': 262144},
  'turns': [] if mode == 'bootstrap' else [
   {'provider_dispatches': 2, 'compactions': 1, 'tools': 0, 'semantic_exact_match': True},
   {'provider_dispatches': 1, 'compactions': 0, 'tools': 0, 'semantic_exact_match': True}],
  'native_terminal_ack_receipts': [] if mode == 'bootstrap' else [
   {**proof, 'attempt_id': str(index), 'terminal_proof_id': str(index)} for index in range(3)]}
 return {'schema': 'nodia-ai-ai40-compaction-parent-r06-v1', 'status': 'passed', 'child': child,
  'fixture_resources_removed': True, 'retained_disposable_container': None,
  'child_exit_code': 0, 'child_exit_signal': None, 'child_timed_out': False, 'operational_database_accessed': False}


class CompactionReceiptTests(unittest.TestCase):
 def test_validator_accepts_the_field_actually_emitted_by_child_and_requires_six_source_bootstrap(self):
  source = path.with_name('nodia-ai-ai40-compaction-child-r06.mjs').read_text(encoding='utf8')
  emitted = re.findall(r'\b(dry_bootstrap_complete_before_[a-z_]+): dryBootstrapComplete', source)
  self.assertEqual(len(emitted), 1)
  for mode in ('bootstrap', 'live'):
   child_receipt = receipt(mode)
   child_receipt['child'].pop('dry_bootstrap_complete_before_account_or_dispatch')
   child_receipt['child'][emitted[0]] = mode == 'bootstrap'
   self.assertTrue(operator.validate_parent(child_receipt, 0, mode, SELECTION))
  old_field = receipt('bootstrap')
  old_field['child']['dry_bootstrap_complete_before_native_methods'] = old_field['child'].pop(emitted[0])
  with self.assertRaises(ValueError): operator.validate_parent(old_field, 0, 'bootstrap', SELECTION)
  incomplete_seed = receipt('bootstrap'); incomplete_seed['child']['source_metrics']['source_text_utf8_bytes'] = 5*26624
  with self.assertRaises(ValueError): operator.validate_parent(incomplete_seed, 0, 'bootstrap', SELECTION)

 def test_exact_two_intentions_require_three_unique_closed_native_acks(self):
  self.assertTrue(operator.validate_parent(receipt(), 0, 'live', SELECTION))
  for key, value in [('total_provider_dispatches', 4), ('runtime_policy_overridden', True),
                     ('readiness_overridden', True), ('production_stage_handler_used', False)]:
   with self.subTest(field=key):
    changed = receipt(); changed['child'][key] = value
    with self.assertRaises(ValueError): operator.validate_parent(changed, 0, 'live', SELECTION)
  for key, value in [('exact_native_ack_settled', False), ('journal_acknowledged', False),
                     ('exact_native_process_absent', False), ('owned_native_process_group_empty', False),
                     ('image_staging_entries', 1)]:
   with self.subTest(proof_field=key):
    changed = receipt(); changed['child']['native_terminal_ack_receipts'][0][key] = value
    with self.assertRaises(ValueError): operator.validate_parent(changed, 0, 'live', SELECTION)
  changed = receipt(); changed['child']['native_terminal_ack_receipts'][1] = copy.deepcopy(changed['child']['native_terminal_ack_receipts'][0])
  with self.assertRaises(ValueError): operator.validate_parent(changed, 0, 'live', SELECTION)

 def test_bootstrap_must_stop_before_native_and_failure_never_becomes_acceptance(self):
  self.assertTrue(operator.validate_parent(receipt('bootstrap'), 0, 'bootstrap', SELECTION))
  changed = receipt('bootstrap'); changed['child']['total_provider_dispatches'] = 1
  with self.assertRaises(ValueError): operator.validate_parent(changed, 0, 'bootstrap', SELECTION)
  changed = receipt(); changed['child']['status'] = 'failed'
  self.assertFalse(operator.validate_parent(changed, 1, 'live', SELECTION))
  changed = receipt(); changed['child']['turns'][1]['compactions'] = 1
  with self.assertRaises(ValueError): operator.validate_parent(changed, 0, 'live', SELECTION)


if __name__ == '__main__':
 unittest.main()
