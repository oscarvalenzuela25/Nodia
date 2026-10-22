// Explicit live acceptance: real Gemini adapter and typed product ports; only SQL identities/data are disposable.
// Candidate publication is compiled from reviewed repository knowledge, never invented by this fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { parse } from 'dotenv';

const phase = process.argv.find((value) => value.startsWith('--phase='))?.slice(8);
assert.ok(['preflight', 'eligibility', 'bootstrap', 'local', 'external', 'external-health', 'artifacts', 'web-routing'].includes(phase), 'Specify an explicit AI-15 live phase');
assert.equal(process.env.NODIA_AI_ALLOW_LIVE, 'yes', 'Explicit live opt-in is required');
const privatePath = process.env.NODIA_AI_LAB_API_ENV;
const selectionPath = process.env.NODIA_AI_LAB_SELECTION_JSON;
const knowledgeRoot = process.env.NODIA_AI_LAB_KNOWLEDGE_ROOT;
const knowledgePin = process.env.NODIA_AI_LAB_KNOWLEDGE_PIN;
assert.ok(privatePath && selectionPath && knowledgeRoot && knowledgePin, 'Explicit private configuration and candidate bundle paths are required');
const privateConfig = parse(fs.readFileSync(privatePath));
const selectionObservation = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
const configured = selectionObservation.rows.filter((row) => row.provider_key === 'gemini' && row.is_active === true);
assert.equal(configured.length, 1, 'Select one exact configured Gemini connection');
const actual = configured[0];
assert.match(privateConfig.GEMINI_SERVICE_TOKEN ?? '', /^[a-f0-9]{64}$/i);
const privateUrl = new URL(privateConfig.GEMINI_MICROSERVICE_URL);
assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(privateUrl.hostname), 'Lab Gemini must remain private');
const manifest = JSON.parse(fs.readFileSync(path.join(knowledgeRoot, 'manifest.json'), 'utf8'));
const pin = JSON.parse(fs.readFileSync(knowledgePin, 'utf8'));
assert.equal(pin.release_id, manifest.release_id, 'Candidate bundle must have an exact runtime pin');
assert.equal(manifest.capability_contracts.length, 67, 'Accept the complete reviewed 67-capability release');
for (const key of ['GEMINI_SERVICE_TOKEN', 'GEMINI_MICROSERVICE_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'REDIS_URL', 'NODIA_CODEX_ENABLED', 'NODIA_CODEX_PROFILE_ROOT']) {
  if (privateConfig[key] !== undefined) process.env[key] = privateConfig[key];
}
// The native GeminiService appends endpoint paths; URL.href adds a trailing slash even for an origin.
process.env.GEMINI_MICROSERVICE_URL = privateConfig.GEMINI_MICROSERVICE_URL.replace(/\/+$/, '');
process.env.SECRET_SEED = randomBytes(32).toString('hex');
process.env.DOTENV_CONFIG_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';

const { createNodiaAiIntegrationFixture, loadAi } = await import('./nodia-ai.integration.fixture.mjs');
const { Test } = await import('@nestjs/testing');
const { TypeOrmModule } = await import('@nestjs/typeorm');
const { UnauthorizedException, ValidationPipe } = await import('@nestjs/common');
const fixture = await createNodiaAiIntegrationFixture('ai15');
const { db, options, identities } = fixture;
const checks = [], turns = [], downloads = [], externalObservations = [], dispatches = [], eligibility = [];
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); };
let application, ports, cleanupProofs, reconcileRuntime, nativeProofs;
const pendingNativeRequests = new Map(), pendingNativeProofs = new Map();
let generationRequests = 0;
const maximumGenerations = ['preflight', 'eligibility'].includes(phase) ? 0 : phase === 'web-routing' ? 4 : phase === 'external' ? 3 : phase === 'local' ? 2 : 1;
let activeFailure;
const identitiesOnly = identities.get('1');
const modeSelection = (mode) => {
  const agentic = mode === 'token_plan_agentic';
  const model = agentic ? actual.agentic_model : actual.web_model;
  assert.ok(typeof model === 'string' && model.trim(), 'An exact configured model is required');
  return { connection_id: String(actual.connection_id), mode, model_id: model, effort_id: (agentic ? actual.agentic_effort : actual.web_effort) ?? null };
};
async function drainProofCleanup() {
  if (!cleanupProofs) return 0;
  let acknowledged = 0;
  for (const job of await db.query("SELECT id FROM nodia_ai_jobs WHERE kind='reconcile' AND stage_key='reconcile_ack' ORDER BY id")) {
    assert.equal((await cleanupProofs.execute(job.id, true)).settled, 1, 'Native terminal proof must be acknowledged');
    acknowledged++;
  }
  return acknowledged;
}
async function settleNativeProof(proof) {
  pendingNativeProofs.set(proof.attemptId, proof);
  await nativeProofs.acknowledge(proof, AbortSignal.timeout(15000));
  pendingNativeProofs.delete(proof.attemptId);
  pendingNativeRequests.delete(proof.attemptId);
}
try {
  const requests = [
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
    ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
    ['nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase'],
    ['nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'],
    ['nodia-ai-products/nodia-ai-product-reads.module', 'NodiaAiProductReadsModule'],
    ['nodia-ai-products/nodia-ai-product-reads.module', 'NODIA_AI_CANDIDATE_READ_FAMILIES'],
    ['nodia-ai-tools/types/tool-registry.types', 'NODIA_AI_TOOL_FAMILIES'],
    ['nodia-ai-tools/types/tool-registry.types', 'NODIA_AI_CAPABILITIES_CATALOG_VERSION'],
    ['nodia-ai-context/types/knowledge.types', 'NODIA_AI_KNOWLEDGE_ROOT'],
    ['nodia-ai-context/types/knowledge.types', 'NODIA_AI_KNOWLEDGE_PIN'],
    ['nodia-ai-context/types/knowledge.types', 'NODIA_AI_KNOWLEDGE_SCHEMA'],
    ['nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case', 'DiscoverNodiaAiToolsUseCase'],
    ['nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase'],
    ['nodia-ai-products/artifacts/nodia-ai-artifacts.module', 'NodiaAiArtifactsModule'],
    ['nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case', 'LoadNodiaAiKnowledgeUseCase'],
    ['nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case', 'GeminiNodiaAiAdapterUseCase'],
    ['nodia-ai-runtime/types/reconciliation.types', 'NodiaAiRuntimeReconciliationPort'],
  ];
  const [Conversation, Processing, Runtime, Adapter, Stage, Create, Admit, Cleanup, Reconcile, Products, CandidateFamilies, Families, CatalogVersion, KnowledgeRoot, KnowledgePin, KnowledgeSchema, Discover, Registry, Artifacts, LoadKnowledge, ConcreteAdapter, NativeProofs] = await Promise.all(requests.map(([file, name]) => loadAi(file, name)));
  const [catalog] = await db.query("SELECT id FROM ai_provider_catalog WHERE key='gemini'");
  const aiMarker = `AI15-connection-${randomBytes(10).toString('hex')}`;
  await db.query(`INSERT INTO ai_providers(id,name,catalog_id,is_active,use_token_plan_web,use_token_plan_agentic,fields)
    VALUES($1,$2,$3,true,true,true,$4::jsonb)`, [actual.connection_id, aiMarker, catalog.id, JSON.stringify({
    token_plan_web: { selected_model: actual.web_model, thinking_level: actual.web_effort ?? null },
    token_plan_agentic: { selected_model: actual.agentic_model, thinking_level: actual.agentic_effort ?? null },
  })]);
  // Stable, explicitly synthetic configuration identity lets subsequent phases reuse the exact successful native probe.
  await db.query("UPDATE ai_providers SET updated_at='2000-01-01T00:00:00Z' WHERE id=$1", [actual.connection_id]);
  const openai = selectionObservation.rows.filter((row) => row.provider_key === 'openai' && row.is_active === true);
  assert.ok(openai.length <= 1, 'Codex fixture requires one exact configured connection');
  if (openai.length) {
    const [openaiCatalog] = await db.query("SELECT id FROM ai_provider_catalog WHERE key='openai'");
    await db.query(`INSERT INTO ai_providers(id,name,catalog_id,is_active,use_token_plan_agentic,fields)
      VALUES($1,'Synthetic Codex observation',$2,true,true,$3::jsonb)`, [openai[0].connection_id, openaiCatalog.id, JSON.stringify({ token_plan_agentic: { selected_model: openai[0].agentic_model ?? null } })]);
  }
  const moduleRoutes = [...new Set(manifest.capability_contracts.flatMap((capability) => capability.required_module_routes))];
  for (const route of moduleRoutes) {
    let [module] = await db.query('SELECT id FROM modules WHERE link=$1', [route]);
    if (!module) [module] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai' RETURNING id", [route, `ai15_live_${randomBytes(5).toString('hex')}`]);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [module.id]);
  }
  const coreMarker = `ai15_live_${randomBytes(10).toString('hex')}`;
  const [role] = await db.query('INSERT INTO roles(key) VALUES($1) RETURNING id', [coreMarker]);
  await db.query("INSERT INTO actions(key) VALUES('ai:manage') ON CONFLICT(key) DO NOTHING");
  await db.query("INSERT INTO role_actions(role_id,action_id) SELECT $1,id FROM actions WHERE key='ai:manage'", [role.id]);
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(1,$1)', [role.id]);
  const productMarker = `AI15-product-${randomBytes(10).toString('hex')}`;
  const providerMarker = `AI15-supplier-${randomBytes(10).toString('hex')}`;
  const categoryMarker = `AI15-category-${randomBytes(10).toString('hex')}`;
  const rentalMarker = `AI15-property-${randomBytes(10).toString('hex')}`;
  const [business] = await db.query("INSERT INTO businesses(name,owner_id) VALUES('Synthetic AI15 live business',1) RETURNING id");
  const [provider] = await db.query('INSERT INTO providers(business_id,name,tax) VALUES($1,$2,0) RETURNING id', [business.id, providerMarker]);
  await db.query("INSERT INTO products(business_id,provider_id,code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock) VALUES($1,$2,'AI15-LIVE',$3,100,119,20,140,0)", [business.id, provider.id, productMarker]);
  await db.query("INSERT INTO finance_categories(user_id,name,key) VALUES(1,$1,'ai15_live_category')", [categoryMarker]);
  await db.query("INSERT INTO rental_properties(owner_id,name,timezone,max_guests,minimum_turnover_minutes,created_by,updated_by) VALUES(1,$1,'America/Santiago',4,0,1,1)", [rentalMarker]);
  // Valid reference metadata only; no R2 object or configured business record is created by this harness.
  const [invoice] = await db.query("INSERT INTO invoices(business_id,provider_id,code,total_amount,path_storage) VALUES($1,$2,'AI15-LIVE',0,$3) RETURNING id", [business.id, provider.id, `invoices/${business.id}/ai15-live-not-materialized.pdf`]);
  const databaseModule = () => TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db });
  ports = await Test.createTestingModule({ imports: [databaseModule(), Products.forPublication(manifest.capability_contracts.map((capability) => capability.capability_id))] }).compile();
  const families = ports.get(CandidateFamilies);
  check('candidate bundle composes all 67 actual typed product ports', families.flatMap((family) => family.capabilities).length === 67);
  const builder = Test.createTestingModule({ imports: [databaseModule(), Conversation, Processing, Runtime, Artifacts], providers: [Stage] });
  builder.overrideProvider(Families).useValue(families);
  builder.overrideProvider(CatalogVersion).useValue(manifest.catalog_release);
  builder.overrideProvider(KnowledgeRoot).useValue(path.resolve(knowledgeRoot));
  builder.overrideProvider(KnowledgePin).useValue(pin);
  builder.overrideProvider(KnowledgeSchema).useValue(fs.readFileSync(path.join(path.dirname(knowledgePin), 'knowledge-schema.json')));
  const module = await builder.compile();
  application = module.createNestApplication({ logger: false });
  application.setGlobalPrefix('api/v1');
  application.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  // Synthetic authenticated identity only. Product/download authorization remains the actual production use case.
  application.useGlobalGuards({ canActivate(context) {
    const request = context.switchToHttp().getRequest();
    if (request.headers['x-ai15-fixture'] !== identitiesOnly.sessionId) throw new UnauthorizedException();
    request.auth = { user: { id: identitiesOnly.userId }, sessionId: identitiesOnly.sessionId };
    return true;
  } });
  await application.listen(0, '127.0.0.1');
  const adapter = module.get(Adapter), create = module.get(Create), admit = module.get(Admit), stage = module.get(Stage);
  cleanupProofs = module.get(Cleanup); reconcileRuntime = module.get(Reconcile); nativeProofs = module.get(NativeProofs);
  check('actual registry exposes 67 domain capabilities and three discovery descriptors', module.get(Registry).list(moduleRoutes).length === 67 && module.get(Discover).descriptors().length === 3);
  check('real compiled knowledge release loads through the production loader', module.get(LoadKnowledge).execute(moduleRoutes).releaseId === manifest.release_id);
  const concrete = module.get(ConcreteAdapter), execute = concrete.execute;
  // Observe the actual production request, then execute it unchanged. Never replace callbacks, results or provider transport.
  concrete.execute = function (request, signal) {
    const names = (request.tools ?? []).map((tool) => tool.name);
    if (request.selection.mode === 'token_plan_agentic') {
      assert.equal(names.length, 72, 'Real Agentic dispatch must receive every capability plus five technical tools');
      for (const capability of manifest.capability_contracts) assert.ok(names.includes(capability.capability_id), 'No published candidate may be silently omitted');
    } else assert.equal(names.length, 0, 'Conversational Web may not receive MCP descriptors');
    const trace = { mode: request.selection.mode, tools: names.length };
    dispatches.push(trace);
    const started = performance.now();
    const aborted = () => {
      trace.worker_signal_aborted = true;
      trace.worker_signal_elapsed_ms = Math.round(performance.now() - started);
      trace.worker_signal_reason = typeof signal?.reason?.message === 'string' && /^nodia_ai:[a-z_]{1,128}$/.test(signal.reason.message) ? signal.reason.message : 'unclassified';
    };
    if (signal?.aborted) aborted();
    else signal?.addEventListener('abort', aborted, { once: true });
    return execute.call(this, request, signal).then((answer) => {
      trace.elapsed_ms = Math.round(performance.now() - started);
      trace.reply_kind = answer.kind;
      trace.native_terminal_outcome = answer.terminalProof?.outcome ?? null;
      return answer;
    }, (error) => {
      trace.elapsed_ms = Math.round(performance.now() - started);
      trace.error_code = typeof error?.code === 'string' && /^[a-z_:-]{1,160}$/.test(error.code) ? error.code : typeof error?.message === 'string' && /^(?:nodia_ai|authorization):[a-z_]{1,128}$/.test(error.message) ? error.message : 'unclassified';
      trace.error_outcome = ['not_dispatched', 'unknown'].includes(error?.outcome) ? error.outcome : null;
      throw error;
    }).finally(() => signal?.removeEventListener('abort', aborted));
  };
  if (phase !== 'preflight') {
    const selection = modeSelection('token_plan_agentic'), observed = await adapter.observe(selection);
    eligibility.push({ available: observed.available, supports_mcp: observed.supportsMcp, reason: typeof observed.reason === 'string' && /^[a-z_:-]{1,160}$/.test(observed.reason) ? observed.reason : null });
    if (phase !== 'eligibility') assert.equal(observed.available, true, 'Exact Agentic selection must be eligible before admission');
    if ((!observed.supportsMcp || phase === 'bootstrap') && phase !== 'eligibility') {
      assert.ok(['local', 'bootstrap'].includes(phase), 'A verified exact MCP probe is required; run the bounded bootstrap first');
      const nonce = randomBytes(16).toString('hex');
      const request = {
        attemptId: randomUUID(), selection, deadlineAt: new Date(Date.now() + 120000), resourceKey: observed.resourceKey,
        sessionGeneration: observed.sessionGeneration, configurationGeneration: observed.configurationGeneration,
        canonicalPrompt: JSON.stringify({ instructions: 'Prueba aislada del transporte. Llama exactamente una vez nodia_fixture_probe con {} y devuelve el código nonce recibido sin cambiarlo. No uses shell, archivos, red ni otras herramientas.', messages: [] }),
        tools: [{ name: 'nodia_fixture_probe', description: 'Diagnóstico explícito sintético sin datos ni acciones de negocio.', inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false } }],
        async onToolCall(call) { assert.equal(call.name, 'nodia_fixture_probe'); assert.deepEqual(call.arguments, {}); return { fixture_only: true, nonce }; },
        async onProtocolProgress(count) { assert.ok(Number.isSafeInteger(count) && count >= 0 && count <= 128); },
      };
      assert.ok(++generationRequests <= maximumGenerations);
      pendingNativeRequests.set(request.attemptId, { engine: 'agentic', attemptId: request.attemptId, operationRef: request.attemptId, resourceKey: request.resourceKey, sessionGeneration: request.sessionGeneration });
      const answer = await concrete.probeMcp(request);
      await settleNativeProof(answer.terminalProof);
      check('fresh native MCP diagnostic completes and includes unpredictable callback data', answer.kind === 'answer' && answer.text.includes(nonce));
      check('exact Agentic configuration now has observed MCP support', (await adapter.observe(selection)).supportsMcp === true);
    }
  }
  const worker = randomUUID();
  async function turn(chat, text) {
    const accepted = await admit.execute(identitiesOnly, chat.conversation_id, { client_message_id: randomUUID(), expected_conversation_revision: chat.revision, parts: [{ kind: 'text', text }] });
    let run;
    for (let step = 0; step < 5; step++) {
      [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [accepted.run.run_id]);
      if (['completed', 'failed', 'cancelled', 'unknown'].includes(run.state)) break;
      const [job] = await db.query('SELECT stage_key FROM nodia_ai_jobs WHERE run_id=$1', [run.id]);
      if (job && job.stage_key !== 'context') assert.ok(++generationRequests <= maximumGenerations, 'Live diagnostic dispatch budget exhausted');
      assert.equal(await stage.execute(worker, AbortSignal.timeout(180000)), true, 'One admitted durable stage must be claimed');
    }
    [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [accepted.run.run_id]);
    const acknowledgedProofs = await drainProofCleanup();
    const receipts = await db.query('SELECT tool_name,state,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 ORDER BY created_at,id', [run.id]);
    turns.push({ state: run.state, error_code: typeof run.error_code === 'string' && /^[a-zA-Z0-9_:.-]{1,160}$/.test(run.error_code) ? run.error_code : null, dispatches: run.provider_dispatches_used, delegations: run.delegations_used, tool_calls: run.tool_calls_used, rpc_messages: run.mcp_rpc_messages_used, native_proofs_acknowledged: acknowledgedProofs, receipt_tools: receipts.map((receipt) => ({ name: receipt.tool_name, state: receipt.state })) });
    if (['external', 'external-health'].includes(phase)) for (const receipt of receipts.filter((item) => item.state === 'completed')) externalObservations.push({ tool: receipt.tool_name, state: receipt.state, result: receipt.public_result });
    check('real Gemini turn completes through the durable worker', run.state === 'completed');
    const [answer] = await db.query('SELECT text FROM nodia_ai_message_parts WHERE message_id=$1 AND part_index=0', [run.assistant_message_id]);
    const [updated] = await db.query('SELECT revision FROM nodia_ai_conversations WHERE id=$1', [chat.conversation_id]);
    return { chat: { ...chat, revision: updated.revision }, run, answer: answer.text, receipts };
  }
  const newChat = (mode) => create.execute(identitiesOnly, { client_request_id: randomUUID(), selection: modeSelection(mode) });
  if (['preflight', 'eligibility'].includes(phase)) {
    check('preflight generates no provider inference', generationRequests === 0 && dispatches.length === 0);
  } else if (phase === 'bootstrap') {
    check('bootstrap performs exactly one diagnostic inference and no product chat', generationRequests === 1 && turns.length === 0 && dispatches.length === 0);
  } else if (phase === 'local') {
    const result = await turn(await newChat('token_plan_agentic'), `Prueba aislada de sólo lectura. Consulta los productos del negocio ${business.id}, mis categorías financieras, los alojamientos que administro, los roles configurados y las conexiones de IA configuradas. Haz una consulta por cada uno de esos cinco recursos mediante las herramientas de Nodia; no cambies datos. Devuelve los nombres o keys exactos obtenidos de cada grupo, sin inventarlos ni resumirlos omitiendo identificadores textuales.`);
    const expected = ['nodia_products_list', 'nodia_finance_categories_list', 'nodia_rental_properties_list', 'nodia_roles_list', 'nodia_ai_providers_list'];
    check('real Agentic selects one native read from each of five product families', expected.every((name) => result.receipts.some((receipt) => receipt.tool_name === name && receipt.state === 'completed')));
    check('final answer incorporates five unpredictable values returned by native SQL', [productMarker, categoryMarker, rentalMarker, coreMarker, aiMarker].every((marker) => result.answer.includes(marker)));
    check('direct Agentic dispatch remains exact and uses bounded MCP', result.run.provider_dispatches_used === 1 && result.run.delegations_used === 0 && result.run.tool_calls_used >= 5);
  } else if (['external', 'external-health'].includes(phase)) {
    assert.equal(openai.length, 1, 'External Codex observation requires a configured connection identity');
    const groups = [
      { names: ['nodia_ai_providers_health', 'nodia_ai_providers_gemini_engines'], instructions: 'nodia_ai_providers_health con {} y nodia_ai_providers_gemini_engines con {}' },
      { names: ['nodia_ai_providers_models', 'nodia_ai_providers_codex_session'], instructions: `nodia_ai_providers_models con provider_id="${actual.connection_id}" y mode="token_plan_web", y nodia_ai_providers_codex_session con provider_id="${openai[0].connection_id}"` },
      { names: ['nodia_invoices_eligible_invoice_connections'], instructions: 'nodia_invoices_eligible_invoice_connections con {}' },
    ];
    let chat = await newChat('token_plan_agentic');
    for (const [index, group] of (phase === 'external-health' ? groups.slice(0, 1) : groups).entries()) {
      const result = await turn(chat, `Diagnóstico focal nuevo ${index + 1} de contratos de observación corregidos. Ejecuta únicamente estas lecturas: ${group.instructions}. No recuperes ni reenvíes intentos anteriores; no ejecutes otras herramientas, login o mutaciones. Resume brevemente los estados observados; desconocido y ocupado no significan sesión cerrada. No cambies de proveedor ni reintentes. Esta solicitud termina al devolver ese resumen.`);
      check(`real Agentic completes external observation group ${index + 1}`, group.names.every((name) => result.receipts.some((receipt) => receipt.tool_name === name && receipt.state === 'completed')));
      check(`external observation group ${index + 1} uses one exact Agentic dispatch`, result.run.provider_dispatches_used === 1 && result.run.delegations_used === 0);
      chat = result.chat;
    }
    check('bounded turns cover the requested external contracts without replay', new Set(externalObservations.map((item) => item.tool)).size === (phase === 'external-health' ? 2 : 5));
  } else if (phase === 'artifacts') {
    const result = await turn(await newChat('token_plan_agentic'), `Prepara tres referencias privadas mediante las herramientas de Nodia: exportación CSV de productos del negocio ${business.id}, exportación CSV de proveedores del mismo negocio y archivo de la factura ${invoice.id}. No descargues los archivos ni leas su contenido, no crees datos. Usa idioma es para CSV. Devuelve las tres referencias y explica que requieren sesión autorizada para descargar.`);
    const expected = ['nodia_products_export_csv', 'nodia_providers_export_csv', 'nodia_invoices_file'];
    check('real Agentic emits three private artifact references through native tools', expected.every((name) => result.receipts.some((receipt) => receipt.tool_name === name && receipt.state === 'completed')));
    for (const name of expected) {
      const receipt = result.receipts.find((item) => item.tool_name === name && item.state === 'completed');
      const artifact = receipt.public_result.artifact;
      assert.match(artifact.reference, /^[0-9a-f-]{36}$/i);
      check(`${name} reference preserves private current-on-download semantics`, artifact.access === 'authenticated_reauthorized' && artifact.semantics === 'current_on_download');
      const url = `${await application.getUrl()}/api/v1/nodia-ai/artifacts/${artifact.reference}`;
      const unauthorized = await fetch(url);
      assert.equal(unauthorized.status, 401);
      const response = await fetch(url, { headers: { 'x-ai15-fixture': identitiesOnly.sessionId } });
      if (name === 'nodia_invoices_file') {
        assert.equal(response.status, 503, 'An unconfigured real storage service must fail explicitly, never fabricate file content');
        const error = await response.json();
        check('invoice download reports actual storage unavailability without exposing credentials', error.message === 'nodia_ai:artifact_storage_unavailable');
        downloads.push({ tool: name, reference_verified: true, content_downloaded: false, unauthenticated_status: unauthorized.status, authenticated_status: response.status, reason: 'storage_not_configured; no object or content fabricated' });
        continue;
      }
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.match(response.headers.get('content-disposition'), /^attachment;/);
      const csv = await response.text();
      check(`${name} authenticated human download regenerates native CSV content`, csv.includes(name === 'nodia_products_export_csv' ? productMarker : providerMarker));
      downloads.push({ tool: name, bytes: Buffer.byteLength(csv), unauthenticated_status: unauthorized.status, authenticated_status: response.status, no_store: true, synthetic_nonce_verified: true });
    }
  } else {
    const nonce = randomBytes(10).toString('hex');
    const web = await turn(await newChat('token_plan_web'), `Responde sólo con este código de prueba: ${nonce}. No necesitas datos ni herramientas.`);
    check('Web remains conversational with no MCP or delegation', web.answer.includes(nonce) && web.run.tool_calls_used === 0 && web.run.delegations_used === 0 && web.run.provider_dispatches_used === 1);
    const Routing = await loadAi('nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case', 'UpdateNodiaAiRoutingUseCase');
    const target = modeSelection('token_plan_agentic'), observed = await adapter.observe(target);
    assert.equal(observed.available, true, 'Exact opted-in Agentic target must be available');
    const chat = await module.get(Routing).execute(identitiesOnly, web.chat.conversation_id, { expected_conversation_revision: web.chat.revision, expected_routing_revision: web.chat.routing.revision, enabled: true, target: { selection: target, configuration_generation: observed.configurationGeneration, session_generation: observed.sessionGeneration } });
    const delegated = await turn(chat, `Consulta los productos del negocio ${business.id} mediante Nodia y devuélveme los nombres exactos. Si estás en Web solicita delegación a la sesión Agentic autorizada. No cambies datos.`);
    check('Web delegates to the opted-in exact Agentic connection for a native SQL read', delegated.run.provider_dispatches_used === 2 && delegated.run.delegations_used === 1 && delegated.receipts.some((receipt) => receipt.tool_name === 'nodia_products_list' && receipt.state === 'completed') && delegated.answer.includes(productMarker));
    const following = await turn(delegated.chat, 'Responde solamente listo. No necesitas consultar datos ni herramientas.');
    check('following turn returns to Web with canonical history and no MCP', following.run.provider_dispatches_used === 1 && following.run.delegations_used === 0 && following.run.tool_calls_used === 0);
  }
  await drainProofCleanup();
  check('all real native runtime slots released after acknowledgement', (await db.query("SELECT resource_key FROM nodia_ai_runtime_slots WHERE state<>'free'")).length === 0);
  const report = { task: 'AI-15', phase, status: 'passed', checks: checks.length, passed: checks, turns, downloads, external_observations: externalObservations, dispatches, eligibility, adapter_dispatch_requests: generationRequests, maximum_adapter_dispatch_requests: maximumGenerations, candidate_release_id: manifest.release_id, domain_capabilities: 67, mcp_catalog_tools: 72, real_gemini_inference: !['preflight', 'eligibility'].includes(phase), adapter_mocked: false, product_readers_mocked: false, synthetic_sql_database: true, synthetic_http_identity: true, configured_business_database_modified: false, configured_provider_selection_modified: false, storage_objects_created: 0, invoice_content_download_verified: false };
  const reportPath = process.env.NODIA_AI_LAB_REPORT_JSON;
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  activeFailure = error;
  if (process.env.NODIA_AI_LAB_REPORT_JSON) fs.writeFileSync(process.env.NODIA_AI_LAB_REPORT_JSON, JSON.stringify({ task: 'AI-15', phase, status: 'failed', checks: checks.length, passed: checks, turns, dispatches, eligibility, external_observations: externalObservations, adapter_dispatch_requests: generationRequests, maximum_adapter_dispatch_requests: maximumGenerations, candidate_release_id: manifest.release_id, inference_replayed: false, configured_business_database_modified: false }, null, 2));
}
finally {
  let cleanupFailed = false, cleanupCounts = null;
  try {
    if (reconcileRuntime) for (const job of await db.query("SELECT id FROM nodia_ai_jobs WHERE kind='turn' AND state='unknown' ORDER BY id")) {
      try { await reconcileRuntime.execute(identities.get('3'), job.id); }
      catch { cleanupFailed = true; console.error('Live AI-15 retains an unresolved attempt; no inference has been replayed.'); }
    }
    await drainProofCleanup();
    for (const request of pendingNativeRequests.values()) {
      try { await settleNativeProof(pendingNativeProofs.get(request.attemptId) ?? await nativeProofs.reconcile(request, AbortSignal.timeout(15000))); }
      catch { cleanupFailed = true; console.error('Live AI-15 retains an unresolved diagnostic native identity; no replay.'); }
    }
    const jobs = await db.query("SELECT id,kind,state,fence,recovery_descriptor FROM nodia_ai_jobs WHERE (kind='turn' AND state NOT IN ('done','failed','cancelled')) OR (kind='reconcile' AND stage_key='reconcile_ack') ORDER BY id");
    const attempts = await db.query("SELECT id,job_id,phase,runtime_resource_key,runtime_fence,external_operation_ref FROM nodia_ai_job_attempts WHERE phase IN ('dispatch_armed','sent','unknown') ORDER BY id");
    const slots = await db.query("SELECT resource_key,state,job_id,fence,external_operation_ref FROM nodia_ai_runtime_slots WHERE state<>'free' ORDER BY resource_key");
    cleanupCounts = { jobs: jobs.length, attempts: attempts.length, runtime_slots: slots.length, diagnostic_requests: pendingNativeRequests.size, diagnostic_proofs: pendingNativeProofs.size };
    if (jobs.length || attempts.length || slots.length) cleanupFailed = true;
    if (cleanupFailed) {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nodia-ai15-live-recovery-'));
      fs.chmodSync(directory, 0o700);
      const recoveryPath = path.join(directory, 'recovery.json');
      fs.writeFileSync(recoveryPath, JSON.stringify({ schema_version: 1, created_at: new Date().toISOString(), phase, database: { host: options.host, port: options.port, username: options.username, database: options.database }, pending_jobs: jobs, pending_runtime_attempts: attempts, pending_runtime_slots: slots, pending_native_requests: [...pendingNativeRequests.values()], pending_native_proofs: [...pendingNativeProofs.values()] }, null, 2), { mode: 0o600 });
      console.error(`Disposable AI-15 database retained for reconciliation; private identities: ${recoveryPath}`);
    }
  } catch { cleanupFailed = true; console.error('AI-15 cleanup could not prove terminal state; preserving SQL for reconciliation.'); }
  await application?.close();
  await ports?.close();
  if (cleanupFailed) { if (db.isInitialized) await db.destroy(); process.exitCode = 1; }
  else await fixture.close();
  if (process.env.NODIA_AI_LAB_REPORT_JSON && fs.existsSync(process.env.NODIA_AI_LAB_REPORT_JSON)) {
    const report = JSON.parse(fs.readFileSync(process.env.NODIA_AI_LAB_REPORT_JSON, 'utf8'));
    report.cleanup = { completed: !cleanupFailed, pending: cleanupCounts, disposable_database_removed: !cleanupFailed, inference_replayed: false };
    fs.writeFileSync(process.env.NODIA_AI_LAB_REPORT_JSON, JSON.stringify(report, null, 2));
  }
}
if (activeFailure) throw activeFailure;
