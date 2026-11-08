// Compiled use cases + disposable PostgreSQL only. No SDK, configured DB,
// account, native process, real business effect or claim of physical ACK.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { QueryFailedError } from 'typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

let fixture;
let phase = 'fixture_bootstrap';
let testId = null;
const passed = [];
const check = (label, condition) => {
  testId = label;
  assert.ok(condition, label);
  passed.push(label);
};
function diagnostic(error) {
  const sqlStates = [
    '23502',
    '23503',
    '23505',
    '23514',
    '22P02',
    '42P01',
    '42703',
    '42601',
    '42501',
    '40P01',
    '55P03',
    '57014',
    '08001',
    '08006',
    '53300',
    '3D000',
  ];
  const code =
    error && typeof error === 'object'
      ? Object.getOwnPropertyDescriptor(error, 'code')?.value
      : null;
  let frame = null;
  try {
    if (error instanceof Error && typeof error.stack === 'string') {
      for (const line of error.stack.split('\n').slice(1)) {
        if (!/^\s+at\s/.test(line) || line.includes('node_modules')) continue;
        const match = line.match(
          /[/\\]((?:test|dist)[/\\][a-zA-Z0-9_./\\-]+\.(?:mjs|js)):(\d+):(\d+)(?:\)|$)/,
        );
        if (match) {
          frame = `${match[1].replaceAll('\\', '/')}:${match[2]}:${match[3]}`;
          break;
        }
      }
    }
  } catch {
    /* No error getter can turn the diagnostic into a raw dump. */
  }
  return {
    status: 'failed',
    phase,
    test_id: testId,
    exception_class:
      error instanceof assert.AssertionError
        ? 'AssertionError'
        : error instanceof QueryFailedError
          ? 'QueryFailedError'
          : error instanceof TypeError
            ? 'TypeError'
            : error instanceof ReferenceError
              ? 'ReferenceError'
              : error instanceof SyntaxError
                ? 'SyntaxError'
                : error instanceof Error
                  ? 'Error'
                  : 'unknown_error',
    sqlstate: sqlStates.includes(code) ? code : null,
    first_party_frame: frame,
    checks_completed: passed.length,
    provider_calls: 0,
    fixture_database_only: true,
  };
}
try {
  fixture = await createNodiaAiIntegrationFixture('ai40');
  const { db, identities } = fixture;
  phase = 'compiled_bootstrap';
  const [
    Runtime,
    AuthStore,
    Authorize,
    Conversations,
    Access,
    Project,
    Snapshots,
    Cancel,
    Claim,
    Checkpoint,
    Recover,
    Reserve,
    ValidatePolicy,
  ] = await Promise.all(
    [
      ['nodia-ai-runtime/nodia-ai-runtime.service', 'NodiaAiRuntimeService'],
      [
        'nodia-ai/nodia-ai-authorization.service',
        'NodiaAiAuthorizationService',
      ],
      [
        'nodia-ai/use-case/authorize-nodia-ai.use-case',
        'AuthorizeNodiaAiUseCase',
      ],
      [
        'nodia-ai-conversation/nodia-ai-conversation.service',
        'NodiaAiConversationService',
      ],
      [
        'nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case',
        'AuthorizeNodiaAiConversationUseCase',
      ],
      [
        'nodia-ai-conversation/use-case/project-nodia-ai-run.use-case',
        'ProjectNodiaAiRunUseCase',
      ],
      [
        'nodia-ai-conversation/use-case/validate-nodia-ai-snapshots.use-case',
        'ValidateNodiaAiSnapshotsUseCase',
      ],
      [
        'nodia-ai-conversation/use-case/cancel-nodia-ai-run.use-case',
        'CancelNodiaAiRunUseCase',
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
        'nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case',
        'ReserveNodiaAiRuntimeSlotUseCase',
      ],
      [
        'nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case',
        'ValidateNodiaAiRuntimePolicyUseCase',
      ],
    ].map(([file, name]) => loadAi(file, name)),
  );
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
  const conversations = new Conversations(db);
  const cancel = new Cancel(
    conversations,
    new Access(conversations, authorize),
    new Project(new Snapshots()),
    policy,
  );
  const claims = new Claim(runtime, authorize, policy);
  const checkpoint = new Checkpoint(runtime, authorize, policy);
  const recover = new Recover(runtime, policy);
  const reserve = new Reserve(checkpoint, policy);
  const identity = identities.get('1');
  const catalog = 'synthetic-cancellation-catalog';
  const selection = {
    connection_id: '1',
    mode: 'agentic',
    model_id: 'synthetic-cancellation-model',
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
  const row = async (id) =>
    (await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [id]))[0];
  const stop = (id, requestId = randomUUID()) =>
    cancel.execute(identity, id, { client_request_id: requestId });
  const claim = () => claims.execute(randomUUID(), [catalog]);
  const reset = () =>
    db.query(
      'TRUNCATE TABLE nodia_ai_conversations,nodia_ai_jobs,nodia_ai_runtime_slots,nodia_ai_audit_events CASCADE',
    );
  async function seed() {
    const chatId = randomUUID(),
      messageId = randomUUID(),
      runId = randomUUID(),
      jobId = randomUUID();
    await db.transaction(async (manager) => {
      await manager.query(
        "INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,creation_request_hash,expires_at,next_message_seq) VALUES($1,1,$2,'Synthetic cancellation',$3,clock_timestamp()+interval '1 day',1)",
        [chatId, randomUUID(), 'a'.repeat(64)],
      );
      await manager.query(
        "INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,status,source_scope_manifest,sealed_at,input_hash) VALUES($1,$2,1,'user',1,$3,'sealed','{}',clock_timestamp(),$4)",
        [messageId, chatId, randomUUID(), 'b'.repeat(64)],
      );
      await manager.query(
        "INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text','Synthetic cancellation input')",
        [messageId, chatId],
      );
      await manager.query(
        'INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,selection_snapshot,catalog_version,policy_version,policy_hash,routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest) VALUES($1,$2,1,$3,$4::jsonb,$5,$6,$7,\'{"schema_version":1,"enabled":false,"revision":1,"target":null}\',$8::jsonb,1,\'queued\',\'context\',clock_timestamp()+interval \'10 minutes\',1,$9::jsonb)',
        [
          runId,
          chatId,
          messageId,
          JSON.stringify(selection),
          catalog,
          policy.policyVersion,
          policy.policyHash,
          JSON.stringify(budget),
          JSON.stringify({ session_generation: 'c'.repeat(32) }),
        ],
      );
      await manager.query(
        "INSERT INTO nodia_ai_execution_grants(id,actor_id,session_public_id,run_id,allowed_modules,allowed_operations,allowed_scope,policy_version,expires_at) VALUES($1,1,$2,$3,'[]','[\"chat:respond\"]','{}',$4,clock_timestamp()+interval '10 minutes')",
        [randomUUID(), identity.sessionId, runId, policy.policyVersion],
      );
      await manager.query(
        "INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,state,available_at,deadline_at,stage_key) VALUES($1,'turn',$2,$3,$4,'ready',clock_timestamp(),clock_timestamp()+interval '10 minutes','context')",
        [jobId, 'turn:' + runId, chatId, runId],
      );
      await manager.query(
        'UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1',
        [chatId, jobId],
      );
    });
    return { chatId, runId, jobId };
  }

  phase = 'concurrent_stop';
  testId = null;
  let own = await seed();
  const requestId = randomUUID();
  const duplicate = await Promise.all([
    stop(own.runId, requestId),
    stop(own.runId, requestId),
    stop(own.runId),
  ]);
  const events = await db.query(
    'SELECT public_payload FROM nodia_ai_events WHERE run_id=$1',
    [own.runId],
  );
  check(
    'concurrent stop intents commit one revision/event and the same run',
    duplicate.every(
      (result) =>
        result.status === 'accepted' &&
        result.run.state === 'cancel_requested' &&
        result.run.revision === 2,
    ) && events.length === 1,
  );
  check(
    'real candidate excludes a cancelled ready run before Claim.reject can fail it',
    (await claim()) === null &&
      (await row(own.runId)).state === 'cancel_requested',
  );
  await recover.execute();
  check(
    'undispatched cancellation becomes cancelled without creating an attempt',
    (await row(own.runId)).state === 'cancelled' &&
      (
        await db.query('SELECT id FROM nodia_ai_job_attempts WHERE job_id=$1', [
          own.jobId,
        ])
      ).length === 0,
  );
  check(
    'retry after recovery returns current terminal state without another event',
    (await stop(own.runId, requestId)).status === 'already_terminal' &&
      (await row(own.runId)).revision === 3,
  );

  phase = 'cancel_claim_rowlock_race';
  testId = null;
  await reset();
  own = await seed();
  // Deterministic lock boundary: hold the chat row, let cancellation acquire
  // the shared queue gate, then enqueue a competing Claim before releasing it.
  const gate = db.createQueryRunner();
  await gate.connect();
  await gate.startTransaction();
  let cancellation, contender;
  try {
    await gate.query(
      'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE',
      [own.chatId],
    );
    cancellation = stop(own.runId);
    cancellation.catch(() => undefined);
    let queueHeld = false;
    for (let index = 0; index < 50; index++) {
      queueHeld =
        (
          await db.query(
            "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid::bigint=(hashtext('nodia-ai:foreground-admission')::bigint & 4294967295) AND granted AND pid<>pg_backend_pid() LIMIT 1",
          )
        ).length === 1;
      if (queueHeld) break;
      await delay(10);
    }
    assert.ok(
      queueHeld,
      'cancellation reached the real queue gate before claim',
    );
    contender = claim();
    contender.catch(() => undefined);
    await gate.commitTransaction();
    const [stopped, racedClaim] = await Promise.all([cancellation, contender]);
    check(
      'queue/chat row-lock race preserves cancellation instead of grant_invalid',
      stopped.run.state === 'cancel_requested' &&
        racedClaim === null &&
        (await row(own.runId)).state === 'cancel_requested',
    );
  } finally {
    if (gate.isTransactionActive) await gate.rollbackTransaction();
    await gate.release();
    await Promise.allSettled([cancellation, contender].filter(Boolean));
  }
  await recover.execute();
  check(
    'raced queued job is recovered once without dispatch',
    (await row(own.runId)).state === 'cancelled' &&
      (await row(own.runId)).provider_dispatches_used === 0,
  );

  phase = 'claimed_stop_checkpoint';
  testId = null;
  await reset();
  own = await seed();
  const leased = await claim();
  assert.ok(leased);
  const stopped = await stop(own.runId);
  let persisted = false;
  await assert.rejects(
    () => checkpoint.heartbeat(leased),
    /nodia_ai:lease_lost/,
  );
  await assert.rejects(
    () =>
      checkpoint.finish(leased, {
        status: 'completed',
        persist: async () => {
          persisted = true;
        },
      }),
    /nodia_ai:lease_lost/,
  );
  check(
    'real durable stop fences a live claim before heartbeat and late persist',
    stopped.run.state === 'cancel_requested' &&
      !persisted &&
      (await row(own.runId)).assistant_message_id === null,
  );
  await recover.execute();
  check(
    'claimed but undispatched job ends cancelled after recovery',
    (await row(own.runId)).state === 'cancelled',
  );

  phase = 'armed_stop_recovery';
  testId = null;
  await reset();
  own = await seed();
  const armed = await claim();
  assert.ok(armed);
  const resource = 'gemini-profile:' + 'a'.repeat(64);
  const reservation = await reserve.execute(armed, resource, armed.attempt.id);
  await checkpoint.armDispatch(armed, undefined, reservation);
  const beforeSlot = (
    await db.query(
      'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1',
      [resource],
    )
  )[0];
  await stop(own.runId);
  check(
    'HTTP intent alone preserves the armed slot/fence/operation identity',
    JSON.stringify(
      (
        await db.query(
          'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1',
          [resource],
        )
      )[0],
    ) === JSON.stringify(beforeSlot),
  );
  await recover.execute();
  const unknown = await stop(own.runId),
    slot = (
      await db.query(
        'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1',
        [resource],
      )
    )[0];
  check(
    'armed cancellation stays unknown with recover_status and retained slot',
    unknown.status === 'already_terminal' &&
      unknown.run.state === 'unknown' &&
      unknown.run.error.retry_action === 'recover_status' &&
      slot.state === 'unknown' &&
      slot.external_operation_ref === armed.attempt.id,
  );
  check(
    'unknown run cannot be claimed or redispatched',
    (await claim()) === null &&
      (await row(own.runId)).provider_dispatches_used === 1,
  );

  phase = 'owner_and_outbox_atomicity';
  testId = null;
  await reset();
  own = await seed();
  await assert.rejects(
    () =>
      cancel.execute(identities.get('3'), own.runId, {
        client_request_id: randomUUID(),
      }),
    /nodia_ai:capability_denied/,
  );
  check(
    'real super_admin authority cannot mutate another owner conversation',
    (await row(own.runId)).state === 'queued',
  );
  await db.query(
    "ALTER TABLE nodia_ai_events ADD CONSTRAINT synthetic_stop_event_failure CHECK (public_payload->'payload'->>'state' IS DISTINCT FROM 'cancel_requested')",
  );
  try {
    await assert.rejects(() => stop(own.runId));
    const after = await row(own.runId);
    check(
      'event write failure rolls CAS state and revision back atomically',
      after.state === 'queued' &&
        after.revision === 1 &&
        (
          await db.query('SELECT id FROM nodia_ai_events WHERE run_id=$1', [
            own.runId,
          ])
        ).length === 0,
    );
  } finally {
    await db.query(
      'ALTER TABLE nodia_ai_events DROP CONSTRAINT synthetic_stop_event_failure',
    );
  }
  console.log(
    JSON.stringify({
      status: 'passed',
      checks: passed,
      provider_calls: 0,
      physical_ack_tested: false,
      fixture_database_only: true,
    }),
  );
} catch (error) {
  console.error(JSON.stringify(diagnostic(error)));
  process.exitCode = 1;
} finally {
  try {
    await fixture?.close();
  } catch (error) {
    phase = 'fixture_cleanup';
    testId = null;
    console.error(JSON.stringify(diagnostic(error)));
    process.exitCode = 1;
  }
}
