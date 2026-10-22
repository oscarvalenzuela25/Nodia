// Explicit operator comparison: two independent, identical synthetic MCP probes.
// Reuses production probeMcp/attestation/reconciliation. No business tools or SQL writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const [candidate, runtime, inputFile, output, flag] = process.argv.slice(2);
const control = flag === '--control';
assert.ok(candidate && path.isAbsolute(candidate) && output && path.isAbsolute(output));
assert.equal(fs.existsSync(output), false, 'Preserve every earlier comparison');
assert.equal(process.env.NODIA_AI_ALLOW_LIVE, control ? 'no' : 'yes');
const require = createRequire(path.join(candidate, 'package.json'));
require('reflect-metadata');
const load = file => import(pathToFileURL(path.join(candidate, 'dist', file + '.js')).href);
const [{ GeminiNodiaAiAdapterUseCase: Adapter }, { NodiaAiAdapterTransport: Transport },
  { ReconcileGeminiNodiaAiRuntimeUseCase: Reconciliation }, { projectNodiaAiConnection: project }] = await Promise.all([
  load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'), load('nodia-ai-adapter/nodia-ai-adapter.service'),
  load('nodia-ai-adapter/use-case/reconcile-gemini-nodia-ai-runtime.use-case'),
  load('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case'),
]);
const sha = value => createHash('sha256').update(Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const now = () => ({ at_utc: new Date().toISOString(), monotonic_ms: performance.now() });
const report = { stage: 'AI-36-C05', scope: 'paired_effort_synthetic_MCP_diagnostic_not_business_acceptance',
  status: 'running', started_at_utc: new Date().toISOString(), maximum_native_start_requests: 2,
  native_start_requests: 0, accepted_native_starts: 0, automatic_inference_retries: 0,
  synthetic_provider_transport: control, real_provider_generations: 0,
  configured_SQL_writes: 0, configured_selection_modified: false, business_tools: 0, business_effects: 0,
  services_restarted: false, storage_operations: 0, credentials_logged: false,
  semantic_acceptance: false, probes: [], checks: [], input_sha256: control ? null : sha(fs.readFileSync(inputFile)),
  source_sha256: sha(fs.readFileSync(new URL(import.meta.url))) };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const check = (id, condition = true) => { assert.ok(condition, id); report.checks.push(id); save(); };
const toolName = 'nodia_fixture_effort_compare';
const tools = [{ name: toolName, description: 'Return a synthetic test nonce without database access or business effects.',
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false } }];
const canonicalPrompt = `Verificación técnica aislada. Llama exactamente una vez a ${toolName} con {}. Después responde sólo con el returned_nonce recibido, literalmente dentro de answer.text. El valor no está en este mensaje. No uses otras herramientas ni solicites escrituras.`;
const nonce = randomBytes(20).toString('hex');
const callbackResult = { schema_version: 1, source: 'explicit_synthetic_fixture', returned_nonce: nonce };
report.canonical_prompt_sha256 = sha(canonicalPrompt); report.tools_sha256 = sha(tools);
report.synthetic_callback_result_sha256 = sha(callbackResult);
let source, active, pending, proofs, terminalProof;
const starts = [], fakeJobs = new Map(), fakeAttestations = new Set();
let row, input, base;
try {
  if (control) {
    row = { id: '2', name: 'Synthetic comparison', is_active: true, use_token_plan_agentic: true,
      use_token_plan_web: false, use_api_key: false, provider_key: 'gemini', catalog_active: true,
      can_use_token_plan_agentic: true, can_use_token_plan_web: true, can_use_api_key: true,
      fields: { token_plan_agentic: { selected_model: 'synthetic-compare-model', thinking_level: 'high' } },
      updated_at: new Date('2026-10-19T00:00:00Z') };
    source = { manager: { query: async () => [row] } };
    const high = project(row).modes.find(item => item.mode === 'token_plan_agentic').configured_selection;
    input = { schema_version: 1, high_selection: high, low_selection: { ...high, effort_id: 'low' },
      public_mode_configuration_sha256: sha(row.fields.token_plan_agentic) };
    base = { async request(target, payload) {
      if (target.endsWith('/observe')) return { available: true, observed_at: new Date().toISOString(),
        source: 'gemini_live_session_and_catalog', resource_key: 'gemini-profile:' + 'b'.repeat(64),
        session_generation: 'd'.repeat(32), adapter_contract_version: 'nodia-ai-gemini-chat/1',
        supports_mcp: fakeAttestations.has(payload.effort_id), reason: null };
      if (target.endsWith('/measure-context')) {
        const canonical = Buffer.byteLength(payload.canonical_prompt), catalog = Buffer.byteLength(JSON.stringify(payload.tools));
        return { measurement_contract_version: 'nodia-ai-context-budget/1', measurement_scope: 'initial_native_prompt',
          measurement_kind: 'exact', canonical_utf8_bytes: canonical, catalog_utf8_bytes: catalog,
          overhead_utf8_bytes: 1000, total_utf8_bytes: canonical + catalog + 1000, max_utf8_bytes: 262144,
          first_mcp_listing_upper_bound_utf8_bytes: catalog + 1000, model_context_tokens: null };
      }
      if (target === '/nodia-ai/agentic/mcp/start') {
        fakeJobs.set(payload.attempt_id, { payload, proof: randomUUID(), call: randomUUID(), result: null });
        return { attempt_id: payload.attempt_id, state: 'running' };
      }
      const match = target.match(/^\/nodia-ai\/agentic\/attempts\/([a-f0-9-]{36})\/(mcp\/(?:events|results|attest)|acknowledge)$/u);
      assert.ok(match, 'Synthetic transport permits only the exact production protocol');
      const job = fakeJobs.get(match[1]); assert.ok(job);
      if (match[2] === 'mcp/results') { job.result = payload.result; return { accepted: true }; }
      if (match[2] === 'mcp/attest') { fakeAttestations.add(job.payload.effort_id); return { verified: true, adapter_contract_version: 'nodia-ai-gemini-chat/1' }; }
      if (match[2] === 'acknowledge') { assert.equal(payload.terminal_proof_id, job.proof); return { acknowledged: true }; }
      const terminal = { attempt_id: match[1], resource_key: job.payload.resource_key, session_generation: job.payload.session_generation,
        operation_ref: match[1], terminal_proof_id: job.proof, process_closed: true, outcome: 'completed', observed_at: new Date().toISOString() };
      return { attempt_id: match[1], state: job.result ? 'completed' : 'running', rpc_messages: 7, unforwarded_tool_requests: 0,
        events: job.result ? [{ seq: 2, kind: 'answer', text: job.result.returned_nonce, terminal_proof: terminal }]
          : [{ seq: 1, kind: 'tool_request', name: toolName, call_id: job.call, arguments: {} }] };
    } };
  } else {
    assert.ok(runtime && path.isAbsolute(runtime) && inputFile && path.isAbsolute(inputFile));
    input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const { parse } = require('dotenv'), { DataSource } = require('typeorm');
    const config = parse(fs.readFileSync(path.join(runtime, '.env')));
    assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(new URL(config.GEMINI_MICROSERVICE_URL).hostname));
    assert.match(config.GEMINI_SERVICE_TOKEN ?? '', /^[a-f0-9]{64}$/iu);
    process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL;
    process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
    process.env.DOTENV_CONFIG_PATH = '/dev/null';
    source = await new DataSource({ type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT),
      database: config.POSTGRES_DB, username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
      ssl: config.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      extra: { options: '-c default_transaction_read_only=on' }, synchronize: false, migrationsRun: false }).initialize();
    assert.equal((await source.query('SHOW default_transaction_read_only'))[0].default_transaction_read_only, 'on');
    [row] = await source.query(`SELECT p.id::text,p.name,p.is_active,p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,
      p.fields,p.updated_at,c.key provider_key,c.is_active catalog_active,c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
      FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`, [input.high_selection.connection_id]);
    base = new Transport();
  }
  assert.deepEqual(Object.keys(input).sort(), ['high_selection', 'low_selection', 'public_mode_configuration_sha256', 'schema_version']);
  assert.equal(input.schema_version, 1);
  const configured = project(row).modes.find(item => item.mode === 'token_plan_agentic').configured_selection;
  assert.deepEqual(configured, input.high_selection, 'High is the exact current public configured selection');
  assert.equal(sha(row.fields.token_plan_agentic), input.public_mode_configuration_sha256);
  const withoutEffort = ({ effort_id: _effort, ...rest }) => rest;
  assert.deepEqual(withoutEffort(input.high_selection), withoutEffort(input.low_selection));
  assert.notEqual(input.high_selection.effort_id, input.low_selection.effort_id);
  assert.ok(typeof input.low_selection.effort_id === 'string' && input.low_selection.effort_id.trim());
  report.public_mode_configuration_sha256 = input.public_mode_configuration_sha256;
  const transport = { async request(target, payload, signal, dispatch) {
    const kind = target.split('/').at(-1), stamp = now();
    assert.ok(['observe', 'measure-context', 'start', 'events', 'results', 'attest', 'cancel', 'reconcile', 'acknowledge'].includes(kind));
    if (kind === 'start') {
      assert.ok(active && report.native_start_requests < 2);
      report.native_start_requests++; starts.push(structuredClone(payload));
      assert.equal(payload.diagnostic, true); assert.ok(!payload.attachments);
      const { attempt_id: _attempt, effort_id: _effort, ...stable } = payload;
      active.stable_native_start_payload_sha256 = sha(stable);
      if (starts.length > 1) {
        const { attempt_id: _firstAttempt, effort_id: _firstEffort, ...firstStable } = starts[0];
        assert.deepEqual(stable, firstStable, 'Only native attempt and effort may differ between probes');
      }
      active.native_start_payload_sha256 = sha(payload);
    }
    const trace = active ? active.transport[kind] ??= { requests: 0, responses: 0, failures: 0, total_ms: 0, minimum_ms: null, maximum_ms: null } : null;
    if (trace) { trace.requests++; trace.last_started = stamp; save(); }
    try {
      const response = await base.request(target, payload, signal, dispatch), ended = now();
      if (trace) {
        const elapsed = ended.monotonic_ms - stamp.monotonic_ms;
        trace.responses++; trace.total_ms += elapsed; trace.minimum_ms = Math.min(trace.minimum_ms ?? elapsed, elapsed);
        trace.maximum_ms = Math.max(trace.maximum_ms ?? elapsed, elapsed); trace.last_finished = ended;
        if (kind === 'start') active.native_start = { started: stamp, accepted: ended, timeout_seconds: payload.timeout_seconds };
        if (kind === 'results') active.result_submission = { started: stamp, finished: ended, accepted: response.accepted === true, call_id: payload.call_id };
        if (kind === 'attest') active.attestation = { verified: response.verified === true, observed: ended };
        if (kind === 'acknowledge') active.ACK = { attempt_id: payload.operation_ref, terminal_proof_sha256: sha(payload.terminal_proof_id), acknowledged: response.acknowledged === true, observed: ended };
      }
      if (kind === 'start' && response.state === 'running') {
        report.accepted_native_starts++; active.accepted_native_starts++;
        if (!control) { report.real_provider_generations++; active.real_provider_generations++; }
      }
      save(); return response;
    } catch (error) {
      if (trace) { trace.failures++; trace.last_failed = now(); save(); } throw error;
    }
  } };
  const adapter = new Adapter(source, transport); proofs = new Reconciliation(transport);
  for (const [label, selection] of [['high', input.high_selection], ['low', input.low_selection]]) {
    active = { label, selection, attempt_id: randomUUID(), status: 'running', transport: {}, callback_count: 0,
      accepted_native_starts: 0, real_provider_generations: 0 };
    report.probes.push(active); save();
    const observed = await adapter.observe(selection, AbortSignal.timeout(35000));
    check(label + '_current_selection_available', observed.available && observed.resourceKey && observed.sessionGeneration);
    active.observation = { supports_mcp_before: observed.supportsMcp, configuration_generation: observed.configurationGeneration,
      resource_key_sha256: sha(observed.resourceKey), session_generation_sha256: sha(observed.sessionGeneration) };
    const measured = await adapter.measureContext({ selection, canonicalPrompt, tools });
    check(label + '_complete_context_fits', measured.totalUtf8Bytes + measured.firstMcpListingUpperBoundUtf8Bytes <= measured.maxUtf8Bytes);
    active.measurement = measured;
    pending = { engine: 'agentic', attemptId: active.attempt_id, operationRef: active.attempt_id,
      resourceKey: observed.resourceKey, sessionGeneration: observed.sessionGeneration };
    active.execute_started = now(); save();
    const reply = await adapter.probeMcp({ attemptId: active.attempt_id, selection, canonicalPrompt, tools,
      resourceKey: observed.resourceKey, configurationGeneration: observed.configurationGeneration,
      sessionGeneration: observed.sessionGeneration, deadlineAt: new Date(Date.now() + 120000),
      async onToolCall(call) {
        assert.equal(call.name, toolName); assert.deepEqual(call.arguments, {}); assert.equal(++active.callback_count, 1);
        active.callback = { call_id: call.callId, name: call.name, observed: now() }; save(); return callbackResult;
      }, async onProtocolProgress(count, _signal, unforwarded) {
        assert.ok(Number.isInteger(count) && count <= 128); assert.equal(unforwarded, 0);
        active.protocol_rpc_messages = count; save();
      },
    }, AbortSignal.timeout(120000));
    active.execute_finished = now(); terminalProof = reply.terminalProof;
    active.terminal_proof = { attempt_id: terminalProof.attemptId, terminal_proof_sha256: sha(terminalProof.terminalProofId),
      outcome: terminalProof.outcome, process_closed: terminalProof.processClosed };
    await proofs.acknowledge(terminalProof, AbortSignal.timeout(15000)); pending = undefined; terminalProof = undefined;
    check(label + '_nonce_callback_completed_attested_and_ACKed', reply.kind === 'answer' && reply.text.includes(nonce) && active.callback_count === 1 &&
      active.attestation?.verified && active.ACK?.acknowledged && active.ACK.terminal_proof_sha256 === active.terminal_proof.terminal_proof_sha256 &&
      active.ACK.attempt_id === active.attempt_id && active.terminal_proof.attempt_id === active.attempt_id &&
      active.terminal_proof.outcome === 'completed' && active.terminal_proof.process_closed === true);
    const after = await adapter.observe(selection, AbortSignal.timeout(35000));
    check(label + '_exact_effort_MCP_proof_current', after.available && after.supportsMcp);
    check(label + '_native_identity_and_configuration_unchanged', after.configurationGeneration === observed.configurationGeneration &&
      after.resourceKey === observed.resourceKey && after.sessionGeneration === observed.sessionGeneration);
    active.status = 'passed'; active.execute_elapsed_ms = active.execute_finished.monotonic_ms - active.execute_started.monotonic_ms; save();
  }
  check('exactly_two_distinct_independent_starts', starts.length === 2 && starts[0].attempt_id !== starts[1].attempt_id);
  check('identical_prompt_tools_result_and_timeout_except_attempt_and_effort', report.probes[0].stable_native_start_payload_sha256 === report.probes[1].stable_native_start_payload_sha256);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; if (active) active.status = 'failed';
  report.failure_code = typeof error?.code === 'string' && /^[a-z][a-z0-9_]{0,127}$/u.test(error.code) ? error.code : 'comparison_assertion_or_protocol_failure';
  if (error?.outcome === 'not_dispatched') pending = undefined;
  process.exitCode = 1;
} finally {
  if (pending && proofs) {
    try {
      terminalProof ??= await proofs.reconcile(pending, AbortSignal.timeout(20000));
      await proofs.acknowledge(terminalProof, AbortSignal.timeout(15000));
      active.reconciliation = { outcome: terminalProof.outcome, process_closed: terminalProof.processClosed, acknowledged: true };
      pending = undefined;
    } catch { report.unresolved_native_identity = pending; }
  }
  report.unresolved_native_state = Boolean(pending);
  report.finished_at_utc = new Date().toISOString(); save();
  if (source?.isInitialized) await source.destroy();
  console.log(JSON.stringify({ status: report.status, control, native_starts: report.native_start_requests,
    actual_provider_generations: report.real_provider_generations, checks: report.checks.length, unresolved: Boolean(pending) }));
}
