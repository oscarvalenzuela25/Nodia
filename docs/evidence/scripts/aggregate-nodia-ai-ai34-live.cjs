// Aggregate preserved synthetic account canaries; never calls a provider or database.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
process.chdir(path.resolve(__dirname, '../../..'));
const candidates = [
  'docs/evidence/nodia-ai-ai34-live-validation-attempt02.json',
  'docs/evidence/nodia-ai-ai34-live-mcp-attempt01.json',
  'docs/evidence/nodia-ai-ai34-live-agentic-instrumented-attempt01.json',
  'docs/evidence/nodia-ai-ai34-live-agentic-role-attempt01.json',
  'docs/evidence/nodia-ai-ai34-live-mcp-attempt02.json',
];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sources = candidates.filter(file => fs.existsSync(file)).map(file => ({ file, data: read(file) }));
assert.equal(sources.length >= 3, true);
assert.ok(sources.every(({ data }) => ['passed', 'failed'].includes(data.status)));
for (const { data } of sources) {
  for (const key of ['operational_sql_writes', 'user_chats_created', 'automatic_inference_retries'])
    assert.equal(data[key], 0);
  assert.ok(Number.isInteger(data.generation_requests) && data.generation_requests >= 1 &&
    data.generation_requests <= data.maximum_generations);
}
const completed = sources.flatMap(({ file, data }) => (data.probes ?? []).map(probe => ({ file, ...probe })));
const compactions = completed.filter(probe => probe.compaction && probe.terminal_proofs_acknowledged >= 1);
const continuity = completed.filter(probe => probe.continuity && probe.terminal_proofs_acknowledged >= 2);
const mcp = sources.filter(({ data }) => data.status === 'passed' && data.mcp_probe?.terminal_proof_acknowledged === true &&
  data.mcp_probe.tool_callback_count === 1);
const failures = sources.filter(({ data }) => data.status === 'failed');
for (const { data } of sources) {
  const reconciled = data.uncertain_attempt_reconciliation;
  if (reconciled) {
    assert.equal(reconciled.acknowledged, true);
    assert.equal(reconciled.process_closed, true);
  }
  const acknowledged = (data.probes ?? []).reduce((sum, probe) => sum + probe.terminal_proofs_acknowledged, 0) +
    Number(data.mcp_probe?.terminal_proof_acknowledged === true) + Number(Boolean(reconciled));
  assert.equal(acknowledged, data.generation_requests, 'Every actual generation must have a terminal ACK or reconciled ACK');
}
const selectionComplete = engine => compactions.some(probe => probe.engine === engine) && continuity.some(probe => probe.engine === engine);
const agenticComplete = selectionComplete('agentic') && mcp.length >= 1;
const passed = selectionComplete('web') && agenticComplete;
const release = read('nodia-server/dist/nodia-ai-context/config/knowledge-pin.json').release_id;
assert.ok(sources.every(({ data }) => /^[a-f0-9]{64}$/.test(data.knowledge_release)));
const output = {
  stage: 'AI-34', scope: 'aggregate_preserved_real_gemini_synthetic_canaries',
  status: passed ? 'passed' : 'partial', observed_at_utc: new Date().toISOString(),
  knowledge_release: release,
  observed_knowledge_releases: [...new Set(sources.map(({ data }) => data.knowledge_release))],
  generation_requests: sources.reduce((sum, { data }) => sum + data.generation_requests, 0),
  successful_compactions: compactions.length,
  successful_continuity_answers: continuity.length,
  successful_mcp_read_probes: mcp.length,
  agentic_acceptance_complete: agenticComplete,
  historical_failed_attempts: failures.length,
  unresolved_attempts: 0, automatic_inference_retries: 0,
  operational_sql_writes: 0, user_chats_created: 0,
  evidence: sources.map(({ file, data }) => ({ path: file,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    generations: data.generation_requests, status: data.status,
    knowledge_release: data.knowledge_release,
    failure_category: data.failure_category ?? null })),
  limitations: [
    'Synthetic account canaries use compiled builders/adapters; worker, SQL persistence, recovery authority and effects are tested separately.',
    'Each canary retains its executed knowledge pin; aggregate current pin does not rewrite earlier account acceptance or prove a production deployment.',
    'Earlier timeout and rejected-tool attempts remain failed, reconciled and acknowledged; later probes are explicit independent attempts, never replay.',
    'The original Web canary had no operations and a historical empty recovery-reference shape; current recovery contracts are established by separate SQL tests.',
    'Five checked extractive categories do not prove exhaustive semantic recall.',
    'Text and MCP probes do not renew native attachment-format verification after restart.',
  ],
};
fs.writeFileSync('docs/evidence/nodia-ai-ai34-live-validation.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ stage: output.stage, status: output.status, generations: output.generation_requests,
  compactions: compactions.length, continuity: continuity.length, mcp: mcp.length, unresolved: 0 }));
