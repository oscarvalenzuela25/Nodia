"""Offline receipt policy checks only; never imports native/runtime/account code."""
import copy
import importlib.util
from pathlib import Path
import unittest

SOURCE = Path(__file__).with_name('nodia-ai-ai40-r06-mcp-operator-r02.py')
spec = importlib.util.spec_from_file_location('r06_mcp_operator', SOURCE)
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)

SELECTION = {'connection_id': '1', 'mode': 'token_plan_agentic', 'model_id': 'synthetic-test-only', 'effort_id': None}


def receipt():
 return {'schema': 'nodia-ai-ai40-real-canary-parent-v1', 'status': 'passed',
  'fixture_resources_removed': True, 'retained_disposable_container': None,
  'child_exit_code': 0, 'child_exit_signal': None, 'child_timed_out': False,
  'operational_database_accessed': False, 'operational_profile_removed': False,
  'child': {'schema': 'nodia-ai-ai40-real-canary-v1', 'status': 'passed', 'selection': SELECTION.copy(),
   'acceptance_kind': 'mcp_transport', 'provider_dispatches_armed': 1, 'gateway_callbacks': 1,
   'final_mcp_accepted': True, 'run_state': 'completed', 'assistant_message_sealed': False,
   'readiness_overridden': False, 'executable_overridden': False, 'publication_overridden': False,
   'operational_database_accessed': False, 'operational_profile_removed': False,
   'terminal_proof_id': '11111111-1111-4111-8111-111111111111', 'response_sha256': 'a'*64}}


class ReceiptBoundaryTests(unittest.TestCase):
 def test_accepts_only_exact_qualification_and_closed_fixture(self):
  self.assertTrue(operator.validate_parent(receipt(), 0, SELECTION))
  cases = [('fixture_resources_removed', False), ('retained_disposable_container', 'retained'),
           ('child_timed_out', True), ('child_exit_code', 1)]
  for key, value in cases:
   with self.subTest(field=key):
    candidate = receipt(); candidate[key] = value
    with self.assertRaises(ValueError): operator.validate_parent(candidate, 0, SELECTION)
  child_cases = [('provider_dispatches_armed', 2), ('gateway_callbacks', 0), ('final_mcp_accepted', False),
                 ('readiness_overridden', True), ('executable_overridden', True), ('publication_overridden', True),
                 ('terminal_proof_id', None), ('operational_database_accessed', True),
                 ('selection', {**SELECTION, 'effort_id': 'different'})]
  for key, value in child_cases:
   with self.subTest(child_field=key):
    candidate = receipt(); candidate['child'][key] = value
    with self.assertRaises(ValueError): operator.validate_parent(candidate, 0, SELECTION)

 def test_failed_or_uncertain_child_does_not_become_acceptance_after_cleanup(self):
  candidate = receipt(); candidate['status'] = 'failed'; candidate['child']['status'] = 'failed'
  candidate['child']['final_mcp_accepted'] = False
  self.assertFalse(operator.validate_parent(candidate, 1, SELECTION))
  candidate = receipt(); candidate['child']['status'] = 'failed'
  self.assertFalse(operator.validate_parent(candidate, 0, SELECTION))
  candidate = receipt(); candidate['child'] = None
  with self.assertRaises(ValueError): operator.validate_parent(candidate, 1, SELECTION)


if __name__ == '__main__':
 unittest.main()
