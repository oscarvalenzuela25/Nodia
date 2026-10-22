// Offline policy contract verification. No scheduler/DB/provider/storage is simulated as real.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const Ajv = require(path.join(root, 'nodia-server/node_modules/ajv/dist/2020')).default;
const policyPath = 'docs/mvp/nodia-ai-v1-runtime-policy.json';
const schemaPath = 'docs/mvp/nodia-ai-v1-runtime-policy.schema.json';
const schema = read(schemaPath);
const structural = new Ajv({ strict: true, allErrors: true }).compile(schema);

function validatePolicy(policy) {
  assert(structural(policy), 'schema: ' + JSON.stringify(structural.errors));
  const { admission: a, results: r, budget: b, queue: q, timing: t, retry, search, retention } = policy;
  assert(a.message_text_utf8_bytes < a.http_json_bytes, 'message lacks HTTP envelope budget');
  assert(a.files_per_message < a.parts_per_message, 'parts lack space for text and files');
  assert(a.title_utf8_bytes <= a.message_text_utf8_bytes, 'title exceeds text budget');
  assert(a.file_bytes <= a.message_files_bytes, 'file exceeds message budget');
  assert(a.message_files_bytes <= a.file_bytes * a.files_per_message, 'unreachable message budget');
  assert(a.message_files_bytes <= a.chat_storage_bytes, 'message exceeds chat storage');
  assert(a.chat_storage_bytes <= a.owner_storage_bytes, 'chat exceeds owner storage');
  assert(a.files_per_message <= a.attachments_per_chat, 'message exceeds attachment count');
  assert(a.uploads_per_owner <= a.uploads_global, 'owner exceeds global uploads');
  assert(a.upload_seconds < a.upload_intent_seconds, 'intent expires before upload deadline');
  assert(a.parse_seconds < t.provider_dispatch_seconds, 'parse exceeds dispatch budget');
  assert(r.list_default_rows <= r.list_max_rows, 'default page exceeds maximum');
  assert(r.list_max_rows <= r.json_collection_items, 'rows exceed JSON collection budget');
  assert(r.report_max_groups <= r.json_collection_items, 'groups exceed JSON collection budget');
  assert(r.report_max_filters <= r.json_collection_items, 'filters exceed JSON collection budget');
  assert(r.tool_result_utf8_bytes <= r.assembled_context_utf8_bytes, 'tool result exceeds context');
  assert(a.message_text_utf8_bytes < r.assembled_context_utf8_bytes, 'message consumes entire context');
  assert(r.assistant_text_utf8_bytes <= r.provider_stream_bytes, 'answer exceeds transport cap');
  assert(r.delta_batch_utf8_bytes <= r.assistant_text_utf8_bytes, 'delta exceeds answer cap');
  const finalEvents = b.steps_per_proposal * 2 + b.tool_calls_per_run * 2 + 8;
  assert(r.outbox_events_per_activity > finalEvents, 'outbox lacks terminal transition headroom');
  assert(b.tool_calls_per_run <= b.mcp_rpc_messages_per_run, 'tool calls exceed RPC budget');
  assert(b.provider_dispatches_per_run >= 1 + b.compactions_per_run + b.delegations_per_run,
    'dispatch budget cannot fit base, compaction and delegation');
  assert(q.active_per_owner <= q.foreground_workers, 'owner exceeds foreground workers');
  assert(q.waiting_per_owner <= q.waiting_global, 'owner exceeds global queue');
  assert(t.heartbeat_seconds * 3 < t.lease_seconds, 'lease lacks heartbeat margin');
  assert(t.lease_seconds < t.provider_dispatch_seconds, 'lease must permit renewal during dispatch');
  assert(q.wait_seconds + t.provider_dispatch_seconds < t.run_seconds, 'no dispatch time after queue');
  assert(t.read_query_seconds <= t.domain_step_seconds, 'read exceeds domain deadline');
  assert(b.steps_per_proposal * t.domain_step_seconds + q.wait_seconds <= t.execution_admission_seconds,
    'execution plan cannot fit queue and steps');
  assert(t.confirmation_challenge_seconds <= t.proposal_seconds, 'challenge outlives proposal');
  assert(t.drain_seconds >= t.provider_dispatch_seconds + t.cancellation_seconds + t.flush_seconds,
    'drain cannot fit dispatch, cancellation and flush');
  assert(retry.pre_dispatch_delay_seconds.length === retry.pre_dispatch_retries, 'retry delay count');
  assert(retry.cleanup_delay_seconds.length === retry.cleanup_attempts - 1, 'cleanup delay count');
  for (const delays of [retry.pre_dispatch_delay_seconds, retry.cleanup_delay_seconds]) {
    assert(delays.every((v, i) => i === 0 || v > delays[i - 1]), 'backoff must increase');
  }
  assert(retry.pre_dispatch_delay_seconds.reduce((n, v) => n + v, 0) < q.wait_seconds,
    'retry delays consume queue deadline');
  assert(search.default_rows <= search.max_rows, 'search page exceeds maximum');
  assert(retention.sweep_seconds < retention.physical_cleanup_target_seconds, 'sweep exceeds cleanup target');
  assert(retention.physical_cleanup_target_seconds <= retention.backup_max_days * 86400,
    'cleanup target exceeds backup horizon');
  return true;
}

function main() {
  const policy = read(policyPath);
  validatePolicy(policy);
  const negativeFixtures = [];
  function reject(name, mutate, expected) {
    const candidate = structuredClone(policy);
    mutate(candidate);
    assert.throws(() => validatePolicy(candidate), expected, name);
    negativeFixtures.push(name);
  }
  reject('missing policy', p => delete p.timing, /schema/);
  reject('unknown override', p => p.model_fallback = 'fixture', /schema/);
  reject('nested unknown field', p => p.queue.unlimited = true, /schema/);
  reject('numeric string', p => p.queue.foreground_workers = '2', /schema/);
  reject('zero upload budget', p => p.admission.file_bytes = 0, /schema/);
  reject('voice product decision preserved', p => p.admission.audio_seconds = 600, /schema/);
  reject('file product decision preserved', p => p.admission.file_bytes *= 2, /schema/);
  reject('extra audit archive rejected', p => p.retention.audit_days_after_chat = 180, /schema/);
  reject('extra receipt archive rejected', p => p.retention.settled_receipt_days_after_chat = 1, /schema/);
  reject('chat window preserved', p => p.retention.chat_days = 30, /schema/);
  reject('API routing excluded', p => p.routing.api_delegation_enabled = true, /schema/);
  reject('error fallback excluded', p => p.routing.fallback_on_error = true, /schema/);
  reject('switch never confirms', p => p.routing.switch_confirms_writes = true, /schema/);
  reject('cross connection routing excluded', p => p.routing.same_connection_only = false, /schema/);
  reject('dispatch replay excluded', p => p.retry.uncertain_dispatch_retries = 1, /schema/);
  reject('gate cannot disappear', p => p.publication_gates.pop(), /schema/);
  reject('gate cannot duplicate', p => p.publication_gates[0] = p.publication_gates[1], /schema/);
  reject('file vs message mismatch', p => p.admission.message_files_bytes = 1, /file exceeds/);
  reject('unreachable message cap', p => p.admission.files_per_message = 1, /unreachable/);
  reject('chat storage mismatch', p => p.admission.chat_storage_bytes = 1, /message exceeds/);
  reject('owner storage mismatch', p => p.admission.owner_storage_bytes = 1, /chat exceeds/);
  reject('count mismatch', p => p.admission.attachments_per_chat = 1, /attachment count/);
  reject('upload concurrency mismatch', p => p.admission.uploads_per_owner = 3, /global uploads/);
  reject('upload intent too short', p => p.admission.upload_intent_seconds = 1, /intent expires/);
  reject('list cannot exceed structure', p => p.results.list_max_rows = 129, /JSON collection/);
  reject('default cannot exceed list', p => p.results.list_default_rows = 101, /default page/);
  reject('context budget insufficient', p => p.results.assembled_context_utf8_bytes = 1, /result exceeds context/);
  reject('RPC budget cannot reset calls', p => p.budget.mcp_rpc_messages_per_run = 1, /RPC budget/);
  reject('dispatch budget must fit phases', p => p.budget.provider_dispatches_per_run = 2, /base, compaction/);
  reject('lease too short', p => p.timing.lease_seconds = 15, /heartbeat margin/);
  reject('queue consumes deadline', p => p.queue.wait_seconds = 600, /dispatch time/);
  reject('step plan too large', p => p.budget.steps_per_proposal = 100, /plan cannot fit/);
  reject('drain too short', p => p.timing.drain_seconds = 120, /drain cannot fit/);
  reject('retry count mismatch', p => p.retry.pre_dispatch_retries = 0, /delay count/);
  reject('cleanup count mismatch', p => p.retry.cleanup_attempts = 1, /delay count/);
  reject('backoff does not increase', p => p.retry.cleanup_delay_seconds[1] = 5, /backoff/);
  reject('search default exceeds maximum', p => p.search.default_rows = 101, /search page/);
  reject('sweep too slow', p => p.retention.sweep_seconds = 86400, /sweep exceeds/);

  const agenticPath = 'docs/evidence/nodia-ai-ai03-gemini-agentic-viability.json';
  const observed = read(agenticPath).authoritativeLiveRun.probe.checks
    .filter(c => typeof c.elapsed_seconds === 'number').map(c => c.elapsed_seconds);
  assert.equal(observed.length, 4, 'Recorded AI-03 dispatch timings missing');
  assert(observed.every(s => s < policy.timing.provider_dispatch_seconds), 'Baseline exceeds selected deadline');
  const boundaryChecks = [];
  function check(name, condition) { assert(condition, name); boundaryChecks.push(name); }
  const byteCap = policy.admission.message_text_utf8_bytes;
  check('UTF8 emoji boundary is bytes, not JS length',
    Buffer.byteLength('😀'.repeat(byteCap / 4)) === byteCap &&
    Buffer.byteLength('😀'.repeat(byteCap / 4) + 'a') === byteCap + 1);
  check('two full files fit one message, third exceeds aggregate',
    2 * policy.admission.file_bytes === policy.admission.message_files_bytes &&
    3 * policy.admission.file_bytes > policy.admission.message_files_bytes);
  const base = Date.parse('2026-10-15T12:00:00Z');
  const expires = base + policy.retention.chat_days * 86400000;
  check('90 UTC periods cross year without local timezone arithmetic',
    new Date(expires).toISOString() === '2027-01-13T12:00:00.000Z' && expires - 1 < expires);
  check('full queue does not imply latency guarantee',
    policy.queue.waiting_global * policy.timing.provider_dispatch_seconds > policy.queue.wait_seconds);
  check('dispatch cap includes delegation and compaction without resetting budget',
    1 + policy.budget.delegations_per_run + policy.budget.compactions_per_run === policy.budget.provider_dispatches_per_run);
  check('worst simultaneous parser allowance is explicit',
    policy.admission.uploads_global * policy.admission.parse_memory_mib === 512);

  const files = [policyPath, schemaPath, 'docs/mvp/50-nodia-ai-ai04-runtime-policy.md',
    'docs/architecture/decisions/ADR-037-nodia-ai-admission-and-minimal-retention.md',
    'docs/nodia-ai/knowledge/nodia-ai/features/runtime-policy.md',
    'docs/evidence/scripts/validate-nodia-ai-ai04.cjs'];
  let localLinksChecked = 0;
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert(!text.includes('\uFFFD'), 'Invalid encoding: ' + file);
    assert(!text.split(/\r?\n/).some(l => /[\t ]+$/.test(l)), 'Trailing whitespace: ' + file);
    if (!file.endsWith('.md')) continue;
    for (const match of text.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
      const link = match[1].replace(/^<|>$/g, '').split('#')[0];
      if (!link || /^[a-z][a-z0-9+.-]*:\/\//i.test(link)) continue;
      const target = path.resolve(root, path.dirname(file), link);
      const generatedHere = process.argv.includes('--write') && target === path.join(root,
        'docs/evidence/nodia-ai-ai04-runtime-policy-validation.json');
      assert(generatedHere || fs.existsSync(target), 'Missing link: ' + link);
      localLinksChecked++;
    }
  }
  const evidence = {
    date: '2026-10-15', task: 'AI-04', status: 'policy_validated_runtime_gated',
    scope: 'Offline schema, semantic rejection fixtures, arithmetic boundaries and recorded evidence comparison only',
    policyVersion: policy.policy_version,
    negativeFixtures, boundaryChecks, localLinksChecked,
    observedAgenticDispatchSeconds: observed,
    observedEvidenceSha256: hash(agenticPath),
    providerDeadlineSeconds: policy.timing.provider_dispatch_seconds,
    measuredDeadlineMarginSeconds: Number((policy.timing.provider_dispatch_seconds - Math.max(...observed)).toFixed(2)),
    productionGates: policy.publication_gates.map(id => ({ id, status: 'pending_runtime_test' })),
    servicesStarted: false, providerCalls: 0, businessWrites: 0,
    artifacts: files.map(file => ({ file, sha256: hash(file) })),
    limitations: [
      'Does not implement or prove PostgreSQL admission, locks, budgets, races, fencing or leases',
      'Does not test parser resource limits, modalities, real storage deletion or backup rotation',
      'Four recorded dispatches are a baseline, not percentiles, capacity or a provider quota',
      'No live service, model inference, schema migration or automatic document approval'
    ]
  };
  const outputPath = 'docs/evidence/nodia-ai-ai04-runtime-policy-validation.json';
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(root, outputPath), JSON.stringify(evidence, null, 2) + '\n');
  } else {
    assert.deepEqual(read(outputPath), evidence, 'Recorded policy evidence drift; review changes then regenerate with --write');
  }
  console.log(JSON.stringify({ status: evidence.status, negativeFixtures: negativeFixtures.length,
    boundaryChecks: boundaryChecks.length, localLinksChecked, observedDispatches: observed.length,
    measuredDeadlineMarginSeconds: evidence.measuredDeadlineMarginSeconds,
    runtimeGatesPending: evidence.productionGates.length, wroteEvidence: process.argv.includes('--write') }, null, 2));
}

if (require.main === module) main();
module.exports = { validatePolicy };
