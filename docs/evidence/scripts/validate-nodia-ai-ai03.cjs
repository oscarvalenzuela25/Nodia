// Recorded-artifact integrity only: no network, account, inference or deployment.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const Ajv = require(path.join(root, 'nodia-server/node_modules/ajv/dist/2020')).default;
const formats = require(path.join(root, 'nodia-server/node_modules/ajv-formats'));
const common = read('docs/mvp/nodia-ai-v1-common-contracts.schema.json');
const evidence = read('docs/evidence/nodia-ai-ai03-gemini-agentic-viability.json');
const ajv = new Ajv({ strict: true, allErrors: true });
formats(ajv);
ajv.addSchema(common);
const selection = ajv.getSchema(common.$id + '#/$defs/Selection');
const live = evidence.authoritativeLiveRun;
assert(selection(live.probe.selection), JSON.stringify(selection.errors));
assert.equal(evidence.status, 'spike_verified_runtime_unpublished');
assert.equal(live.exit_code, 0);
assert.equal(live.runtime_restored, true);
assert.equal(live.probe.viable, true);
assert.equal(live.probe.generation_processes, 4);
assert.equal(live.probe.mcp_calls, 2);
assert.equal(live.probe.mcp_event_counts.cli_arguments_normalized, 2);
assert.equal(live.probe.mcp_call_attempts.length, 2);
assert(live.probe.mcp_call_attempts.every(call => call.arguments_type === 'str'));
assert(live.probe.mcp_protocols.length > 0);
assert(live.probe.checks.every(check => check.passed === true));
assert.equal(evidence.recallQuestionsSupplyExpectedValues, false);
for (const name of ['exact_discovered_selection', 'native_mcp_read_roundtrip', 'native_mcp_prepare_roundtrip',
  'callback_bound_to_probe_run', 'native_conversation_identity_preserved', 'native_process_resume_recall',
  'canonical_history_new_process_recall', 'canonical_replay_no_new_callbacks', 'mcp_callbacks_passed_hook']) {
  assert(live.probe.checks.some(check => check.name === name), 'Missing live check: ' + name);
}
const safety = evidence.authoritativeSafetyRun;
assert.equal(safety.runtime_restored, true);
assert.equal(safety.probe.safety_passed, true);
assert(safety.probe.checks.every(check => check.passed === true));
assert.equal(safety.probe.native_cancel.remote_outcome, 'unknown');
assert.equal(safety.probe.native_cancel.automatic_retry, false);
assert.equal(safety.probe.native_cancel.fixture_processes_remaining, 0);
assert.equal(safety.probe.mcp_event_counts.tool_completed, 0);
const canonical = evidence.authoritativeFreshProfileRun;
assert.equal(canonical.runtime_restored, true);
assert.equal(canonical.probe.canonical_fresh_profile_passed, true);
assert.equal(canonical.probe.canonical_values_randomized, true);
assert.equal(canonical.probe.question_supplies_expected_values, false);
assert.equal(canonical.probe.generation_processes, 1);
assert.equal(canonical.probe.mcp_event_counts.tool_completed, 0);
assert(canonical.probe.checks.every(check => check.passed === true));
for (const run of [live, safety, canonical]) {
  assert.equal(run.probe.business_writes, 0);
  assert.equal(run.probe.published_capabilities, 0);
  assert.equal(run.probe.owned_processes_remaining, 0);
  assert.equal(run.probe.owned_fixture_processes_remaining, 0);
  assert.equal(run.probe.temporary_context_removed, true);
}
assert.equal(evidence.businessWrites, 0);
assert.equal(evidence.publishedCapabilities, 0);
assert.equal(evidence.automaticInferenceRetry, false);
assert.equal(evidence.decision.productionMcpTools, 'unpublished');
assert.equal(evidence.decision.adapterStates, 'not_activated');
assert.equal(evidence.postRestore.webAuthenticated, true);
assert.equal(evidence.postRestore.agenticAvailable, true);
assert.equal(evidence.postRestore.agenticSessionActive, true);
for (const file of evidence.files) assert(fs.statSync(path.join(root, file)).isFile(), file);
for (const [file, sha256] of Object.entries(evidence.currentHarnessHashes)) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'),
    sha256, 'Source drift: ' + file);
}
console.log({ task: 'AI-03', status: 'artifact_consistent', liveChecksRecorded: live.probe.checks.length,
  safetyChecksRecorded: safety.probe.checks.length, testsRecorded: evidence.offline.totalTestsPassed,
  productionTools: 0, note: 'Does not rerun account or Python tests.' });
