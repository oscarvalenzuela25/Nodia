// AI-38 guard around the frozen, already verified C05 SQL/HTTP acceptance harness.
// This file adds no publication override and never enables an operational tool.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

assert.equal(process.env.NODIA_AI_ALLOW_LIVE, 'yes');
assert.equal(process.env.NODIA_AI_C05_SEMANTIC_CONTROL, 'no');
assert.ok(['preferences', 'finance'].includes(process.env.NODIA_AI_C05_CASE));
const bindingPath = process.env.NODIA_AI_AI38_CAPABILITY_BINDING;
const supplementalPath = process.env.NODIA_AI_AI38_CAPABILITY_SUPPLEMENT;
assert.ok(bindingPath && supplementalPath && path.isAbsolute(bindingPath) && path.isAbsolute(supplementalPath));
assert.equal(fs.existsSync(supplementalPath), false, 'Preserve each closed verification');
const sha = value => createHash('sha256').update(value).digest('hex');
const binding = JSON.parse(fs.readFileSync(bindingPath));
assert.equal(binding.case_id, process.env.NODIA_AI_C05_CASE);
assert.equal(binding.selection.mode, 'token_plan_agentic');
assert.equal(binding.selection.effort_id, 'high', 'This cohort verifies the configured High selection');
const inherited = new URL('./nodia-ai-ai36-c05-live.integration.mjs', import.meta.url);
assert.equal(sha(fs.readFileSync(inherited)), binding.inherited_harness_sha256);
const pin = JSON.parse(fs.readFileSync(new URL('../dist/nodia-ai-context/config/knowledge-pin.json', import.meta.url)));
const manifestBytes = fs.readFileSync(new URL('../dist/nodia-ai/knowledge/manifest.json', import.meta.url));
const manifest = JSON.parse(manifestBytes);
assert.equal(pin.release_id, binding.context_pin.release_id);
assert.equal(pin.catalog_release, binding.context_pin.catalog_release);
assert.equal(sha(manifestBytes), binding.context_pin.manifest_sha256);
assert.equal(manifest.registry_sha256, binding.context_pin.registry_sha256);
const requested = binding.case_id === 'preferences'
  ? ['nodia_preferences_prepare', 'nodia_preferences_list'] : ['nodia_finance_movements_prepare_create'];
for (const name of requested) assert.ok(manifest.capability_contracts.some(item =>
  item.capability_id === name && item.publication === 'published'));
const c05Tools = new Set(['nodia_finance_movements_prepare_create', 'nodia_proposals_get',
  'nodia_operations_get', 'nodia_workflows_prepare', 'nodia_attachments_describe',
  'nodia_preferences_list', 'nodia_preferences_prepare']);
const report = { stage: 'AI-38', scope: 'same_epoch_High_three_pending_capabilities_disposable_SQL',
  case_id: binding.case_id, status: 'running', binding_sha256: sha(fs.readFileSync(bindingPath)),
  requested_capabilities: requested, maximum_native_start_requests: 2,
  native_start_requests: 0, starts: [], configured_SQL_writes: 0,
  operational_publication_modified: false, automatic_inference_retries: 0,
  inherited_harness_source_preserved: true, physical_UI_acceptance: false };
const save = () => fs.writeFileSync(supplementalPath, JSON.stringify(report, null, 2) + '\n');
save();
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (target.pathname === '/nodia-ai/agentic/mcp/start') {
    assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(target.hostname));
    assert.equal(init?.method, 'POST');
    assert.ok(typeof init.body === 'string' && Buffer.byteLength(init.body) <= 4_194_304);
    const payload = JSON.parse(init.body);
    assert.equal(payload.model_id, binding.selection.model_id);
    assert.equal(payload.effort_id, binding.selection.effort_id);
    assert.equal(payload.session_generation, binding.session_generation);
    assert.equal(payload.configuration_generation, binding.configuration_generation);
    assert.ok(report.native_start_requests < 2, 'No third generation or automatic replay');
    assert.ok(report.starts.every(item => item.attempt_id !== payload.attempt_id));
    const names = payload.tools.map(tool => tool.name);
    const phase = names.includes('nodia_capabilities_select') ? 'discovery' : 'execution';
    assert.equal(phase, report.native_start_requests === 0 ? 'discovery' : 'execution');
    assert.ok(names.every(name => !c05Tools.has(name) || requested.includes(name)));
    report.native_start_requests++;
    report.starts.push({ attempt_id: payload.attempt_id, phase, tool_names: names,
      catalog_sha256: sha(JSON.stringify(payload.tools)), request_recorded_at_utc: new Date().toISOString() });
    save(); // Count before crossing the private dispatch boundary.
  }
  return fetchOriginal(input, init);
};
try {
  await import(inherited);
  const result = JSON.parse(fs.readFileSync(process.env.NODIA_AI_C05_OUTPUT));
  assert.equal(result.status, 'passed');
  assert.equal(result.independent_case_completed, true);
  assert.equal(result.unresolved_native_or_proof_state, false);
  assert.equal(result.actual_provider_generations, 2);
  assert.equal(report.native_start_requests, 2);
  for (const name of requested) {
    const accepted = result.per_capability[name];
    assert.equal(accepted.actual_callbacks, 1);
    assert.equal(accepted.successful_callbacks, 1);
    assert.ok(accepted.semantic_assertions.length > 0 && accepted.semantic_assertions.every(item => item.passed));
  }
  report.status = 'passed';
} finally {
  globalThis.fetch = fetchOriginal;
  if (report.status !== 'passed') report.status = 'failed_no_replay';
  report.finished_at_utc = new Date().toISOString();
  save();
}
