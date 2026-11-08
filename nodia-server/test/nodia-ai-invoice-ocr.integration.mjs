// Real disposable PostgreSQL + Nest composition. Planner provenance is synthetic;
// no adapter observation, original-storage read, SDK, OCR or operational DB is used.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every(arg => arg === '--published'), 'Usage: node test/nodia-ai-invoice-ocr.integration.mjs [--published]');
const requirePublication = args.includes('--published');
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
delete process.env.NODIA_AI_RECOVERY_CONFIG_FILE;
const fixture = await createNodiaAiIntegrationFixture('ai42');
const { db, options, identities } = fixture, checks = [];
let compiled, failure, ocrCalls = 0, externalCalls = 0;
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); };
const forbiddenIO = async () => { externalCalls++; throw Error('Unexpected external I/O in AI42 SQL fixture'); };
const uuid = () => randomUUID();
try {
  const entries = [
    ['nodia-ai-invoice-ocr/nodia-ai-invoice-ocr.module', 'NodiaAiInvoiceOcrModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-invoice-ocr/use-case/snapshot-nodia-ai-invoice-ocr.use-case', 'SnapshotNodiaAiInvoiceOcrUseCase'],
    ['nodia-ai-invoice-ocr/use-case/build-nodia-ai-invoice-ocr-tool.use-case', 'BuildNodiaAiInvoiceOcrToolUseCase'],
    ['nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case', 'ProcessNodiaAiInvoiceOcrStageUseCase'],
    ['nodia-ai-context/use-case/process-nodia-ai-stage.use-case', 'ProcessNodiaAiStageUseCase'],
    ['nodia-ai-invoice-ocr/types/invoice-ocr-port', 'NodiaAiInvoiceOcrPort'],
    ['nodia-ai-invoice-ocr/types/invoice-ocr-state', 'ocrHash'],
    ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-adapter/nodia-ai-adapter.service', 'NodiaAiAdapterTransport'],
    ['nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentStorage'],
    ['nodia-ai-attachment/types/attachment-ports', 'NodiaAiAttachmentInspector'],
    ['common/storage/storage.service', 'StorageService'],
    ['common/redis/redis.service', 'RedisService'],
    ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
    ['nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY'],
  ];
  const [OcrModule, ProcessingModule, Snapshot, Builder, OcrStage, Processing, Port, hash,
    Authorize, Adapter, Transport, Storage, Inspector, StorageService, Redis, CodexRuntime, Policy] =
    await Promise.all(entries.map(([path, name]) => loadAi(path, name)));
  const configuration = 'a'.repeat(64), session = 'b'.repeat(32);
  const selection = { connection_id: '1', mode: 'agentic', model_id: 'synthetic-ai42-model', effort_id: null };
  const ocrPort = { assertSupported() {}, async execute() { ocrCalls++; throw Error('OCR must not run in preparation/concurrency checks'); } };
  compiled = await Test.createTestingModule({ imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), OcrModule, ProcessingModule,
  ] })
    .overrideProvider(Port).useValue(ocrPort)
    .overrideProvider(Adapter).useValue({ observe: forbiddenIO, execute: forbiddenIO, measureContext: forbiddenIO,
      async verifyConfiguration(actual, generation) { assert.deepEqual(actual, selection); assert.equal(generation, configuration); } })
    .overrideProvider(Transport).useValue({ request: forbiddenIO })
    .overrideProvider(Storage).useValue({ get: forbiddenIO, put: forbiddenIO, delete: forbiddenIO })
    .overrideProvider(Inspector).useValue({ inspect: forbiddenIO })
    .overrideProvider(StorageService).useValue({ uploadFile: forbiddenIO, deleteFile: forbiddenIO })
    .overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] })
    .overrideProvider(CodexRuntime).useValue({ onModuleDestroy: async () => {} })
    .compile();
  await compiled.init();
  const snapshots = compiled.get(Snapshot), authorization = compiled.get(Authorize), policy = compiled.get(Policy);
  check('Nest resolves OCR module, Processing, OCR stage and Snapshot without a DI cycle',
    Boolean(snapshots && compiled.get(Processing) && compiled.get(OcrStage) && compiled.get(Port) === ocrPort));
  if (requirePublication) {
    const [Registry, Knowledge] = await Promise.all([
      loadAi('nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case', 'NodiaAiToolRegistryUseCase'),
      loadAi('nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case', 'LoadNodiaAiKnowledgeUseCase'),
    ]);
    const registry = compiled.get(Registry), knowledge = compiled.get(Knowledge);
    const registered = registry.get('nodia_invoices_ocr');
    check('published composition registers the OCR MCP tool with an object-only closed input schema',
      registered?.publication === 'published' && registered.kind === 'analyze_attachment' &&
      registered.inputSchema.type === 'object' && registered.inputSchema.additionalProperties === false &&
      registered.inputSchema.properties && !Array.isArray(registered.inputSchema.properties));
    const documentId = 'nodia-ai.invoice-ocr-product-comparison';
    const routes = ['/nodia-ai', '/business'];
    const selected = knowledge.index(routes).filter(fragment => fragment.id.startsWith(documentId + ':'));
    check('published manifest contains the approved OCR document and business-scoped capability fragment',
      knowledge.manifest.documents.some(document => document.document_id === documentId && document.revision === 1) && selected.length > 0 &&
      knowledge.manifest.fragments.filter(fragment => fragment.document_id === documentId).every(fragment =>
        fragment.required_module_routes.includes('/business') && fragment.requires.some(requirement =>
          requirement.capability_id === 'nodia_invoices_ocr' && requirement.revision === 1)));
    // Feature explanations are loaded by explicit ID; execute(routes) alone loads product_summary fragments.
    const fragmentIds = selected.map(fragment => fragment.id);
    const loaded = knowledge.execute(routes, fragmentIds);
    check('authorized knowledge execution reads the actual OCR fragment bytes and matching publication hashes',
      loaded.fragments.length === fragmentIds.length && loaded.fragments.every(fragment =>
        fragmentIds.includes(fragment.id) && fragment.text.trim().length > 0 &&
        selected.some(index => index.id === fragment.id && index.sha256 === fragment.sha256)));
    const restrictedRoutes = ['/nodia-ai'];
    assert.throws(() => knowledge.execute(restrictedRoutes, fragmentIds), /knowledge_not_available/);
    check('without business scope the OCR fragment is excluded and explicit detail reads are denied',
      !knowledge.index(restrictedRoutes).some(fragment => fragment.id.startsWith(documentId + ':')) &&
      !knowledge.execute(restrictedRoutes).fragments.some(fragment => fragment.id.startsWith(documentId + ':')));
  }
  const tool = compiled.get(Builder).execute()[0].capabilities[0];
  const identity = identities.get('1'), otherIdentity = identities.get('2');
  let [businessModule] = await db.query("SELECT id FROM modules WHERE link='/business'");
  if (!businessModule) [businessModule] = await db.query(`INSERT INTO modules(module_group_id,sort_order,link,key)
    SELECT n.module_group_id,(SELECT COALESCE(MAX(m.sort_order),-1)+1 FROM modules m WHERE m.module_group_id=n.module_group_id),
      '/business','synthetic_ai42_business' FROM modules n WHERE n.key='nodia_ai' RETURNING id`);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING', [businessModule.id]);
  const business = uuid(), foreignBusiness = uuid();
  await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,2,'Synthetic AI42 authorized'),($2,2,'Synthetic AI42 foreign')", [business, foreignBusiness]);
  await db.query('INSERT INTO business_collaborators(business_id,user_id,is_active) VALUES($1,1,true)', [business]);
  const fields = { code: { value: 'SKU', instructions: 'Synthetic column' }, cost_price: { value: 'NET', instructions: 'Preserve zero' } };
  const [provider] = await db.query("INSERT INTO providers(business_id,name,tax,fields) VALUES($1,'Synthetic chosen supplier',0,$2) RETURNING id::text", [business, fields]);
  const [foreignProvider] = await db.query("INSERT INTO providers(business_id,name,tax,fields) VALUES($1,'Synthetic foreign supplier',0,'{}') RETURNING id::text", [foreignBusiness]);
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a4WQAAAAASUVORK5CYII=', 'base64');
  const contentHash = createHash('sha256').update(bytes).digest('hex'), scope = { schema_version: 1, module_routes: ['/business', '/nodia-ai'] };
  const budget = { schema_version: 1, tool_calls: policy.budget.tool_calls_per_run,
    mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run, provider_dispatches: policy.budget.provider_dispatches_per_run,
    compactions: policy.budget.compactions_per_run, delegations: policy.budget.delegations_per_run };
  assert.equal(budget.provider_dispatches, 3);

  async function newTurn(chat, seq, attachmentId = null) {
    const messageId = uuid(), runId = uuid(), jobId = uuid(), attemptId = uuid(), workerId = uuid(), resource = `synthetic-ai42:${chat}:${seq}`;
    await db.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,$3,'user',1,$4,'sealed',$5,now(),$6)", [messageId, chat, seq, uuid(), scope, 'c'.repeat(64)]);
    if (attachmentId) await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text,attachment_id) VALUES($1,$2,0,'image',NULL,$3)", [messageId, chat, attachmentId]);
    else await db.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','Elijo el proveedor comercial indicado.')", [messageId, chat]);
    await db.query(`INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest)
      VALUES($1,$2,1,$3,$4,'synthetic-ai42',$5,$6,$7,$8,$9,'running','inference',now()+interval '10 minutes',1,$10)`,
    [runId, chat, messageId, selection, policy.policyVersion, policy.policyHash,
      { schema_version: 1, enabled: false, revision: 1, target: null }, budget, seq,
      { configuration_generation: configuration, session_generation: session, module_routes: scope.module_routes }]);
    await db.query("INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,state,available_at,lease_owner,lease_until,fence,attempt_count,deadline_at,stage_key,stage_seq) VALUES($1,'turn',$2,$3,$4,'leased',now(),$5,now()+interval '5 minutes',1,1,now()+interval '10 minutes','inference',1)", [jobId, `synthetic-ai42:${runId}`, chat, runId, workerId]);
    await db.query("INSERT INTO nodia_ai_runtime_slots(resource_key,state) VALUES($1,'free')", [resource]);
    await db.query("INSERT INTO nodia_ai_job_attempts(id,job_id,attempt_no,fence,worker_id,phase,started_at,runtime_resource_key,stage_key,stage_seq,selection_snapshot,routing_phase) VALUES($1,$2,1,1,$3,'dispatch_armed',now(),$4,'inference',1,$5,'base')", [attemptId, jobId, workerId, resource, selection]);
    await db.query('UPDATE nodia_ai_conversations SET next_message_seq=$2 WHERE id=$1', [chat, seq]);
    return { chat, seq: String(seq), messageId, runId, jobId, attemptId };
  }
  async function completePlanner(turn) {
    await db.query("UPDATE nodia_ai_job_attempts SET phase='completed',ended_at=now() WHERE id=$1", [turn.attemptId]);
    await db.query("UPDATE nodia_ai_runs SET state='completed',completed_at=now() WHERE id=$1", [turn.runId]);
    await db.query("UPDATE nodia_ai_jobs SET state='done' WHERE id=$1", [turn.jobId]);
  }
  async function context(manager, turn, toolCallId) {
    const actor = await authorization.execute(identity, { moduleRoutes: ['/business'] }, manager);
    return { manager, actor, moduleRoutes: actor.modules.map(m => m.route), runId: turn.runId,
      conversationId: turn.chat, attemptId: turn.attemptId, toolCallId };
  }
  async function prepareOperation(turn, input) {
    const id = uuid();
    const operation = await db.transaction(async manager => {
      const ctx = await context(manager, turn, id);
      await manager.query("INSERT INTO nodia_ai_tool_calls(id,conversation_id,run_id,adapter_call_id,tool_name,contract_hash,arguments_hash,arguments,scope_manifest,state) VALUES($1,$2,$3,$4,'nodia_invoices_ocr',$5,$6,$7,'{}','validated')", [id, turn.chat, turn.runId, uuid(), 'd'.repeat(64), hash(input), input]);
      const op = await tool.external.prepare(input, ctx);
      await manager.query("UPDATE nodia_ai_tool_calls SET scope_manifest=jsonb_build_object('external_snapshot_hash',$2::text) WHERE id=$1", [id, op.fingerprint]);
      return op;
    });
    return { id, input, turn, operation, result: await operation.execute(new AbortController().signal) };
  }
  async function finishOperation(manager, pending, existingContext) {
    const ctx = existingContext ?? await context(manager, pending.turn, pending.id);
    await tool.verifyAuthority(pending.input, ctx);
    await pending.operation.verify(ctx);
    await tool.verifyResultAuthority(pending.input, pending.result, ctx);
    await manager.query("UPDATE nodia_ai_tool_calls SET state='completed',public_result=$2,completed_at=now() WHERE id=$1", [pending.id, pending.result]);
  }
  async function scenario() {
    const chat = uuid(), attachmentId = uuid(), generation = uuid();
    await db.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,expires_at) VALUES($1,1,$2,$3,now()+interval '90 days')", [chat, uuid(), 'e'.repeat(64)]);
    // Same immutable key construction as CreateNodiaAiAttachmentUseCase; migration1792800000000 enforces it.
    const storageKey = `nodia-ai/${chat}/${attachmentId}/${generation}`;
    await db.query("INSERT INTO nodia_ai_attachments(id,conversation_id,client_request_id,request_hash,retention_epoch,kind,state,file_name,storage_key,generation,reserved_bytes,byte_count,media_type,content_hash,expires_at) VALUES($1,$2,$3,$4,1,'image','ready','synthetic-invoice.png',$5,$6,$7,$7,'image/png',$8,now()+interval '90 days')", [attachmentId, chat, uuid(), 'f'.repeat(64), storageKey, generation, bytes.length, contentHash]);
    const first = await newTurn(chat, 1, attachmentId);
    const prep = await prepareOperation(first, { action: 'prepare', business_id: business, attachment_id: attachmentId, compare_prices: false });
    await db.transaction(manager => finishOperation(manager, prep));
    await completePlanner(first);
    return { chat, attachmentId, prep, first, second: await newTurn(chat, 2) };
  }
  const first = await scenario();
  check('prepare persists awaiting_supplier without OCR', first.prep.result.status === 'awaiting_supplier' && ocrCalls === 0);
  const pendingRefs = await db.transaction(async manager => snapshots.loadReferences(manager, await authorization.execute(identity, {}, manager), first.chat, '1'));
  check('pending analysis is recovered privately before the supplier turn', pendingRefs.references.length === 1 && pendingRefs.references[0].analysis_id === first.prep.id && pendingRefs.references[0].provider_id === null);
  await assert.rejects(() => prepareOperation(first.second, { action: 'request', analysis_id: first.prep.id, provider_id: foreignProvider.id }), /invoice_ocr_invalid/);
  check('foreign commercial supplier cannot consume the preparation', (await db.query("SELECT scope_manifest->>'invoice_ocr_consumed_by' AS consumer FROM nodia_ai_tool_calls WHERE id=$1", [first.prep.id]))[0].consumer === null);
  const request = await prepareOperation(first.second, { action: 'request', analysis_id: first.prep.id, provider_id: provider.id });
  await db.transaction(manager => finishOperation(manager, request));
  const stored = (await db.query('SELECT scope_manifest FROM nodia_ai_tool_calls WHERE id=$1', [request.id]))[0].scope_manifest.invoice_ocr_snapshot;
  assert.deepEqual(stored.provider_fields, fields);
  check('new turn requests the same original without reattachment and freezes commercial zero/config',
    request.result.analysis_id === first.prep.id && request.result.request_id === request.id && stored.source_user_message_id === first.first.messageId &&
    stored.user_message_id === first.second.messageId && stored.source.attachment_id === first.attachmentId && stored.source.content_hash === contentHash && stored.tax === 0);
  await db.transaction(manager => finishOperation(manager, request));
  check('repeated same request identity preserves one completed receipt', Number((await db.query("SELECT count(*) AS n FROM nodia_ai_tool_calls WHERE run_id=$1 AND public_result->>'status'='requested'", [first.second.runId]))[0].n) === 1);
  const readRefs = throughSeq => db.transaction(async manager => snapshots.loadReferences(manager, await authorization.execute(identity, {}, manager), first.chat, throughSeq));
  check('throughSeq excludes the future supplier decision even when its preparation is older', (await readRefs('1')).references.length === 0);
  const currentRefs = await readRefs('2');
  check('current bound exposes only the scoped request hint, no extraction or private configuration', currentRefs.references.length === 1 && currentRefs.references[0].provider_id === provider.id && !/provider_fields|content_hash|extraction|model_id/.test(JSON.stringify(currentRefs)));
  const otherRefs = await db.transaction(async manager => snapshots.loadReferences(manager, await authorization.execute(otherIdentity, {}, manager), first.chat, '2'));
  check('another actor cannot recover references from an owned chat', otherRefs.references.length === 0);
  await db.query('UPDATE business_collaborators SET is_active=false WHERE business_id=$1 AND user_id=1', [business]);
  check('business revocation immediately removes private references', (await readRefs('2')).references.length === 0);
  await assert.rejects(() => db.transaction(async manager => snapshots.read(first.prep.id, await context(manager, first.second, uuid()))), /business_scope_not_allowed/);
  await db.query('UPDATE business_collaborators SET is_active=true WHERE business_id=$1 AND user_id=1', [business]);
  await db.query("UPDATE nodia_ai_runs SET state='unknown' WHERE id=$1", [first.second.runId]);
  check('unknown OCR intent remains visible as a hint without being replayable', (await readRefs('2')).references[0].state_hint === 'unknown');
  await assert.rejects(() => prepareOperation(first.second, { action: 'request', analysis_id: first.prep.id, provider_id: provider.id }), /already_requested/);

  const race = await scenario(), input = { action: 'request', analysis_id: race.prep.id, provider_id: provider.id };
  const [a, b] = await Promise.all([prepareOperation(race.second, input), prepareOperation(race.second, input)]);
  const runners = [db.createQueryRunner(), db.createQueryRunner()];
  try {
    await Promise.all(runners.map(r => r.connect()));
    const pids = await Promise.all(runners.map(async r => Number((await r.query('SELECT pg_backend_pid() AS pid'))[0].pid)));
    check('concurrent requests use two real PostgreSQL connections', pids[0] !== pids[1]);
    await Promise.all(runners.map(r => r.startTransaction('READ COMMITTED')));
    await Promise.all(runners.map(r => r.query("SET LOCAL lock_timeout='8s';SET LOCAL statement_timeout='10s'")));
    const contextA = await context(runners[0].manager, a.turn, a.id);
    await a.operation.verify(contextA); // Production verification holds the preparation row lock.
    const secondResult = finishOperation(runners[1].manager, b).then(() => ({ accepted: true }), error => ({ accepted: false, error }));
    let blocked = false;
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const [{ blockers }] = await db.query('SELECT pg_blocking_pids($1) AS blockers', [pids[1]]);
      if (blockers.map(Number).includes(pids[0])) { blocked = true; break; }
      await delay(20);
    }
    check('second production verification actually waits for the preparation lock', blocked);
    await finishOperation(runners[0].manager, a, contextA);
    await runners[0].commitTransaction();
    const second = await secondResult;
    assert.equal(second.accepted, false); assert.match(second.error.message, /already_requested/);
    await runners[1].rollbackTransaction();
    const [{ consumer }] = await db.query("SELECT scope_manifest->>'invoice_ocr_consumed_by' AS consumer FROM nodia_ai_tool_calls WHERE id=$1", [race.prep.id]);
    const [{ n }] = await db.query("SELECT count(*)::int AS n FROM nodia_ai_tool_calls WHERE run_id=$1 AND state='completed' AND public_result->>'status'='requested'", [race.second.runId]);
    check('exactly one concurrent consumer commits and the loser cannot create an OCR request', consumer === a.id && n === 1);
  } finally {
    await Promise.all(runners.map(async r => { try { if (r.isTransactionActive) await r.rollbackTransaction(); } finally { await r.release(); } }));
  }
  const [{ domain_count }] = await db.query('SELECT ((SELECT count(*) FROM products)+(SELECT count(*) FROM invoices))::int AS domain_count');
  const [{ reservations }] = await db.query('SELECT sum(provider_dispatches_used)::int AS reservations FROM nodia_ai_runs');
  check('neither sequential nor concurrent preparation reserves an OCR dispatch budget', reservations === 0);
  check('all preparation/recovery/concurrency checks perform zero OCR, external I/O and business writes', ocrCalls === 0 && externalCalls === 0 && domain_count === 0);
} catch (error) { failure = error; }
finally { try { await compiled?.close(); } finally { await fixture.close(); } }
console.log(JSON.stringify({ stage: 'AI42-invoice-ocr-sql-di', status: failure ? 'failed' : 'passed', configured_database_used: false,
  publication_mode: requirePublication ? 'published' : 'prepublication',
  provider_generations: 0, ocr_port_calls: ocrCalls, external_calls: externalCalls, planner: 'synthetic_SQL_provenance',
  boundary: 'real_registration_callbacks_and_SQL_not_MCP_transport', checks: checks.length, check_names: checks,
  cleanup_complete: true, ...(failure ? { error: { name: failure.name, message: failure.message } } : {}) }, null, 2));
if (failure) throw failure;
