// Compiled AI-34 contracts with disposable PostgreSQL and an explicitly synthetic adapter.
// No configured database, provider session, R2, Redis or domain effect is used.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';
import { createNodiaAiUnpublishedFixture } from './nodia-ai-unpublished.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai34');
const unpublished = await createNodiaAiUnpublishedFixture();
const { db, options, identities } = fixture;
const checks = [], dispatches = [], handlerFailures = [];
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); };
const phrase = 'Synthetic earlier request retained.';
let app, compiled, onDispatch, invalidCompaction = false, loseCompactionTransport = false;
const resourceKey = 'gemini-profile:' + 'a'.repeat(64);
try {
  const [Conversation, Processing, Runtime, Adapter, Stage, Create, Admit, Update, Checkpoint, SnapshotModule, SnapshotStore, Migration, History, AttachmentStore, Prepare, Recovery, Expire] = await Promise.all([
    ['nodia-ai-conversation/nodia-ai-conversation.module', 'NodiaAiConversationModule'],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case', 'RunNodiaAiStageUseCase'],
    ['nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case', 'CreateNodiaAiConversationUseCase'],
    ['nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case', 'AdmitNodiaAiMessageUseCase'],
    ['nodia-ai-conversation/use-case/update-nodia-ai-conversation.use-case', 'UpdateNodiaAiConversationUseCase'],
    ['nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case', 'CheckpointNodiaAiJobUseCase'],
    ['nodia-ai-context-snapshot/nodia-ai-context-snapshot.module', 'NodiaAiContextSnapshotModule'],
    ['nodia-ai-context-snapshot/nodia-ai-context-snapshot.service', 'NodiaAiContextSnapshotService'],
    ['migrations/1793000000000-CreateNodiaAiContextSnapshots', 'CreateNodiaAiContextSnapshots1793000000000'],
    ['nodia-ai-context-snapshot/use-case/load-nodia-ai-context-history.use-case', 'LoadNodiaAiContextHistoryUseCase'],
    ['nodia-ai-attachment/nodia-ai-attachment.service', 'NodiaAiAttachmentService'],
    ['nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case', 'PrepareNodiaAiProposalUseCase'],
    ['nodia-ai-context/use-case/load-nodia-ai-recovery-refs.use-case', 'LoadNodiaAiRecoveryRefsUseCase'],
    ['nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase'],
  ].map(([file, name]) => loadAi(file, name)));
  const count = async (table, where = 'true', values = []) => (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`, values))[0].n;
  const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nodia_ai_context_snapshots'");
  check('M4 adds exactly the nine-column snapshot table and nullable run reference', columns.length === 9 && (await db.query("SELECT is_nullable FROM information_schema.columns WHERE table_name='nodia_ai_runs' AND column_name='context_snapshot_id'"))[0].is_nullable === 'YES');
  // Exercise this stage's exact delta even when later, independent migrations are installed.
  await db.transaction(manager => new Migration().down(manager.queryRunner));
  check('empty snapshot migration rolls back without removing independent preferences', (await db.query("SELECT to_regclass('nodia_ai_context_snapshots')::text AS snapshots,to_regclass('nodia_ai_preferences')::text AS preferences"))[0].snapshots === null && await count('nodia_ai_preferences') === 0);
  await db.transaction(manager => new Migration().up(manager.queryRunner));
  check('empty snapshot migration can be applied again', await count('nodia_ai_context_snapshots') === 0);

  const [provider] = await db.query("INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI34 transport','{}') RETURNING id::text");
  const selection = { connection_id: provider.id, mode: 'token_plan_web', model_id: 'synthetic-ai34-model', effort_id: null };
  const external = {
    // This metadata is a declared synthetic adapter contract, not a provider/model limit observation.
    async measureContext(request) {
      const canonicalUtf8Bytes = Buffer.byteLength(request.canonicalPrompt);
      const catalogUtf8Bytes = request.tools?.length ? Buffer.byteLength(JSON.stringify(request.tools.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })))) : 0;
      const overheadUtf8Bytes = 1000;
      const firstMcpListingUpperBoundUtf8Bytes = catalogUtf8Bytes ? 2 * catalogUtf8Bytes + 2048 : 0;
      return { measurementContractVersion: 'nodia-ai-context-budget/1', measurementScope: 'initial_native_prompt', measurementKind: 'upper_bound', canonicalUtf8Bytes, catalogUtf8Bytes, overheadUtf8Bytes, totalUtf8Bytes: canonicalUtf8Bytes + catalogUtf8Bytes + overheadUtf8Bytes, firstMcpListingUpperBoundUtf8Bytes, maxUtf8Bytes: 262144, modelContextTokens: null };
    },
    async verifyConfiguration() {},
    async observe() { return { available: true, observedAt: new Date(), source: 'synthetic_fixture_only', resourceKey, configurationGeneration: 'c'.repeat(64), sessionGeneration: 'd'.repeat(32), adapterContractVersion: 'nodia-ai-gemini-chat/1', supportsMcp: false, reason: null }; },
    async execute(request) {
      const prompt = JSON.parse(request.canonicalPrompt);
      const compaction = prompt.task === 'compact_conversation';
      const [attempt] = await db.query('SELECT phase FROM nodia_ai_job_attempts WHERE id=$1', [request.attemptId]);
      const [run] = await db.query('SELECT r.* FROM nodia_ai_runs r JOIN nodia_ai_jobs j ON j.run_id=r.id JOIN nodia_ai_job_attempts a ON a.job_id=j.id WHERE a.id=$1', [request.attemptId]);
      assert.equal(attempt.phase, 'dispatch_armed');
      if (compaction) {
        assert.equal(run.compactions_used, 1);
        assert.equal(run.provider_dispatches_used, 1);
        assert.ok(!request.tools?.length, 'compaction exposes no product tools');
      }
      assert.ok(Buffer.byteLength(request.canonicalPrompt) <= 262144);
      dispatches.push({ runId: run.id, compaction, mode: request.selection.mode, selection: request.selection, prompt });
      await onDispatch?.(request, prompt, run);
      if (compaction && loseCompactionTransport) throw Error('Synthetic compacting transport lost after dispatch');
      const summary = prompt.previous_memory ? structuredClone(prompt.previous_memory) : { schema_version: 1, facts: [], decisions: [], questions: [], entities: [], requirements: [] };
      if (compaction) {
        const cited = prompt.messages.filter(message => message.content.includes(phrase)).map(message => message.seq);
        for (let i = 0; i < cited.length; i += 100) summary.facts.push({ text: phrase, source_seqs: cited.slice(i, i + 100) });
      }
      const text = compaction ? invalidCompaction ? '{invalid_synthetic_json' : JSON.stringify(summary) : 'Synthetic bounded answer';
      return { kind: 'answer', text, terminalProof: { engine: request.selection.mode === 'token_plan_web' ? 'web' : 'agentic', attemptId: request.attemptId, resourceKey: request.resourceKey, sessionGeneration: request.sessionGeneration, operationRef: request.attemptId, terminalProofId: randomUUID(), processClosed: true, outcome: 'completed', observedAt: new Date() } };
    },
  };
  compiled = await unpublished.override(Test.createTestingModule({ imports: [TypeOrmModule.forRootAsync({ useFactory: () => options, dataSourceFactory: async () => db }), Conversation, Processing, Runtime, SnapshotModule], providers: [Stage] })).overrideProvider(Adapter).useValue(external).compile();
  app = compiled.createNestApplication({ logger: false });
  await app.init();
  const create = compiled.get(Create), admit = compiled.get(Admit), update = compiled.get(Update), stage = compiled.get(Stage), store = compiled.get(SnapshotStore), checkpoint = compiled.get(Checkpoint), history = compiled.get(History);
  const identity = identities.get('1'), worker = randomUUID(), signal = () => AbortSignal.timeout(20000);
  const handlerExecute = stage.handler.execute.bind(stage.handler);
  stage.handler.execute = async (...args) => {
    try { return await handlerExecute(...args); }
    catch (error) { handlerFailures.push({ name: error.name, message: error.message, code: error.code ?? null }); throw error; }
  };
  const getRun = async id => (await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [id]))[0];
  const getChat = async id => (await db.query('SELECT * FROM nodia_ai_conversations WHERE id=$1', [id]))[0];
  const createChat = async () => create.execute(identity, { client_request_id: randomUUID(), selection });
  const seedHistory = async (chatId, total = 240, bytes = 600, scope = []) => {
    await db.transaction(async manager => {
      for (let seq = 1; seq <= total; seq++) {
        const id = randomUUID(), role = seq % 2 ? 'user' : 'assistant';
        await manager.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,input_hash,status,source_scope_manifest,sealed_at) VALUES($1,$2,$3,$4,$5,$6,$7,'sealed',$8,clock_timestamp())", [id, chatId, String(seq), role, role === 'user' ? '1' : null, role === 'user' ? randomUUID() : null, role === 'user' ? 'f'.repeat(64) : null, { schema_version: 1, module_routes: scope }]);
        await manager.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text',$3)", [id, chatId, phrase + ' ' + 'x'.repeat(bytes)]);
      }
      await manager.query('UPDATE nodia_ai_conversations SET next_message_seq=$2 WHERE id=$1', [chatId, String(total)]);
    });
  };
  const admitTurn = async chatId => admit.execute(identity, chatId, { client_message_id: randomUUID(), expected_conversation_revision: (await getChat(chatId)).revision, parts: [{ kind: 'text', text: phrase + ' Current explicit request.' }] });
  const complete = async runId => {
    for (let pass = 0; pass < 5; pass++) {
      const run = await getRun(runId);
      if (['completed', 'failed', 'unknown', 'cancelled'].includes(run.state)) return run;
      assert.equal(await stage.execute(worker, signal()), true);
    }
    throw Error('Synthetic stage count exceeded');
  };

  const long = await createChat();
  await seedHistory(long.conversation_id);
  const loaded = await db.transaction(async manager => ({
    hash: await history.fingerprint(manager, long.conversation_id, '240'),
    window: await history.load(manager, { conversationId: long.conversation_id, actorId: '1', throughSeq: '240', moduleRoutes: [], maxBytes: 32768 }),
    full: await history.load(manager, { conversationId: long.conversation_id, actorId: '1', throughSeq: '240', moduleRoutes: [], maxBytes: 196608 }),
  }));
  check('SQL history loader bounds an ordered prefix before transferring content to Node', !loaded.window.complete && loaded.window.history.length > 0 && loaded.window.history.length < 240 && loaded.window.history[0].seq === '1');
  check('SQL history loader can load 240 ordered messages without the former collection cap', loaded.full.complete && loaded.full.history.length === 240 && loaded.full.throughSeq === '240');
  const hashRunner = db.createQueryRunner(); await hashRunner.connect(); await hashRunner.startTransaction();
  try {
    await hashRunner.query("UPDATE nodia_ai_message_parts SET text=text||' mutation' WHERE message_id=(SELECT id FROM nodia_ai_messages WHERE conversation_id=$1 AND seq=1)", [long.conversation_id]);
    const changedHash = await history.fingerprint(hashRunner.manager, long.conversation_id, '240');
    check('SQL source fingerprint changes when an earlier canonical text changes', changedHash !== loaded.hash && changedHash.length === 64);
  } finally { await hashRunner.rollbackTransaction(); await hashRunner.release(); }
  check('rolling back a source mutation restores its exact SQL fingerprint', await db.transaction(manager => history.fingerprint(manager, long.conversation_id, '240')) === loaded.hash);
  const longTurn = await admitTurn(long.conversation_id), before = (await getChat(long.conversation_id)).expires_at;
  const completed = await complete(longTurn.run.run_id);
  assert.equal(completed.state, 'completed', JSON.stringify({ state: completed.state, phase: completed.phase, error_code: completed.error_code, compactions: completed.compactions_used, dispatches: completed.provider_dispatches_used }));
  check('history beyond the former collection limit completes via one compacting dispatch and one answer', completed.state === 'completed' && completed.compactions_used === 1 && completed.provider_dispatches_used === 2);
  const [snapshot] = await db.query('SELECT * FROM nodia_ai_context_snapshots WHERE id=$1', [completed.context_snapshot_id]);
  check('snapshot pins a nonempty canonical prefix with an exact source hash and builder contract', snapshot && snapshot.source_hash.length === 64 && BigInt(snapshot.through_message_seq) > 0n && snapshot.builder_contract_version === 'nodia-ai-compaction/1');
  const longCalls = dispatches.filter(call => call.runId === completed.id);
  check('compaction keeps the exact Web selection and has no hidden mode or model fallback', longCalls.length === 2 && longCalls.every(call => Object.entries(selection).every(([key, value]) => call.selection[key] === value)));
  const answer = longCalls.find(call => !call.compaction).prompt;
  check('answer receives cited memory and current text within the canonical adapter budget', answer.conversation_memory?.facts.length > 0 && answer.messages.at(-1).content.includes('Current explicit request.'));
  check('original history remains intact and compaction never renews retention', await count('nodia_ai_messages', 'conversation_id=$1', [long.conversation_id]) === 242 && (await getChat(long.conversation_id)).expires_at.getTime() === before.getTime());
  check('completed compacting turn is never replayed', await stage.execute(worker, signal()) === false && dispatches.filter(call => call.runId === completed.id).length === 2);
  const second = await admitTurn(long.conversation_id), continued = await complete(second.run.run_id);
  check('subsequent turn reuses the validated snapshot without another compaction', continued.state === 'completed' && continued.compactions_used === 0 && continued.provider_dispatches_used === 1 && continued.context_snapshot_id === snapshot.id);

  const oversized = await createChat(); await seedHistory(oversized.conversation_id, 120, 2400);
  const [rawSize] = await db.query('SELECT sum(octet_length(text))::text AS bytes FROM nodia_ai_message_parts WHERE conversation_id=$1', [oversized.conversation_id]);
  const oversizedTurn = await admitTurn(oversized.conversation_id), oversizedRun = await complete(oversizedTurn.run.run_id);
  check('history larger than the canonical byte ceiling completes from one bounded compaction window and the remaining tail', BigInt(rawSize.bytes) > 262144n && oversizedRun.state === 'completed' && oversizedRun.compactions_used === 1 && oversizedRun.provider_dispatches_used === 2 && dispatches.filter(call => call.runId === oversizedRun.id).every(call => Buffer.byteLength(JSON.stringify(call.prompt)) <= 262144));

  const [secondProvider] = await db.query("INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI34 second connection','{}') RETURNING id::text");
  const changed = await update.selection(identity, long.conversation_id, { expected_conversation_revision: (await getChat(long.conversation_id)).revision, selection: { ...selection, connection_id: secondProvider.id, mode: 'token_plan_agentic', model_id: 'synthetic-ai34-other-model' } });
  const changedTurn = await admitTurn(long.conversation_id), changedRun = await complete(changedTurn.run.run_id);
  const changedCall = dispatches.find(call => call.runId === changedRun.id && !call.compaction);
  assert.equal(changedRun.state, 'completed', JSON.stringify({ state: changedRun.state, phase: changedRun.phase, error_code: changedRun.error_code, compactions: changedRun.compactions_used, dispatches: changedRun.provider_dispatches_used, failures: handlerFailures }));
  check('changing connection mode and model preserves canonical memory without replaying prior turns', changed.selection.connection_id === secondProvider.id && changed.selection.mode === 'token_plan_agentic' && changedRun.state === 'completed' && changedRun.context_snapshot_id === snapshot.id && changedRun.compactions_used === 0 && changedCall.prompt.conversation_memory.facts.length > 0 && dispatches.filter(call => call.runId === completed.id).length === 2);

  const runner = db.createQueryRunner();
  await runner.connect(); await runner.startTransaction();
  try { await assert.rejects(() => new Migration().down(runner), /explicit reconciliation/); }
  finally { await runner.rollbackTransaction(); await runner.release(); }
  check('rollback refuses populated snapshots rather than silently discarding memory', await count('nodia_ai_context_snapshots') > 0);
  assert.throws(() => store.latest(db.manager, long.conversation_id, '999'), error => error.message === 'authorization:transaction_required');
  check('snapshot reads require the caller transaction');
  const other = await createChat();
  // A real run from another chat cannot point to this chat's snapshot.
  const otherTurn = await admitTurn(other.conversation_id);
  await assert.rejects(() => db.transaction(manager => manager.query('UPDATE nodia_ai_runs SET context_snapshot_id=$1 WHERE id=$2', [snapshot.id, otherTurn.run.run_id])), error => error.code === '23503');
  check('deferred composite foreign key rejects a cross-chat snapshot reference');
  await complete(otherTurn.run.run_id);
  const beforeUsage = await db.transaction(manager => compiled.get(AttachmentStore).usage(manager, other.conversation_id, '1', new Date()));
  const inserted = await Promise.all([1, 2].map(() => db.transaction(manager => store.insert(manager, { conversationId: other.conversation_id, throughSeq: '1', sourceHash: 'a'.repeat(64), summary: { schema_version: 1, facts: [], decisions: [], questions: [], entities: [], requirements: [] }, scopeManifest: { schema_version: 1, module_routes: [] }, builderContractVersion: 'nodia-ai-compaction/1' }))));
  check('concurrent snapshot append serializes durable revisions without overwriting an artifact', new Set(inserted.map(item => item.revision)).size === 2 && inserted.some(item => item.revision === 1) && inserted.some(item => item.revision === 2));
  const afterUsage = await db.transaction(manager => compiled.get(AttachmentStore).usage(manager, other.conversation_id, '1', new Date()));
  const [snapshotBytes] = await db.query('SELECT sum(octet_length(summary::text)+octet_length(scope_manifest::text))::text AS bytes FROM nodia_ai_context_snapshots WHERE conversation_id=$1', [other.conversation_id]);
  check('chat and owner storage admission counts every persisted snapshot summary and scope byte', BigInt(afterUsage.chat_bytes) - BigInt(beforeUsage.chat_bytes) === BigInt(snapshotBytes.bytes) && BigInt(afterUsage.owner_bytes) - BigInt(beforeUsage.owner_bytes) === BigInt(snapshotBytes.bytes));

  const invalid = await createChat(); await seedHistory(invalid.conversation_id);
  const invalidTurn = await admitTurn(invalid.conversation_id); invalidCompaction = true;
  const invalidRun = await complete(invalidTurn.run.run_id); invalidCompaction = false;
  check('invalid compaction output fails explicitly without creating a snapshot or replaying generation', invalidRun.state === 'failed' && invalidRun.compactions_used === 1 && invalidRun.provider_dispatches_used === 1 && await count('nodia_ai_context_snapshots', 'conversation_id=$1', [invalid.conversation_id]) === 0 && dispatches.filter(call => call.runId === invalidRun.id).length === 1);

  const race = await createChat(); await seedHistory(race.conversation_id);
  const raceTurn = await admitTurn(race.conversation_id);
  onDispatch = async (_request, prompt) => { if (prompt.task === 'compact_conversation') await db.query("UPDATE nodia_ai_message_parts SET text=text||' synthetic source mutation' WHERE conversation_id=$1 AND message_id=(SELECT id FROM nodia_ai_messages WHERE conversation_id=$1 AND seq=1)", [race.conversation_id]); };
  const raced = await complete(raceTurn.run.run_id); onDispatch = undefined;
  check('a source mutation after compaction dispatch cannot publish a stale snapshot or start an answer', raced.state === 'failed' && raced.provider_dispatches_used === 1 && await count('nodia_ai_context_snapshots', 'conversation_id=$1', [race.conversation_id]) === 0 && dispatches.filter(call => call.runId === raced.id).length === 1);

  const exhausted = await createChat(); await seedHistory(exhausted.conversation_id);
  const exhaustedTurn = await admitTurn(exhausted.conversation_id);
  await db.query("UPDATE nodia_ai_runs SET budget_snapshot=jsonb_set(budget_snapshot,'{compactions}','0') WHERE id=$1", [exhaustedTurn.run.run_id]);
  const exhaustedRun = await complete(exhaustedTurn.run.run_id);
  check('an exhausted compacting budget rejects before generation without a hidden retry', exhaustedRun.state === 'failed' && exhaustedRun.provider_dispatches_used === 0 && dispatches.every(call => call.runId !== exhaustedRun.id));

  const armed = await admitTurn(long.conversation_id);
  await stage.execute(worker, signal());
  const originalArm = checkpoint.armDispatch.bind(checkpoint);
  checkpoint.armDispatch = async (claim, chosen, reservation, validate) => {
    await db.query("UPDATE nodia_ai_message_parts SET text=text||' synthetic prefix mutation' WHERE conversation_id=$1 AND message_id=(SELECT id FROM nodia_ai_messages WHERE conversation_id=$1 AND seq=1)", [long.conversation_id]);
    return originalArm(claim, chosen, reservation, validate);
  };
  let armedRun;
  try { armedRun = await complete(armed.run.run_id); } finally { checkpoint.armDispatch = originalArm; }
  check('source fingerprint is checked inside arming before dispatch budget is consumed', armedRun.state === 'failed' && armedRun.provider_dispatches_used === 0 && dispatches.every(call => call.runId !== armedRun.id));

  const route = '/tools/business';
  let [businessModule] = await db.query('SELECT id::text FROM modules WHERE link=$1', [route]);
  if (!businessModule) [businessModule] = await db.query("INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,$1,'synthetic_ai34_business' FROM modules WHERE key='nodia_ai' RETURNING id::text", [route]);
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [businessModule.id]);
  const scoped = await createChat(); await seedHistory(scoped.conversation_id, 240, 600, [route]);
  const scopedTurn = await admitTurn(scoped.conversation_id), scopedRun = await complete(scopedTurn.run.run_id);
  check('authorized scoped source can be compacted while its module is assigned', scopedRun.state === 'completed' && scopedRun.context_snapshot_id);
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [businessModule.id]);
  const revokedTurn = await admitTurn(scoped.conversation_id), revokedRun = await complete(revokedTurn.run.run_id);
  const revokedCalls = dispatches.filter(call => call.runId === revokedRun.id);
  check('revocation never reuses a snapshot or source payload from a lost module', ['completed', 'failed'].includes(revokedRun.state) && revokedRun.context_snapshot_id !== scopedRun.context_snapshot_id && revokedCalls.every(call => !JSON.stringify(call.prompt).includes('x'.repeat(200))));
  const redacted = await db.transaction(manager => history.load(manager, { conversationId: scoped.conversation_id, actorId: '1', throughSeq: '240', moduleRoutes: [], maxBytes: 32768 }));
  check('current module revocation is applied inside the SQL history projection before content transfer', redacted.history.every(item => item.parts.length === 0));

  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [other.conversation_id]);
  const purged = await compiled.get(Expire).execute();
  assert.equal(purged.purged_chats, 1);
  check('chat purge cascades snapshots and their same-chat runs without a deferred FK conflict', await count('nodia_ai_context_snapshots', 'conversation_id=$1', [other.conversation_id]) === 0 && await count('nodia_ai_runs', 'conversation_id=$1', [other.conversation_id]) === 0);
  check('the independent accepted-preference table is preserved by snapshot lifecycle changes', (await db.query("SELECT to_regclass('nodia_ai_preferences')::text AS name"))[0].name === 'nodia_ai_preferences');
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING', [businessModule.id]);
  const businessId = randomUUID();
  await db.query("INSERT INTO businesses(id,owner_id,name) VALUES($1,1,'Synthetic AI34 referenced business')", [businessId]);
  const prepareMemory = async chatId => db.transaction(async manager => {
    const result = await compiled.get(Prepare).execute(manager, identity, { conversationId: chatId, toolName: 'nodia_preferences_prepare_create', partial: { scope_key: 'business', scope: {}, key: 'business_id', value: businessId } });
    assert.equal(result.status, 'ready'); return result.proposal;
  });
  const historical = await createChat();
  for (let item = 0; item < 130; item++) await prepareMemory(historical.conversation_id);
  await db.query("UPDATE nodia_ai_proposal_revisions SET state='cancelled' WHERE proposal_id IN (SELECT id FROM nodia_ai_proposals WHERE conversation_id=$1)", [historical.conversation_id]);
  const historicalRefs = await db.transaction(manager => compiled.get(Recovery).load(manager, identity, historical.conversation_id));
  check('many terminal proposals remain inspectable through bounded references without blocking a chat', historicalRefs.pending_references.length === 0 && historicalRefs.historical_references.length === 25 && historicalRefs.historical_total === '130' && historicalRefs.historical_included === 25 && historicalRefs.historical_more);
  check('operation references contain identity state and hashes without replayable commands or confirmation tokens', historicalRefs.historical_references.every(ref => ref.kind === 'proposal' && ref.state === 'cancelled' && !('command' in ref) && !('confirmation_token' in ref)) && await count('nodia_ai_executions', 'conversation_id=$1', [historical.conversation_id]) === 0);
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [businessModule.id]);
  const restrictedRefs = await db.transaction(manager => compiled.get(Recovery).load(manager, identity, historical.conversation_id));
  check('each retained operation reference is reauthorized and becomes restricted after module revocation', restrictedRefs.historical_references.length === 25 && restrictedRefs.historical_references.every(ref => ref.kind === 'restricted' && ref.reference_kind === 'proposal'));
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [businessModule.id]);
  const pending = await createChat();
  for (let item = 0; item < 129; item++) await prepareMemory(pending.conversation_id);
  await assert.rejects(() => db.transaction(manager => compiled.get(Recovery).load(manager, identity, pending.conversation_id)), /nodia_ai:context_limit/);
  check('too many live pending proposals fail explicitly rather than silently dropping a required confirmation');
  const uncertain = await createChat(); await seedHistory(uncertain.conversation_id);
  const uncertainTurn = await admitTurn(uncertain.conversation_id); loseCompactionTransport = true;
  const uncertainRun = await complete(uncertainTurn.run.run_id); loseCompactionTransport = false;
  check('a lost compacting response is unknown and cannot trigger another generation', uncertainRun.state === 'unknown' && uncertainRun.compactions_used === 1 && uncertainRun.provider_dispatches_used === 1 && await stage.execute(worker, signal()) === false && dispatches.filter(call => call.runId === uncertainRun.id).length === 1);
  const Policy = await loadAi('nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY');
  const reserve = BigInt(compiled.get(Policy).results.assistant_text_utf8_bytes);
  const [scopeBytes] = await db.query("SELECT octet_length(jsonb_build_object('schema_version',1,'module_routes',context_manifest->'module_routes')::text)::text AS bytes FROM nodia_ai_runs WHERE id=$1", [uncertainRun.id]);
  const reserved = await db.transaction(async manager => ({
    withRun: await compiled.get(AttachmentStore).usage(manager, uncertain.conversation_id, '1', new Date()),
    excluded: await compiled.get(AttachmentStore).usage(manager, uncertain.conversation_id, '1', new Date(), uncertainRun.id),
  }));
  const expectedReserve = 3n * reserve + BigInt(scopeBytes.bytes);
  check('unknown compacting run retains bounded snapshot and answer reservations until reconciliation', BigInt(reserved.withRun.chat_bytes) - BigInt(reserved.excluded.chat_bytes) === expectedReserve && BigInt(reserved.withRun.owner_bytes) - BigInt(reserved.excluded.owner_bytes) === expectedReserve);
  console.log(JSON.stringify({ stage: 'AI-34', scope: 'compiled_context_compaction_disposable_postgresql', checks: checks.length, passed: checks, synthetic_dispatches: dispatches.length, synthetic_compactions: dispatches.filter(call => call.compaction).length, real_inference: false, configured_database_used: false, storage_operations: 0 }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ stage: 'AI-34', completed_checks: checks.length, last_checks: checks.slice(-4) }));
  throw error;
} finally {
  if (app) await app.close(); else await compiled?.close();
  await fixture.close(); unpublished.close();
}
