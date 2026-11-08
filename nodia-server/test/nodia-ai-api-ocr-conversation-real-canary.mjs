// Operator-only, disposable PostgreSQL. Default inert. Real keys enter stdin only.
// The initial awaiting-supplier turn is synthetic planning with real gateway/SQL.
// --planner real makes only the subsequent supplier-selection turn and OCR real.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assertPublishedCanaryCatalog } from './fixtures/published-canary-catalog.mjs';

const GATE = 'root_approved_api_ocr_conversation_canary_r01';
const PDF_HASH = '9f9a32bd46ebfcb1063e7d1bf4e067f91ff5e5c5d82e1536c2d9725f84917e59';
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value);
const safeError = error => ['ERR_MODULE_NOT_FOUND', 'ENOENT', 'EACCES'].includes(error?.code) ? error.code : /^(?:nodia_ai:|canary:)?[a-z][a-z0-9_]{0,100}$/.test(error?.code ?? error?.message ?? '')
  ? (error.code ?? error.message) : error instanceof assert.AssertionError ? 'assertion_failed' : 'operator_or_provider_failed';
const fail = code => { throw Error('canary:' + code); };
const ORACLE = { code: 'C03-PDF-R01', total_amount: 0, issue_date: '2026-10-25', items: [{
  name: 'Agua C03 PDF', code: 'SKU-PDF-C03', quantity: 0, packages: null, units_per_package: null,
  cost_price: null, cost_price_tax: null, unit_price: 0, total_price: 0,
}] };

function validateInput(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'gate,model,provider,secret' || value.gate !== GATE ||
      !['openai', 'gemini'].includes(value.provider) || typeof value.secret !== 'string' || !value.secret.trim() ||
      value.secret !== value.secret.trim() || Buffer.byteLength(value.secret) > 16384 || /[\r\n\0]/.test(value.secret) ||
      typeof value.model !== 'string' || !value.model.trim() || value.model !== value.model.trim() ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,1023}$/.test(value.model)) fail('stdin_contract');
  return value;
}
async function stdinInput() {
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) { size += chunk.length; if (size > 65536) fail('stdin_limit'); chunks.push(chunk); }
  const buffer = Buffer.concat(chunks);
  try { return validateInput(JSON.parse(buffer.toString('utf8'))); }
  finally { buffer.fill(0); chunks.forEach(chunk => chunk.fill(0)); }
}
function extractionOracle(value) {
  assert.equal(value.code, ORACLE.code); assert.equal(value.total_amount, 0);
  assert.equal(value.data.issue_date, ORACLE.issue_date); assert.equal(value.data.items.length, 1);
  const item = value.data.items[0]; assert.equal(item.code, ORACLE.items[0].code);
  for (const key of ['quantity', 'unit_price', 'total_price']) assert.equal(item[key], 0);
  for (const key of ['packages', 'units_per_package', 'cost_price', 'cost_price_tax']) assert.equal(item[key], null);
  return { actual_zeros: 4, unknown_numbers: 4 };
}
function response(provider, value, kind = 'text') {
  return new Response(json(provider === 'openai'
    ? { status: 'completed', output: kind === 'calls' ? value.map(call => ({ type: 'function_call', call_id: randomUUID(), name: call.name, arguments: json(call.arguments) }))
      : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: value }] }] }
    : { candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: kind === 'calls'
      ? value.map(call => ({ functionCall: { id: randomUUID(), name: call.name, args: call.arguments } })) : [{ text: value }] } }] }),
  { headers: { 'content-type': 'application/json' } });
}
function options() {
  const args = process.argv.slice(2), mode = args.includes('--execute') ? 'execute' : args.includes('--offline') ? 'offline' : args.includes('--self-test') ? 'self-test' : 'inert';
  let planner = 'synthetic', fixture;
  for (let i = 0; i < args.length; i++) {
    if (['--execute', '--offline', '--self-test'].includes(args[i])) continue;
    if (args[i] === '--planner') { planner = args[++i]; if (!['real', 'synthetic'].includes(planner)) fail('planner_option'); }
    else if (args[i] === '--fixture') { fixture = args[++i]; if (!fixture || fixture.startsWith('--')) fail('fixture_option'); }
    else fail('arguments');
  }
  if (args.filter(x => ['--execute', '--offline', '--self-test'].includes(x)).length > 1) fail('arguments');
  return { mode, planner, fixture };
}
async function selfTest() {
  const input = { provider: 'openai', model: 'fixture-ocr-model', secret: 'synthetic-only', gate: GATE };
  validateInput(input);
  for (const invalid of [{ ...input, extra: 1 }, { ...input, gate: 'bad' }, { ...input, secret: 'x\ny' }, { ...input, model: '' }])
    assert.throws(() => validateInput(invalid));
  const extraction = { code: ORACLE.code, total_amount: ORACLE.total_amount, data: { issue_date: ORACLE.issue_date, items: ORACLE.items } };
  assert.deepEqual(extractionOracle(extraction), { actual_zeros: 4, unknown_numbers: 4 });
  assert.throws(() => extractionOracle({ ...extraction, total_amount: null }));
  for (const provider of ['openai', 'gemini']) {
    const body = await response(provider, [{ name: 'nodia_invoices_ocr', arguments: { action: 'read' } }], 'calls').json();
    assert.ok(provider === 'openai' ? body.output[0].type === 'function_call' : body.candidates[0].content.parts[0].functionCall);
  }
  console.log(json({ success: true, mode: 'self-test', checks: 8, provider_requests: 0, database_access: false }));
}
async function execute(opts) {
  const report = { schema_version: 1, success: false, task: 'api_conversational_ocr_canary',
    scope: 'disposable_database_synthetic_original_storage', planner: opts.planner, preparation_planner: 'synthetic',
    key_persisted: false, operational_database_accessed: false, physical_user_click: false,
    automatic_retries: 0, real_posts: 0, real_ocr_posts: 0, real_planner_posts: 0, discovery_gets: 0,
    synthetic_posts: 0, stages: [], terminals: [], checks: [], state_clean: false };
  const originalFetch = globalThis.fetch, logs = new Map(['log', 'info', 'warn', 'error', 'debug'].map(name => [name, console[name]]));
  let secret, fixture, compiled, runId, current, phase = 'input', api;
  let networkLiveAllowed = true;
  const signal = AbortSignal.timeout(300000), storage = new Map();
  let selection, registry, stage, cleanup, recover, reconcile, db, identities, policy, currentReply;
  const check = (name, value) => { assert.ok(value, name); report.checks.push(name); };
  try {
    const input = opts.mode === 'execute' ? await stdinInput() : { provider: 'openai', model: 'fixture-ocr-model', secret: 'synthetic-only', gate: GATE };
    secret = input.secret; delete input.secret; report.provider = input.provider; report.model = input.model;
    for (const name of logs.keys()) console[name] = () => {};
    process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
    delete process.env.NODIA_AI_RECOVERY_CONFIG_FILE;
    globalThis.fetch = async () => fail('network_during_setup');
    phase = 'isolated_postgresql_setup';
    const { createNodiaAiIntegrationFixture, loadAi } = await import('./nodia-ai.integration.fixture.mjs');
    fixture = await createNodiaAiIntegrationFixture('ai9204');
    ({ db, identities } = fixture);
    const { Test } = await import('@nestjs/testing'), { TypeOrmModule } = await import('@nestjs/typeorm');
    const { Logger } = await import('@nestjs/common');
    Logger.overrideLogger({ log() {}, error() {}, debug() {}, verbose() {}, warn(message) {
      const value = String(message), start = value.indexOf('{');
      if (start < 0) return;
      try { const data = JSON.parse(value.slice(start)); if (/^(?:nodia_ai:)?[a-z][a-z0-9_]{0,100}$/.test(data.error_code ?? ''))
        (report.diagnostics ??= []).push({ phase: data.phase, error_code: data.error_code, sql_state: data.sql_state ?? null }); } catch { /* No raw diagnostic escapes. */ }
    } });
    const load = (path, name) => loadAi(path, name);
    const modules = await Promise.all([
      ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
      ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
      ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
      ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
      ['nodia-ai-confirmation/nodia-ai-confirmation.module', 'NodiaAiConfirmationModule'],
      ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    ].map(([path, name]) => load(path, name)));
    const Stage = await load('nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase');
    const Redis = await load('common/redis/redis.service', 'RedisService');
    const Storage = await load('nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentStorage');
    const builder = Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => fixture.options, dataSourceFactory: async () => db }), ...modules], providers: [Stage] });
    builder.overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] });
    builder.overrideProvider(Storage).useValue({ async get(key, maxBytes, bounded) { bounded.throwIfAborted(); const data = storage.get(key); assert.ok(data && data.length <= maxBytes); return Buffer.from(data); }, put: async () => fail('storage_put'), delete: async () => fail('storage_delete') });
    compiled = await builder.compile();
    const get = async (path, name) => compiled.get(await load(path, name));
    stage = compiled.get(Stage); registry = await get('nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase');
    policy = await get('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY');
    const knowledge = await get('nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case', 'LoadNodiaAiKnowledgeUseCase');
    report.knowledge_release = knowledge.manifest.release_id; report.catalog_release = registry.catalogVersion;
    report.published_contracts = assertPublishedCanaryCatalog(registry.publishedContracts(), knowledge.manifest.capability_contracts, ['nodia_invoices_ocr']);
    check('actual_compiled_contract_registry_matches_pinned_knowledge_with_sales', true);
    check('shared_three_post_policy_unchanged', policy.budget.provider_dispatches_per_run === 3);
    const schema = JSON.parse(await readFile(new URL('../dist/nodia-ai-invoice-ocr/contracts/invoice-ocr.json', import.meta.url), 'utf8'));
    report.ocr_result_schema_modes = schema.$defs.InvoiceOcrResult.oneOf.map(variant => variant.properties.selection.properties.mode);
    cleanup = await get('nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase');
    recover = await get('nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case', 'RecoverNodiaAiJobsUseCase');
    reconcile = await get('nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase');
    const credentials = await get('nodia-ai-adapter/api-nodia-ai-credentials.service', 'ApiNodiaAiCredentialsService');
    const ledger = await get('nodia-ai-adapter/api-nodia-ai-runtime.service', 'ApiNodiaAiRuntimeService');
    const acknowledge = ledger.acknowledge.bind(ledger);
    ledger.acknowledge = async (proof, bounded) => {
      const [row] = await db.query('SELECT state,exchange_count,request_hash,response_hash,terminal_proof FROM nodia_ai_api_dispatches WHERE attempt_id=$1', [proof.attemptId]);
      assert.ok(row?.state === 'closed' && row.terminal_proof?.schema_version === 3 && proof.engine === 'api_key' && proof.localTransportClosed === true);
      const witness = { attempt_id: proof.attemptId, schema_version: 3, local_transport_closed: true,
        remote_outcome: proof.remoteOutcome, outcome: proof.outcome, exchanges: row.exchange_count,
        proof_sha256: hash(json(row.terminal_proof)), request_sha256: row.request_hash, response_sha256: row.response_hash, ack: false };
      report.terminals.push(witness);
      await acknowledge(proof, bounded); witness.ack = true;
    };
    api = await get('common/ai/api-provider.service', 'ApiProviderService');
    const originalSecret = credentials.secret.bind(credentials);
    credentials.secret = async (requested, expected) => { await originalSecret(requested, expected); return secret; };
    globalThis.fetch = async (url, init = {}) => {
      const target = new URL(url), method = init.method ?? 'GET';
      const origin = input.provider === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com';
      if (!networkLiveAllowed || target.origin !== origin || target.username || target.password || target.hash || init.redirect !== 'error') fail('network_envelope');
      if (method === 'GET') {
        if (input.provider === 'openai' ? target.pathname !== '/v1/models' || !!target.search : target.pathname !== '/v1beta/models' || [...target.searchParams.keys()].some(key => !['pageSize', 'pageToken'].includes(key))) fail('discovery_route');
        if (phase !== 'discovery' || report.discovery_gets >= 20) fail('unexpected_get'); report.discovery_gets++;
        const reply = await originalFetch(url, init); (report.http_statuses ??= []).push({ kind: 'discovery', status: reply.status }); return reply;
      }
      if (method !== 'POST' || !current || typeof init.body !== 'string') fail('unexpected_post');
      if (target.search || (input.provider === 'openai' ? target.pathname !== '/v1/responses' : target.pathname !== '/v1beta/models/' + encodeURIComponent(input.model.replace(/^models\//, '')) + ':generateContent')) fail('generation_route');
      const payload = JSON.parse(init.body), ocr = input.provider === 'openai' ? payload.text?.format?.name === 'invoice' : !!payload.generationConfig?.responseFormat;
      if (input.provider === 'openai' && payload.model !== input.model) fail('selected_model_changed');
      const live = opts.mode === 'execute' && (ocr || (opts.planner === 'real' && current.kind === 'request'));
      if (live) {
        if (report.real_posts >= (opts.planner === 'real' ? 3 : 1) || (ocr && report.real_ocr_posts >= 1)) fail('real_post_budget');
        report.real_posts++; if (ocr) report.real_ocr_posts++; else report.real_planner_posts++;
        const reply = await originalFetch(url, init); (report.http_statuses ??= []).push({ kind: ocr ? 'ocr' : 'planner', status: reply.status }); return reply;
      }
      report.synthetic_posts++; current.synthetic++;
      if (ocr) return response(input.provider, json(ORACLE));
      const names = input.provider === 'openai' ? payload.tools?.map(tool => tool.name) : payload.tools?.[0]?.functionDeclarations?.map(tool => tool.name);
      assert.ok(names?.length);
      const [run] = await db.query('SELECT context_manifest FROM nodia_ai_runs WHERE id=$1', [runId]);
      if (run.context_manifest.tool_selection.phase === 'discovery') return response(input.provider, [{ name: 'nodia_capabilities_select', arguments: { catalog_version: registry.catalogVersion, capability_ids: ['nodia_invoices_ocr'] } }], 'calls');
      if (!current.called) { current.called = true; return response(input.provider, [{ name: 'nodia_invoices_ocr', arguments: current.arguments }], 'calls'); }
      return response(input.provider, 'Synthetic planning response; extraction is separately owned by the OCR stage.');
    };
    if (opts.mode === 'execute') {
      phase = 'discovery'; const models = await api.listModels(input.provider, secret, AbortSignal.timeout(30000));
      check('exact_model_in_live_discovery', models.some(item => item.id === input.model)); report.discovered_models = models.length;
    }
    phase = 'seed';
    let [businessModule] = await db.query("SELECT id FROM modules WHERE link='/business'");
    if (!businessModule) [businessModule] = await db.query("INSERT INTO modules(module_group_id,sort_order,link,key) SELECT m.module_group_id,(SELECT COALESCE(max(sort_order),-1)+1 FROM modules WHERE module_group_id=m.module_group_id),'/business','synthetic_api_ocr_business' FROM modules m WHERE m.key='nodia_ai' RETURNING id", []);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [businessModule.id]);
    const business = randomUUID(), foreignBusiness = randomUUID();
    await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,1,'Synthetic API OCR owner'),($2,2,'Synthetic foreign business')", [business, foreignBusiness]);
    const fields = { code: { value: 'SKU', instructions: 'Preserve the printed code' } };
    const [supplier] = await db.query("INSERT INTO providers(business_id,name,tax,fields) VALUES($1,'Synthetic explicitly chosen supplier',0,$2) RETURNING id::text", [business, fields]);
    await db.query("INSERT INTO providers(business_id,name,tax,fields) VALUES($1,'Synthetic foreign supplier',0,'{}')", [foreignBusiness]);
    const [catalog] = await db.query('SELECT id::text FROM ai_provider_catalog WHERE key=$1', [input.provider]);
    await db.query('UPDATE ai_provider_catalog SET can_use_api_key=true,is_active=true WHERE id=$1', [catalog.id]);
    const [provider] = await db.query("INSERT INTO ai_providers(catalog_id,name,use_api_key,use_agentic,default_mode,fields) VALUES($1,'Disposable OCR API connection',true,false,'api_key',$2) RETURNING id::text", [catalog.id, { api_key: { selected_model: input.model, available_models: [{ id: input.model }] } }]);
    const { encryptSecret, generateFingerprint } = await import('../dist/ai-provider/helpers/ai-key-crypto.helper.js');
    const dummy = 'synthetic-api-ocr-dummy-key-never-forwarded';
    await db.query("INSERT INTO ai_api_keys(provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_selected,is_active) VALUES($1,'Dummy memory-only test',$2,$3,'...fixture',true,true)", [provider.id, encryptSecret(dummy), generateFingerprint(dummy)]);
    selection = { connection_id: provider.id, mode: 'api_key', model_id: input.model, effort_id: null };
    const create = await get('nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase');
    const admit = await get('nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase');
    const authorize = await get('nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase');
    const builderTool = await get('nodia-ai-invoice-ocr/use-case/build-nodia-ai-invoice-ocr-tool.use-case', 'BuildNodiaAiInvoiceOcrToolUseCase');
    const tool = builderTool.execute()[0].capabilities[0];
    const chat = await create.execute(identities.get('1'), { client_request_id: randomUUID(), selection });
    const attachment = randomUUID(), generation = randomUUID();
    const fixturePath = opts.fixture ?? fileURLToPath(new URL('../../ops/lab/artifacts/c03-analysis-fixtures-r01/C03-PDF-R01.pdf', import.meta.url));
    const bytes = await readFile(fixturePath); check('public_standard_pdf_exact_hash', hash(bytes) === PDF_HASH && bytes.length === 43102); report.fixture_sha256 = PDF_HASH;
    const storageKey = `nodia-ai/${chat.conversation_id}/${attachment}/${generation}`; storage.set(storageKey, bytes);
    await db.query("INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,page_count,expires_at) VALUES($1,$2,$3,$4,1,'pdf','ready','C03-PDF-R01.pdf',$5,$6,$7,$7,'application/pdf',$8,1,now()+interval '1 day')", [attachment, chat.conversation_id, randomUUID(), hash('fixture'), storageKey, generation, bytes.length, PDF_HASH]);
    const clean = async () => { for (let i = 0; i < 5; i++) if (!(await cleanup.execute()).processed) break; };
    async function turn(kind, args, text, attach = false) {
      current = { kind, arguments: args, synthetic: 0, called: false }; currentReply = undefined;
      const [chatNow] = await db.query('SELECT revision FROM nodia_ai_conversations WHERE id=$1', [chat.conversation_id]);
      const result = await admit.execute(identities.get('1'), chat.conversation_id, { client_message_id: randomUUID(), expected_conversation_revision: chatNow.revision,
        parts: [{ kind: 'text', text }, ...(attach ? [{ kind: 'pdf', attachment_id: attachment }] : [])] });
      runId = result.run.run_id;
      for (let i = 0; i < 12; i++) {
        const [run] = await db.query('SELECT state,error_code,provider_dispatches_used FROM nodia_ai_runs WHERE id=$1', [runId]);
        if (['completed', 'failed', 'unknown', 'cancelled', 'waiting_for_user'].includes(run.state)) { currentReply = run; break; }
        await stage.execute(randomUUID(), signal); await clean();
      }
      assert.ok(currentReply, 'bounded terminal run');
      const attempts = await db.query('SELECT stage_key,phase FROM nodia_ai_job_attempts WHERE job_id IN (SELECT id FROM nodia_ai_jobs WHERE run_id=$1) ORDER BY started_at', [runId]);
      report.stages.push({ kind, run_id: runId, state: currentReply.state, error_code: currentReply.error_code, used: currentReply.provider_dispatches_used, attempts: attempts.map(item => ({ stage: item.stage_key, phase: item.phase })) });
      const receipts = await db.query('SELECT id,tool_name,public_result,scope_manifest FROM nodia_ai_tool_calls WHERE run_id=$1 ORDER BY created_at', [runId]);
      return { run: currentReply, receipts };
    }
    phase = 'synthetic_prepare_turn';
    const prepared = await turn('prepare', { action: 'prepare', business_id: business, attachment_id: attachment, compare_prices: true }, 'Analiza esta factura; primero pide elegir el proveedor comercial explícitamente.', true);
    check('initial_synthetic_planner_prepares_real_awaiting_supplier', prepared.run.state === 'completed');
    const prep = prepared.receipts.find(row => row.tool_name === 'nodia_invoices_ocr');
    check('preparation_does_not_dispatch_ocr', prep?.public_result?.status === 'awaiting_supplier' && report.real_ocr_posts === 0);
    phase = 'supplier_request_turn';
    const requested = await turn('request', { action: 'request', analysis_id: prep.id, provider_id: supplier.id }, `Elijo explícitamente el proveedor comercial Synthetic explicitly chosen supplier, id ${supplier.id}, para el análisis pendiente ${prep.id}, negocio ${business}. Ejecuta ahora una sola extracción OCR del PDF ya adjuntado, compara los precios y muestra el borrador; no guardes productos, facturas ni stock. No generes imágenes ni reinterpretes el original con el chat. Usa nodia_invoices_ocr action request y termina la planificación para que el backend ejecute la etapa OCR.`);
    check('actual_conversational_ocr_turn_completes_inside_three_post_budget', requested.run.state === 'completed' && requested.run.provider_dispatches_used <= 3);
    const receipt = requested.receipts.find(row => row.tool_name === 'nodia_invoices_ocr' && row.scope_manifest.invoice_ocr_result);
    check('common_worker_persists_one_bound_extraction', !!receipt);
    const extraction = receipt.scope_manifest.invoice_ocr_result.extraction;
    report.numeric_oracle = extractionOracle(extraction); report.extraction_sha256 = hash(json(extraction));
    const savedResult = json(receipt.scope_manifest.invoice_ocr_result), ocrAttempt = receipt.scope_manifest.invoice_ocr_attempt_id;
    const frozenPosts = report.real_posts;
    phase = 'read_comparison_reload_without_new_inference';
    const read = async actorId => db.transaction(async manager => {
      const actor = await authorize.execute(identities.get(actorId), {}, manager);
      const ctx = { manager, actor, moduleRoutes: actor.modules.map(item => item.route), runId, conversationId: chat.conversation_id, toolCallId: randomUUID() };
      const operation = await tool.external.prepare({ action: 'read', analysis_id: prep.id, compare_prices: true }, ctx);
      const result = await operation.execute(signal); await operation.verify(ctx); await tool.verifyResultAuthority({ action: 'read', analysis_id: prep.id, compare_prices: true }, result, ctx); return result;
    });
    const read1 = await read('1'), read2 = await read('1');
    check('real_authorized_read_and_reload_reuse_extraction_without_api', json(read1.extraction) === json(extraction) && json(read2.extraction) === json(extraction) && report.real_posts === frozenPosts);
    report.readback_extraction_sha256 = hash(json(read2.extraction));
    check('products_empty_comparison_is_unmatched_unknown', read2.comparison.length === 1 && read2.comparison[0].match === 'unmatched' && read2.comparison[0].net.direction === 'unknown');
    await assert.rejects(read('2'));
    check('foreign_actor_cannot_read_owned_analysis', true);
    await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [businessModule.id]);
    await assert.rejects(read('1'));
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [businessModule.id]);
    check('module_revocation_denies_analysis_read_without_api', report.real_posts === frozenPosts);
    const [fresh] = await db.query('SELECT scope_manifest FROM nodia_ai_tool_calls WHERE id=$1', [receipt.id]);
    check('read_comparison_never_rewrites_original_extraction_or_ocr_attempt', json(fresh.scope_manifest.invoice_ocr_result) === savedResult && fresh.scope_manifest.invoice_ocr_attempt_id === ocrAttempt);
    const [effects] = await db.query('SELECT (SELECT count(*)::int FROM products) products,(SELECT count(*)::int FROM invoices) invoices,(SELECT count(*)::int FROM nodia_ai_proposals) proposals,(SELECT count(*)::int FROM nodia_ai_executions) executions');
    check('ocr_and_reads_never_create_commercial_effect_or_confirmation', Object.values(effects).every(value => value === 0)); report.effects = effects;
    await clean();
    check('at_most_one_real_ocr_request_and_bounded_planner', opts.mode !== 'execute' || (report.real_ocr_posts === 1 && report.real_planner_posts <= (opts.planner === 'real' ? 2 : 0)));
    report.success = true;
  } catch (error) {
    networkLiveAllowed = false;
    report.failure_phase = phase; report.error_code = safeError(error);
    if (error instanceof assert.AssertionError) report.assertion = String(error.message).slice(0, 180);
  } finally {
    try {
      if (db && runId) {
        const [pending] = await db.query("SELECT id,state,lease_until FROM nodia_ai_jobs WHERE run_id=$1 AND kind='turn'", [runId]);
        if (pending?.state === 'leased') {
          const wait = Math.max(0, new Date(pending.lease_until).getTime() - Date.now()) + 80;
          if (wait <= 32000) { await new Promise(resolve => setTimeout(resolve, wait)); await recover.execute(); }
        }
        const [unknown] = await db.query("SELECT id FROM nodia_ai_jobs WHERE run_id=$1 AND state='unknown'", [runId]);
        if (unknown) { const before = report.real_posts; const result = await reconcile.execute(identities.get('3'), unknown.id); report.unknown_reconciled = result.resolved; assert.equal(report.real_posts, before); }
        for (let i = 0; i < 5; i++) if (!(await cleanup.execute()).processed) break;
        const [quiet] = await db.query("SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) jobs,(SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') slots,(SELECT count(*)::int FROM nodia_ai_api_dispatches WHERE acknowledged_at IS NULL) unacked_api");
        report.quiet = quiet; report.state_clean = Object.values(quiet).every(value => value === 0);
        report.dispatches = await db.query('SELECT state,exchange_count,acknowledged_at IS NOT NULL ack FROM nodia_ai_api_dispatches ORDER BY started_at');
      }
    } catch (error) { report.recovery_error_code = safeError(error); report.success = false; }
    secret = undefined; globalThis.fetch = originalFetch;
    try { if (compiled) await compiled.close(); } finally { if (fixture) { await fixture.close(); report.owned_fixture_cleanup = true; } }
    for (const [name, fn] of logs) console[name] = fn;
    report.success = report.success && report.state_clean === true;
    console.log(json(report)); if (!report.success) process.exitCode = 1;
  }
}
const opts = options();
if (opts.mode === 'self-test') await selfTest();
else if (['execute', 'offline'].includes(opts.mode)) await execute(opts);
else console.log(json({ inert: true, provider_requests: 0, gate: 'explicit --execute and validated stdin required' }));
