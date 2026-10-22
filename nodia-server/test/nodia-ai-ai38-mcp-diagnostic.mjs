// AI-38: one explicit MCP nonce probe; configured PostgreSQL remains strictly read-only.
// No transport payload, response body, service token, free-form URL or provider output is logged.
// Keep ai15-live-attest unchanged as historical evidence. This harness also records the
// post-start not_dispatched classification risk without changing production transport.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { parse } from 'dotenv';
assert.equal(process.env.NODIA_AI_ALLOW_LIVE, 'yes');
assert.equal(process.env.NODIA_AI_ATTEST_CONFIGURED_DB, 'read_only', 'Explicit configured read-only database gate is required');
const config = parse(fs.readFileSync(process.env.NODIA_AI_LAB_API_ENV));
const snapshot = JSON.parse(fs.readFileSync(process.env.NODIA_AI_LAB_SELECTION_JSON, 'utf8'));
const candidates = snapshot.rows.filter((row) => row.provider_key === 'gemini' && row.is_active);
assert.equal(candidates.length, 1, 'Select one exact observed Gemini connection');
for (const key of ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'GEMINI_MICROSERVICE_URL', 'GEMINI_SERVICE_TOKEN']) assert.ok(typeof config[key] === 'string' && config[key].length, `Missing configured ${key}`);
const serviceUrl = new URL(config.GEMINI_MICROSERVICE_URL);
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(serviceUrl.hostname));
assert.match(config.GEMINI_SERVICE_TOKEN, /^[a-f0-9]{64}$/i);
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL.replace(/\/+$/, '');
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
const { Test } = await import('@nestjs/testing');
const { TypeOrmModule } = await import('@nestjs/typeorm');
const { DataSource } = await import('typeorm');
const { NodiaAiAdapterModule } = await import('../dist/nodia-ai-adapter/nodia-ai-adapter.module.js');
const { NodiaAiAdapterTransport } = await import('../dist/nodia-ai-adapter/nodia-ai-adapter.service.js');
const { NodiaAiAdapterPort } = await import('../dist/nodia-ai-adapter/types/nodia-ai-adapter.types.js');
const { GeminiNodiaAiAdapterUseCase } = await import('../dist/nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case.js');
const { NodiaAiRuntimeReconciliationPort } = await import('../dist/nodia-ai-runtime/types/reconciliation.types.js');
const { projectNodiaAiConnection } = await import('../dist/nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js');
const port = Number(config.POSTGRES_PORT);
assert.ok(Number.isInteger(port) && port >= 1 && port <= 65535);
const options = { type: 'postgres', host: config.POSTGRES_HOST, port, username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD, database: config.POSTGRES_DB, entities: [], migrations: [], synchronize: false, migrationsRun: false, extra: { options: '-c default_transaction_read_only=on' } };
const db = await new DataSource(options).initialize();
let module, proofs, requestIdentity, terminalProof, dispatched = false, pending = false, failure, result;
const observeOnly = process.argv.includes('--observe-only');
const diagnostics = {
  schema_version: 1,
  callbacks: null,
  protocol_progress_notifications: null,
  last_rpc_messages: null,
  last_unforwarded_tool_requests: null,
  valid_progress_snapshots: 0,
  start_admission: 'not_requested',
  post_start_not_dispatched_error: false,
  attempt_id: null,
  selection: null,
  configuration_generation: null,
  session_generation: null,
  phases: {},
  endpoints: Object.fromEntries(['observe', 'start', 'events', 'results', 'attest', 'cancel', 'reconcile', 'acknowledge']
    .map((name) => [name, { requests: 0, completed: 0, failed: 0 }])),
};
function phase(name) { diagnostics.phases[name] = (diagnostics.phases[name] ?? 0) + 1; }
function endpointName(route) {
  if (route === '/nodia-ai/agentic/observe') return 'observe';
  if (route === '/nodia-ai/agentic/mcp/start') return 'start';
  assert.ok(requestIdentity, 'Attempt identity required for private attempt endpoints');
  const base = `/nodia-ai/agentic/attempts/${requestIdentity.attemptId}`;
  for (const name of ['events', 'results', 'attest', 'cancel']) if (route === `${base}/mcp/${name}`) return name;
  for (const name of ['reconcile', 'acknowledge']) if (route === `${base}/${name}`) return name;
  assert.fail('Unexpected diagnostic endpoint');
}
const nativeTransport = new NodiaAiAdapterTransport();
const observedTransport = {
  async request(route, payload, signal, dispatch = false) {
    const endpoint = endpointName(route);
    const counter = diagnostics.endpoints[endpoint];
    if (endpoint === 'start') {
      assert.equal(counter.requests, 0, 'At most one start request; no automatic inference retry');
      diagnostics.start_admission = 'requested';
    }
    counter.requests++;
    try {
      const response = await nativeTransport.request(route, payload, signal, dispatch);
      counter.completed++;
      if (endpoint === 'start') diagnostics.start_admission =
        response?.attempt_id === requestIdentity?.attemptId && response?.state === 'running' ? 'running' : 'uncertain';
      if (endpoint === 'events' && response?.attempt_id === requestIdentity?.attemptId &&
          Number.isSafeInteger(response.rpc_messages) && response.rpc_messages >= 0 && response.rpc_messages <= 128 &&
          Number.isSafeInteger(response.unforwarded_tool_requests) && response.unforwarded_tool_requests >= 0 && response.unforwarded_tool_requests <= 12) {
        diagnostics.valid_progress_snapshots++;
        diagnostics.last_rpc_messages = response.rpc_messages;
        diagnostics.last_unforwarded_tool_requests = response.unforwarded_tool_requests;
      }
      return response;
    } catch (error) {
      counter.failed++;
      if (endpoint === 'start') diagnostics.start_admission =
        error?.outcome === 'not_dispatched' ? 'rejected_no_admission' : 'uncertain';
      if (diagnostics.start_admission === 'running' && error?.outcome === 'not_dispatched')
        diagnostics.post_start_not_dispatched_error = true;
      throw error;
    }
  },
};
try {
  phase('verify_configured_selection');
  const [readOnly] = await db.query('SHOW default_transaction_read_only');
  assert.equal(readOnly.default_transaction_read_only, 'on');
  const [row] = await db.query(`SELECT p.id::text, p.name AS label, p.is_active, p.use_api_key, p.use_token_plan_web, p.use_token_plan_agentic,
    p.fields, c.key AS provider_key, c.is_active AS catalog_active, c.can_use_api_key, c.can_use_token_plan_web, c.can_use_token_plan_agentic
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`, [String(candidates[0].connection_id)]);
  assert.ok(row && row.provider_key === 'gemini' && row.is_active === true && row.use_token_plan_agentic === true);
  // Reuse the production UI projection, including own per-model null clearing and historical-field precedence.
  const projected = projectNodiaAiConnection(row).modes.find((mode) => mode.mode === 'token_plan_agentic');
  assert.equal(projected.configuration, 'configured', 'A valid configured Agentic selection is required; no fallback');
  const selection = projected.configured_selection;
  assert.ok(selection);
  assert.equal(selection.model_id, candidates[0].agentic_model, 'Configured model changed since the explicit selection snapshot');
  assert.equal(selection.effort_id, candidates[0].agentic_effort ?? null, 'Configured effort changed since the explicit selection snapshot');
  diagnostics.selection = { connection_id: selection.connection_id, mode: selection.mode, model_id: selection.model_id, effort_id: selection.effort_id };
  module = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), NodiaAiAdapterModule] })
    .overrideProvider(NodiaAiAdapterTransport).useValue(observedTransport).compile();
  const adapter = module.get(NodiaAiAdapterPort), concrete = module.get(GeminiNodiaAiAdapterUseCase);
  proofs = module.get(NodiaAiRuntimeReconciliationPort);
  phase('observe_before');
  const observed = await adapter.observe(selection);
  diagnostics.configuration_generation = observed.configurationGeneration;
  diagnostics.session_generation = observed.sessionGeneration;
  assert.equal(observed.available, true, 'Exact configured connection must be eligible before any diagnostic generation');
  const [current] = await db.query('SELECT fields FROM ai_providers WHERE id=$1', [selection.connection_id]);
  const currentSelection = projectNodiaAiConnection({ ...row, fields: current?.fields }).modes.find((mode) => mode.mode === 'token_plan_agentic').configured_selection;
  assert.deepEqual(currentSelection, selection, 'A concurrent model or effort change requires a new explicit observation');
  result = { task: 'AI-38', scope: 'exact_configured_connection_mcp_nonce_diagnostic', configured_database_read_only: true, configured_database_modified: false, configured_selection_modified: false, available_before: observed.available, supports_mcp_before: observed.supportsMcp, real_provider_dispatch_requests: 0, maximum_provider_dispatch_requests: observeOnly ? 0 : 1, diagnostic_nonce_verified: false, native_terminal_proof_acknowledged: false, inference_replayed: false };
  if (!observeOnly) {
    const nonce = randomBytes(16).toString('hex');
    let callbacks = 0;
    diagnostics.callbacks = 0;
    diagnostics.protocol_progress_notifications = 0;
    const request = { attemptId: randomUUID(), selection, canonicalPrompt: JSON.stringify({ instructions: 'Prueba técnica aislada. Llama nodia_fixture_configured_probe exactamente una vez con {} y devuelve el código nonce obtenido. No ejecutes shell, archivos, red u otras herramientas.', messages: [] }), deadlineAt: new Date(Date.now() + 120000), resourceKey: observed.resourceKey, sessionGeneration: observed.sessionGeneration, configurationGeneration: observed.configurationGeneration,
      tools: [{ name: 'nodia_fixture_configured_probe', description: 'Diagnóstico de transporte sin acceso a datos o acciones del negocio.', inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false } }],
      async onToolCall(call) {
        diagnostics.callbacks = ++callbacks;
        assert.equal(call.name, 'nodia_fixture_configured_probe'); assert.deepEqual(call.arguments, {});
        assert.equal(callbacks, 1); return { fixture_only: true, nonce };
      },
      async onProtocolProgress(count, _signal, unforwarded) {
        diagnostics.protocol_progress_notifications++;
        diagnostics.last_rpc_messages = count;
        diagnostics.last_unforwarded_tool_requests = unforwarded ?? null;
        assert.ok(Number.isSafeInteger(count) && count >= 0 && count <= 128);
        assert.ok(Number.isSafeInteger(unforwarded) && unforwarded >= 0 && unforwarded <= 12);
      },
    };
    requestIdentity = { engine: 'agentic', attemptId: request.attemptId, operationRef: request.attemptId, resourceKey: request.resourceKey, sessionGeneration: request.sessionGeneration };
    diagnostics.attempt_id = request.attemptId;
    pending = true; dispatched = true; result.real_provider_dispatch_requests = 1;
    phase('probe');
    const answer = await concrete.probeMcp(request);
    phase('probe_returned');
    terminalProof = answer.terminalProof;
    phase('acknowledge_completed');
    await proofs.acknowledge(terminalProof, AbortSignal.timeout(15000));
    pending = false;
    assert.equal(answer.kind, 'answer');
    assert.equal(callbacks, 1);
    assert.ok(answer.text.includes(nonce));
    result.diagnostic_nonce_verified = true; result.native_terminal_proof_acknowledged = true;
  }
  phase('observe_after');
  const after = await adapter.observe(selection);
  result.supports_mcp_after = after.supportsMcp;
  if (!observeOnly) assert.equal(after.supportsMcp, true);
  result.status = 'passed';
  phase('passed');
} catch (error) {
  phase('failed');
  // A later endpoint may report not_dispatched although /start already returned running.
  // The attempt still needs reconciliation; an error category cannot erase its identity.
  if (diagnostics.start_admission === 'not_requested' || diagnostics.start_admission === 'rejected_no_admission') pending = false;
  failure = error;
  result ??= { task: 'AI-38', configured_database_read_only: true, configured_database_modified: false, real_provider_dispatch_requests: dispatched ? 1 : 0, maximum_provider_dispatch_requests: observeOnly ? 0 : 1, inference_replayed: false };
  result.status = 'failed';
  result.error_code = typeof error?.code === 'string' && /^[a-z_:-]{1,160}$/.test(error.code) ? error.code : 'attestation_check_failed';
} finally {
  if (pending) {
    try {
      if (!terminalProof) { phase('reconcile'); terminalProof = await proofs.reconcile(requestIdentity, AbortSignal.timeout(15000)); }
      phase('acknowledge_recovered'); await proofs.acknowledge(terminalProof, AbortSignal.timeout(15000));
      pending = false; result.native_terminal_proof_acknowledged = true;
    }
    catch { /* Preserve the only unresolved identity, never replay the generation. */ }
  }
  if (pending) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nodia-ai38-mcp-diagnostic-recovery-'));
    fs.chmodSync(directory, 0o700);
    fs.writeFileSync(path.join(directory, 'recovery.json'), JSON.stringify({ request: requestIdentity, proof: terminalProof ?? null }, null, 2), { mode: 0o600 });
    console.error(`Unresolved native identity preserved for reconciliation: ${directory}`);
    process.exitCode = 1;
  }
  result.native_pending_identity = pending;
  result.real_provider_dispatch_requests = diagnostics.endpoints.start.requests;
  result.diagnostics = diagnostics;
  phase('cleanup');
  await module?.close();
  if (db.isInitialized) await db.destroy();
  if (process.env.NODIA_AI_LAB_REPORT_JSON) fs.writeFileSync(process.env.NODIA_AI_LAB_REPORT_JSON, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
if (failure) { process.exitCode = 1; console.error('Configured MCP attestation failed; inspect its safe report. No inference was replayed.'); }
