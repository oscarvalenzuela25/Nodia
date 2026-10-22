import fs from 'node:fs';
import assert from 'node:assert/strict';

const target = 'docs/evidence/nodia-ai-ai15-lab-activation.json';
const report = JSON.parse(fs.readFileSync(target, 'utf8'));
assert.equal(report.server_release.knowledge_release, '5b27b4a3873037c8e850df90a801d84c561545414a8b27de415a3c8ab1f66c96');
assert.equal(report.services.api.active, true);
assert.equal(report.services.worker.active, true);
report.status = 'publication_activated_real_chat_acceptance_blocked';
report.real_ui_verified = false;
report.real_ui_chat_completion_verified = false;
report.deployment_operator_inference_dispatches = report.lab_inference_dispatches;
delete report.lab_inference_dispatches;
report.ui = {
  scope: 'actual_browser_session_and_configured_database',
  status: 'access_configuration_persistence_and_failure_recovery_verified_generation_failed',
  url: 'http://localhost:5174/tools/nodia-ai?chat=4e5848a7-36ae-4ccc-82bb-99a38761963a',
  conversation_id: '4e5848a7-36ae-4ccc-82bb-99a38761963a',
  checks_passed: [
    'Existing authenticated super_admin gains the installed NodiaAI module after context refresh.',
    'Page, empty state and configuration drawer load from the deployed API.',
    'Existing Gemini connection and dynamically discovered Web model can be selected and saved per conversation.',
    'Web selection is observed available before the test message; availability is not asserted after the failure.',
    'Automatic Agentic switch is absent while the exact Agentic MCP selection has no positive attestation.',
    'Exactly one synthetic text message is admitted; native work runs through the standalone worker.',
    'UI shows queued/running and then unknown without resending the intent.',
    'Operator reconciliation and terminal acknowledgement use the existing CLI and validated current super_admin session.',
    'After API/worker restart and browser reload, conversation, selection and message persist; the run visibly remains failed.',
    'UI blocks sending while the current selection is unavailable; no replacement mode or model is selected.'
  ],
  model_source: 'actual_backend_discovery_and_browser_selection',
  mode: 'token_plan_web',
  model_id: '56fdd199312815e2',
  effort_id: null,
  adapter_dispatches: 1,
  domain_tool_calls: 0,
  mcp_rpc_messages: 0,
  delegations: 0,
  inference_replayed: false,
  assistant_answer_completed: false,
  failure: { phase: 'generation', exception_type: 'TimeoutError', elapsed_ms: 119003 },
  failure_evidence: 'nodia-ai-ai15-live-web-chat-failure.json',
  final_run_state: 'failed',
  final_error_code: 'nodia_ai:outcome_unknown',
  final_pending_jobs: 0,
  final_native_pending_files: 0,
  initial_test_knowledge_release: '997234d07d7dd237fbb2d6f135c617f524c8a4fb4506bad6ea7f9c44608c4dee',
  reload_knowledge_release: report.server_release.knowledge_release,
  metadata_only_release_change: 'Only three documentary revisions/hashes changed; all 67 capability contracts and 27 prompt fragment hashes remained identical.',
  final_screenshot: 'outputs/nodia-ai-ai15-real-ui.png',
  frontend_change: {
    files: ['nodia-client/src/translate/es/nodiaAi.json', 'nodia-client/src/translate/en/nodiaAi.json'],
    impact: 'Welcome copy reflects published reads with permission and verified Agentic prerequisites; no layout, interactions, contracts or tool permissions changed.',
    knowledge_impact: 'Presentation-only wording; existing published capabilities and functional rules are unchanged.',
    checks: { existing_nodia_ai_tests: 43, files: 4, typecheck: 'passed', lint: 'passed' }
  }
};
report.limitations.unshift('The real Web UI message also timed out during generation at119003ms. No assistant response completed; reconciliation/acknowledgement left zero pending jobs without replay.');
const bytes = JSON.stringify(report, null, 2) + '\n';
fs.writeFileSync(target, bytes);
fs.writeFileSync('.tmp/ai15-lab-activation.json', bytes);
console.log(JSON.stringify({ status: report.status, release: report.server_release.knowledge_release, ui_checks: report.ui.checks_passed.length, real_chat_completed: false, pending_jobs: 0 }));
