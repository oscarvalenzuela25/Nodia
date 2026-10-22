// AI-38: real Web -> opted-in Agentic -> next-turn Web, with disposable SQL only.
// Candidate publication, context, gateway and worker stages are production code.
// No provider fallback, bootstrap generation, synthetic publication or native restart.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { parse } from 'dotenv';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

assert.equal(process.env.NODIA_AI_ALLOW_LIVE, 'yes');
assert.equal(process.env.NODIA_AI_ATTEST_CONFIGURED_DB, 'read_only');
const preflightOnly = process.argv.includes('--preflight-only');
const output = process.env.NODIA_AI_LAB_REPORT_JSON;
assert.ok(output && path.isAbsolute(output) && !fs.existsSync(output));
const config = parse(fs.readFileSync(process.env.NODIA_AI_LAB_API_ENV));
const observedCanary = JSON.parse(fs.readFileSync(process.env.NODIA_AI38_EXPECTED_MCP_REPORT, 'utf8'));
assert.equal(observedCanary.status, 'passed');
assert.equal(observedCanary.native_pending_identity, false);
assert.equal(observedCanary.native_result.diagnostic_nonce_verified, true);
const expectedAgentic = observedCanary.native_result.diagnostics;
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(new URL(config.GEMINI_MICROSERVICE_URL).hostname));
assert.match(config.GEMINI_SERVICE_TOKEN, /^[a-f0-9]{64}$/iu);
process.env.GEMINI_MICROSERVICE_URL = config.GEMINI_MICROSERVICE_URL.replace(/\/+$/u, '');
process.env.GEMINI_SERVICE_TOKEN = config.GEMINI_SERVICE_TOKEN;
process.env.DOTENV_CONFIG_PATH = '/dev/null';
const sha = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const report = { stage: 'AI-38', scope: 'real_Web_opt_in_Agentic_next_turn_Web_disposable_SQL',
  status: 'running', started_at_utc: new Date().toISOString(), preflight_only: preflightOnly,
  maximum_provider_dispatch_requests: preflightOnly ? 0 : 5, provider_dispatch_requests: 0,
  maximum_provider_dispatch_requests_per_delegated_run: 3, native_accepted_starts: { web: 0, agentic: 0 },
  generation_count_scope: 'Nodia_adapter_requests_not_provider_internal_tokens_or_billing',
  automatic_inference_retries: 0, configured_SQL_writes: 0, configured_database_read_only: true,
  provider_configuration_modified: false, operational_Node_modified: false, native_restarts: 0,
  synthetic_provider_transport: false, synthetic_publication_override: false,
  fixture_authenticated_actor: true, standalone_worker_or_UI_acceptance: false,
  writes_confirmed_or_business_effects_created: 0, checks: [], generations: [], turns: [],
  terminal_ACKs: [], transport_counts: {}, native_pending_identity: null };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const check = (name, value = true) => { assert.ok(value, name); report.checks.push(name); save(); };
save();
const operational = new DataSource({ type: 'postgres', host: config.POSTGRES_HOST, port: Number(config.POSTGRES_PORT),
  database: config.POSTGRES_DB, username: config.POSTGRES_USER, password: config.POSTGRES_PASSWORD,
  extra: { options: '-c default_transaction_read_only=on' }, synchronize: false, migrationsRun: false });
let fixture, compiled, activeTurn, cleanup, reconciliation, pending = false;
const trackedNative = new Map();
try {
  await operational.initialize();
  const [readOnly] = await operational.query('SHOW default_transaction_read_only');
  assert.equal(readOnly.default_transaction_read_only, 'on');
  const [quiet] = await operational.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`);
  check('configured SQL has no active or uncertain work before verification', Object.values(quiet).every(value => value === 0));
  const rows = await operational.query(`SELECT p.id::text,p.updated_at,p.fields,p.is_active,
    p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,c.key provider_key,c.is_active catalog_active,
    c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
    WHERE c.key='gemini' AND p.is_active AND c.is_active`);
  assert.equal(rows.length, 1);
  const original = rows[0];
  const project = await loadAi('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case', 'projectNodiaAiConnection');
  const modes = project(original).modes;
  const configuredSelection = mode => {
    const value = modes.find(item => item.mode === mode);
    assert.equal(value.configuration, 'configured'); assert.ok(value.configured_selection);
    return value.configured_selection;
  };
  const web = configuredSelection('token_plan_web'), agentic = configuredSelection('token_plan_agentic');
  assert.deepEqual(agentic, expectedAgentic.selection, 'Keep the exact MCP-verified selection; no model or effort fallback');
  report.selections = { web, agentic };
  const fields = { token_plan_web: original.fields.token_plan_web, token_plan_agentic: original.fields.token_plan_agentic };
  const secrets = new Set(['api_key', 'api_keys', 'access_token', 'refresh_token', 'id_token', 'secret', 'password', 'cookies', 'cookie', 'authorization', 'credentials', 'credential']);
  const rejectSecrets = value => {
    if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      assert.equal(secrets.has(key.toLowerCase()), false, 'Only nonsecret mode fields can enter the fixture'); rejectSecrets(item);
    }
  };
  rejectSecrets(fields);
  report.public_mode_fields_sha256 = sha(fields);
  await operational.destroy();
  fixture = await createNodiaAiIntegrationFixture('ai3802');
  const { db, options, identities } = fixture, identity = identities.get('3');
  const entries = [
    ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
    ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
    ['nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case', 'UpdateNodiaAiRoutingUseCase'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case', 'GeminiNodiaAiAdapterUseCase'],
    ['nodia-ai-adapter/nodia-ai-adapter.service', 'NodiaAiAdapterTransport'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'],
    ['nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase'],
    ['nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase'],
  ];
  const [Tools, Conversation, Processing, Runtime, Stage, Create, Admit, Routing, AdapterPort, Adapter, Transport, Redis, Reconciliation, Cleanup, Registry] =
    await Promise.all(entries.map(([file, name]) => loadAi(file, name)));
  const manifest = JSON.parse(fs.readFileSync(new URL('../dist/nodia-ai/knowledge/manifest.json', import.meta.url), 'utf8'));
  const pin = JSON.parse(fs.readFileSync(new URL('../dist/nodia-ai-context/config/knowledge-pin.json', import.meta.url), 'utf8'));
  assert.equal(manifest.release_id, pin.release_id);
  assert.equal(manifest.capability_contracts.length, 74);
  const productCapability = manifest.capability_contracts.find(item => item.capability_id === 'nodia_products_list');
  assert.equal(productCapability?.publication, 'published');
  report.publication = { release_id: pin.release_id, catalog_release: pin.catalog_release, capabilities: 74 };
  for (const route of productCapability.required_module_routes) {
    const existing = await db.query('SELECT id FROM modules WHERE link=$1', [route]);
    if (!existing.length) await db.query(`INSERT INTO modules(module_group_id,link,key)
      SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai'`, [route, 'ai38_routing_' + randomBytes(6).toString('hex')]);
  }
  await db.query(`INSERT INTO ai_providers(id,name,catalog_id,fields,use_token_plan_web,use_token_plan_agentic,is_active,updated_at)
    SELECT $1,'Disposable AI38 exact public configuration',id,$2::jsonb,true,true,true,$3
    FROM ai_provider_catalog WHERE key='gemini'`, [original.id, JSON.stringify(fields), original.updated_at]);
  const [business] = await db.query("INSERT INTO businesses(name,owner_id) VALUES('Disposable AI38 routing business',3) RETURNING id::text");
  const [supplier] = await db.query("INSERT INTO providers(business_id,name,tax) VALUES($1,'Disposable AI38 routing supplier',0) RETURNING id::text", [business.id]);
  const marker = 'AI38-product-' + randomBytes(16).toString('hex');
  await db.query(`INSERT INTO products(business_id,provider_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock)
    VALUES($1,$2,'AI38-ROUTING',$3,100,119,20,140,0)`, [business.id, supplier.id, marker]);
  const transport = new Transport();
  const seenStarts = new Set();
  const auditedTransport = { async request(route, payload, signal, dispatch = false) {
    const generationEngine = route === '/nodia-ai/web/turn' ? 'web' : route === '/nodia-ai/agentic/mcp/start' ? 'agentic' : null;
    let kind;
    if (generationEngine) {
      kind = generationEngine + '_start';
      assert.ok(!preflightOnly && ++report.provider_dispatch_requests <= report.maximum_provider_dispatch_requests, 'Bounded real-provider budget; no retry');
      assert.ok(!seenStarts.has(payload.attempt_id), 'Never replay an admitted native identity');
      seenStarts.add(payload.attempt_id);
      trackedNative.set(payload.attempt_id, { engine: generationEngine, attemptId: payload.attempt_id,
        operationRef: payload.attempt_id, resourceKey: payload.resource_key, sessionGeneration: payload.session_generation });
    } else {
      const match = route.match(/^\/nodia-ai\/(web|agentic)\/(observe|measure-context|attempts\/[a-f0-9-]{36}\/(?:mcp\/(?:events|results|cancel)|reconcile|acknowledge))$/u);
      assert.ok(match, 'Only closed conversation/proof endpoints are permitted');
      kind = match[2].replace(/attempts\/[a-f0-9-]{36}\//u, '').replace('/', '_');
    }
    report.transport_counts[kind] = (report.transport_counts[kind] ?? 0) + 1; save();
    let response;
    try { response = await transport.request(route, payload, signal, dispatch); }
    catch (error) {
      // Only a rejection of this start can establish no admission. Later endpoint
      // errors never erase a previously admitted identity, regardless of classification.
      if (generationEngine && error?.outcome === 'not_dispatched') trackedNative.delete(payload.attempt_id);
      throw error;
    }
    if (generationEngine && (generationEngine === 'web' || response?.state === 'running')) report.native_accepted_starts[generationEngine]++;
    if (route.endsWith('/acknowledge') && response?.acknowledged === true) {
      report.terminal_ACKs.push({ attempt_id: payload.operation_ref, terminal_proof_sha256: sha(payload.terminal_proof_id) });
      trackedNative.delete(payload.operation_ref);
    }
    save(); return response;
  } };
  const native = new Adapter(db, auditedTransport);
  const instrumented = {
    observe: (...args) => native.observe(...args),
    verifyConfiguration: (...args) => native.verifyConfiguration(...args),
    measureContext: (...args) => native.measureContext(...args),
    async execute(request, signal) {
      assert.ok(activeTurn);
      assert.deepEqual(request.selection, request.selection.mode === 'token_plan_web' ? web : agentic);
      const [run] = await db.query('SELECT context_manifest FROM nodia_ai_runs WHERE id=$1', [activeTurn.run_id]);
      const [attempt] = await db.query('SELECT routing_phase,stage_key,selection_snapshot FROM nodia_ai_job_attempts WHERE id=$1', [request.attemptId]);
      assert.deepEqual(attempt.selection_snapshot, request.selection);
      const names = (request.tools ?? []).map(tool => tool.name).sort();
      const generation = { attempt_id: request.attemptId, selection: request.selection, routing_phase: attempt.routing_phase,
        stage_key: attempt.stage_key, selection_phase: run.context_manifest.tool_selection?.phase ?? null,
        tool_names: names, callbacks: [], terminal_received: false };
      activeTurn.generations.push(generation); report.generations.push(generation); save();
      assert.ok(activeTurn.generations.length <= (activeTurn.label === 'delegated' ? 3 : 1));
      if (request.selection.mode === 'token_plan_web') assert.equal(names.length, 0, 'Web never receives MCP');
      else {
        assert.equal(attempt.routing_phase, 'delegated');
        assert.deepEqual(names, Object.keys(run.context_manifest.tool_contracts).sort());
        assert.equal(report.terminal_ACKs.length, report.generations.length - 1, 'Prior native proof must be ACKed before another generation');
        const slots = await db.query("SELECT resource_key FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')");
        assert.equal(slots.length, 1, 'Web profile must be released before Agentic');
        if (generation.selection_phase === 'execution') {
          assert.deepEqual(run.context_manifest.tool_selection.request.capability_ids, ['nodia_products_list']);
          assert.ok(names.includes('nodia_products_list') && !names.includes('nodia_capabilities_select'));
        } else assert.ok(names.includes('nodia_capabilities_select') && !names.includes('nodia_products_list'));
      }
      const reply = await native.execute({ ...request, ...(request.onToolCall ? {
        onToolCall: async (call, callbackSignal) => {
          const item = { name: call.name, call_id: call.callId, completed: false };
          generation.callbacks.push(item); save();
          const result = await request.onToolCall(call, callbackSignal);
          item.completed = true; save(); return result;
        },
      } : {}) }, signal);
      generation.reply_kind = reply.kind; generation.terminal_received = true;
      generation.terminal_outcome = reply.terminalProof?.outcome;
      generation.terminal_proof_sha256 = sha(reply.terminalProof?.terminalProofId); save();
      return reply;
    },
  };
  compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options,
    dataSourceFactory: async () => db }), Tools, Conversation, Processing, Runtime], providers: [Stage] })
    .overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [], delByPattern: async () => {} })
    .overrideProvider(Transport).useValue(auditedTransport).overrideProvider(AdapterPort).useValue(instrumented).compile();
  cleanup = compiled.get(Cleanup); reconciliation = compiled.get(Reconciliation);
  check('compiled publication binds actual product read', compiled.get(Registry).list(productCapability.required_module_routes).some(item => item.toolName === 'nodia_products_list'));
  const observedWeb = await native.observe(web), observedAgentic = await native.observe(agentic);
  check('exact Web is available and cannot use MCP', observedWeb.available && !observedWeb.supportsMcp);
  check('exact configured Agentic already has current MCP attestation', observedAgentic.available && observedAgentic.supportsMcp);
  assert.equal(observedAgentic.configurationGeneration, expectedAgentic.configuration_generation);
  assert.equal(observedAgentic.sessionGeneration, expectedAgentic.session_generation);
  report.exact_observation = { configuration_generation: observedAgentic.configurationGeneration,
    session_generation: observedAgentic.sessionGeneration, supports_mcp: observedAgentic.supportsMcp };
  if (!preflightOnly) {
    const chat = await compiled.get(Create).execute(identity, { client_request_id: randomUUID(), title: 'AI38 disposable routing acceptance', selection: web });
    const drain = async () => { for (let index = 0; index < 8; index++) if (!(await cleanup.execute()).processed) break; };
    async function turn(label, text) {
      const [header] = await db.query('SELECT revision FROM nodia_ai_conversations WHERE id=$1', [chat.conversation_id]);
      activeTurn = { label, generations: [], state: null };
      report.turns.push(activeTurn); save();
      const accepted = await compiled.get(Admit).execute(identity, chat.conversation_id, { client_message_id: randomUUID(),
        expected_conversation_revision: header.revision, parts: [{ kind: 'text', text }] });
      activeTurn.run_id = accepted.run.run_id; save();
      for (let step = 0; step < 10; step++) {
        const [run] = await db.query('SELECT state FROM nodia_ai_runs WHERE id=$1', [activeTurn.run_id]);
        if (['completed', 'failed', 'unknown', 'cancelled', 'waiting_for_user'].includes(run.state)) break;
        assert.equal(await compiled.get(Stage).execute(randomUUID(), new AbortController().signal), true);
        await drain();
      }
      const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [activeTurn.run_id]);
      activeTurn.state = run.state; activeTurn.error_code = run.error_code;
      activeTurn.dispatches = run.provider_dispatches_used; activeTurn.delegations = run.delegations_used;
      activeTurn.tool_calls = run.tool_calls_used; activeTurn.rpc_messages = run.mcp_rpc_messages_used; save();
      assert.equal(run.state, 'completed', 'A failed or uncertain generation ends this cohort; no inference replay');
      const [answer] = await db.query('SELECT text FROM nodia_ai_message_parts WHERE message_id=$1 AND part_index=0', [run.assistant_message_id]);
      return { run, text: answer.text };
    }
    const nonce = randomBytes(16).toString('hex');
    const first = await turn('web_conversation', `Responde exactamente este código: ${nonce}. No necesitas datos ni herramientas.`);
    check('real Web conversational reply verifies unpredictable requested code', first.text.includes(nonce));
    check('first Web turn uses one generation and no tools', first.run.provider_dispatches_used === 1 && first.run.delegations_used === 0 && first.run.tool_calls_used === 0);
    const [header] = await db.query('SELECT revision,routing_revision FROM nodia_ai_conversations WHERE id=$1', [chat.conversation_id]);
    await compiled.get(Routing).execute(identity, chat.conversation_id, { expected_conversation_revision: header.revision,
      expected_routing_revision: header.routing_revision, enabled: true, target: { selection: agentic,
        configuration_generation: observedAgentic.configurationGeneration, session_generation: observedAgentic.sessionGeneration } });
    const delegated = await turn('delegated', `Consulta los productos del negocio ${business.id} mediante la herramienta nodia_products_list y devuelve los nombres exactos obtenidos. Si estás en Web solicita la delegación a la sesión Agentic autorizada. Para descubrimiento selecciona sólo nodia_products_list; termina esa generación después de seleccionar. No cambies datos ni uses otras capacidades de negocio.`);
    check('opted-in Web delegates once and finishes via discovery then product execution', delegated.run.provider_dispatches_used === 3 && delegated.run.delegations_used === 1);
    check('real Agentic answer contains product value obtainable only from disposable SQL', delegated.text.includes(marker));
    const productReceipts = await db.query("SELECT state FROM nodia_ai_tool_calls WHERE run_id=$1 AND tool_name='nodia_products_list'", [delegated.run.id]);
    check('product read has completed durable receipt', productReceipts.length >= 1 && productReceipts.every(item => item.state === 'completed'));
    const delegatedGenerations = report.turns.find(item => item.label === 'delegated').generations;
    check('typed Web delegation preserves separate exact phase provenance', delegatedGenerations.length === 3 &&
      delegatedGenerations[0].selection.mode === 'token_plan_web' && delegatedGenerations[0].reply_kind === 'delegation_request' &&
      delegatedGenerations.slice(1).every(item => item.selection.mode === 'token_plan_agentic' && item.routing_phase === 'delegated'));
    const following = await turn('next_turn_web', 'Devuelve solamente el código del primer mensaje de esta conversación, sin consultar herramientas ni datos externos.');
    check('next turn returns to Web with canonical earlier history', following.text.includes(nonce) && following.run.provider_dispatches_used === 1 && following.run.delegations_used === 0 && following.run.tool_calls_used === 0);
    const [stored] = await db.query('SELECT selected_mode FROM nodia_ai_conversations WHERE id=$1', [chat.conversation_id]);
    check('base conversation selection remains Web', stored.selected_mode === 'token_plan_web');
    await drain();
    check('every generation received its real terminal proof and exact native ACK', report.generations.length === 5 && report.terminal_ACKs.length === 5 &&
      report.generations.every(item => item.terminal_received && item.terminal_outcome === 'completed' && report.terminal_ACKs.some(ack => ack.attempt_id === item.attempt_id && ack.terminal_proof_sha256 === item.terminal_proof_sha256)));
  }
  await operational.initialize();
  const [unchanged] = await operational.query('SELECT fields,updated_at FROM ai_providers WHERE id=$1', [original.id]);
  assert.deepEqual({ fields: { token_plan_web: unchanged.fields.token_plan_web, token_plan_agentic: unchanged.fields.token_plan_agentic },
    updated_at: unchanged.updated_at }, { fields, updated_at: original.updated_at });
  report.configured_snapshot_unchanged_after = true;
  await operational.destroy();
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure_category = error instanceof assert.AssertionError ? 'acceptance_assertion_failed' : 'live_routing_failed';
  const code = error?.code ?? error?.message;
  report.error_code = typeof code === 'string' && /^(?:nodia_ai:)?[a-z_]{1,120}$/u.test(code) ? code : null;
  process.exitCode = 1;
} finally {
  if (fixture && compiled && reconciliation && cleanup) {
    try {
      for (const job of await fixture.db.query("SELECT id FROM nodia_ai_jobs WHERE kind='turn' AND state='unknown'"))
        await reconciliation.execute(fixture.identities.get('3'), job.id);
      for (let index = 0; index < 8; index++) if (!(await cleanup.execute()).processed) break;
      const [quiet] = await fixture.db.query(`SELECT
        (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('leased','unknown') OR kind='reconcile') unresolved_jobs,
        (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
        (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) retained_slots`);
      report.disposable_final = quiet; pending = Object.values(quiet).some(value => value !== 0) || trackedNative.size > 0;
    } catch { pending = true; }
  } else pending = trackedNative.size > 0;
  report.native_pending_identity = pending;
  report.disposable_database_retained_for_reconciliation = pending;
  if (pending) {
    report.status = 'failed'; process.exitCode = 1;
    fs.writeFileSync(path.join(path.dirname(output), 'private-routing-recovery.json'), JSON.stringify({
      synthetic_database: fixture?.options ?? null, native_requests: [...trackedNative.values()],
    }, null, 2), { flag: 'wx', mode: 0o600 });
  }
  if (operational.isInitialized) await operational.destroy();
  await compiled?.close();
  if (fixture && !pending) await fixture.close();
  report.finished_at_utc = new Date().toISOString(); save();
  console.log(JSON.stringify(report, null, 2));
}
