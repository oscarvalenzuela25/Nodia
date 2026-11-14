// Real PostgreSQL + compiled owner/transport, strictly synthetic provider and credentials.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { DataSource } from 'typeorm';

process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const dist = process.env.TEACHER_SERVER_DIST ? pathToFileURL(resolve(process.env.TEACHER_SERVER_DIST) + sep) : new URL('../dist/', import.meta.url);
const compiled = path => new URL(path, dist);
const { TeacherGenerationRuntimeService } =
  await import(compiled('ai-generation/teacher-generation-runtime.service.js').href);
const { ApiTextGenerationService } =
  await import(compiled('ai-generation/api-text-generation.service.js').href);
const { GenerationWorkerSourceRegistry } =
  await import(compiled('ai-generation/worker-source-registry.js').href);
const { ApiNodiaAiCredentialsService } =
  await import(compiled('nodia-ai-adapter/api-nodia-ai-credentials.service.js').href);
const { NodiaAiConnectionsService } =
  await import(compiled('nodia-ai-conversation/nodia-ai-connections.service.js').href);
const { CheckModuleAccessUseCase } =
  await import(compiled('authorization/use-case/check-module-access.use-case.js').href);
const { ValidateNodiaAiRuntimePolicyUseCase } =
  await import(compiled('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js').href);
const { TeacherService } = await import(compiled('teacher/teacher.service.js').href);
const { ExecuteTeacherCommandUseCase } =
  await import(compiled('teacher/use-case/execute-teacher-command.use-case.js').href);
const { ReadTeacherUseCase } =
  await import(compiled('teacher/use-case/read-teacher.use-case.js').href);
const { PublishTeacherUseCase } =
  await import(compiled('teacher/use-case/publish-teacher.use-case.js').href);
const { encryptSecret, generateFingerprint } =
  await import(compiled('ai-provider/helpers/ai-key-crypto.helper.js').href);
const { TEACHER_GENERATION_POLICY } =
  await import(compiled('ai-generation/teacher-qualification-policy.js').href);
assert.equal(TEACHER_GENERATION_POLICY.version, 'teacher-generation-policy/3', 'use the current compiled Teacher policy');
const container = `template_teacher_runtime_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let source,
  started = false;
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
const originalFetch = globalThis.fetch;
try {
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-e',
    'POSTGRES_USER=teacher',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    'POSTGRES_DB=teacher',
    '-p',
    '127.0.0.1::5432',
    'postgres:16-alpine',
  );
  started = true;
  for (let i = 0; i < 100; i++) {
    try {
      docker(
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'teacher',
      );
      break;
    } catch {
      if (i === 99) throw Error('disposable postgres unavailable');
      await delay(200);
    }
  }
  source = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'teacher',
    password,
    database: 'teacher',
    migrations: [
      fileURLToPath(compiled('migrations/*.js')),
    ],
    synchronize: false,
  });
  await source.initialize();
  await source.runMigrations({ transaction: 'all' });
  const actor = { userId: '9007199254740993', sessionId: randomUUID() };
  await source.query(
    "INSERT INTO users(id,email,name) VALUES($1,'teacher-runtime@example.invalid','Synthetic runtime actor')",
    [actor.userId],
  );
  await source.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [actor.sessionId, actor.userId, 'a'.repeat(64)],
  );
  const [{ id: group }] = await source.query(
    "INSERT INTO module_groups(key,sort_order) VALUES('synthetic_teacher',99) RETURNING id::text",
  );
  const [{ id: moduleId }] = await source.query(
    "INSERT INTO modules(module_group_id,key,link,sort_order) VALUES($1,'nodia_teacher','/nodia-teacher',0) RETURNING id::text",
    [group],
  );
  await source.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)',
    [actor.userId, moduleId],
  );
  const [{ id: connectionId }] = await source.query(
    "INSERT INTO ai_providers(catalog_id,name,use_api_key,fields) SELECT id,'Synthetic teacher transport',true,$1::jsonb FROM ai_provider_catalog WHERE key='openai' RETURNING id::text",
    [
      JSON.stringify({
        api_key: {
          selected_model: 'fixture-model-discovered',
          available_models: [{ id: 'fixture-model-discovered' }],
        },
      }),
    ],
  );
  const secret = 'synthetic-never-a-real-key';
  await source.query(
    "INSERT INTO ai_api_keys(provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_selected) VALUES($1,'Synthetic', $2,$3,'****',true)",
    [connectionId, encryptSecret(secret), generateFingerprint(secret)],
  );
  const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
    JSON.parse(
      await readFile(
        new URL('../src/nodia-ai-runtime/config/runtime-policy.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const access = new CheckModuleAccessUseCase(source),
    credentials = new ApiNodiaAiCredentialsService(source),
    registry = new GenerationWorkerSourceRegistry();
  const runtime = new TeacherGenerationRuntimeService(
    source,
    access,
    credentials,
    new NodiaAiConnectionsService(source),
    registry,
    new ApiTextGenerationService(credentials, policy),
    policy,
  );
  runtime.onModuleInit();
  const publisher = new PublishTeacherUseCase();
  runtime.setPublisher(publisher.publish.bind(publisher));
  const selection = {
    connection_id: connectionId,
    mode: 'api_key',
    model_id: 'fixture-model-discovered',
    effort_id: null,
  };
  const qualificationCounts = async () => (await source.query(
    `SELECT (SELECT count(*)::integer FROM ai_generation_qualifications) AS transport,
     (SELECT count(*)::integer FROM teacher_purpose_qualifications) AS purpose`,
  ))[0];
  const initialQualifications = await qualificationCounts();
  check(
    initialQualifications.transport === 0 && initialQualifications.purpose === 0,
    'first selected generation starts with no transport or purpose qualification receipts',
  );
  const readiness = await runtime.eligibility(actor, connectionId, selection);
  check(
    readiness.eligible === true && readiness.reason_code === 'configuration_ready' && readiness.checked_at === null,
    'configured API selection is ready without claiming a completed inference or requiring a prior canary',
  );
  const verifiedSelection = await source.transaction((manager) =>
    runtime.verifySelection(manager, actor, selection, 'setup_reply'),
  );
  const configuredSelection = await credentials.configuration(selection);
  check(
    verifiedSelection.configuration_generation === configuredSelection.configurationGeneration &&
      verifiedSelection.session_generation === configuredSelection.sessionGeneration,
    'real admission validates the exact configuration without substituting its qualification boundary',
  );
  const store = new TeacherService(source, access),
    commands = new ExecuteTeacherCommandUseCase(store, runtime),
    read = new ReadTeacherUseCase(store, runtime);
  const draft = await commands.execute(actor, null, randomUUID(), 'create', {
    topic: 'Computer networks',
    objective: 'Explain DNS clearly',
    explanation_language: 'en',
    organization: 'topics',
    day_count: null,
  });
  await commands.execute(actor, draft.session_id, randomUUID(), 'patch', {
    expected_session_revision: 1,
    selection,
  });
  const firstMessageKey = randomUUID();
  const firstMessageBody = {
    expected_session_revision: 2,
    text: 'Use practical examples',
    generate_reply: true,
  };
  const message = await commands.execute(
    actor,
    draft.session_id,
    firstMessageKey,
    'message',
    firstMessageBody,
  );
  const repeatedMessage = await commands.execute(actor, draft.session_id, firstMessageKey, 'message', firstMessageBody);
  check(repeatedMessage.job_id === message.job_id &&
    (await source.query('SELECT count(*)::integer AS n FROM teacher_generation_jobs WHERE session_id=$1', [draft.session_id]))[0].n === 1,
  'repeating the first explicit intent returns the same job without duplicate admission');
  let posts = 0;
  globalThis.fetch = async (_url, init) => {
    const [{ used }] = await source.query(
      'SELECT dispatches_used AS used FROM teacher_sessions WHERE id=$1',
      [draft.session_id],
    );
    const [{ reserved_exchanges, started_exchanges }] = await source.query(
      "SELECT reserved_exchanges,started_exchanges FROM ai_generation_operations WHERE owner_kind='teacher' ORDER BY created_at DESC LIMIT 1",
    );
    check(
      used === 1 && reserved_exchanges === 1 && started_exchanges === 1,
      'POST sees a durable single reservation, not double charged',
    );
    const body = JSON.parse(init.body);
    check(
      body.model === selection.model_id && body.tools.length === 0,
      'exact selected model, zero tools',
    );
    posts++;
    const text = JSON.stringify({
      schema_version: 1,
      text: 'We can study DNS by topics.',
      brief: { topic: 'Computer networks', objective: 'Explain DNS clearly' },
      questions: [],
      organization_options: ['days', 'topics'],
    });
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text }],
          },
        ],
      }),
    );
  };
  const workers = await Promise.all([
    runtime.execute(randomUUID(), new AbortController().signal),
    runtime.execute(randomUUID(), new AbortController().signal),
  ]);
  check(
    workers.filter(Boolean).length === 1,
    'two concurrent workers consume only one real Teacher job',
  );
  const status = await read.job(actor, message.job_id);
  check(
    status.state === 'ready' && status.local_closed === true,
    'material/message ready only after local commit and closure',
  );
  const [{ n: fakeChats }] = await source.query(
    'SELECT count(*)::integer AS n FROM nodia_ai_conversations',
  );
  check(fakeChats === 0, 'no synthetic chat conversations/runs');
  const [{ n: openSlots }] = await source.query(
    "SELECT count(*)::integer AS n FROM nodia_ai_runtime_slots WHERE state<>'free' OR generation_operation_id IS NOT NULL",
  );
  check(openSlots === 0, 'canonical slot released with exact ownership proof');
  check(posts === 1, 'one HTTP POST per Teacher job');
  const [firstOutput] = await source.query(
    "SELECT text FROM teacher_setup_messages WHERE generation_job_id=$1 AND role='assistant'",
    [message.job_id],
  );
  const qualificationsAfterFirst = await qualificationCounts();
  check(firstOutput?.text === 'We can study DNS by topics.' &&
    qualificationsAfterFirst.transport === 0 && qualificationsAfterFirst.purpose === 0,
  'first worker generation publishes valid output with zero prior or fabricated qualification receipts');
  const detail = await read.detail(actor, draft.session_id);
  const second = await commands.execute(
    actor,
    draft.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: detail.revision,
      text: 'Another clarification',
      generate_reply: true,
    },
  );
  globalThis.fetch = async () => {
    posts++;
    throw Error('Synthetic lost remote response');
  };
  await runtime.execute(randomUUID(), new AbortController().signal);
  const lost = await read.job(actor, second.job_id);
  check(
    lost.state === 'unknown' &&
      lost.local_closed === true &&
      lost.remote_outcome === 'unknown',
    'lost response remains unknown despite proven local closure',
  );
  await runtime.execute(randomUUID(), new AbortController().signal);
  await runtime.recover();
  check(posts === 2, 'unknown is never replayed by worker/recovery');
  const [{ used }] = await source.query(
    'SELECT dispatches_used AS used FROM teacher_sessions WHERE id=$1',
    [draft.session_id],
  );
  check(used === 2, 'lost response still consumes session budget');
  await assert.rejects(() =>
    source.transaction(async (m) => {
      await m.query(
        "INSERT INTO ai_generation_operations(id,owner_kind,actor_id,connection_id,selection_snapshot,configuration_generation,session_generation,resource_key,worker_id,owner_fence,runtime_fence,phase,request_hash,exchange_limit) VALUES($1,'teacher',$2,$3,'{}','x','y','invalid',$4,1,1,'reserved',$5,1)",
        [
          randomUUID(),
          actor.userId,
          connectionId,
          randomUUID(),
          'a'.repeat(64),
        ],
      );
    }),
  );
  checks++;
  // Complete but malformed content is a known domain rejection, never a ready empty lesson.
  const beforeInvalid = await read.detail(actor, draft.session_id);
  const invalidJob = await commands.execute(
    actor,
    draft.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: beforeInvalid.revision,
      text: 'Invalid output case',
      generate_reply: true,
    },
  );
  globalThis.fetch = async () => {
    posts++;
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: '{"wrong":"shape"}' }],
          },
        ],
      }),
    );
  };
  await runtime.execute(randomUUID(), new AbortController().signal);
  const invalid = await read.job(actor, invalidJob.job_id);
  check(
    invalid.state === 'failed_known' &&
      invalid.remote_outcome === 'completed' &&
      invalid.local_closed === true,
    'invalid completed output is failed_known with completed transport',
  );
  const beforeRevoked = await read.detail(actor, draft.session_id);
  const revoked = await commands.execute(
    actor,
    draft.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: beforeRevoked.revision,
      text: 'Revoked before dispatch',
      generate_reply: true,
    },
  );
  await source.query(
    'UPDATE user_modules SET is_active=false WHERE user_id=$1 AND module_id=$2',
    [actor.userId, moduleId],
  );
  await runtime.execute(randomUUID(), new AbortController().signal);
  const [{ state: revokedState }] = await source.query(
    'SELECT state FROM teacher_generation_jobs WHERE id=$1',
    [revoked.job_id],
  );
  check(
    revokedState === 'failed_known' && posts === 3,
    'revoked authority prevents POST after queued admission',
  );
  await source.query(
    'UPDATE user_modules SET is_active=true WHERE user_id=$1 AND module_id=$2',
    [actor.userId, moduleId],
  );
  const other = { userId: '9007199254740994', sessionId: randomUUID() };
  await source.query(
    "INSERT INTO users(id,email,name) VALUES($1,'other-teacher@example.invalid','Synthetic other owner')",
    [other.userId],
  );
  await source.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [other.sessionId, other.userId, 'b'.repeat(64)],
  );
  await source.query(
    'INSERT INTO user_modules(user_id,module_id,is_active) VALUES($1,$2,true)',
    [other.userId, moduleId],
  );
  await source.query(
    "INSERT INTO user_roles(user_id,role_id,is_active) SELECT $1,id,true FROM roles WHERE key='super_admin'",
    [actor.userId],
  );
  const foreign = await commands.execute(other, null, randomUUID(), 'create', {
    topic: 'Owned by a different user',
    objective: 'Check authority at dispatch',
    explanation_language: 'en',
    organization: 'topics',
    day_count: null,
  });
  await commands.execute(other, foreign.session_id, randomUUID(), 'patch', {
    expected_session_revision: 1,
    selection,
  });
  const adminJob = await commands.execute(
    actor,
    foreign.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: 2,
      text: 'Admitted with current administrator scope',
      generate_reply: true,
    },
  );
  await source.query('UPDATE user_roles SET is_active=false WHERE user_id=$1', [
    actor.userId,
  ]);
  await runtime.execute(randomUUID(), new AbortController().signal);
  const [{ state: adminRevoked }] = await source.query(
    'SELECT state FROM teacher_generation_jobs WHERE id=$1',
    [adminJob.job_id],
  );
  check(
    adminRevoked === 'failed_known' && posts === 3,
    'removing super_admin before dispatch revokes access to another owner session',
  );
  const beforePause = await read.detail(actor, draft.session_id);
  await commands.execute(actor, draft.session_id, randomUUID(), 'pause', {
    expected_session_revision: beforePause.revision,
    expected_cursor_revision: beforePause.cursor.revision,
    cursor: { phase: 'setup', plan_revision_id: null },
  });
  check(
    (await runtime.execute(randomUUID(), new AbortController().signal)) ===
      false,
    'pause cannot start new inference',
  );
  // Reproduce pause winning after the actual durable claim and before arm.
  await commands.execute(actor, draft.session_id, randomUUID(), 'resume', {
    expected_session_revision: (await read.detail(actor, draft.session_id))
      .revision,
  });
  const beforeRace = await read.detail(actor, draft.session_id);
  const pauseRace = await commands.execute(
    actor,
    draft.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: beforeRace.revision,
      text: 'Pause wins after claim',
      generate_reply: true,
    },
  );
  const actualClaim = runtime.claim.bind(runtime);
  runtime.claim = async (...args) => {
    const claim = await actualClaim(...args);
    if (claim) {
      const current = await read.detail(actor, draft.session_id);
      await commands.execute(actor, draft.session_id, randomUUID(), 'pause', {
        expected_session_revision: current.revision,
        expected_cursor_revision: current.cursor.revision,
        cursor: { phase: 'setup', plan_revision_id: null },
      });
    }
    return claim;
  };
  try {
    await runtime.execute(randomUUID(), new AbortController().signal);
  } finally {
    runtime.claim = actualClaim;
  }
  const cancelled = await read.job(actor, pauseRace.job_id);
  const [cancelledCount] = await source.query(
    'SELECT dispatches_used FROM teacher_generation_jobs WHERE id=$1',
    [pauseRace.job_id],
  );
  check(
    cancelled.state === 'cancelled_before_dispatch' &&
      cancelled.remote_outcome === null &&
      cancelled.local_closed === true &&
      cancelledCount.dispatches_used === 0 &&
      posts === 3,
    'durable pre-arm pause is cancelled_before_dispatch, zero POST and zero charge',
  );
  // Crash after arm: an expired lease alone is insufficient; prove a dead local executor.
  await commands.execute(actor, draft.session_id, randomUUID(), 'resume', {
    expected_session_revision: (await read.detail(actor, draft.session_id))
      .revision,
  });
  const beforeCrash = await read.detail(actor, draft.session_id);
  const crashed = await commands.execute(
    actor,
    draft.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: beforeCrash.revision,
      text: 'Crash recovery proof fixture',
      generate_reply: true,
    },
  );
  const crashClaim = await runtime.claim(randomUUID());
  assert.equal(crashClaim.job.id, crashed.job_id);
  await runtime.arm(crashClaim);
  await source.query(
    "UPDATE teacher_generation_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [crashed.job_id],
  );
  await source.query(
    "UPDATE nodia_ai_runtime_slots SET lease_until=clock_timestamp()-interval '1 second' WHERE generation_operation_id=$1",
    [crashClaim.operationId],
  );
  await runtime.recover();
  let crashView = await read.job(actor, crashed.job_id);
  check(
    crashView.state === 'unknown' && crashView.local_closed === false,
    'expired lease does not prove a running local owner closed',
  );
  const [{ api_owner_identity: owner }] = await source.query(
    'SELECT api_owner_identity FROM ai_generation_operations WHERE id=$1',
    [crashClaim.operationId],
  );
  await source.query(
    'UPDATE ai_generation_operations SET api_owner_identity=$2::jsonb WHERE id=$1',
    [
      crashClaim.operationId,
      JSON.stringify({ ...owner, pid: 2147483647, birth: '1' }),
    ],
  );
  await runtime.recover();
  crashView = await read.job(actor, crashed.job_id);
  const [closedOp] = await source.query(
    'SELECT terminal_proof,acknowledged_at FROM ai_generation_operations WHERE id=$1',
    [crashClaim.operationId],
  );
  check(
    crashView.state === 'unknown' &&
      crashView.remote_outcome === 'unknown' &&
      crashView.local_closed === true &&
      closedOp.terminal_proof?.local_transport_closed === true &&
      closedOp.terminal_proof?.request_hash === crashClaim.requestHash &&
      closedOp.acknowledged_at,
    'dead local owner proof persists exact operation/fences and ACK without remote cancellation fiction',
  );
  await runtime.recover();
  await runtime.execute(randomUUID(), new AbortController().signal);
  check(posts === 3, 'recovered crash never replays an armed inference');
  const beforeHeld = await read.detail(actor, draft.session_id);
  const held1 = await commands.execute(
    actor,
    draft.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: beforeHeld.revision,
      text: 'Retained queue item one',
      generate_reply: true,
    },
  );
  const held2 = await commands.execute(
    actor,
    draft.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: (await read.detail(actor, draft.session_id))
        .revision,
      text: 'Retained queue item two',
      generate_reply: true,
    },
  );
  const holdSession = await read.detail(actor, draft.session_id);
  await commands.execute(actor, draft.session_id, randomUUID(), 'pause', {
    expected_session_revision: holdSession.revision,
    expected_cursor_revision: holdSession.cursor.revision,
    cursor: { phase: 'setup', plan_revision_id: null },
  });
  await source.query(
    "UPDATE teacher_generation_jobs SET created_at=clock_timestamp()-interval '301 seconds' WHERE id=ANY($1::uuid[])",
    [[held1.job_id, held2.job_id]],
  );
  await commands.execute(actor, draft.session_id, randomUUID(), 'resume', {
    expected_session_revision: (await read.detail(actor, draft.session_id))
      .revision,
  });
  const expiredHeld = await read.job(actor, held1.job_id);
  check(
    expiredHeld.allowed_actions.continue_before_dispatch.enabled === false,
    'paused/resumed jobs cannot extend the original300s queue cap',
  );
  await assert.rejects(
    () =>
      commands.job(actor, randomUUID(), held1.job_id, 'continue_job', {
        expected_session_revision: holdSession.revision + 2,
        expected_job_fence: expiredHeld.fence,
      }),
    /job_not_resumable/,
  );
  checks++;
  const counterBefore = (
    await source.query(
      'SELECT dispatches_used FROM teacher_sessions WHERE id=$1',
      [draft.session_id],
    )
  )[0].dispatches_used;
  await runtime.recover();
  const expiredStates = await source.query(
    'SELECT state,blocks_duplicate,dispatches_used FROM teacher_generation_jobs WHERE id=ANY($1::uuid[])',
    [[held1.job_id, held2.job_id]],
  );
  check(
    expiredStates.length === 2 &&
      expiredStates.every(
        (j) =>
          j.state === 'cancelled_before_dispatch' &&
          j.blocks_duplicate === false &&
          j.dispatches_used === 0,
      ),
    'two expired retained jobs release actor admission without inference or cancellation fiction',
  );
  const newAfterExpiry = await commands.execute(
    actor,
    draft.session_id,
    randomUUID(),
    'message',
    {
      expected_session_revision: (await read.detail(actor, draft.session_id))
        .revision,
      text: 'Admission works after retained expiry',
      generate_reply: true,
    },
  );
  check(
    !!newAfterExpiry.job_id,
    'expired paused jobs do not permanently occupy both actor pending slots',
  );
  await source.query(
    "UPDATE teacher_generation_jobs SET created_at=clock_timestamp()-interval '301 seconds' WHERE id=$1",
    [newAfterExpiry.job_id],
  );
  check(
    (await runtime.execute(randomUUID(), new AbortController().signal)) ===
      false,
    'queued admission past300s is never armed even before recovery',
  );
  await runtime.recover();
  const queuedExpiry = await read.job(actor, newAfterExpiry.job_id);
  check(
    queuedExpiry.state === 'failed_known' &&
      queuedExpiry.error_code === 'queue_deadline' &&
      posts === 3 &&
      (
        await source.query(
          'SELECT dispatches_used FROM teacher_sessions WHERE id=$1',
          [draft.session_id],
        )
      )[0].dispatches_used === counterBefore,
    'queue expiry is known local failure with zero extra POST or budget charge',
  );
  const qualifyDraft=await commands.execute(actor,null,randomUUID(),'create',{topic:'Dedicated qualification',objective:'Verify pending capacity applies to the operator lane',explanation_language:'en',organization:'topics',day_count:null});
  await commands.execute(actor,qualifyDraft.session_id,randomUUID(),'patch',{expected_session_revision:1,selection});
  const queueDraft=await commands.execute(actor,null,randomUUID(),'create',{topic:'Pending capacity',objective:'Keep two undispatched intents',explanation_language:'en',organization:'topics',day_count:null});
  await commands.execute(actor,queueDraft.session_id,randomUUID(),'patch',{expected_session_revision:1,selection});
  await commands.execute(actor,queueDraft.session_id,randomUUID(),'message',{expected_session_revision:2,text:'First distinct pending intent',generate_reply:true});
  await commands.execute(actor,queueDraft.session_id,randomUUID(),'message',{expected_session_revision:3,text:'Second distinct pending intent',generate_reply:true});
  await assert.rejects(()=>runtime.qualifyText(actor,qualifyDraft.session_id,selection,new AbortController().signal),/capacity_unavailable/);
  check((await source.query('SELECT count(*)::integer AS n FROM teacher_generation_jobs WHERE session_id=$1',[qualifyDraft.session_id]))[0].n===0,'operator qualification cannot bypass the shared pending admission limit');
  await source.query("UPDATE teacher_generation_jobs SET deadline_at=clock_timestamp()-interval '1 second' WHERE session_id=$1 AND state='queued'",[queueDraft.session_id]);
  await runtime.recover();
  const { PrepareNodiaAiRestoreUseCase } =
    await import(compiled('nodia-ai-recovery/use-case/prepare-nodia-ai-restore.use-case.js').href);
  const beforeRestore = (
    await source.query('SELECT count(*)::integer AS n FROM teacher_sessions')
  )[0].n;
  const restore = new PrepareNodiaAiRestoreUseCase(
    source,
    policy,
    {
      execute: async () => {
        throw Error('must not mutate legacy data');
      },
    },
    {
      execute: () => {
        throw Error('must not start a chat-only restore');
      },
    },
  );
  await assert.rejects(
    () => restore.execute({}),
    /teacher_restore_requires_owner_reconciliation/,
  );
  check(
    (
      await source.query('SELECT count(*)::integer AS n FROM teacher_sessions')
    )[0].n === beforeRestore,
    'legacy chat-only restore refuses a populated Teacher database before mutation',
  );
  if (process.argv.includes('--real-api')) {
    // Explicit, separate canary: reads configured credentials only; all owners/results are disposable.
    // No operational auth impersonation, data mutations, acceptance transfer, fallback or retry.
    const { parse } = await import('dotenv');
    const environment = parse(
      await readFile(new URL('../.env', import.meta.url)),
    );
    const live = new DataSource({
      type: 'postgres',
      host: environment.POSTGRES_HOST,
      port: Number(environment.POSTGRES_PORT),
      database: environment.POSTGRES_DB,
      username: environment.POSTGRES_USER,
      password: environment.POSTGRES_PASSWORD,
      synchronize: false,
    });
    let realPosts = 0;
    const evidence = {
      environment: 'local Windows / disposable PostgreSQL16 owners',
      operational_database: 'credential/configuration reads only',
      real_provider: true,
      posts: 0,
      selection: null,
      canary: null,
      plan: null,
      material: null,
      error: null,
    };
    try {
      await live.initialize();
      const configured =
        await live.query(`SELECT p.id::text AS connection_id,p.fields FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
        WHERE p.is_active AND p.use_api_key AND c.is_active AND c.can_use_api_key
        AND EXISTS(SELECT 1 FROM ai_api_keys k WHERE k.provider_id=p.id AND k.is_active AND k.is_selected)`);
      assert.equal(
        configured.length,
        1,
        'real canary requires one explicit configured API selection; ambiguity stops it',
      );
      const mode = configured[0].fields?.api_key;
      assert.ok(
        typeof mode?.selected_model === 'string' && mode.selected_model.trim(),
        'no model fallback',
      );
      const levels = mode.thinking_levels;
      const effort =
        levels && Object.hasOwn(levels, mode.selected_model)
          ? levels[mode.selected_model]
          : (mode.thinking_level ?? null);
      const selected = {
        connection_id: configured[0].connection_id,
        mode: 'api_key',
        model_id: mode.selected_model,
        effort_id: effort,
      };
      evidence.selection = selected;
      process.env.AI_SECRET_MASTER_KEY = environment.AI_SECRET_MASTER_KEY;
      const liveCredentials = new ApiNodiaAiCredentialsService(live);
      const facade = {
        configuration: (s) => liveCredentials.configuration(s),
        secret: (s, c) => liveCredentials.secret(s, c),
      };
      const liveConfig = await facade.configuration(selected);
      await source.query(
        `INSERT INTO ai_providers(id,catalog_id,name,use_api_key,fields) SELECT $1,id,'Disposable exact selection identity',true,'{}' FROM ai_provider_catalog WHERE key=$2 ON CONFLICT(id) DO NOTHING`,
        [liveConfig.connectionId, liveConfig.providerKey],
      );
      await source.query(
        `INSERT INTO ai_api_keys(id,provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_selected) VALUES($1,$2,'Inert FK identity','not-a-credential',$3,'****',false) ON CONFLICT(id) DO NOTHING`,
        [
          liveConfig.keyId,
          liveConfig.connectionId,
          randomBytes(32).toString('hex'),
        ],
      );
      const realRuntime = new TeacherGenerationRuntimeService(
        source,
        access,
        facade,
        new NodiaAiConnectionsService(source),
        new GenerationWorkerSourceRegistry(),
        new ApiTextGenerationService(facade, policy),
        policy,
      );
      realRuntime.setPublisher(publisher.publish.bind(publisher));
      const realCommands = new ExecuteTeacherCommandUseCase(store, realRuntime),
        realRead = new ReadTeacherUseCase(store, realRuntime);
      const canaryDraft = await realCommands.execute(
        actor,
        null,
        randomUUID(),
        'create',
        {
          topic: 'Computer networks',
          objective: 'Explain DNS resolution and diagnose a failed lookup',
          explanation_language: 'en',
          organization: 'topics',
          day_count: null,
        },
      );
      await realCommands.execute(
        actor,
        canaryDraft.session_id,
        randomUUID(),
        'patch',
        { expected_session_revision: 1, selection: selected },
      );
      globalThis.fetch = async (url, init) => {
        realPosts++;
        assert.ok(realPosts <= 3, 'bounded real provider canary');
        return originalFetch(url, init);
      };
      evidence.canary = await realRuntime.qualifyText(
        actor,
        canaryDraft.session_id,
        selected,
        new AbortController().signal,
      );
      const exactEligibility = await realRuntime.eligibility(
        actor,
        selected.connection_id,
        selected,
      );
      assert.equal(exactEligibility.eligible, true);
      const current = await realRead.detail(actor, canaryDraft.session_id);
      const planJob = await realCommands.execute(
        actor,
        canaryDraft.session_id,
        randomUUID(),
        'propose',
        {
          expected_session_revision: current.revision,
          organization: 'topics',
          day_count: null,
        },
      );
      await realRuntime.execute(randomUUID(), new AbortController().signal);
      evidence.plan = await realRead.job(actor, planJob.job_id);
      assert.equal(
        evidence.plan.state,
        'ready',
        'real plan must validate before further POST',
      );
      const planned = await realRead.detail(actor, canaryDraft.session_id),
        proposal = planned.latest_proposal;
      await realCommands.execute(
        actor,
        canaryDraft.session_id,
        randomUUID(),
        'accept',
        {
          expected_session_revision: planned.revision,
          proposal_revision_id: proposal.id,
          proposal_hash: proposal.content_hash,
        },
        { proposalId: proposal.id },
      );
      const accepted = await realRead.detail(actor, canaryDraft.session_id),
        unit = accepted.current_plan.outline.sections[0].units[0];
      const packetJob = await realCommands.execute(
        actor,
        canaryDraft.session_id,
        randomUUID(),
        'material',
        {
          expected_session_revision: accepted.revision,
          plan_revision_id: accepted.current_plan.id,
          variant: 'current',
        },
        { unitId: unit.id },
      );
      await realRuntime.execute(randomUUID(), new AbortController().signal);
      evidence.material = await realRead.job(actor, packetJob.job_id);
      assert.equal(evidence.material.state, 'ready');
      if (process.argv.includes('--retain-review')) {
        // Only public educational content and its synthetic exercise keys. No prompt,
        // raw provider response, chain of thought, credentials or operational records.
        const [content] = await source.query(
          'SELECT public_blocks,content_hash FROM teacher_content_versions WHERE session_id=$1 AND generation_job_id=$2',
          [canaryDraft.session_id, packetJob.job_id],
        );
        const items = await source.query(
          'SELECT i.ordinal,i.kind,i.objective_ids,i.public_question,i.max_points,k.private_key,k.expected_explanation FROM teacher_assessment_items i JOIN teacher_assessment_keys k ON k.item_id=i.id JOIN teacher_assessments a ON a.id=i.assessment_id WHERE a.session_id=$1 AND a.generation_job_id=$2 ORDER BY i.ordinal',
          [canaryDraft.session_id, packetJob.job_id],
        );
        await mkdir(new URL('../../output/teacher/', import.meta.url), {
          recursive: true,
        });
        await writeFile(
          new URL(
            '../../output/teacher/pedagogical-review-candidate.json',
            import.meta.url,
          ),
          JSON.stringify(
            {
              schema_version: 1,
              provenance:
                'bounded real Teacher generation in disposable PostgreSQL, synthetic learning request',
              selection: selected,
              plan_job_id: planJob.job_id,
              material_job_id: packetJob.job_id,
              outline: accepted.current_plan.outline,
              public_blocks: content.public_blocks,
              content_hash: content.content_hash,
              practice_items: items,
              factual_review_state: 'pending',
              external_sources_verified: false,
            },
            null,
            2,
          ) + '\n',
        );
      }
    } catch (error) {
      evidence.error = error instanceof Error ? error.message : 'canary_failed';
    } finally {
      evidence.posts = realPosts;
      await mkdir(new URL('../../output/teacher/', import.meta.url), {
        recursive: true,
      });
      await writeFile(
        new URL('../../output/teacher/real-api-canary.json', import.meta.url),
        JSON.stringify(evidence, null, 2) + '\n',
      );
      if (live.isInitialized) await live.destroy();
    }
    console.log(
      JSON.stringify({
        real_api_canary_posts: realPosts,
        real_api_canary_complete: evidence.error === null,
        evidence: 'output/teacher/real-api-canary.json',
        operational_writes: 0,
      }),
    );
  }
  console.log(
    JSON.stringify({
      checks,
      postgres: '16 disposable',
      provider: 'synthetic HTTP only',
      real_provider_qualified: false,
      teacher_policy: TEACHER_GENERATION_POLICY.version,
      first_generation_without_qualification: true,
      first_generation_purpose: 'setup_reply',
      posts,
      configured_database_touched: false,
    }),
  );
} finally {
  globalThis.fetch = originalFetch;
  if (source?.isInitialized) await source.destroy();
  if (started) docker('rm', '-f', container);
}
