// OPERATOR ONLY. Exactly two explicit chat intentions: compact+answer, then snapshot reuse.
// The production handler/router/runtime/policy/publication are not replaced. Never run in CI.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants } from 'node:fs';
import { lstat, readFile, realpath, readdir, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMPACTION_FIRST_REQUEST, COMPACTION_REUSE_REQUEST, COMPACTION_EXPECTED_HOUSE,
  compactionSources, verifyCompactionSources, verifyCompactionSummary, sha256 } from './nodia-ai-ai40-compaction-sources-r06.mjs';

const RELEASE = '/opt/nodia/releases/nodia-server-ai40-r06';
const RELEASE_SHA = '5aa5b74dd43cfbc61615f766ba8e17dd12bb3c8bb0a695bd85fc68c6d519c2bd';
const DRY_BOOTSTRAP_COMPLETE = Symbol('dry_bootstrap_complete_before_any_native_method');
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const checks = [], runs = [], terminalReceipts = [];
const sqlNativeRequests = new Map();
let phase = 'operator_input', compiled, db, stage, cleanup, reconcile, identity, adminIdentity, selection;
let exactAck, inspectNative, journal, proofHelpers;
let failed = null, safeToRemove = false, fixtureContainer = null, sourceMetrics = null, snapshotMetrics = null;
let dispatches = 0, fixtureConnected = false, chatId = null, snapshotId = null;
let handlerVerified = false;
let dryBootstrapComplete = false;
const started = new Date().toISOString();
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const load = async (file, name) => (await import(pathToFileURL(join(RELEASE, 'dist', file + '.js'))))[name];
const safeError = error => ({ name: ['AssertionError', 'Error', 'NodiaAiAdapterError', 'QueryFailedError',
  'UnknownDependenciesException', 'InvalidClassModuleException', 'SyntaxError', 'TypeError', 'ReferenceError'].includes(error?.name) ? error.name : 'unclassified',
  code: typeof error?.code === 'string' && (/^[a-z][a-z0-9_:]{1,95}$/u.test(error.code) ||
    /^(?:ERR_[A-Z_]{1,40}|ENOENT|MODULE_NOT_FOUND|[0-9A-Z]{5})$/u.test(error.code)) ? error.code : null });
try {
  assert.equal(process.platform, 'linux'); assert.ok(process.getuid() > 0);
  assert.equal(process.env.NODIA_CODEX_ENABLED, 'true');
  let size = 0; const chunks = [];
  for await (const chunk of process.stdin) { size += chunk.length; assert.ok(size <= 1024 * 1024); chunks.push(chunk); }
  const config = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(exact(config, ['schema_version', 'authorize_compaction_workflow', 'max_provider_dispatches', 'selection', 'provider', 'expected_binary_sha256', 'provided_fixture', 'execution_mode']));
  assert.ok(['bootstrap', 'live'].includes(config.execution_mode));
  assert.equal(config.schema_version, 1); assert.equal(config.authorize_compaction_workflow, true);
  assert.equal(config.max_provider_dispatches, 3);
  selection = config.selection;
  assert.ok(exact(selection, ['connection_id', 'mode', 'model_id', 'effort_id']));
  assert.equal(selection.connection_id, '1'); assert.equal(selection.mode, 'token_plan_agentic');
  assert.ok(typeof selection.model_id === 'string' && selection.model_id.trim() && Buffer.byteLength(selection.model_id) <= 1024);
  assert.ok(selection.effort_id === null || typeof selection.effort_id === 'string' && /^[a-z][a-z0-9_-]{0,31}$/u.test(selection.effort_id));
  assert.ok(exact(config.provider, ['is_active', 'catalog_active', 'use_token_plan_agentic', 'can_use_token_plan_agentic', 'updated_at', 'agentic_fields']));
  for (const key of ['is_active', 'catalog_active', 'use_token_plan_agentic', 'can_use_token_plan_agentic']) assert.equal(config.provider[key], true);
  assert.ok(typeof config.provider.updated_at === 'string' && Number.isFinite(Date.parse(config.provider.updated_at)));
  assert.ok(config.provider.agentic_fields && typeof config.provider.agentic_fields === 'object' && !Array.isArray(config.provider.agentic_fields));
  assert.match(config.expected_binary_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(sha256(await readFile(join(RELEASE, 'release-manifest.json'))), RELEASE_SHA);
  const supplied = config.provided_fixture;
  assert.ok(exact(supplied, ['schema_version', 'container_name', 'options', 'identities']));
  assert.equal(supplied.schema_version, 1); assert.match(supplied.container_name, /^template_ai40_[1-9]\d*_[a-f0-9]{8}$/u);
  fixtureContainer = supplied.container_name;
  const options = supplied.options;
  assert.ok(exact(options, ['type', 'host', 'port', 'username', 'password', 'database', 'synchronize', 'entities', 'migrations']));
  assert.equal(options.type, 'postgres'); assert.equal(options.host, '127.0.0.1');
  assert.equal(options.database, 'ai40'); assert.equal(options.username, 'ai40'); assert.equal(options.synchronize, false);
  assert.match(options.password, /^[a-f0-9]{40}$/u);
  assert.ok(Number.isSafeInteger(options.port) && options.port > 1024 && options.port <= 65535 && options.port !== 5432);
  assert.deepEqual(options.entities, [join(RELEASE, 'dist/**/*.entity.js')]);
  assert.deepEqual(options.migrations, [join(RELEASE, 'dist/migrations/*.js')]);
  assert.ok(Array.isArray(supplied.identities) && supplied.identities.length === 3);
  for (const [index, actor] of supplied.identities.entries()) {
    assert.ok(exact(actor, ['userId', 'sessionId'])); assert.equal(actor.userId, String(index + 1));
    assert.match(actor.sessionId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
  }
  identity = supplied.identities[0];
  adminIdentity = supplied.identities[2];
  const profileRoot = process.env.NODIA_CODEX_PROFILE_ROOT;
  assert.ok(profileRoot && resolve(profileRoot) === profileRoot && await realpath(profileRoot) === profileRoot);
  for (const path of [profileRoot, join(profileRoot, selection.connection_id)]) {
    const st = await lstat(path); assert.ok(st.isDirectory() && !st.isSymbolicLink() && st.uid === process.getuid() && (st.mode & 0o077) === 0);
  }
  assert.equal(await lstat(join(profileRoot, selection.connection_id, 'auth.json')).then(() => true, error => {
    if (error.code === 'ENOENT') return false; throw error;
  }), false);
  process.env.AUTH_JWT_SECRET = randomUUID() + randomUUID();
  process.env.GOOGLE_CLIENT_ID = 'synthetic-ai40.apps.googleusercontent.com';
  process.env.AUTH_ALLOWED_ORIGINS = 'http://127.0.0.1';
  const require = createRequire(join(RELEASE, 'package.json'));
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  phase = 'disposable_sql'; db = await new DataSource(options).initialize(); fixtureConnected = true;
  const [provider] = await db.query(`INSERT INTO ai_providers(id,catalog_id,name,is_active,use_token_plan_agentic,fields,updated_at)
    SELECT $1::bigint,id,'AI40 compaction public configuration mirror',true,true,$2::jsonb,$3::timestamp
    FROM ai_provider_catalog WHERE key='openai' RETURNING id::text`,
  [selection.connection_id, JSON.stringify({ token_plan_agentic: config.provider.agentic_fields }), config.provider.updated_at]);
  assert.equal(provider?.id, selection.connection_id);
  await db.query("UPDATE ai_provider_catalog SET is_active=true,can_use_token_plan_agentic=true WHERE key='openai'");
  const { Test } = require('@nestjs/testing'); const { TypeOrmModule } = require('@nestjs/typeorm');
  const [Conversation, Processing, Runtime, RunStage, ProcessStage, Create, Admit, Cleanup, CodexAdapter, CodexRuntime, Redis, History, Reconcile, ChatRuntime] = await Promise.all([
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
    ['nodia-ai-context/use-case/process-nodia-ai-stage.use-case', 'ProcessNodiaAiStageUseCase'],
    ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
    ['nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase'],
    ['nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case', 'CodexNodiaAiAdapterUseCase'],
    ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
    ['common/redis/redis.service', 'RedisService'],
    ['nodia-ai-context-snapshot/use-case/load-nodia-ai-context-history.use-case', 'LoadNodiaAiContextHistoryUseCase'],
    ['nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'],
    ['common/ai/codex/codex-chat-runtime', 'CodexChatRuntime'],
  ].map(([file, name]) => load(file, name)));
  const { NODIA_AI_STAGE_HANDLER } = await import(pathToFileURL(join(RELEASE, 'dist/nodia-ai-runtime/types/worker.types.js')));
  const { NODIA_AI_RUNTIME_POLICY } = await import(pathToFileURL(join(RELEASE, 'dist/nodia-ai-runtime/config/runtime-policy.js')));
  phase = 'compiled_application';
  compiled = await Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), Conversation, Processing, Runtime], providers: [RunStage] })
    .overrideProvider(Redis).useValue({ get: async () => null, set: async () => {}, del: async () => {}, keys: async () => [] }).setLogger(false).compile();
  stage = compiled.get(RunStage); cleanup = compiled.get(Cleanup); reconcile = compiled.get(Reconcile);
  const handler = compiled.get(ProcessStage); assert.equal(stage.handler, handler); assert.equal(compiled.get(NODIA_AI_STAGE_HANDLER), handler);
  handlerVerified = true;
  const adapter = compiled.get(CodexAdapter), nativeRuntime = compiled.get(CodexRuntime);
  const chatRuntime = compiled.get(ChatRuntime); assert.equal(adapter.runtime, chatRuntime); journal = chatRuntime.journal;
  const policy = compiled.get(NODIA_AI_RUNTIME_POLICY), code = randomBytes(16).toString('hex').toUpperCase();
  const history = compactionSources(code); sourceMetrics = verifyCompactionSources(history, code, policy);
  const create = compiled.get(Create), admit = compiled.get(Admit), historyReader = compiled.get(History);
  const chat = await create.execute(identity, { client_request_id: randomUUID(), selection }); chatId = chat.conversation_id;
  phase = 'seed_declared_synthetic_history';
  await db.transaction(async manager => {
    const [locked] = await manager.query('SELECT owner_id,next_message_seq,active_job_id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE', [chatId]);
    assert.equal(locked.owner_id, identity.userId); assert.equal(locked.next_message_seq, '0'); assert.equal(locked.active_job_id, null);
    for (const item of history) {
      const messageId = randomUUID(), clientId = randomUUID();
      const inputHash = sha256(JSON.stringify({ conversation_id: chatId, actor_id: identity.userId, parts: item.parts }));
      await manager.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,input_hash,status,source_scope_manifest,sealed_at) VALUES($1,$2,$3,'user',$4,$5,$6,'sealed',$7,clock_timestamp())",
        [messageId, chatId, item.seq, identity.userId, clientId, inputHash, item.scope]);
      await manager.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text',$3)", [messageId, chatId, item.parts[0].text]);
    }
    await manager.query('UPDATE nodia_ai_conversations SET next_message_seq=$2 WHERE id=$1', [chatId, '6']);
  });
  const sourceHash = await db.transaction(manager => historyReader.fingerprint(manager, chatId, '6'));
  const loaded = await db.transaction(manager => historyReader.load(manager, { conversationId: chatId,
    actorId: identity.userId, throughSeq: '6', moduleRoutes: ['/tools/nodia-ai'],
    maxBytes: Math.floor(policy.results.assembled_context_utf8_bytes * 3 / 4) }));
  assert.equal(loaded.complete, true); assert.equal(loaded.throughSeq, '6'); assert.equal(loaded.history.length, 6);
  assert.deepEqual(loaded.history.map(item => item.parts.map(part => part.text)), history.map(item => item.parts.map(part => part.text)));
  const loadedBytes = Buffer.byteLength(JSON.stringify(loaded.history));
  assert.ok(loadedBytes >= policy.results.assembled_context_utf8_bytes / 2 && loadedBytes < Math.floor(policy.results.assembled_context_utf8_bytes * 3 / 4));
  sourceMetrics = { ...sourceMetrics, actual_SQL_loader_complete: loaded.complete, actual_SQL_history_json_utf8_bytes: loadedBytes };
  const Builder = await load('nodia-ai-context/use-case/build-nodia-ai-compaction.use-case', 'BuildNodiaAiCompactionUseCase');
  const prepared = compiled.get(Builder).execute({ history: loaded.history, moduleRoutes: ['/tools/nodia-ai'],
    throughSeq: '6', sourceHash }, 'plain_text');
  const measured = chatRuntime.measure({ modelId: selection.model_id,
    ...(selection.effort_id ? { effort: selection.effort_id } : {}), prompt: prepared.prompt, tools: [] });
  assert.ok(prepared.sourceBytes <= policy.results.assembled_context_utf8_bytes);
  assert.ok(measured.totalUtf8Bytes <= measured.maxUtf8Bytes);
  sourceMetrics = { ...sourceMetrics, source_hash: sourceHash, prepared_transport: 'plain_text',
    prepared_prompt_sha256: sha256(prepared.prompt), prepared_prompt_utf8_bytes: prepared.sourceBytes,
    pure_native_measurement: measured };
  if (config.execution_mode === 'bootstrap') {
    const [counts] = await db.query(`SELECT (SELECT count(*)::integer FROM nodia_ai_runs) runs,
      (SELECT count(*)::integer FROM nodia_ai_jobs) jobs,(SELECT count(*)::integer FROM nodia_ai_executions) business_executions,
      (SELECT count(*)::integer FROM nodia_ai_messages) messages`);
    assert.deepEqual(counts, { runs: 0, jobs: 0, business_executions: 0, messages: 6 });
    check('Compiled DI, six-source SQL seed/load/fingerprint, explicit plain-text compaction builder and pure measurement complete before executable, account observation, Admit or RunStage', true);
    dryBootstrapComplete = true; safeToRemove = true; phase = 'dry_bootstrap_complete';
    throw DRY_BOOTSTRAP_COMPLETE;
  }
  const binary = await nativeRuntime.executable();
  const binaryInfo = await lstat(binary); assert.ok(binaryInfo.isFile() && !binaryInfo.isSymbolicLink());
  assert.equal(sha256(await readFile(binary)), config.expected_binary_sha256);
  const observation = await adapter.observe(selection, AbortSignal.timeout(30000));
  check('Current unmodified R06 account metadata and fresh MCP acceptance are available', observation.available === true && observation.supportsMcp === true);
  const getChat = async () => (await db.query('SELECT * FROM nodia_ai_conversations WHERE id=$1', [chatId]))[0];
  const getRun = async id => (await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [id]))[0];
  proofHelpers = await import(pathToFileURL(join(RELEASE, 'dist/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js')));
  const { sameCodexProcess, assertCodexGroupEmpty } = await import(pathToFileURL(join(RELEASE, 'dist/common/ai/codex/codex-process-ownership.js')));
  inspectNative = async proof => {
    const handle = await open(join(await journal.root(), proof.attemptId + '.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes;
    try {
      const st = await handle.stat(); assert.ok(st.isFile() && st.uid === process.getuid() && st.nlink === 1 && (st.mode & 0o777) === 0o600 && st.size <= 4096);
      bytes = await handle.readFile(); assert.equal(bytes.length, st.size);
    } finally { await handle.close(); }
    const record = journal.decode(JSON.parse(bytes.toString('utf8')));
    assert.ok(record && record.native); assert.equal(record.identity.attemptId, proof.attemptId);
    assert.equal(record.identity.operationRef, proof.operationRef); assert.equal(record.identity.adapterIdentity.connectionId, selection.connection_id);
    assert.equal(record.identity.adapterIdentity.providerKey, 'openai'); assert.equal(record.identity.adapterIdentity.contractVersion, 'nodia-ai-codex-chat/1');
    assert.equal(record.identity.resourceKey, proof.resourceKey); assert.equal(record.identity.sessionGeneration, proof.sessionGeneration);
    assert.deepEqual(journal.proof(record), proof);
    assert.equal(record.acknowledged, true); assert.equal(record.unforwardedRequests, 0);
    assert.equal(await sameCodexProcess(record.native), false); await assertCodexGroupEmpty(record.native.group);
    const staging = join(profileRoot, selection.connection_id, 'nodia-chat-images');
    let stagingEntries = 0, stagingPresent = false;
    try {
      const st = await lstat(staging); assert.ok(st.isDirectory() && !st.isSymbolicLink() && st.uid === process.getuid() && (st.mode & 0o077) === 0);
      stagingPresent = true; stagingEntries = (await readdir(staging)).length;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    assert.equal(stagingEntries, 0);
    return { journal_state: record.state, journal_acknowledged: record.acknowledged,
      journal_record_sha256: sha256(bytes),
      exact_native_process_absent: true, owned_native_process_group_empty: true,
      image_staging_root_present: stagingPresent, image_staging_entries: stagingEntries };
  };
  exactAck = async function exactAck(allowUnknownOutcome = false) {
    const ownRunIds = runs.map(run => run.run_id);
    if (!ownRunIds.length) return;
    const attempts = await db.query('SELECT a.id FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.conversation_id=$1 AND j.run_id=ANY($2::uuid[])', [chatId, ownRunIds]);
    const ownDedupKeys = attempts.map(attempt => 'ack:' + attempt.id);
    const pending = await db.query("SELECT id,recovery_descriptor FROM nodia_ai_jobs WHERE kind='reconcile' AND stage_key='reconcile_ack' AND dedup_key=ANY($1::text[]) ORDER BY id", [ownDedupKeys]);
    for (const row of pending) {
      const proof = proofHelpers.readTerminalProof(row.recovery_descriptor);
      sqlNativeRequests.set(proof.attemptId, proofHelpers.readRuntimeProofRequest(row.recovery_descriptor));
      assert.equal(proof.processClosed, true);
      assert.ok(proof.outcome === 'completed' || allowUnknownOutcome && proof.outcome === 'abandoned_unknown');
      const settled = await cleanup.execute(row.id);
      assert.deepEqual(settled, { processed: 1, settled: 1 });
      terminalReceipts.push({ attempt_id: proof.attemptId, terminal_proof_id: proof.terminalProofId,
        operation_ref: proof.operationRef, process_closed: proof.processClosed, outcome: proof.outcome,
        exact_native_ack_settled: true, ...await inspectNative(proof) });
    }
  };
  async function normalTurn(text, expectedDispatches, expectedCompactions, expectedAnswer) {
    const before = await getChat(); const result = await admit.execute(identity, chatId, {
      client_message_id: randomUUID(), expected_conversation_revision: before.revision, parts: [{ kind: 'text', text }],
    });
    const id = result.run.run_id; const retainedUntil = (await getChat()).expires_at.getTime();
    runs.push({ run_id: id, expected_dispatches: expectedDispatches });
    for (let pass = 0; pass < 4; pass++) {
      const pending = await getRun(id);
      if (['completed', 'failed', 'unknown', 'cancelled', 'waiting_for_user'].includes(pending.state)) break;
      assert.ok(['context', 'inference'].includes(pending.phase), 'No discovery, delegation or extra feature is authorized by this canary');
      assert.ok(pending.provider_dispatches_used < expectedDispatches, 'Do not dispatch beyond the fixed intention budget');
      assert.equal(await stage.execute(randomUUID(), AbortSignal.timeout(policy.timing.run_seconds * 1000)), true);
      const after = await getRun(id);
      dispatches = (await db.query('SELECT COALESCE(sum(provider_dispatches_used),0)::integer n FROM nodia_ai_runs WHERE conversation_id=$1', [chatId]))[0].n;
      assert.ok(after.provider_dispatches_used <= expectedDispatches); assert.equal(after.tool_calls_used, 0);
      await exactAck();
    }
    const run = await getRun(id);
    check('Normal production turn completes with its exact dispatch and compaction budget', run.state === 'completed' && run.provider_dispatches_used === expectedDispatches && run.compactions_used === expectedCompactions && run.tool_calls_used === 0);
    const [answer] = await db.query("SELECT string_agg(p.text,'' ORDER BY p.part_index) AS text FROM nodia_ai_messages m JOIN nodia_ai_message_parts p ON p.message_id=m.id WHERE m.id=$1 AND m.role='assistant' AND m.status='sealed'", [run.assistant_message_id]);
    assert.equal(answer.text.trim(), expectedAnswer);
    assert.equal((await getChat()).expires_at.getTime(), retainedUntil, 'Provider output and ACK must not renew owner retention');
    runs[runs.length - 1] = { run_id: id, state: run.state, provider_dispatches: run.provider_dispatches_used, compactions: run.compactions_used,
      tools: run.tool_calls_used, snapshot_id: run.context_snapshot_id, semantic_exact_match: true, answer_sha256: sha256(answer.text),
      context_sha256: run.context_manifest.context_sha256 ?? null, context_snapshot: run.context_manifest.context_snapshot ?? null,
      compaction: run.context_manifest.compaction ?? null };
    return run;
  }
  phase = 'real_compaction_and_continuation';
  const first = await normalTurn(COMPACTION_FIRST_REQUEST, 2, 1, code); snapshotId = first.context_snapshot_id;
  const [snapshot] = await db.query('SELECT * FROM nodia_ai_context_snapshots WHERE id=$1', [snapshotId]);
  assert.equal(snapshot.through_message_seq, '6'); assert.equal(snapshot.source_hash, sourceHash);
  assert.equal(snapshot.builder_contract_version, 'nodia-ai-compaction/1');
  assert.deepEqual(snapshot.scope_manifest, history[0].scope);
  snapshotMetrics = { id: snapshot.id, revision: snapshot.revision, through_seq: snapshot.through_message_seq,
    source_hash: snapshot.source_hash, builder_contract_version: snapshot.builder_contract_version,
    ...verifyCompactionSummary(snapshot.summary, history, code) };
  assert.equal(await db.transaction(manager => historyReader.fingerprint(manager, chatId, '6')), sourceHash);
  const beforeReuseCount = (await db.query('SELECT count(*)::integer n FROM nodia_ai_context_snapshots WHERE conversation_id=$1', [chatId]))[0].n;
  phase = 'real_snapshot_reuse';
  const second = await normalTurn(COMPACTION_REUSE_REQUEST, 1, 0, COMPACTION_EXPECTED_HOUSE);
  assert.equal(second.context_snapshot_id, snapshot.id);
  assert.equal(second.context_manifest.context_snapshot?.id, snapshot.id);
  assert.equal(second.context_manifest.context_snapshot?.source_hash, sourceHash);
  assert.equal((await db.query('SELECT count(*)::integer n FROM nodia_ai_context_snapshots WHERE conversation_id=$1', [chatId]))[0].n, beforeReuseCount);
  assert.equal(await db.transaction(manager => historyReader.fingerprint(manager, chatId, '6')), sourceHash);
  assert.equal(dispatches, 3); assert.equal(terminalReceipts.length, 3);
  check('No completed intention is replayed', await stage.execute(randomUUID(), AbortSignal.timeout(5000)) === false);
  const [counts] = await db.query(`SELECT (SELECT count(*)::integer FROM nodia_ai_messages WHERE conversation_id=$1) messages,
    (SELECT count(*)::integer FROM nodia_ai_context_snapshots WHERE conversation_id=$1) snapshots,
    (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting')) pending_jobs,
    (SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') retained_slots,
    (SELECT count(*)::integer FROM nodia_ai_executions) business_executions`, [chatId]);
  check('Six synthetic source users, two real admitted users and two actual assistant replies remain intact', counts.messages === 10 && counts.snapshots === 1);
  check('No pending work, retained native slot or business execution remains', counts.pending_jobs === 0 && counts.retained_slots === 0 && counts.business_executions === 0);
  sourceMetrics = { ...sourceMetrics, final_counts: counts }; safeToRemove = true; phase = 'complete';
} catch (error) { if (error !== DRY_BOOTSTRAP_COMPLETE) failed = safeError(error); }
finally {
  if (chatId && db?.isInitialized) {
    try {
      dispatches = (await db.query('SELECT COALESCE(sum(provider_dispatches_used),0)::integer n FROM nodia_ai_runs WHERE conversation_id=$1', [chatId]))[0].n;
    } catch { /* An unavailable fixture retains the last confirmed SQL counter, never an invented count. */ }
  }
  if (!safeToRemove && chatId && db?.isInitialized && reconcile && exactAck && inspectNative) {
    try {
      // The production administrative use case owns native reconciliation. Never invoke it twice or replay a stage.
      const ownRunIds = runs.map(run => run.run_id);
      const nativeBefore = await db.query('SELECT a.id FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.conversation_id=$1 AND j.run_id=ANY($2::uuid[]) AND a.external_operation_ref IS NOT NULL', [chatId, ownRunIds]);
      for (const row of await db.query("SELECT id FROM nodia_ai_jobs WHERE kind='turn' AND state='unknown' AND conversation_id=$1 AND run_id=ANY($2::uuid[])", [chatId, ownRunIds])) {
        const [current] = await db.query('SELECT state,recovery_descriptor FROM nodia_ai_jobs WHERE id=$1 AND conversation_id=$2 AND run_id=ANY($3::uuid[])', [row.id, chatId, ownRunIds]);
        if (!current || current.state !== 'unknown') continue;
        const expected = proofHelpers.readRuntimeProofRequest(current.recovery_descriptor);
        sqlNativeRequests.set(expected.attemptId, expected);
        const result = await reconcile.execute(adminIdentity, row.id);
        assert.equal(result.resolved, true); assert.equal(result.cleanup_pending, false);
        const [remaining] = await db.query('SELECT state FROM nodia_ai_jobs WHERE id=$1', [row.id]);
        assert.ok(!remaining || remaining.state !== 'unknown');
        const record = await journal.read(expected.attemptId); assert.ok(record);
        const proof = journal.proof(record); proofHelpers.assertRuntimeTerminalProof(expected, proof);
        const closure = await inspectNative(proof);
        if (!terminalReceipts.some(receipt => receipt.attempt_id === proof.attemptId)) terminalReceipts.push({
          attempt_id: proof.attemptId, terminal_proof_id: proof.terminalProofId, operation_ref: proof.operationRef,
          process_closed: proof.processClosed, outcome: proof.outcome, exact_native_ack_settled: true, ...closure });
      }
      await exactAck(true);
      // A semantic failure may still be safe to clean only after independent SQL and actual native ownership checks.
      const [pending] = await db.query(`SELECT
        (SELECT count(*)::integer FROM nodia_ai_jobs WHERE state IN ('ready','leased','unknown','waiting') OR kind='reconcile') jobs,
        (SELECT count(*)::integer FROM nodia_ai_runtime_slots WHERE state<>'free') slots,
        (SELECT count(*)::integer FROM nodia_ai_executions) effects`);
      assert.equal(pending.jobs, 0); assert.equal(pending.slots, 0); assert.equal(pending.effects, 0);
      const nativeIds = new Set([...sqlNativeRequests.keys(), ...nativeBefore.map(row => row.id)]);
      for (const id of nativeIds) {
        const expected = sqlNativeRequests.get(id); assert.ok(expected);
        const record = await journal.read(id); assert.ok(record);
        const proof = journal.proof(record); proofHelpers.assertRuntimeTerminalProof(expected, proof); await inspectNative(proof);
      }
      assert.equal(nativeIds.size, dispatches);
      assert.equal(terminalReceipts.length, dispatches);
      safeToRemove = true;
    } catch { /* Retain the disposable database for a separately reviewed exact reconciliation. */ }
  }
  await compiled?.close().catch(() => {});
  if (db?.isInitialized) await db.destroy().catch(() => {});
}
console.log(JSON.stringify({ schema: 'nodia-ai-ai40-compaction-child-r06-v1', status: !failed && safeToRemove ? 'passed' : 'failed',
  started_at_utc: started, finished_at_utc: new Date().toISOString(), phase, error: failed,
  release: RELEASE, release_manifest_sha256: RELEASE_SHA, selection, checks, source_metrics: sourceMetrics, snapshot: snapshotMetrics,
  turns: runs, native_terminal_ack_receipts: terminalReceipts, total_provider_dispatches: dispatches,
  max_authorized_provider_dispatches: 3, production_stage_handler_used: handlerVerified, readiness_overridden: false,
  dry_bootstrap_complete_before_account_or_dispatch: dryBootstrapComplete,
  executable_overridden: false, publication_overridden: false, runtime_policy_overridden: false,
  redis_event_bus_synthetic: true, seeded_history_is_declared_synthetic: true, seeded_assistant_messages: 0,
  current_requests_contain_private_oracle: false, oracle_or_raw_messages_emitted: false,
  fixture_connected: fixtureConnected, fixture_sql_safe_to_remove: safeToRemove,
  retained_disposable_container: safeToRemove ? null : fixtureContainer, operational_database_accessed: false,
  operational_profile_removed: false, full_C40_09_accepted: false,
  limits: ['Only successful compaction, cited snapshot and its next-turn reuse are exercised.', 'Cancel, revocation, exclusion and other recovery gates remain separate.', 'A fixture history is seeded directly; normal Create/Admit and unmodified production worker stages execute both new intentions.'] }, null, 2));
if (failed || !safeToRemove) process.exitCode = 1;
