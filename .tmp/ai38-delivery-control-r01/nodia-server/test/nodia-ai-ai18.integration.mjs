// Compiled HTTP + disposable PostgreSQL. Synthetic executor admission only;
// native finance preparation is real, while every provider and domain effect is forbidden.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai18');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
let app,
  base,
  compiled,
  prepare,
  providerOperations = 0;
try {
  const Module = await loadAi(
    'nodia-ai-confirmation/nodia-ai-confirmation.module',
    'NodiaAiConfirmationModule',
  );
  const ReviewModule = await loadAi(
    'nodia-ai-proposal-review/nodia-ai-proposal-review.module',
    'NodiaAiProposalReviewModule',
  );
  const ConversationModule = await loadAi(
    'nodia-ai-conversation/nodia-ai-conversation.module',
    'NodiaAiConversationModule',
  );
  const Prepare = await loadAi(
    'nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case',
    'PrepareNodiaAiProposalUseCase',
  );
  const Finance = await loadAi(
    'nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case',
    'PrepareNodiaAiFinanceMovementUseCase',
  );
  const admissionToken = await loadAi(
    'nodia-ai-confirmation/types/execution-admission.types',
    'NODIA_AI_EXECUTION_ADMISSION',
  );
  const Redis = await loadAi('common/redis/redis.service', 'RedisService');
  const Adapter = await loadAi(
    'nodia-ai-adapter/types/nodia-ai-adapter.types',
    'NodiaAiAdapterPort',
  );
  const schema = readFileSync(
    new URL(
      '../dist/nodia-ai-tools/config/common-schema.json',
      import.meta.url,
    ),
    'utf8',
  );
  const { compileNodiaAiToolSchema } =
    await import('../dist/nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js');
  const validators = new Map(
    [
      'PublicProposal',
      'ConfirmationChallengeResponse',
      'ExecutionAccepted',
      'ExecutionStatus',
      'ApiError',
    ].map((definition) => [
      definition,
      compileNodiaAiToolSchema({
        sourceJson: schema,
        definition,
        sha256: createHash('sha256').update(schema).digest('hex'),
      }).validate,
    ]),
  );
  const { appendNodiaAiExecutionEvent } =
    await import('../dist/nodia-ai-run/event-journal.js');
  const valid = (name, value) =>
    assert.ok(validators.get(name)(value), `${name}: ${JSON.stringify(value)}`);
  // AI-20 enables the native financial executor. Preserve the historical
  // fail-closed scenario explicitly instead of treating production as empty.
  async function start(registrations = []) {
    const builder = Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => options,
          dataSourceFactory: async () => db,
        }),
        Module,
        ReviewModule,
        ConversationModule,
      ],
    });
    builder.overrideProvider(Redis).useValue({
      get: async () => null,
      set: async () => {},
      del: async () => {},
      keys: async () => [],
    });
    builder.overrideProvider(Adapter).useValue(
      Object.fromEntries(
        ['observe', 'execute', 'verifyConfiguration'].map((name) => [
          name,
          async () => {
            providerOperations++;
            throw Error(`Forbidden synthetic provider ${name}`);
          },
        ]),
      ),
    );
    if (registrations !== undefined)
      builder.overrideProvider(admissionToken).useValue(registrations);
    compiled = await builder.compile();
    prepare = compiled.get(Prepare);
    const Policy = await loadAi(
      'nodia-ai-runtime/config/runtime-policy',
      'NODIA_AI_RUNTIME_POLICY',
    );
    const parser = await loadAi(
      'nodia-ai-conversation/nodia-ai-conversation-body-parser',
      'createNodiaAiConversationBodyParser',
    );
    const Filter = await loadAi(
      'common/filters/all-exceptions.filter',
      'AllExceptionsFilter',
    );
    app = compiled.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.use(
      '/api/v1/nodia-ai',
      parser(compiled.get(Policy).admission.http_json_bytes),
    );
    app.useGlobalFilters(new Filter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalGuards({
      canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const identity = identities.get(request.headers['x-fixture-actor']);
        if (!identity) throw new UnauthorizedException();
        request.auth = {
          user: { id: identity.userId },
          sessionId: identity.sessionId,
        };
        return true;
      },
    });
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api/v1/nodia-ai`;
  }
  async function request(
    path,
    { actor = '1', method = 'GET', body, rawBody, status = 200 } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
      ...(body === undefined && rawBody === undefined
        ? {}
        : { body: rawBody ?? JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.ok(
      (Array.isArray(status) ? status : [status]).includes(response.status),
      `${method} ${path}: ${response.status} ${JSON.stringify(value)}`,
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (response.status >= 400) valid('ApiError', value.error);
    return { status: response.status, value };
  }
  async function rows() {
    return (
      await db.query(
        `SELECT (SELECT count(*)::int FROM nodia_ai_confirmation_challenges) challenges,(SELECT count(*)::int FROM nodia_ai_executions) executions,(SELECT count(*)::int FROM nodia_ai_execution_steps) steps,(SELECT count(*)::int FROM nodia_ai_execution_grants WHERE execution_id IS NOT NULL) grants,(SELECT count(*)::int FROM nodia_ai_jobs WHERE kind='execution') jobs,(SELECT count(*)::int FROM nodia_ai_events WHERE execution_id IS NOT NULL) events`,
      )
    )[0];
  }
  let [destination] = await db.query(
    "SELECT id FROM modules WHERE link='/tools/finances-personal'",
  );
  if (!destination)
    [destination] = await db.query(
      "INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/finances-personal','synthetic_ai18_finance' FROM modules WHERE key='nodia_ai' RETURNING id",
    );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',
    [destination.id],
  );
  const [category] = await db.query(
    "INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic AI18 food','synthetic_ai18_food') RETURNING id",
  );
  const [sentinel] = await db.query(
    "INSERT INTO finance_movements(user_id,category_id,name,amount,type,status) VALUES(1,$1,'Existing synthetic AI18 record',123,'expense','paid') RETURNING id,amount::text,name",
    [category.id],
  );
  async function proposal() {
    const chat = randomUUID();
    await db.query(
      "INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,1,$2,$3,'Synthetic AI18 only',clock_timestamp()+interval '90 days')",
      [chat, randomUUID(), 'a'.repeat(64)],
    );
    const result = await db.transaction((manager) =>
      prepare.execute(manager, identities.get('1'), {
        conversationId: chat,
        toolName: 'nodia_finance_movements_prepare_create',
        partial: {
          name: 'Synthetic expense',
          amount: '20000',
          category_id: category.id,
          type: 'expense',
          status: 'paid',
        },
      }),
    );
    assert.equal(result.status, 'ready');
    valid('PublicProposal', result.proposal);
    return { chat, ...result.proposal };
  }
  const challengeBody = (p) => ({
    proposal_revision: p.revision,
    expected_hash: p.hash,
  });
  const challengePath = (p) =>
    `/proposals/${p.proposal_id}/confirmation-challenge`;
  const confirmPath = (p) => `/proposals/${p.proposal_id}/confirm`;
  async function challenge(p, actor = '1') {
    const result = await request(challengePath(p), {
      actor,
      method: 'POST',
      body: challengeBody(p),
    });
    valid('ConfirmationChallengeResponse', result.value);
    return result.value;
  }
  const confirmation = (p, c, client_request_id = randomUUID()) => ({
    client_request_id,
    proposal_revision: p.revision,
    expected_hash: p.hash,
    confirmation_token: c.confirmation_token,
  });
  async function confirm(p, c, extra = {}) {
    return request(confirmPath(p), {
      method: 'POST',
      status: 202,
      body: confirmation(p, c),
      ...extra,
    });
  }

  await start();
  const finance = compiled.get(Finance);
  const registration = {
    toolName: finance.toolName,
    contractHash: finance.contractHash,
    catalogVersion: finance.catalogVersion,
  };
  const gated = await proposal();
  const gatedMetadata = (
    await request(`/proposals/${gated.proposal_id}/review-metadata?revision=1`)
  ).value;
  check(
    'production review reports unavailable execution without pretending approval can run',
    gatedMetadata.proposal_id === gated.proposal_id &&
      gatedMetadata.hash === gated.hash &&
      gatedMetadata.confirmation.available === false &&
      gatedMetadata.confirmation.reason === 'nodia_ai:execution_unavailable',
  );
  await request(challengePath(gated), {
    method: 'POST',
    body: challengeBody(gated),
    status: 503,
  });
  await request(confirmPath(gated), {
    method: 'POST',
    body: confirmation(gated, {
      confirmation_token: randomBytes(32).toString('base64url'),
    }),
    status: 503,
  });
  check(
    'explicit empty executor registry rejects challenge and confirmation without creating work',
    Object.values(await rows()).every((value) => value === 0),
  );
  await app.close();
  app = undefined;
  await db.initialize();
  await start([registration]);
  check(
    'AI-18 migration installs all three consumed tables',
    (
      await db.query(
        "SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('nodia_ai_confirmation_challenges','nodia_ai_executions','nodia_ai_execution_steps')",
      )
    )[0].n === 3,
  );

  const p = await proposal();
  const metadata = (
    await request(`/proposals/${p.proposal_id}/review-metadata?revision=1`)
  ).value;
  check(
    'human review metadata binds typed editable fields to exact revision and hash',
    metadata.proposal_id === p.proposal_id &&
      metadata.revision === p.revision &&
      metadata.hash === p.hash &&
      metadata.read_only === false &&
      metadata.confirmation.available === true &&
      metadata.editable_fields.length === 5 &&
      metadata.editable_fields.every(
        (field) =>
          field.step_id === p.steps[0].step_id &&
          ['name', 'amount', 'type', 'status', 'is_active'].includes(
            field.field_key,
          ),
      ),
  );
  const foreignMetadata = (
    await request(`/proposals/${p.proposal_id}/review-metadata?revision=1`, {
      actor: '3',
    })
  ).value;
  check(
    'administrator inspection exposes read-only metadata without approval or edit controls',
    foreignMetadata.read_only === true &&
      foreignMetadata.editable_fields.length === 0 &&
      foreignMetadata.confirmation.available === false,
  );
  const [retentionBefore] = await db.query(
    'SELECT expires_at,last_owner_message_at FROM nodia_ai_conversations WHERE id=$1',
    [p.chat],
  );
  const c = await challenge(p);
  check(
    'challenge is bound to the exact public proposal identity and hash',
    c.proposal_id === p.proposal_id &&
      c.proposal_revision === p.revision &&
      c.expected_hash === p.hash &&
      /^[A-Za-z0-9_-]{43}$/.test(c.confirmation_token),
  );
  const [storedChallenge] = await db.query(
    'SELECT * FROM nodia_ai_confirmation_challenges WHERE proposal_id=$1',
    [p.proposal_id],
  );
  check(
    'database stores only token digest and authenticated session',
    storedChallenge.token_hash ===
      createHash('sha256').update(c.confirmation_token).digest('hex') &&
      storedChallenge.actor_id === '1' &&
      storedChallenge.session_public_id === identities.get('1').sessionId &&
      !JSON.stringify(storedChallenge).includes(c.confirmation_token),
  );
  check(
    'challenge expiry obeys 120 seconds and does not exceed proposal lifetime',
    Date.parse(c.expires_at) - storedChallenge.created_at.getTime() <= 120000 &&
      Date.parse(c.expires_at) <= Date.parse(p.expires_at),
  );
  await request(challengePath(p), {
    actor: '2',
    method: 'POST',
    body: challengeBody(p),
    status: 404,
  });
  await request(challengePath(p), {
    actor: '3',
    method: 'POST',
    body: challengeBody(p),
    status: 403,
  });
  await request(confirmPath(p), {
    actor: '3',
    method: 'POST',
    body: confirmation(p, c),
    status: 403,
  });
  check(
    'foreign ordinary users and omniscient administrator cannot confirm as owner',
    (await rows()).executions === 0,
  );
  const secondSession = { userId: '1', sessionId: randomUUID() };
  await db.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,1,'synthetic-ai18-session',clock_timestamp()+interval '1 hour')",
    [secondSession.sessionId],
  );
  identities.set('second', secondSession);
  const c2 = await challenge(p, 'second');
  await request(confirmPath(p), {
    actor: 'second',
    method: 'POST',
    body: confirmation(p, c),
    status: 403,
  });
  await request(confirmPath(p), {
    method: 'POST',
    body: confirmation(p, c2),
    status: 403,
  });
  const c3 = await challenge(p);
  await request(confirmPath(p), {
    method: 'POST',
    body: confirmation(p, c),
    status: 403,
  });
  check(
    'same-session token rotates in place while other-device challenge remains independent',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_confirmation_challenges WHERE proposal_id=$1',
        [p.proposal_id],
      )
    )[0].n === 2 && c3.confirmation_token !== c.confirmation_token,
  );
  for (const body of [
    { ...confirmation(p, c3), owner_id: '3' },
    { ...confirmation(p, c3), confirmation_token: 'a' },
    { ...confirmation(p, c3), proposal_revision: '1' },
  ])
    await request(confirmPath(p), { method: 'POST', body, status: 400 });
  await request(confirmPath(p), {
    method: 'POST',
    rawBody: `{"client_request_id":"${randomUUID()}","proposal_revision":1,"expected_hash":"${p.hash}","confirmation_token":"${c3.confirmation_token}","confirmation_token":"${c3.confirmation_token}"}`,
    status: 400,
  });
  check(
    'strict human wire rejects unknown fields, coerced revision, malformed token and duplicate JSON keys',
    (await rows()).executions === 0,
  );
  const sameRequest = confirmation(p, c3);
  const concurrent = await Promise.all([
    request(confirmPath(p), { method: 'POST', body: sameRequest, status: 202 }),
    request(confirmPath(p), { method: 'POST', body: sameRequest, status: 202 }),
  ]);
  concurrent.forEach((item) => valid('ExecutionAccepted', item.value));
  const executionId = concurrent[0].value.execution.execution_id;
  check(
    'double click admits exactly one execution and returns its identity twice',
    concurrent[1].value.execution.execution_id === executionId &&
      (await rows()).executions === 1,
  );
  const replay = await request(confirmPath(p), {
    method: 'POST',
    body: {
      ...sameRequest,
      confirmation_token: randomBytes(32).toString('base64url'),
    },
    status: 202,
  });
  check(
    'lost HTTP response retry recovers admitted work without consuming another challenge',
    replay.value.execution.execution_id === executionId,
  );
  await confirm(p, c2, { actor: 'second', status: 409 });
  const otherDevice = (
    await request(`/proposals/${p.proposal_id}`, { actor: 'second' })
  ).value;
  check(
    'another device discovers the existing execution after distinct-request conflict',
    otherDevice.execution_id === executionId && (await rows()).executions === 1,
  );
  const [execution] = await db.query(
    'SELECT * FROM nodia_ai_executions WHERE id=$1',
    [executionId],
  );
  const [step] = await db.query(
    'SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1',
    [executionId],
  );
  const [grant] = await db.query(
    'SELECT * FROM nodia_ai_execution_grants WHERE execution_id=$1',
    [executionId],
  );
  const [job] = await db.query(
    "SELECT * FROM nodia_ai_jobs WHERE execution_id=$1 AND kind='execution'",
    [executionId],
  );
  check(
    'one atomic confirmation freezes origin, exact approval hash and stable step identity',
    execution.origin_proposal_id === p.proposal_id &&
      execution.origin_proposal_revision === p.revision &&
      execution.proposal_hash === p.hash &&
      execution.actor_id === '1' &&
      execution.chat_owner_id === '1' &&
      step.id === p.steps[0].step_id &&
      step.source_step_id === step.id &&
      step.state === 'ready' &&
      step.bound_command_hash === null &&
      step.minimal_receipt === null,
  );
  check(
    'grant and typed job refer only to confirmed identity without provider credentials',
    grant.command_set_hash === p.hash &&
      grant.run_id === null &&
      grant.session_public_id === identities.get('1').sessionId &&
      job.run_id === null &&
      job.state === 'ready' &&
      job.execution_id === executionId &&
      grant.expires_at.getTime() === job.deadline_at.getTime() &&
      grant.expires_at.getTime() <= Date.parse(p.expires_at) &&
      !JSON.stringify({ grant, job }).includes(c3.confirmation_token),
  );
  const [approvalEvent] = await db.query(
    'SELECT run_id,event_key,public_payload FROM nodia_ai_events WHERE execution_id=$1',
    [executionId],
  );
  check(
    'human admission commits exactly one execution event without model run or challenge material',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_events WHERE execution_id=$1',
        [executionId],
      )
    )[0].n === 1 &&
      approvalEvent.run_id === null &&
      approvalEvent.public_payload.kind === 'execution_changed' &&
      !JSON.stringify(approvalEvent).includes(c3.confirmation_token),
  );
  const journalInput = {
    conversationId: p.chat,
    executionId,
    eventKey: approvalEvent.event_key,
    payload: { revision: 1, state: 'queued', error: null },
    moduleRoutes: ['/tools/finances-personal'],
    maxEvents: 8,
  };
  await db.transaction((manager) =>
    appendNodiaAiExecutionEvent(manager, journalInput),
  );
  await assert.rejects(
    db.transaction((manager) =>
      appendNodiaAiExecutionEvent(manager, {
        ...journalInput,
        payload: { revision: 2, state: 'queued', error: null },
      }),
    ),
    /request_conflict/,
  );
  await assert.rejects(
    db.transaction((manager) =>
      appendNodiaAiExecutionEvent(manager, {
        ...journalInput,
        moduleRoutes: ['/tools/finances-personal', '/unexpected'],
      }),
    ),
    /request_conflict/,
  );
  await assert.rejects(
    db.transaction((manager) =>
      appendNodiaAiExecutionEvent(manager, {
        ...journalInput,
        payload: {
          revision: 1,
          state: 'queued',
          error: null,
          confirmation_token: 'forbidden',
        },
      }),
    ),
    /invalid_persisted_state/,
  );
  check(
    'execution event dedup preserves exact target payload and scope while rejecting approval material',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_events WHERE execution_id=$1',
        [executionId],
      )
    )[0].n === 1,
  );
  await assert.rejects(
    db.transaction(async (manager) => {
      for (let revision = 2; revision <= 4; revision++)
        await appendNodiaAiExecutionEvent(manager, {
          ...journalInput,
          eventKey: `synthetic:normal:${revision}`,
          payload: { revision, state: 'running', error: null },
        });
      await assert.rejects(
        appendNodiaAiExecutionEvent(manager, {
          ...journalInput,
          eventKey: 'synthetic:overflow',
          payload: { revision: 5, state: 'running', error: null },
        }),
        /execution_limit/,
      );
      for (let revision = 5; revision <= 8; revision++)
        await appendNodiaAiExecutionEvent(manager, {
          ...journalInput,
          eventKey: `synthetic:terminal:${revision}`,
          payload: {
            revision,
            state: revision === 5 ? 'partially_completed' : 'unknown',
            error: null,
          },
        });
      assert.equal(
        (
          await manager.query(
            'SELECT count(*)::int n FROM nodia_ai_events WHERE execution_id=$1',
            [executionId],
          )
        )[0].n,
        8,
      );
      await assert.rejects(
        appendNodiaAiExecutionEvent(manager, {
          ...journalInput,
          eventKey: 'synthetic:terminal:overflow',
          payload: { revision: 9, state: 'unknown', error: null },
        }),
        /execution_limit/,
      );
      throw Error('synthetic_ai18_journal_rollback');
    }),
    /synthetic_ai18_journal_rollback/,
  );
  check(
    'shared journal reserves four terminal slots and rolls back allocation with failed transaction',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_events WHERE execution_id=$1',
        [executionId],
      )
    )[0].n === 1 &&
      (
        await db.query(
          'SELECT next_event_seq FROM nodia_ai_conversations WHERE id=$1',
          [p.chat],
        )
      )[0].next_event_seq === '1',
  );
  const frozen = (await request(`/proposals/${p.proposal_id}`)).value;
  // JSONB preserves data, not insertion order of object keys. The proposal hash
  // is canonical JCS; compare the public value graph rather than JSON.stringify.
  assert.deepEqual(
    frozen.steps,
    p.steps,
    'confirmed preview data is unchanged',
  );
  check(
    'confirmed proposal retains exact content and exposes its admitted execution',
    frozen.state === 'confirmed' &&
      frozen.hash === p.hash &&
      frozen.execution_id === executionId,
  );
  const status = (await request(`/operations/${executionId}`)).value;
  valid('ExecutionStatus', status);
  const resumedChat = (await request(`/conversations/${p.chat}`)).value;
  check(
    'reopening the chat observes the admitted execution without resubmitting confirmation',
    resumedChat.active_execution?.execution_id === executionId &&
      resumedChat.active_execution.state === 'queued' &&
      (await rows()).executions === 1,
  );
  check(
    'current-authority operation observation reports queued work without fictional business success',
    status.execution_id === executionId &&
      status.state === 'queued' &&
      status.can_resume === false &&
      status.steps.length === 1 &&
      status.steps[0].state === 'ready' &&
      status.steps[0].result_refs.length === 0,
  );
  await request(`/operations/${executionId}`, { actor: '2', status: 404 });
  await request(`/operations/${executionId}`, { actor: '3' });
  await request(confirmPath(p), {
    method: 'POST',
    body: { ...sameRequest, expected_hash: 'f'.repeat(64) },
    status: 409,
  });
  const different = await proposal();
  const differentChallenge = await challenge(different);
  await request(confirmPath(different), {
    method: 'POST',
    body: confirmation(
      different,
      differentChallenge,
      sameRequest.client_request_id,
    ),
    status: 409,
  });
  check(
    'request identity cannot be rebound to another hash or proposal',
    (await rows()).executions === 1,
  );
  const [retentionAfter] = await db.query(
    'SELECT expires_at,last_owner_message_at FROM nodia_ai_conversations WHERE id=$1',
    [p.chat],
  );
  check(
    'challenge confirmation retry and inspection never renew owner-message retention',
    retentionBefore.expires_at.getTime() ===
      retentionAfter.expires_at.getTime() &&
      retentionAfter.last_owner_message_at === null,
  );

  const raced = await proposal();
  const raceFirst = await challenge(raced),
    raceSecond = await challenge(raced, 'second');
  const twoDevices = await Promise.all([
    confirm(raced, raceFirst, { status: [202, 409] }),
    confirm(raced, raceSecond, { actor: 'second', status: [202, 409] }),
  ]);
  check(
    'simultaneous different device requests admit one origin and reject the competitor',
    twoDevices.filter((item) => item.status === 202).length === 1 &&
      twoDevices.filter((item) => item.status === 409).length === 1 &&
      (
        await db.query(
          'SELECT count(*)::int n FROM nodia_ai_executions WHERE origin_proposal_id=$1',
          [raced.proposal_id],
        )
      )[0].n === 1,
  );

  const edited = await proposal();
  const staleChallenge = await challenge(edited);
  const revised = (
    await request(`/proposals/${edited.proposal_id}`, {
      method: 'PATCH',
      body: {
        expected_proposal_revision: edited.revision,
        expected_hash: edited.hash,
        edits: [
          {
            step_id: edited.steps[0].step_id,
            field_key: 'amount',
            value: '30000',
          },
        ],
      },
    })
  ).value;
  await request(confirmPath(edited), {
    method: 'POST',
    body: confirmation(edited, staleChallenge),
    status: 409,
  });
  await request(confirmPath(revised), {
    method: 'POST',
    body: confirmation(revised, staleChallenge),
    status: 403,
  });
  check(
    'old revision and token cannot approve changed content',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_executions WHERE origin_proposal_id=$1',
        [edited.proposal_id],
      )
    )[0].n === 0,
  );
  const expiring = await proposal(),
    expiredChallenge = await challenge(expiring);
  await db.query(
    "UPDATE nodia_ai_confirmation_challenges SET expires_at=created_at+interval '1 microsecond' WHERE proposal_id=$1",
    [expiring.proposal_id],
  );
  await request(confirmPath(expiring), {
    method: 'POST',
    body: confirmation(expiring, expiredChallenge),
    status: 403,
  });
  check(
    'expired challenge cannot create execution',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_executions WHERE origin_proposal_id=$1',
        [expiring.proposal_id],
      )
    )[0].n === 0,
  );
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [
    destination.id,
  ]);
  await request(confirmPath(p), {
    method: 'POST',
    body: sameRequest,
    status: 403,
  });
  await request(`/operations/${executionId}`, { status: 403 });
  await request(challengePath(different), {
    method: 'POST',
    body: challengeBody(different),
    status: 403,
  });
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
    destination.id,
  ]);
  check(
    'revoked destination module denies fresh admission and prior-result replay immediately',
    (await rows()).executions === 2,
  );
  await db.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
    [identities.get('1').sessionId],
  );
  await request(confirmPath(p), {
    method: 'POST',
    body: sameRequest,
    status: 401,
  });
  await request(`/operations/${executionId}`, { status: 401 });
  await request(`/operations/${executionId}`, { actor: 'second' });
  const sessionRecovery = await request(confirmPath(p), {
    actor: 'second',
    method: 'POST',
    body: sameRequest,
    status: 202,
  });
  await db.query(
    'UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1',
    [identities.get('1').sessionId],
  );
  check(
    'session revocation blocks result recovery while another current session retains observation',
    sessionRecovery.value.execution.execution_id === executionId,
  );

  const changed = await proposal(),
    changedChallenge = await challenge(changed);
  await db.query('UPDATE finance_categories SET is_active=false WHERE id=$1', [
    category.id,
  ]);
  await request(confirmPath(changed), {
    method: 'POST',
    body: confirmation(changed, changedChallenge),
    status: 409,
  });
  const observedChanged = (await request(`/proposals/${changed.proposal_id}`))
    .value;
  assert.deepEqual(
    observedChanged.steps,
    changed.steps,
    'precondition failure preserves frozen preview data',
  );
  check(
    'changed native precondition rejects admission without recomputing approved content',
    observedChanged.hash === changed.hash &&
      (
        await db.query(
          'SELECT count(*)::int n FROM nodia_ai_executions WHERE origin_proposal_id=$1',
          [changed.proposal_id],
        )
      )[0].n === 0,
  );
  await db.query('UPDATE finance_categories SET is_active=true WHERE id=$1', [
    category.id,
  ]);

  const rollback = await proposal(),
    rollbackChallenge = await challenge(rollback);
  const saturated = await rows();
  await confirm(rollback, rollbackChallenge, { status: 429 });
  assert.deepEqual(await rows(), saturated);
  check(
    'real per-owner waiting admission limit rejects excess work without consuming approval',
    (
      await db.query(
        'SELECT consumed_at FROM nodia_ai_confirmation_challenges WHERE proposal_id=$1',
        [rollback.proposal_id],
      )
    )[0].consumed_at === null,
  );
  // End only the earlier synthetic two-device fixture. There is no native
  // executor in this test and no dispatched step, so cancellation is certain.
  // This is fixture lifecycle setup, not a production cancellation endpoint.
  const racedExecutionId = twoDevices.find((item) => item.status === 202).value
    .execution.execution_id;
  await db.transaction(async (manager) => {
    const [prior] = await manager.query(
      'SELECT state,revision,conversation_id FROM nodia_ai_executions WHERE id=$1 FOR UPDATE',
      [racedExecutionId],
    );
    assert.equal(prior.state, 'queued');
    const jobs = await manager.query(
      'SELECT id,state,attempt_count FROM nodia_ai_jobs WHERE execution_id=$1 FOR UPDATE',
      [racedExecutionId],
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].state, 'ready');
    assert.equal(jobs[0].attempt_count, 0);
    assert.equal(
      (
        await manager.query(
          'SELECT count(*)::int n FROM nodia_ai_execution_steps WHERE execution_id=$1 AND (dispatched_at IS NOT NULL OR bound_command_hash IS NOT NULL OR minimal_receipt IS NOT NULL)',
          [racedExecutionId],
        )
      )[0].n,
      0,
    );
    await manager.query(
      "UPDATE nodia_ai_execution_steps SET state='cancelled',completed_at=clock_timestamp() WHERE execution_id=$1",
      [racedExecutionId],
    );
    await manager.query(
      "UPDATE nodia_ai_jobs SET state='cancelled',updated_at=clock_timestamp() WHERE id=$1",
      [jobs[0].id],
    );
    await manager.query(
      'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE execution_id=$1',
      [racedExecutionId],
    );
    await manager.query(
      'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2',
      [prior.conversation_id, jobs[0].id],
    );
    await manager.query(
      "UPDATE nodia_ai_executions SET state='cancelled',revision=revision+1,completed_at=clock_timestamp() WHERE id=$1",
      [racedExecutionId],
    );
    await appendNodiaAiExecutionEvent(manager, {
      conversationId: prior.conversation_id,
      executionId: racedExecutionId,
      eventKey: 'synthetic:fixture-cancelled',
      payload: {
        revision: prior.revision + 1,
        state: 'cancelled',
        error: null,
      },
      moduleRoutes: ['/tools/finances-personal'],
      maxEvents: 8,
    });
  });
  const beforeRollback = await rows();
  await db.query(
    "CREATE FUNCTION synthetic_ai18_reject_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.execution_id IS NOT NULL THEN RAISE EXCEPTION 'synthetic_ai18_outbox_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai18_event BEFORE INSERT ON nodia_ai_events FOR EACH ROW EXECUTE FUNCTION synthetic_ai18_reject_event()",
  );
  await request(confirmPath(rollback), {
    method: 'POST',
    body: confirmation(rollback, rollbackChallenge),
    status: 500,
  });
  await db.query(
    'DROP TRIGGER synthetic_ai18_event ON nodia_ai_events; DROP FUNCTION synthetic_ai18_reject_event()',
  );
  assert.deepEqual(await rows(), beforeRollback);
  check(
    'outbox failure rolls back execution steps grant job challenge consumption and proposal state',
    (await request(`/proposals/${rollback.proposal_id}`)).value.state ===
      'ready' &&
      (
        await db.query(
          'SELECT consumed_at FROM nodia_ai_confirmation_challenges WHERE proposal_id=$1',
          [rollback.proposal_id],
        )
      )[0].consumed_at === null,
  );
  const completedRollback = await confirm(rollback, rollbackChallenge);
  check(
    'same exact user approval remains usable after transactional rollback',
    completedRollback.value.execution.state === 'queued',
  );

  await assert.rejects(
    db.query('UPDATE nodia_ai_executions SET proposal_hash=$2 WHERE id=$1', [
      executionId,
      'f'.repeat(64),
    ]),
    /immutable/i,
  );
  await assert.rejects(
    db.query(
      'UPDATE nodia_ai_execution_steps SET native_request_key=$2 WHERE id=$1',
      [step.id, randomUUID()],
    ),
    /immutable/i,
  );
  await assert.rejects(
    db.query('DELETE FROM nodia_ai_execution_steps WHERE id=$1', [step.id]),
    /immutable_execution_step/i,
  );
  await assert.rejects(
    db.query(
      'UPDATE nodia_ai_execution_grants SET command_set_hash=NULL WHERE execution_id=$1',
      [executionId],
    ),
    /check constraint/i,
  );
  check(
    'SQL cannot rewrite approval identity, per-step identity or omit execution grant hash',
    true,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO nodia_ai_execution_steps(id,execution_id,source_step_id,position,tool_name,template_hash,bound_command_hash,native_request_key,state,minimal_scope,minimal_receipt,recovery_descriptor,lease_fence,error_code,dispatched_at,completed_at)
    SELECT $2,execution_id,$2,2,tool_name,template_hash,NULL,$3,'ready',minimal_scope,NULL,NULL,0,NULL,NULL,NULL FROM nodia_ai_execution_steps WHERE id=$1`,
      [step.id, different.steps[0].step_id, randomUUID()],
    ),
    /origin_mismatch/i,
  );
  check(
    'SQL cannot append a step from another proposal to the confirmed operation',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_execution_steps WHERE execution_id=$1',
        [executionId],
      )
    )[0].n === 1,
  );
  const Expire = await loadAi(
    'nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case',
    'ExpireNodiaAiConversationsUseCase',
  );
  await db.query(
    "UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [p.chat],
  );
  await request(`/operations/${executionId}`, { status: 410 });
  await request(`/operations/${executionId}`, { actor: '3', status: 404 });
  await compiled.get(Expire).execute();
  check(
    'expired unstarted execution is purged with its challenge grant job steps and events',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_executions WHERE id=$1',
        [executionId],
      )
    )[0].n === 0 &&
      (
        await db.query(
          'SELECT count(*)::int n FROM nodia_ai_jobs WHERE execution_id=$1',
          [executionId],
        )
      )[0].n === 0 &&
      (
        await db.query(
          'SELECT count(*)::int n FROM nodia_ai_confirmation_challenges WHERE proposal_id=$1',
          [p.proposal_id],
        )
      )[0].n === 0,
  );
  await request(`/operations/${executionId}`, { status: 404 });
  check(
    'all admission and observation cases leave the business sentinel untouched and call no provider',
    providerOperations === 0 &&
      (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n ===
        1 &&
      JSON.stringify(
        (
          await db.query('SELECT id,amount::text,name FROM finance_movements')
        )[0],
      ) === JSON.stringify(sentinel),
  );
  console.log(
    JSON.stringify(
      {
        stage: 'AI-18',
        scope:
          'compiled_http_disposable_postgresql_native_preparation_synthetic_execution_admission_no_provider_no_domain_effect',
        checks: checks.length,
        passed: checks,
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  await fixture.close();
}
