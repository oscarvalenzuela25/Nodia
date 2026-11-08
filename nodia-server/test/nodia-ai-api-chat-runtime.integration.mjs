// Real PostgreSQL and production runtime cases; no provider network or real credentials.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createNodiaAiIntegrationFixture, loadAi } from './nodia-ai.integration.fixture.mjs';

const originalFetch = globalThis.fetch; let providerHttpAttempts = 0;
globalThis.fetch = async () => { providerHttpAttempts++; throw Error('offline_sql_test_forbids_http'); };
const fixture = await createNodiaAiIntegrationFixture('ai92');
const { db, identities } = fixture;
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const load = (path, name) => loadAi(path, name);
try {
  const [Runtime, Auth, Authorize, Validate, Claim, Checkpoint, Reserve, Api, Migration, Release, Recover, Reconcile, Cleanup] = await Promise.all([
    load('nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService'),
    load('nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'),
    load('nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'),
    load('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case', 'ValidateNodiaAiRuntimePolicyUseCase'),
    load('nodia-ai-runtime/use-case/claim-nodia-ai-job.use-case', 'ClaimNodiaAiJobUseCase'),
    load('nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case', 'CheckpointNodiaAiJobUseCase'),
    load('nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case', 'ReserveNodiaAiRuntimeSlotUseCase'),
    load('nodia-ai-adapter/api-nodia-ai-runtime.service', 'ApiNodiaAiRuntimeService'),
    load('migrations/1793310000000-AddNodiaAiApiChatRuntime', 'AddNodiaAiApiChatRuntime1793310000000'),
    load('nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case', 'ReleaseNodiaAiRuntimeSlotUseCase'),
    load('nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case', 'RecoverNodiaAiJobsUseCase'),
    load('nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case', 'ReconcileNodiaAiRuntimeUseCase'),
    load('nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase'),
  ]);
  const { apiReplyDigest } = await import('../dist/nodia-ai-adapter/api-nodia-ai-runtime.service.js');
  const policy = new Validate().execute(JSON.parse(await readFile(new URL('../dist/nodia-ai-runtime/config/runtime-policy.json', import.meta.url), 'utf8')));
  const runtime = new Runtime(db), authorize = new Authorize(new Auth(db));
  const claims = new Claim(runtime, authorize, policy), checkpoint = new Checkpoint(runtime, authorize, policy), reserve = new Reserve(checkpoint, policy);
  const release = new Release(checkpoint), recover = new Recover(runtime, policy);
  const admin = { userId: '3', sessionId: identities.get('3').sessionId };
  async function commonReconcile(api, jobId) {
    const cleanup = new Cleanup(runtime, api, policy);
    return new Reconcile(runtime, authorize, api, cleanup, policy).execute(admin, jobId);
  }
  const catalog = 'synthetic-api-chat-runtime';
  // The neutral bridge now enforces a real provider FK. This runtime-only fixture
  // previously used an unbacked selection; register its synthetic identity, no key/network.
  await db.query("INSERT INTO ai_providers(id,catalog_id,name,use_api_key,fields) SELECT 1,id,'Synthetic runtime identity',true,'{}' FROM ai_provider_catalog WHERE key='openai' ON CONFLICT(id) DO NOTHING");
  async function seed(arm = true) {
    const conversation = randomUUID(), message = randomUUID(), run = randomUUID(), job = randomUUID();
    const model = 'fixture-dynamic-api-model', connection = '1';
    const resourceKey = 'api-connection:' + createHash('sha256').update(conversation).digest('hex');
    const identity = { providerKey: 'openai', contractVersion: 'nodia-ai-api-chat/1', connectionId: connection };
    const selection = { connection_id: connection, mode: 'api_key', model_id: model, effort_id: null };
    const manifest = { session_generation: 'c'.repeat(32), configuration_generation: 'd'.repeat(64), adapter_identity: {
      provider_key: identity.providerKey, contract_version: identity.contractVersion, connection_id: identity.connectionId } };
    await db.transaction(async manager => {
      await manager.query("INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,expires_at,next_message_seq) VALUES($1,1,$2,'Synthetic API chat',$3,now()+interval '1 day',1)", [conversation, randomUUID(), 'a'.repeat(64)]);
      await manager.query("INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',1,$3,'sealed','{}',now(),$4)", [message, conversation, randomUUID(), 'b'.repeat(64)]);
      await manager.query("INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','Synthetic input')", [message, conversation]);
      const budget = { schema_version: 1, tool_calls: policy.budget.tool_calls_per_run, mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run,
        provider_dispatches: policy.budget.provider_dispatches_per_run, compactions: policy.budget.compactions_per_run, delegations: policy.budget.delegations_per_run };
      await manager.query(`INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest)
        VALUES($1,$2,1,$3,$4::jsonb,$5,$6,$7,'{"schema_version":1,"enabled":false,"revision":1,"target":null}',$8::jsonb,1,'queued','context',now()+interval '10 minutes',1,$9::jsonb)`,
      [run, conversation, message, JSON.stringify(selection), catalog, policy.policyVersion, policy.policyHash, JSON.stringify(budget), JSON.stringify(manifest)]);
      await manager.query(`INSERT INTO nodia_ai_execution_grants(id,actor_id,session_public_id,run_id,allowed_modules,allowed_operations,allowed_scope,policy_version,expires_at)
        VALUES($1,1,$2,$3,'[]','["chat:respond"]','{}',$4,now()+interval '10 minutes')`, [randomUUID(), identities.get('1').sessionId, run, policy.policyVersion]);
      await manager.query("INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,state,available_at,deadline_at,stage_key) VALUES($1,'turn',$2,$3,$4,'ready',now(),now()+interval '10 minutes','context')", [job, 'turn:' + run, conversation, run]);
      await manager.query('UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1', [conversation, job]);
    });
    const claim = await claims.execute(randomUUID(), [catalog]); assert.equal(claim?.job.id, job);
    const reservation = { ...await reserve.execute(claim, resourceKey, claim.attempt.id), adapterIdentity: identity, sessionGeneration: manifest.session_generation };
    if (arm) await checkpoint.armDispatch(claim, selection, reservation);
    const request = { attemptId: claim.attempt.id, selection, canonicalPrompt: 'Synthetic bounded prompt', deadlineAt: new Date(Date.now() + 30000),
      resourceKey, sessionGeneration: manifest.session_generation, configurationGeneration: manifest.configuration_generation };
    return { claim, request, run, job, reservation };
  }
  const migrationCount = (await db.query("SELECT count(*)::int count FROM migrations WHERE name='AddNodiaAiApiChatRuntime1793310000000'"))[0].count;
  check('fresh installation includes additive API migration once', migrationCount === 1);

  const first = await seed();
  const executors = [new Api(db), new Api(db)];
  const starts = await Promise.allSettled(executors.map(executor => executor.start(first.request)));
  check('two executors race: only one durable attempt can start', starts.filter(result => result.status === 'fulfilled').length === 1);
  const executor = executors[starts.findIndex(result => result.status === 'fulfilled')];
  const identity = starts.find(result => result.status === 'fulfilled').value;
  await assert.rejects(new Api(db).reconcile(identity, AbortSignal.timeout(5000)));
  check('a second module instance cannot reconcile a live physical executor', true);
  const exchanges = await Promise.allSettled(Array.from({ length: policy.budget.provider_dispatches_per_run + 1 }, () => executor.reserveExchange(first.request)));
  if (exchanges.filter(result => result.status === 'fulfilled').length !== policy.budget.provider_dispatches_per_run)
    console.log(JSON.stringify({ diagnostic: 'exchange_reservation', expected: policy.budget.provider_dispatches_per_run,
      results: exchanges.map(result => result.status === 'fulfilled' ? 'reserved' : {
        message: /^nodia_ai:[a-z_]+$/.test(result.reason?.message ?? '') ? result.reason.message : 'database_or_contract_error', code: result.reason?.code ?? null,
      }) }));
  check('concurrent exchanges spend exactly the persisted HTTP dispatch budget', exchanges.filter(result => result.status === 'fulfilled').length === policy.budget.provider_dispatches_per_run);
  const counts = (await db.query('SELECT d.exchange_count,r.provider_dispatches_used FROM nodia_ai_api_dispatches d JOIN nodia_ai_job_attempts a ON a.id=d.attempt_id JOIN nodia_ai_jobs j ON j.id=a.job_id JOIN nodia_ai_runs r ON r.id=j.run_id WHERE d.attempt_id=$1', [first.request.attemptId]))[0];
  check('initial arm is not charged twice and failed over-budget exchange is rolled back', counts.exchange_count === policy.budget.provider_dispatches_per_run && counts.provider_dispatches_used === counts.exchange_count);
  const neutral=(await db.query('SELECT owner_kind,chat_attempt_id,teacher_attempt_id,reserved_exchanges,started_exchanges FROM ai_generation_operations WHERE id=$1',[first.request.attemptId]))[0];
  check('new chat uses its real attempt in the neutral bridge and preserves exchange accounting',neutral.owner_kind==='chat'&&neutral.chat_attempt_id===first.request.attemptId&&neutral.teacher_attempt_id===null&&neutral.reserved_exchanges===counts.exchange_count&&neutral.started_exchanges===counts.exchange_count);
  const reply = { text: 'Synthetic completed response' };
  const proof = await executor.finish(first.request, 'completed', apiReplyDigest(reply));
  check('completed HTTP proof separates local closure from native process claims', proof.engine === 'api_key' && proof.localTransportClosed && proof.remoteOutcome === 'completed' && proof.processClosed === undefined);
  await executor.assertCompletedRequest(first.request, proof, reply);
  await assert.rejects(executor.assertCompletedRequest({ ...first.request, canonicalPrompt: 'Tampered original' }, proof, reply));
  await assert.rejects(executor.assertCompletedRequest(first.request, proof, { text: 'Fabricated qualification result' }));
  check('qualification cannot replace original content or a returned nonce after completion', true);
  await checkpoint.finish(first.claim, { status: 'completed', terminalProof: proof, persist: manager => release.execute(first.claim, first.reservation, proof, manager) });
  await executor.acknowledge(proof, AbortSignal.timeout(5000));
  await executor.acknowledge(proof, AbortSignal.timeout(5000));
  const saved = (await db.query('SELECT state FROM nodia_ai_jobs WHERE id=$1', [first.job]))[0];
  check('common checkpoint accepts API proof and ACK is idempotent', saved.state === 'done');
  await assert.rejects(executor.acknowledge({ ...proof, localTransportClosed: false }, AbortSignal.timeout(5000)));
  check('forged closure cannot acknowledge a proof', true);

  const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction();
  await assert.rejects(new Migration().down(runner), /rollback_after_execution/);
  await runner.rollbackTransaction(); await runner.release();
  check('rollback refuses to discard recovery metadata after API dispatch', true);

  const noStart = await seed();
  const descriptor = (await db.query('SELECT recovery_descriptor FROM nodia_ai_jobs WHERE id=$1', [noStart.job]))[0].recovery_descriptor;
  const { readRuntimeProofRequest } = await import('../dist/nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js');
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [noStart.job]);
  await recover.execute();
  const recovered = await new Api(db).reconcile(readRuntimeProofRequest(descriptor), AbortSignal.timeout(5000));
  check('armed-before-start crash produces a closed unknown tombstone without dispatch/replay', recovered.localTransportClosed && recovered.remoteOutcome === 'unknown' && recovered.outcome === 'abandoned_unknown');
  await assert.rejects(new Api(db).start(noStart.request));
  check('a stale worker cannot dispatch after reconciliation has fenced its job', true);
  const settledNoStart = await commonReconcile(new Api(db), noStart.job);
  check('common administrative reconciliation closes the unknown run and releases its SQL slot', settledNoStart.resolved && !settledNoStart.cleanup_pending);

  const failedCompletion = await seed();
  let rejectTerminalWrite = false;
  const faultSource = Object.create(db);
  faultSource.transaction = work => db.transaction(async manager => work(new Proxy(manager, {
    get(target, property) {
      if (property === 'query') return async (sql, parameters) => {
        if (rejectTerminalWrite && sql.startsWith("UPDATE nodia_ai_api_dispatches SET state='closed'")) {
          rejectTerminalWrite = false; throw Error('fixture_terminal_write_failed');
        }
        return target.query(sql, parameters);
      };
      const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
    },
  })));
  const completionExecutor = new Api(faultSource);
  const completionIdentity = await completionExecutor.start(failedCompletion.request);
  await completionExecutor.reserveExchange(failedCompletion.request);
  rejectTerminalWrite = true;
  await assert.rejects(completionExecutor.finish(failedCompletion.request, 'completed', apiReplyDigest(reply)), /fixture_terminal_write_failed/);
  const stillRunning = (await db.query('SELECT state,terminal_proof FROM nodia_ai_api_dispatches WHERE attempt_id=$1', [failedCompletion.request.attemptId]))[0];
  check('failed terminal SQL rolls back its physical row without inventing a durable proof', stillRunning.state === 'running' && stillRunning.terminal_proof === null);
  await db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [failedCompletion.job]);
  await recover.execute();
  await assert.rejects(new Api(db).reconcile(completionIdentity, AbortSignal.timeout(5000)), /api_executor_still_active/);
  const localClosure = await completionExecutor.reconcile(completionIdentity, AbortSignal.timeout(5000));
  check('only the same executor with attested completed local work can recover failed terminal persistence', localClosure.localTransportClosed && localClosure.remoteOutcome === 'completed' && localClosure.outcome === 'completed');
  await completionExecutor.assertCompletedRequest(failedCompletion.request, localClosure, reply);
  await completionExecutor.acknowledge(localClosure, AbortSignal.timeout(5000));
  await assert.rejects(completionExecutor.start(failedCompletion.request));
  check('positive local closure recovery retains payload binding and never replays a request', true);
  const settledCompletion = await commonReconcile(completionExecutor, failedCompletion.job);
  check('completed response with failed SQL persistence settles through common recovery without another generation', settledCompletion.resolved && !settledCompletion.cleanup_pending);

  const pre = await seed(false);
  await assert.rejects(new Api(db).start(pre.request));
  check('HTTP cannot start from claimed phase before durable arming', true);
  await checkpoint.finish(pre.claim,{status:'failed',errorCode:'nodia_ai:cancelled'});
  const expired=await seed();
  const Conversations=await load('nodia-ai-conversation/nodia-ai-conversation.service','NodiaAiConversationService');
  const Expire=await load('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case','ExpireNodiaAiConversationsUseCase');
  await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[expired.claim.job.conversation_id]);
  const expiry=await new Expire(new Conversations(db),policy,undefined,{enabled:false}).execute();
  const expiredSlot=(await db.query('SELECT state,generation_operation_id FROM nodia_ai_runtime_slots WHERE resource_key=$1',[expired.request.resourceKey]))[0];
  const remaining=(await db.query('SELECT count(*)::int AS n FROM ai_generation_operations WHERE id=$1',[expired.request.attemptId]))[0];
  check('chat expiry preserves legacy minimal recovery while detaching only its neutral projection',expiry.purged_chats===1&&expiredSlot.state==='unknown'&&expiredSlot.generation_operation_id===null&&remaining.n===0);

  check('no provider or HTTP requests were attempted during SQL verification', providerHttpAttempts === 0);
  const dispatchRows = Number((await db.query('SELECT count(*)::int count FROM nodia_ai_api_dispatches'))[0].count);
  console.log(JSON.stringify({ success: true, checks, checks_passed: checks.length, api_dispatch_rows_observed: dispatchRows, provider_http_requests: providerHttpAttempts, real_credentials: false,
    postgres: '16 disposable', operational_database_accessed: false, cleanup: 'owned container and its volumes removed in finally' }));
} finally { try { await fixture.close(); } finally { globalThis.fetch = originalFetch; } }
