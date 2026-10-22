// Real PostgreSQL claims/fences and compiled cases. All identities, payloads and providers are synthetic.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fork } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { JwtService } from '@nestjs/jwt';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai11');
const { db, identities } = fixture;
const passed = [];
const check = (name, value) => {
  assert.ok(value, name);
  passed.push(name);
};
const required = [
  ['nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService'],
  ['nodia-ai/nodia-ai-authorization.service', 'NodiaAiAuthorizationService'],
  ['nodia-ai/use-case/authorize-nodia-ai.use-case', 'AuthorizeNodiaAiUseCase'],
  [
    'nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case',
    'ValidateNodiaAiRuntimePolicyUseCase',
  ],
  [
    'nodia-ai-runtime/use-case/claim-nodia-ai-job.use-case',
    'ClaimNodiaAiJobUseCase',
  ],
  [
    'nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case',
    'CheckpointNodiaAiJobUseCase',
  ],
  [
    'nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case',
    'RecoverNodiaAiJobsUseCase',
  ],
  [
    'nodia-ai-runtime/use-case/retry-nodia-ai-job.use-case',
    'RetryNodiaAiJobUseCase',
  ],
  [
    'nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case',
    'ReserveNodiaAiRuntimeSlotUseCase',
  ],
  [
    'nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case',
    'ReleaseNodiaAiRuntimeSlotUseCase',
  ],
  [
    'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
    'RunNodiaAiStageUseCase',
  ],
];
const [
  Runtime,
  AuthStore,
  Authorize,
  ValidatePolicy,
  Claim,
  Checkpoint,
  Recover,
  Retry,
  Reserve,
  Release,
  RunStage,
] = await Promise.all(required.map(([file, name]) => loadAi(file, name)));
const policy = new ValidatePolicy().execute(
  JSON.parse(
    await readFile(
      new URL(
        '../dist/nodia-ai-runtime/config/runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);
const runtime = new Runtime(db),
  authorize = new Authorize(new AuthStore(db));
const claims = new Claim(runtime, authorize, policy),
  checkpoint = new Checkpoint(runtime, authorize, policy),
  recover = new Recover(runtime, policy),
  retry = new Retry(checkpoint, policy),
  reserve = new Reserve(checkpoint, policy),
  release = new Release(checkpoint);
const worker1 = randomUUID(),
  worker2 = randomUUID(),
  worker3 = randomUUID();
const key = 'gemini-profile:' + 'a'.repeat(64);
const processes = new Set();
const catalog = 'synthetic-ai11-catalog';
const claim = async (worker = worker1) => claims.execute(worker, [catalog]);
const row = async (table, id) => {
  assert(
    [
      'nodia_ai_jobs',
      'nodia_ai_runs',
      'nodia_ai_job_attempts',
      'nodia_ai_conversations',
    ].includes(table),
  );
  return (await db.query(`SELECT * FROM ${table} WHERE id=$1`, [id]))[0];
};
const reset = async () => {
  await db.query(
    'TRUNCATE TABLE nodia_ai_conversations,nodia_ai_jobs,nodia_ai_runtime_slots,nodia_ai_audit_events CASCADE',
  );
};
async function startProcess(arm = false) {
  const child = fork(
    fileURLToPath(
      new URL('./nodia-ai-ai11-process.fixture.mjs', import.meta.url),
    ),
    [],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
  );
  processes.add(child);
  const reply = () =>
    Promise.race([
      once(child, 'message').then(([message]) => message),
      once(child, 'exit').then(() => {
        throw Error('Synthetic worker exited early');
      }),
    ]);
  const ready = await reply();
  assert.equal(ready.event, 'ready');
  const result = reply();
  child.send({
    command: 'start',
    database: {
      type: 'postgres',
      host: fixture.options.host,
      port: fixture.options.port,
      username: fixture.options.username,
      password: fixture.options.password,
      database: fixture.options.database,
    },
    workerId: randomUUID(),
    catalog,
    arm,
    resourceKey: key,
  });
  const response = await result;
  assert.equal(response.event, 'claimed');
  return {
    child,
    claim: response.claim,
    close: async () => {
      const ended = once(child, 'exit');
      child.send({ command: 'close' });
      await ended;
      processes.delete(child);
    },
  };
}
async function seed(owner = '1', overrides = {}) {
  const conversationId = randomUUID(),
    messageId = randomUUID(),
    runId = randomUUID(),
    jobId = randomUUID();
  const selection = {
    connection_id: '1',
    mode: 'token_plan_web',
    model_id: 'synthetic-not-an-operational-model',
    effort_id: null,
  };
  const budget = {
    schema_version: 1,
    tool_calls: policy.budget.tool_calls_per_run,
    mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run,
    provider_dispatches: policy.budget.provider_dispatches_per_run,
    compactions: policy.budget.compactions_per_run,
    delegations: policy.budget.delegations_per_run,
  };
  await db.transaction(async (manager) => {
    await manager.query(
      "INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,expires_at,next_message_seq) VALUES($1,$2,$3,'Synthetic worker test',$4,clock_timestamp()+interval '1 day',1)",
      [conversationId, owner, randomUUID(), 'a'.repeat(64)],
    );
    await manager.query(
      "INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',$3,$4,'sealed','{}',clock_timestamp(),$5)",
      [messageId, conversationId, owner, randomUUID(), 'b'.repeat(64)],
    );
    await manager.query(
      "INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','Synthetic input')",
      [messageId, conversationId],
    );
    await manager.query(
      "INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,'{\"schema_version\":1,\"enabled\":false,\"revision\":1,\"target\":null}',$9::jsonb,1,'queued','context',clock_timestamp()+interval '10 minutes',1,'{}')",
      [
        runId,
        conversationId,
        owner,
        messageId,
        JSON.stringify(selection),
        overrides.catalog ?? catalog,
        policy.policyVersion,
        overrides.policyHash ?? policy.policyHash,
        JSON.stringify(budget),
      ],
    );
    await manager.query(
      "INSERT INTO nodia_ai_execution_grants(id,actor_id,session_public_id,run_id,allowed_modules,allowed_operations,allowed_scope,policy_version,expires_at) VALUES($1,$2,$3,$4,'[]','[\"chat:respond\"]','{}',$5,clock_timestamp()+interval '10 minutes')",
      [
        randomUUID(),
        owner,
        identities.get(owner).sessionId,
        runId,
        policy.policyVersion,
      ],
    );
    await manager.query(
      "INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,state,available_at,deadline_at,stage_key) VALUES($1,'turn',$2,$3,$4,'ready',clock_timestamp(),clock_timestamp()+interval '10 minutes','context')",
      [jobId, 'turn:' + runId, conversationId, runId],
    );
    await manager.query(
      'UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1',
      [conversationId, jobId],
    );
  });
  await db.query(
    'UPDATE nodia_ai_runs SET context_manifest=$2::jsonb WHERE id=$1',
    [runId, JSON.stringify({ session_generation: 'c'.repeat(32) })],
  );
  return { conversationId, messageId, runId, jobId, selection };
}
try {
  await seed();
  const simultaneous = await Promise.all([claim(worker1), claim(worker2)]);
  check(
    'two consumers admit exactly one stage of one job',
    simultaneous.filter(Boolean).length === 1,
  );
  const first = simultaneous.find(Boolean);
  check(
    'first delivery has a durable worker attempt and fence',
    first.job.fence === '1' &&
      first.attempt.phase === 'claimed' &&
      (await row('nodia_ai_job_attempts', first.attempt.id)).worker_id ===
        first.attempt.worker_id,
  );
  await checkpoint.finish(first, {
    status: 'continue',
    nextStage: 'inference',
    persist: async (manager) => {
      await manager.query(
        'UPDATE nodia_ai_runs SET context_manifest=context_manifest||\'{"checkpoint":true}\' WHERE id=$1',
        [first.run.id],
      );
    },
  });
  const saved = await row('nodia_ai_jobs', first.job.id);
  check(
    'result checkpoint and next stage commit atomically without a live lease',
    saved.state === 'ready' &&
      saved.stage_seq === 2 &&
      saved.lease_owner === null &&
      (await row('nodia_ai_runs', first.run.id)).context_manifest.checkpoint ===
        true,
  );
  const second = await claim(worker2);
  check(
    'next stage gets a distinct attempt and newer fence',
    second.job.fence === '2' &&
      second.attempt.id !== first.attempt.id &&
      second.attempt.stage_key === 'inference',
  );
  await assert.rejects(
    () =>
      checkpoint.execute(first, async () => {
        throw Error('old worker executed');
      }),
    /lease_lost/,
  );
  passed.push('old worker cannot commit after another stage claims its job');
  const reservation = await reserve.execute(second, key, second.attempt.id);
  const secondProof = {
    engine: 'web',
    attemptId: second.attempt.id,
    operationRef: reservation.operationRef,
    resourceKey: reservation.resourceKey,
    sessionGeneration: 'c'.repeat(32),
    terminalProofId: randomUUID(),
    processClosed: true,
    outcome: 'completed',
    observedAt: new Date(),
  };
  check(
    'physical profile reservation has a monotonic durable fence',
    reservation.fence === '1',
  );
  await checkpoint.armDispatch(second, undefined, reservation);
  check(
    'dispatch consumes durable shared budget before remote I/O',
    (await row('nodia_ai_runs', second.run.id)).provider_dispatches_used ===
      1 &&
      (await row('nodia_ai_job_attempts', second.attempt.id)).phase ===
        'dispatch_armed',
  );
  await assert.rejects(
    () => checkpoint.armDispatch(second, undefined, reservation),
    /lease_lost/,
  );
  passed.push('same attempt cannot arm or reserve provider budget twice');
  await checkpoint.heartbeat(second);
  const [slotHeartbeat] = await db.query(
    'SELECT lease_until FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [key],
  );
  check(
    'heartbeat renews the existing physical slot rather than acquiring another',
    slotHeartbeat.lease_until > new Date(),
  );
  await assert.rejects(
    () =>
      checkpoint.finish(second, {
        terminalProof: secondProof,
        status: 'continue',
        nextStage: 'finalize',
        persist: async (manager) => {
          await release.execute(second, reservation, secondProof, manager);
          await manager.query(
            'UPDATE nodia_ai_runs SET context_manifest=\'{"rolled_back":true}\' WHERE id=$1',
            [second.run.id],
          );
          throw Error('Synthetic rollback');
        },
      }),
    /Synthetic rollback/,
  );
  const [slotAfterRollback] = await db.query(
    'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [key],
  );
  check(
    'failed result transaction preserves both slot and original stage',
    slotAfterRollback.state === 'held' &&
      (await row('nodia_ai_jobs', second.job.id)).state === 'leased' &&
      !(await row('nodia_ai_runs', second.run.id)).context_manifest.rolled_back,
  );
  check(
    'failed response commit does not leave a detached proof-cleanup job',
    (
      await db.query(
        "SELECT count(*)::integer count FROM nodia_ai_jobs WHERE kind='reconcile'",
      )
    )[0].count === 0,
  );
  await checkpoint.finish(second, {
    terminalProof: secondProof,
    status: 'continue',
    nextStage: 'finalize',
    persist: (manager) =>
      release.execute(second, reservation, secondProof, manager),
  });
  const [freeSlot] = await db.query(
    'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [key],
  );
  check(
    'verified terminal result releases only its slot in the same checkpoint',
    freeSlot.state === 'free' &&
      freeSlot.job_id === null &&
      freeSlot.fence === '1',
  );
  const [successfulAck] = await db.query(
    'SELECT * FROM nodia_ai_jobs WHERE dedup_key=$1',
    ['ack:' + second.attempt.id],
  );
  check(
    'known successful response commits detached minimal native-proof cleanup atomically',
    successfulAck?.kind === 'reconcile' &&
      successfulAck.stage_key === 'reconcile_ack' &&
      successfulAck.conversation_id === null &&
      successfulAck.run_id === null &&
      successfulAck.recovery_descriptor.terminal_proof.id ===
        secondProof.terminalProofId,
  );
  const finalize = await claim();
  await checkpoint.finish(finalize, { status: 'completed' });
  check(
    'finalization closes activity without changing human retention basis',
    (await row('nodia_ai_jobs', finalize.job.id)).state === 'done' &&
      (await row('nodia_ai_runs', finalize.run.id)).state === 'completed' &&
      (await row('nodia_ai_conversations', finalize.job.conversation_id))
        .active_job_id === null,
  );

  await reset();
  await seed();
  const crash = await claim();
  await db.query(
    "UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [crash.job.id],
  );
  await recover.execute();
  const recovered = await claim(worker2);
  check(
    'lease loss before dispatch can recover under a new fence',
    recovered?.job.id === crash.job.id &&
      BigInt(recovered.job.fence) > BigInt(crash.job.fence) &&
      recovered.job.attempt_count === 2,
  );
  await assert.rejects(
    () => checkpoint.execute(crash, async () => undefined),
    /lease_lost/,
  );
  passed.push('late undispatched worker is fenced after recovery');

  await reset();
  await seed();
  const unknown = await claim();
  const uncertainReservation = await reserve.execute(
    unknown,
    key,
    unknown.attempt.id,
  );
  await checkpoint.armDispatch(unknown, undefined, uncertainReservation);
  await db.query(
    "UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [unknown.job.id],
  );
  await recover.execute();
  const unknownRow = await row('nodia_ai_jobs', unknown.job.id);
  const [quarantined] = await db.query(
    'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [key],
  );
  check(
    'crash after arming preserves unknown instead of replaying inference',
    unknownRow.state === 'unknown' &&
      (await row('nodia_ai_runs', unknown.run.id)).state === 'unknown' &&
      (await claim(worker2)) === null,
  );
  check(
    'lease expiry quarantines an unclosed physical runtime',
    quarantined.state === 'unknown',
  );
  await assert.rejects(
    () =>
      release.execute(unknown, uncertainReservation, {
        engine: 'web',
        attemptId: unknown.attempt.id,
        operationRef: uncertainReservation.operationRef,
        resourceKey: uncertainReservation.resourceKey,
        sessionGeneration: 'c'.repeat(32),
        terminalProofId: randomUUID(),
        processClosed: true,
        outcome: 'completed',
        observedAt: new Date(),
      }),
    /lease_lost/,
  );
  passed.push('stale worker cannot free an unknown runtime');
  await seed('2');
  const other = await claim(worker2);
  await db.query(
    "UPDATE nodia_ai_runtime_slots SET lease_until=clock_timestamp()-interval '1 hour' WHERE resource_key=$1",
    [key],
  );
  await assert.rejects(
    () => reserve.execute(other, key, other.attempt.id),
    /runtime_busy/,
  );
  passed.push(
    'unknown runtime does not become free merely because its lease expired',
  );

  await reset();
  await seed('1');
  await seed('1');
  await seed('2');
  await seed('3');
  const cap = await Promise.all([
    claim(worker1),
    claim(worker2),
    claim(worker3),
  ]);
  check(
    'concurrent claims obey global and owner capacity',
    cap.filter(Boolean).length === policy.queue.foreground_workers &&
      new Set(cap.filter(Boolean).map((item) => item.identity.userId)).size ===
        policy.queue.foreground_workers,
  );
  check(
    'capacity saturation leaves unclaimed work ready',
    (
      await db.query(
        "SELECT count(*)::integer count FROM nodia_ai_jobs WHERE state='ready'",
      )
    )[0].count === 2,
  );

  await reset();
  const locked = await seed('1');
  await seed('2');
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(
      'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE',
      [locked.conversationId],
    );
    const skip = await claim();
    check(
      'SKIP LOCKED can claim another conversation while the oldest row is locked',
      skip?.job.conversation_id !== locked.conversationId &&
        skip?.identity.userId === '2',
    );
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
  }

  await reset();
  await seed('1', { catalog: 'unsupported' });
  await seed('2', { policyHash: 'f'.repeat(64) });
  check(
    'rolling worker never interprets an unsupported catalog or policy hash',
    (await claim()) === null,
  );

  await reset();
  await seed();
  const revoked = await claim();
  await db.query(
    "UPDATE user_modules SET is_active=false WHERE user_id=1 AND module_id IN(SELECT id FROM modules WHERE key='nodia_ai')",
  );
  let invoked = false;
  await assert.rejects(
    () =>
      checkpoint.execute(revoked, async () => {
        invoked = true;
      }),
    (error) => error.getStatus?.() === 403,
  );
  check('module revocation is checked before the next local effect', !invoked);
  await db.query(
    "UPDATE user_modules SET is_active=true WHERE user_id=1 AND module_id IN(SELECT id FROM modules WHERE key='nodia_ai')",
  );

  await reset();
  await seed();
  const retryClaim = await claim();
  check(
    'provably pre-dispatch failure can requeue the same stage identity',
    await retry.execute(retryClaim, 'nodia_ai:runtime_busy'),
  );
  let retryRow = await row('nodia_ai_jobs', retryClaim.job.id);
  check(
    'safe retry preserves stage and absolute admission deadline',
    retryRow.state === 'ready' &&
      retryRow.stage_seq === retryClaim.job.stage_seq &&
      retryRow.deadline_at.getTime() === retryClaim.job.deadline_at.getTime(),
  );
  await db.query(
    'UPDATE nodia_ai_jobs SET available_at=clock_timestamp() WHERE id=$1',
    [retryClaim.job.id],
  );
  const retryClaim2 = await claim();
  check(
    'second pre-dispatch retry remains bounded',
    await retry.execute(retryClaim2, 'nodia_ai:runtime_busy'),
  );
  await db.query(
    'UPDATE nodia_ai_jobs SET available_at=clock_timestamp() WHERE id=$1',
    [retryClaim.job.id],
  );
  const retryClaim3 = await claim();
  check(
    'third pre-dispatch failure cannot extend the retry budget',
    !(await retry.execute(retryClaim3, 'nodia_ai:runtime_busy')),
  );
  await checkpoint.armDispatch(
    retryClaim3,
    undefined,
    await reserve.execute(retryClaim3, key, retryClaim3.attempt.id),
  );
  check(
    'armed inference is never eligible for safe retry',
    !(await retry.execute(retryClaim3, 'nodia_ai:runtime_busy')),
  );

  await reset();
  await seed();
  const cancel = await claim();
  await db.query(
    "UPDATE nodia_ai_runs SET state='cancel_requested' WHERE id=$1",
    [cancel.run.id],
  );
  await recover.execute();
  check(
    'cancellation before dispatch becomes known cancelled and releases activity',
    (await row('nodia_ai_jobs', cancel.job.id)).state === 'cancelled' &&
      (await row('nodia_ai_conversations', cancel.job.conversation_id))
        .active_job_id === null,
  );

  await reset();
  await seed();
  let remoteSends = 0;
  const handler = {
    catalogVersions: [catalog],
    execute: async (_claim, context) => {
      await context.armDispatch(
        undefined,
        await reserve.execute(_claim, key, _claim.attempt.id),
      );
      remoteSends++;
      throw Error('Synthetic lost response');
    },
  };
  const stageRunner = new RunStage(claims, checkpoint, retry, handler, policy);
  check(
    'compiled runner can process a bounded synthetic dispatch stage',
    await stageRunner.execute(worker1, new AbortController().signal),
  );
  check(
    'lost response persists unknown without a second send',
    remoteSends === 1 &&
      (
        await db.query(
          "SELECT count(*)::integer count FROM nodia_ai_jobs WHERE state='unknown'",
        )
      )[0].count === 1,
  );
  await stageRunner.execute(worker2, new AbortController().signal);
  check(
    'second worker does not replay an uncertain remote operation',
    remoteSends === 1,
  );

  await reset();
  await seed();
  const processClaims = await Promise.all([startProcess(), startProcess()]);
  check(
    'two separate Node worker processes share the same durable claim gate',
    processClaims.filter((item) => item.claim).length === 1,
  );
  await Promise.all(processClaims.map((item) => item.close()));
  await reset();
  await seed();
  const crashedProcess = await startProcess(true);
  const terminated = once(crashedProcess.child, 'exit');
  crashedProcess.child.kill('SIGKILL');
  await terminated;
  processes.delete(crashedProcess.child);
  await db.query(
    "UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [crashedProcess.claim.jobId],
  );
  await recover.execute();
  check(
    'killing an armed worker process preserves unknown and does not dispatch it again',
    (await row('nodia_ai_jobs', crashedProcess.claim.jobId)).state ===
      'unknown' && (await claim()) === null,
  );
  const [crashedSlot] = await db.query(
    'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [key],
  );
  check(
    'crashed worker process cannot lose its physical runtime quarantine',
    crashedSlot.state === 'unknown',
  );

  await reset();
  const waited = await seed();
  await db.query(
    "UPDATE nodia_ai_runs SET created_at=clock_timestamp()-($2+1)*interval '1 second' WHERE id=$1",
    [waited.runId, policy.queue.wait_seconds],
  );
  check(
    'undispatched queue work is not claimable after its own shorter wait window',
    (await claim()) === null,
  );
  await recover.execute();
  check(
    'queue deadline fails undispatched work without resetting its run deadline',
    (await row('nodia_ai_jobs', waited.jobId)).state === 'failed' &&
      (await row('nodia_ai_runs', waited.runId)).error_code ===
        'nodia_ai:deadline_exceeded',
  );

  await reset();
  const waitingProfile = await seed();
  await db.query("UPDATE nodia_ai_jobs SET stage_key='inference' WHERE id=$1", [
    waitingProfile.jobId,
  ]);
  await db.query(
    'UPDATE nodia_ai_runs SET context_manifest=$2::jsonb WHERE id=$1',
    [waitingProfile.runId, JSON.stringify({ resource_key: key })],
  );
  await db.query(
    "INSERT INTO nodia_ai_runtime_slots(resource_key,state,fence) VALUES($1,'unknown',1)",
    [key],
  );
  check(
    'known busy or unknown profile leaves inference waiting without consuming an attempt',
    (await claim()) === null &&
      (await row('nodia_ai_jobs', waitingProfile.jobId)).attempt_count === 0,
  );
  await db.query(
    "UPDATE nodia_ai_runtime_slots SET state='free' WHERE resource_key=$1",
    [key],
  );
  check(
    'a waiting stage becomes claimable when its independent runtime is actually freed',
    Boolean(await claim()),
  );

  // Native supervisor proofs are synthetic; SQL/authority/retention/recovery remain real.
  const [CleanupProofs, ReconcileRuntime, ConversationStore, ExpireChats] =
    await Promise.all(
      [
        [
          'nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case',
          'CleanupNodiaAiRuntimeProofsUseCase',
        ],
        [
          'nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case',
          'ReconcileNodiaAiRuntimeUseCase',
        ],
        [
          'nodia-ai-conversation/nodia-ai-conversation.service',
          'NodiaAiConversationService',
        ],
        [
          'nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case',
          'ExpireNodiaAiConversationsUseCase',
        ],
      ].map(([file, name]) => loadAi(file, name)),
    );
  let proofCalls = 0,
    ackCalls = 0,
    failAck = false,
    mutateBeforeCommit = false,
    invalidProof = false,
    proofOutcome = 'completed';
  const nativeProof = {
    reconcile: async (request) => {
      proofCalls++;
      if (mutateBeforeCommit)
        await db.query('UPDATE nodia_ai_jobs SET fence=fence+1 WHERE id=$1', [
          (
            await db.query(
              "SELECT id FROM nodia_ai_jobs WHERE state='unknown' LIMIT 1",
            )
          )[0].id,
        ]);
      return {
        ...request,
        terminalProofId: randomUUID(),
        processClosed: true,
        outcome: proofOutcome,
        observedAt: new Date(),
        ...(invalidProof
          ? { resourceKey: 'gemini-profile:' + 'f'.repeat(64) }
          : {}),
      };
    },
    acknowledge: async () => {
      ackCalls++;
      if (failAck) throw Error('Synthetic lost acknowledgement');
    },
  };
  const cleanupProofs = new CleanupProofs(runtime, nativeProof, policy),
    reconcileRuntime = new ReconcileRuntime(
      runtime,
      authorize,
      nativeProof,
      cleanupProofs,
      policy,
    ),
    expireChats = new ExpireChats(new ConversationStore(db), policy);
  async function uncertain() {
    await reset();
    const data = await seed();
    await db.query(
      'UPDATE nodia_ai_runs SET context_manifest=$2::jsonb WHERE id=$1',
      [data.runId, JSON.stringify({ session_generation: 'c'.repeat(32) })],
    );
    const work = await claim();
    const held = await reserve.execute(work, key, work.attempt.id);
    await checkpoint.armDispatch(work, undefined, held);
    await checkpoint.finish(work, {
      status: 'unknown',
      errorCode: 'nodia_ai:outcome_unknown',
    });
    return { ...data, claim: work };
  }
  let pendingProof = await uncertain();
  const beforeDenied = proofCalls;
  await assert.rejects(
    () => reconcileRuntime.execute(identities.get('1'), pendingProof.jobId),
    (error) => error.getStatus?.() === 403,
  );
  check(
    'reconciliation requires a current super_admin before asking native supervisor',
    proofCalls === beforeDenied &&
      (await row('nodia_ai_jobs', pendingProof.jobId)).state === 'unknown',
  );
  const listed = await reconcileRuntime.list(identities.get('3'));
  check(
    'operator list exposes only bounded technical pending identities',
    listed.length === 1 &&
      listed[0].job_id === pendingProof.jobId &&
      !JSON.stringify(listed).includes('Synthetic input'),
  );
  const closed = await reconcileRuntime.execute(
    identities.get('3'),
    pendingProof.jobId,
  );
  const [closedSlot] = await db.query(
    'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [key],
  );
  check(
    'verified terminal native proof closes unknown locally without generating a second response',
    closed.resolved &&
      !closed.cleanup_pending &&
      closedSlot.state === 'free' &&
      (await row('nodia_ai_runs', pendingProof.runId)).error_code ===
        'nodia_ai:response_unavailable',
  );
  check(
    'settled acknowledgement removes the minimal job and its delivery attempts',
    !(await row('nodia_ai_jobs', pendingProof.jobId)) &&
      (
        await db.query(
          'SELECT count(*)::integer count FROM nodia_ai_job_attempts WHERE job_id=$1',
          [pendingProof.jobId],
        )
      )[0].count === 0,
  );
  pendingProof = await uncertain();
  proofOutcome = 'abandoned_unknown';
  await reconcileRuntime.execute(identities.get('3'), pendingProof.jobId);
  proofOutcome = 'completed';
  check(
    'a supervised abandoned outcome closes locally without claiming remote absence or inventing a reply',
    (await row('nodia_ai_runs', pendingProof.runId)).error_code ===
      'nodia_ai:outcome_unknown' &&
      (await row('nodia_ai_runs', pendingProof.runId)).assistant_message_id ===
        null &&
      (await row('nodia_ai_runs', pendingProof.runId))
        .provider_dispatches_used === 1,
  );

  pendingProof = await uncertain();
  invalidProof = true;
  await assert.rejects(
    () => reconcileRuntime.execute(identities.get('3'), pendingProof.jobId),
    (error) => error.getStatus?.() === 409,
  );
  check(
    'mismatched native proof never releases the SQL runtime',
    (
      await db.query(
        'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
        [key],
      )
    )[0].state === 'unknown',
  );
  invalidProof = false;
  mutateBeforeCommit = true;
  await assert.rejects(
    () => reconcileRuntime.execute(identities.get('3'), pendingProof.jobId),
    (error) => error.getStatus?.() === 409,
  );
  mutateBeforeCommit = false;
  check(
    'reconciliation rechecks its SQL fence after external proof returns',
    (await row('nodia_ai_jobs', pendingProof.jobId)).state === 'unknown',
  );

  pendingProof = await uncertain();
  await db.query(
    'UPDATE nodia_ai_jobs SET recovery_descriptor=NULL WHERE id=$1',
    [pendingProof.jobId],
  );
  const beforeLegacy = proofCalls;
  await assert.rejects(
    () => reconcileRuntime.execute(identities.get('3'), pendingProof.jobId),
    /reconciliation_identity_missing/,
  );
  check(
    'legacy unknown without native attempt identity stays quarantined',
    proofCalls === beforeLegacy &&
      (
        await db.query(
          'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
          [key],
        )
      )[0].state === 'unknown',
  );

  pendingProof = await uncertain();
  await db.query(
    "UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [pendingProof.conversationId],
  );
  await expireChats.execute();
  const detached = await row('nodia_ai_jobs', pendingProof.jobId);
  check(
    'expiring unknown purges content but preserves only reconciliation identity',
    !detached.run_id &&
      !detached.conversation_id &&
      detached.recovery_descriptor.runtime.attempt_id ===
        pendingProof.claim.attempt.id &&
      !JSON.stringify(detached.recovery_descriptor).includes('model'),
  );
  await reconcileRuntime.execute(identities.get('3'), pendingProof.jobId);
  check(
    'a detached expired attempt can be reconciled without restoring chat content',
    !(await row('nodia_ai_jobs', pendingProof.jobId)) &&
      !(await row('nodia_ai_conversations', pendingProof.conversationId)),
  );

  pendingProof = await uncertain();
  failAck = true;
  const proofCountBefore = proofCalls;
  const ackCountBefore = ackCalls;
  const cleanupPending = await reconcileRuntime.execute(
    identities.get('3'),
    pendingProof.jobId,
  );
  let pendingAck = await row('nodia_ai_jobs', pendingProof.jobId);
  check(
    'lost acknowledgement retains a bounded idempotent cleanup job instead of reopening generation',
    cleanupPending.cleanup_pending &&
      pendingAck.kind === 'reconcile' &&
      pendingAck.stage_key === 'reconcile_ack' &&
      pendingAck.recovery_descriptor.cleanup_attempts === 1,
  );
  await db.query(
    "UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [pendingProof.conversationId],
  );
  await expireChats.execute();
  pendingAck = await row('nodia_ai_jobs', pendingProof.jobId);
  check(
    'purging during pending proof cleanup retains its exact proof and removes the conversation',
    !!pendingAck.recovery_descriptor.terminal_proof.id &&
      pendingAck.conversation_id === null &&
      !(await row('nodia_ai_conversations', pendingProof.conversationId)),
  );
  for (let index = 1; index < policy.retry.cleanup_attempts; index++) {
    await db.query(
      'UPDATE nodia_ai_jobs SET available_at=clock_timestamp() WHERE id=$1',
      [pendingProof.jobId],
    );
    await cleanupProofs.execute();
  }
  pendingAck = await row('nodia_ai_jobs', pendingProof.jobId);
  check(
    'cleanup exhaustion remains visible with proof identity and no automatic retry loop',
    pendingAck.state === 'failed' &&
      ackCalls - ackCountBefore === policy.retry.cleanup_attempts &&
      pendingAck.recovery_descriptor.cleanup_attempts ===
        policy.retry.cleanup_attempts &&
      (await cleanupProofs.execute()).processed === 0,
  );
  failAck = false;
  const manualCleanup = await reconcileRuntime.execute(
    identities.get('3'),
    pendingProof.jobId,
  );
  check(
    'authenticated explicit recovery retries acknowledgement without replaying or re-inspecting generation',
    !manualCleanup.cleanup_pending &&
      !(await row('nodia_ai_jobs', pendingProof.jobId)) &&
      proofCalls === proofCountBefore + 1,
  );

  await reset();
  await seed();
  const beforeArm = await claim();
  await reserve.execute(beforeArm, key, beforeArm.attempt.id);
  await db.query(
    "UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [beforeArm.job.id],
  );
  await recover.execute();
  check(
    'crash before durable dispatch releases only its proven undispatched SQL reservation',
    (
      await db.query(
        'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
        [key],
      )
    )[0].state === 'free' &&
      (await row('nodia_ai_jobs', beforeArm.job.id)).state === 'ready',
  );

  const secret = 'synthetic-ai11-jwt-' + randomUUID();
  const tokenFor = (id) =>
    new JwtService().sign(
      { sub: id, sid: identities.get(id).sessionId, token_use: 'access' },
      { secret, issuer: 'nodia', audience: 'nodia:api', expiresIn: 60 },
    );
  const adminToken = tokenFor('3'),
    ordinaryToken = tokenFor('1');
  const baseEnvironment = {
    ...process.env,
    AUTH_JWT_SECRET: secret,
    GOOGLE_CLIENT_ID: 'synthetic-ai11.apps.googleusercontent.com',
    POSTGRES_HOST: fixture.options.host,
    POSTGRES_PORT: String(fixture.options.port),
    POSTGRES_USER: fixture.options.username,
    POSTGRES_PASSWORD: fixture.options.password,
    POSTGRES_DB: fixture.options.database,
  };
  const invokeCli = (token) =>
    spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL('../scripts/reconcile-nodia-ai-runtime.mjs', import.meta.url),
        ),
        '--list',
      ],
      {
        encoding: 'utf8',
        env: { ...baseEnvironment, NODIA_AI_OPERATOR_ACCESS_TOKEN: token },
        timeout: 30000,
      },
    );
  const listedByCli = invokeCli(adminToken);
  check(
    'operator CLI list validates a real signed access token against current fixture authority',
    listedByCli.status === 0 &&
      Array.isArray(JSON.parse(listedByCli.stdout).pending),
  );
  check(
    'operator CLI never prints its access token or signing secret',
    ![listedByCli.stdout, listedByCli.stderr].some(
      (value) => value.includes(adminToken) || value.includes(secret),
    ),
  );
  const ordinaryCli = invokeCli(ordinaryToken);
  check(
    'operator CLI refuses a signed ordinary user without leaking its credential',
    ordinaryCli.status === 1 &&
      ordinaryCli.stderr.includes('super_admin_required') &&
      !ordinaryCli.stderr.includes(ordinaryToken),
  );
  const noToken = invokeCli('');
  check(
    'operator CLI rejects missing authentication before opening its database',
    noToken.status === 1 &&
      noToken.stderr.includes('operator_access_token_required'),
  );

  console.log(
    JSON.stringify({
      task: 'AI-11',
      scope: 'compiled_use_cases_and_disposable_postgresql16',
      checks: passed.length,
      passed,
      configuredDatabaseTouched: false,
      providersCalled: false,
    }),
  );
} finally {
  for (const child of processes) {
    if (child.exitCode === null) {
      const ended = once(child, 'exit');
      child.kill('SIGKILL');
      await ended;
    }
  }
  await fixture.close();
}
