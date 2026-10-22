// Offline artifact checks. Does not run Python, authenticate, infer or publish tools.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const Ajv = require(path.join(root, 'nodia-server/node_modules/ajv/dist/2020')).default;
const formats = require(path.join(root, 'nodia-server/node_modules/ajv-formats'));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const common = read('docs/mvp/nodia-ai-v1-common-contracts.schema.json');
const fixture = read('docs/evidence/nodia-ai-ai02-fixture-protocol.schema.json');
const evidence = read('docs/evidence/nodia-ai-ai02-gemini-web-viability.json');
const ajv = new Ajv({ strict: true, allErrors: true });
formats(ajv);
ajv.addSchema(common);
const selection = ajv.getSchema(common.$id + '#/$defs/Selection');
assert(selection(evidence.authoritativeLiveRun.probe.selection), JSON.stringify(selection.errors));
const envelope = ajv.compile(fixture);
assert(envelope({ kind: 'answer', text: 'synthetic' }));
assert(envelope({ kind: 'tool_request', call_id: 'synthetic', tool: 'fixture.expense.prepare',
  arguments: { name: 'Comida', amount: '20000', category_id: 'fixture-food', status: 'paid' } }));
for (const tool of ['confirm', 'execute', 'sql', 'http']) {
  assert.equal(envelope({ kind: 'tool_request', call_id: 'synthetic', tool, arguments: {} }), false);
}
assert.equal(envelope({ kind: 'answer', text: 'synthetic', approval_token: 'fixture' }), false);
const live = evidence.authoritativeLiveRun;
assert.equal(live.probe_exit_code, 0);
assert.equal(live.runtime_restored, true);
assert.equal(live.probe.conversation_loop_passed, true);
assert.equal(live.recallQuestionsSupplyExpectedValues, false);
assert.equal(live.probe.business_writes, 0);
assert.equal(live.probe.published_capabilities, 0);
assert.equal(live.probe.synthetic_provider_chats_cleanup, true);
assert.equal(live.probe.generation_invocations, 7);
assert(live.probe.checks.every(check => check.passed === true));
for (const name of ['exact_discovered_selection', 'natural_language_read_request',
  'natural_language_prepare_request', 'read_result_continuation', 'preview_result_continuation',
  'opaque_continuation_rehydrated', 'canonical_history_rehydrated', 'preview_not_executed']) {
  assert(live.probe.checks.some(check => check.name === name), 'Missing live check: ' + name);
}
assert.equal(evidence.postRestore.authenticated, true);
assert.equal(evidence.decision.tools, 'unpublished');
for (const [file, sha256] of Object.entries(evidence.offline.deployedSourceHashes)) {
  const bytes = fs.readFileSync(path.join(root, 'nodia-gemini-microservice', file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256, 'Source drift: ' + file);
}
for (const file of evidence.files) assert(fs.statSync(path.join(root, file)).isFile(), file);
for (const [file, sha256] of Object.entries(evidence.probeSourceHashes)) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'),
    sha256, 'Probe artifact drift: ' + file);
}
console.log({ status: 'artifact_consistent', task: 'AI-02', liveChecksRecorded: live.probe.checks.length,
  newTestsRecorded: evidence.offline.newTestsPassed, productionTools: 0,
  note: 'This check validates recorded artifacts; it does not rerun account or Python tests.' });
