// Compiled Nest + disposable PostgreSQL. No configured data or providers.
// The fixture alone opens admission; the internal local executor uses real finance rules.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai19');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
let app,
  compiled,
  base,
  prepare,
  execute,
  providerCalls = 0;
try {
  const Confirmation = await loadAi(
    'nodia-ai-confirmation/nodia-ai-confirmation.module',
    'NodiaAiConfirmationModule',
  );
  const Execution = await loadAi(
    'nodia-ai-execution/nodia-ai-execution.module',
    'NodiaAiExecutionModule',
  );
  const Conversation = await loadAi(
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
  const Execute = await loadAi(
    'nodia-ai-execution/use-case/execute-nodia-ai-financial-execution.use-case',
    'ExecuteNodiaAiFinancialExecutionUseCase',
  );
  const admission = await loadAi(
    'nodia-ai-confirmation/types/execution-admission.types',
    'NODIA_AI_EXECUTION_ADMISSION',
  );
  const Redis = await loadAi('common/redis/redis.service', 'RedisService');
  const Adapter = await loadAi(
    'nodia-ai-adapter/types/nodia-ai-adapter.types',
    'NodiaAiAdapterPort',
  );
  async function start(allow) {
    const builder = Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => options,
          dataSourceFactory: async () => db,
        }),
        Confirmation,
        Execution,
        Conversation,
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
            providerCalls++;
            throw Error('Forbidden AI19 provider');
          },
        ]),
      ),
    );
    if (allow) {
      const finance = new Finance(undefined);
      builder.overrideProvider(admission).useValue([
        {
          toolName: finance.toolName,
          contractHash: finance.contractHash,
          catalogVersion: finance.catalogVersion,
        },
      ]);
    } else builder.overrideProvider(admission).useValue([]);
    compiled = await builder.compile();
    prepare = compiled.get(Prepare);
    execute = compiled.get(Execute);
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
    { actor = '1', method = 'GET', body, status = 200 } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    assert.equal(
      response.status,
      status,
      `${method} ${path}: ${response.status} ${JSON.stringify(value)}`,
    );
    return value;
  }
  let [destination] = await db.query(
    "SELECT id FROM modules WHERE link='/finances-personal'",
  );
  if (!destination)
    [destination] = await db.query(
      "INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/finances-personal','synthetic_ai19_finance' FROM modules WHERE key='nodia_ai' RETURNING id",
    );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',
    [destination.id],
  );
  const [category] = await db.query(
    "INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic AI19 food','synthetic_ai19_food') RETURNING id",
  );
  const [category2] = await db.query(
    "INSERT INTO finance_categories(user_id,name,key) VALUES(2,'Synthetic AI19 owner two','synthetic_ai19_two') RETURNING id",
  );
  async function proposal({ actor = '1', partial = {} } = {}) {
    const chat = randomUUID(),
      identity = identities.get(actor);
    await db.query(
      "INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI19 only',clock_timestamp()+interval '90 days')",
      [chat, identity.userId, randomUUID(), 'a'.repeat(64)],
    );
    const result = await db.transaction((manager) =>
      prepare.execute(manager, identity, {
        conversationId: chat,
        toolName: 'nodia_finance_movements_prepare_create',
        partial: {
          name: 'Synthetic AI19 exact expense',
          amount: '20000',
          category_id: category.id,
          type: 'expense',
          status: 'paid',
          ...partial,
        },
      }),
    );
    assert.equal(result.status, 'ready');
    return { chat, ...result.proposal };
  }
  async function admit(p, actor = '1') {
    const challenge = await request(
      `/proposals/${p.proposal_id}/confirmation-challenge`,
      {
        actor,
        method: 'POST',
        body: { proposal_revision: p.revision, expected_hash: p.hash },
      },
    );
    return (
      await request(`/proposals/${p.proposal_id}/confirm`, {
        actor,
        method: 'POST',
        status: 202,
        body: {
          client_request_id: randomUUID(),
          proposal_revision: p.revision,
          expected_hash: p.hash,
          confirmation_token: challenge.confirmation_token,
        },
      })
    ).execution;
  }
  const run = (id, actor = '1') => execute.execute(identities.get(actor), id);
  const snapshot = async (id) => {
    const [row] = await db.query(
      `SELECT (SELECT count(*)::int FROM finance_movements) movements,(SELECT row_to_json(e) FROM nodia_ai_executions e WHERE e.id=$1) execution,(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.position) FROM nodia_ai_execution_steps s WHERE s.execution_id=$1) steps,(SELECT jsonb_agg(to_jsonb(j) ORDER BY j.id) FROM nodia_ai_jobs j WHERE j.execution_id=$1) jobs,(SELECT jsonb_agg(to_jsonb(ev) ORDER BY ev.seq) FROM nodia_ai_events ev WHERE ev.execution_id=$1) events`,
      [id],
    );
    return row;
  };
  // Fixture cleanup only: rejected jobs retain their real snapshot until assertions,
  // then stop consuming the unchanged two-waiting-per-owner admission budget.
  async function closeRejected(id) {
    await db.transaction(async (manager) => {
      await manager.query(
        "UPDATE nodia_ai_jobs SET state='cancelled',updated_at=clock_timestamp() WHERE execution_id=$1",
        [id],
      );
      await manager.query(
        'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE execution_id=$1',
        [id],
      );
      await manager.query(
        'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=(SELECT conversation_id FROM nodia_ai_executions WHERE id=$1)',
        [id],
      );
      await manager.query(
        "UPDATE nodia_ai_execution_steps SET state='cancelled' WHERE execution_id=$1",
        [id],
      );
      await manager.query(
        "UPDATE nodia_ai_executions SET state='cancelled',revision=revision+1,completed_at=clock_timestamp() WHERE id=$1",
        [id],
      );
    });
  }
  await start(false);
  const gated = await proposal();
  await request(`/proposals/${gated.proposal_id}/confirmation-challenge`, {
    method: 'POST',
    body: { proposal_revision: gated.revision, expected_hash: gated.hash },
    status: 503,
  });
  check(
    'explicit empty executor registry rejects effect admission and creates no execution',
    (await db.query('SELECT count(*)::int n FROM nodia_ai_executions'))[0].n ===
      0,
  );
  await app.close();
  app = undefined;
  await db.initialize();
  await start(true);

  const exact = await proposal({ partial: { amount: '9007199254740993' } });
  const queued = await admit(exact);
  const completed = await run(queued.execution_id);
  check(
    'internal coordinator completes only the approved single financial effect',
    completed.state === 'completed' &&
      completed.steps.length === 1 &&
      completed.steps[0].state === 'completed',
  );
  const [step] = await db.query(
    'SELECT * FROM nodia_ai_execution_steps WHERE execution_id=$1',
    [queued.execution_id],
  );
  const receipt = step.minimal_receipt;
  assert.ok(receipt);
  const [movement] = await db.query(
    'SELECT * FROM finance_movements WHERE id=$1',
    [receipt.resource_id],
  );
  check(
    'native financial movement preserves exact bigint string and confirmed fields',
    movement.amount === '9007199254740993' &&
      movement.user_id === '1' &&
      movement.category_id === category.id &&
      movement.name === 'Synthetic AI19 exact expense' &&
      movement.type === 'expense' &&
      movement.status === 'paid' &&
      movement.obligation_id === null,
  );
  check(
    'minimal receipt links the created record and owner while identity stays in stable columns',
    receipt.schema_version === 1 &&
      receipt.resource_key === 'finance_movements' &&
      receipt.subject_user_id === '1' &&
      Object.keys(receipt).sort().join(',') ===
        'resource_id,resource_key,schema_version,subject_user_id' &&
      /^[a-f0-9]{64}$/.test(step.bound_command_hash) &&
      step.completed_at instanceof Date &&
      step.native_request_key !== null,
  );
  const [settled] = await db.query(
    "SELECT e.state execution,j.state job,c.active_job_id,(SELECT count(*)::int FROM nodia_ai_events ev WHERE ev.execution_id=e.id AND ev.public_payload->'payload'->>'state'='completed') events FROM nodia_ai_executions e JOIN nodia_ai_jobs j ON j.execution_id=e.id JOIN nodia_ai_conversations c ON c.id=e.conversation_id WHERE e.id=$1",
    [queued.execution_id],
  );
  check(
    'effect receipt job completion released conversation and terminal outbox commit together',
    settled.execution === 'completed' &&
      settled.job === 'done' &&
      settled.active_job_id === null &&
      settled.events === 1,
  );
  const firstSnapshot = await snapshot(queued.execution_id);
  const recovered = await request(`/operations/${queued.execution_id}`);
  check(
    'lost response is recovered by read without another financial mutation',
    recovered.state === 'completed' &&
      JSON.stringify(await snapshot(queued.execution_id)) ===
        JSON.stringify(firstSnapshot),
  );
  const repeat = await run(queued.execution_id);
  check(
    'explicit execution replay returns the committed witness without creating another movement',
    repeat.state === 'completed' &&
      JSON.stringify(await snapshot(queued.execution_id)) ===
        JSON.stringify(firstSnapshot),
  );
  for (const [column, value] of [
    [
      'minimal_receipt',
      JSON.stringify({ ...receipt, resource_id: '999999999' }),
    ],
    ['bound_command_hash', 'e'.repeat(64)],
    ['state', 'ready'],
  ]) {
    const cast = column === 'minimal_receipt' ? '::jsonb' : '';
    await assert.rejects(
      db.query(
        `UPDATE nodia_ai_execution_steps SET ${column}=$2${cast} WHERE execution_id=$1`,
        [queued.execution_id, value],
      ),
      /immutable/i,
    );
  }
  await assert.rejects(
    db.query("UPDATE nodia_ai_executions SET state='queued' WHERE id=$1", [
      queued.execution_id,
    ]),
    /immutable/i,
  );
  check(
    'committed receipt command hash and terminal identities cannot be rewritten in SQL',
    JSON.stringify(await snapshot(queued.execution_id)) ===
      JSON.stringify(firstSnapshot),
  );

  const ConfirmationStore = await loadAi(
    'nodia-ai-confirmation/nodia-ai-confirmation.service',
    'NodiaAiConfirmationService',
  );
  const confirmationStore = compiled.get(ConfirmationStore),
    sourceSteps = confirmationStore.steps.bind(confirmationStore);
  confirmationStore.steps = async (...args) =>
    (await sourceSteps(...args)).map((value) => ({
      ...value,
      minimal_receipt: {
        ...value.minimal_receipt,
        resource_id: 'not-a-resource-id',
      },
    }));
  try {
    await request(`/operations/${queued.execution_id}`, { status: 500 });
  } finally {
    confirmationStore.steps = sourceSteps;
  }
  check(
    'status projection rejects a forged persisted receipt instead of publishing a false resource',
    JSON.stringify(await snapshot(queued.execution_id)) ===
      JSON.stringify(firstSnapshot),
  );

  const concurrent = await admit(await proposal());
  const both = await Promise.all([
    run(concurrent.execution_id),
    run(concurrent.execution_id),
  ]);
  check(
    'two concurrent execution invocations serialize to one native movement and receipt',
    both.every((x) => x.state === 'completed') &&
      (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n ===
        2,
  );

  for (const phase of ['receipt', 'outbox']) {
    const candidate = await admit(await proposal());
    const before = await snapshot(candidate.execution_id);
    const table =
      phase === 'receipt' ? 'nodia_ai_execution_steps' : 'nodia_ai_events';
    const timing = phase === 'receipt' ? 'BEFORE UPDATE' : 'BEFORE INSERT';
    const condition =
      phase === 'receipt'
        ? 'NEW.minimal_receipt IS NOT NULL'
        : "NEW.execution_id IS NOT NULL AND NEW.public_payload->'payload'->>'state'='completed'";
    await db.query(
      `CREATE FUNCTION synthetic_ai19_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'synthetic_ai19_atomic_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_ai19_failure ${timing} ON ${table} FOR EACH ROW EXECUTE FUNCTION synthetic_ai19_fail()`,
    );
    await assert.rejects(
      run(candidate.execution_id),
      /synthetic_ai19_atomic_failure/,
    );
    await db.query(
      `DROP TRIGGER synthetic_ai19_failure ON ${table}; DROP FUNCTION synthetic_ai19_fail()`,
    );
    check(
      `${phase} failure rolls back native movement receipt transitions job and outbox`,
      JSON.stringify(await snapshot(candidate.execution_id)) ===
        JSON.stringify(before),
    );
    const retry = await run(candidate.execution_id);
    check(
      `explicit exact retry after ${phase} rollback creates one committed effect`,
      retry.state === 'completed' &&
        (await db.query('SELECT count(*)::int n FROM finance_movements'))[0]
          .n ===
          before.movements + 1,
    );
  }

  const lost = await admit(await proposal());
  const Store = await loadAi(
    'nodia-ai-execution/nodia-ai-execution.service',
    'NodiaAiExecutionService',
  );
  const store = compiled.get(Store),
    transaction = store.transaction.bind(store);
  const beforeLost = await snapshot(lost.execution_id);
  // Inject transport loss only after the real PostgreSQL transaction commits.
  store.transaction = async (work) => {
    await transaction(work);
    throw Error('synthetic_ai19_post_commit_response_lost');
  };
  try {
    await assert.rejects(
      run(lost.execution_id),
      (error) =>
        error.getStatus?.() === 503 &&
        error.message === 'nodia_ai:execution_result_unknown',
    );
  } finally {
    store.transaction = transaction;
  }
  const afterLost = await snapshot(lost.execution_id);
  check(
    'a lost local COMMIT acknowledgement leaves one durable effect and reports uncertainty',
    afterLost.movements === beforeLost.movements + 1 &&
      afterLost.execution.state === 'completed' &&
      afterLost.steps[0].minimal_receipt !== null,
  );
  const lostRead = await request(`/operations/${lost.execution_id}`);
  await run(lost.execution_id);
  check(
    'observation and explicit replay after lost COMMIT acknowledgement never repeat the effect',
    lostRead.state === 'completed' &&
      JSON.stringify(await snapshot(lost.execution_id)) ===
        JSON.stringify(afterLost),
  );

  for (const fence of ['grant', 'deadline', 'epoch', 'bound_hash']) {
    const candidate = await admit(await proposal());
    if (fence === 'grant')
      await db.query(
        'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE execution_id=$1',
        [candidate.execution_id],
      );
    if (fence === 'deadline')
      await db.query(
        "UPDATE nodia_ai_jobs SET deadline_at=clock_timestamp()-interval '1 second' WHERE execution_id=$1",
        [candidate.execution_id],
      );
    if (fence === 'epoch')
      await db.query(
        'UPDATE nodia_ai_conversations SET retention_epoch=retention_epoch+1 WHERE id=(SELECT conversation_id FROM nodia_ai_executions WHERE id=$1)',
        [candidate.execution_id],
      );
    if (fence === 'bound_hash')
      await db.query(
        'UPDATE nodia_ai_execution_steps SET bound_command_hash=$2 WHERE execution_id=$1',
        [candidate.execution_id, 'f'.repeat(64)],
      );
    const before = await snapshot(candidate.execution_id);
    await assert.rejects(run(candidate.execution_id), (error) =>
      fence === 'bound_hash'
        ? error.getStatus?.() === 500 && error.message === 'nodia_ai:invalid_persisted_state'
        : [403, 409, 410].includes(error.getStatus?.()),
    );
    check(
      `${fence} fence rejects execution before any native effect or receipt`,
      JSON.stringify(await snapshot(candidate.execution_id)) ===
        JSON.stringify(before),
    );
    await closeRejected(candidate.execution_id);
  }

  const immutable = await admit(await proposal());
  const immutableBefore = await snapshot(immutable.execution_id);
  await assert.rejects(
    db.query(
      'UPDATE nodia_ai_execution_steps SET native_request_key=$2 WHERE execution_id=$1',
      [immutable.execution_id, randomUUID()],
    ),
    /immutable/i,
  );
  await assert.rejects(
    db.query(
      'UPDATE nodia_ai_execution_steps SET minimal_scope=$2::jsonb WHERE execution_id=$1',
      [immutable.execution_id, JSON.stringify({ subject_user_id: '2' })],
    ),
    /immutable/i,
  );
  check(
    'database rejects rewriting approved effect request identity and subject scope',
    JSON.stringify(await snapshot(immutable.execution_id)) ===
      JSON.stringify(immutableBefore),
  );
  await closeRejected(immutable.execution_id);

  const GetProposal = await loadAi(
    'nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case',
    'GetNodiaAiProposalUseCase',
  );
  const Effect = await loadAi(
    'nodia-ai-finance-effect/use-case/execute-nodia-ai-finance-movement-effect.use-case',
    'ExecuteNodiaAiFinanceMovementEffectUseCase',
  );
  const { storedStep } =
    await import('../dist/nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js');
  const nativeCandidate = await proposal();
  for (const tamper of [
    'amount_number',
    'owner_scope',
    'unsupported_binding',
  ]) {
    const count = (
      await db.query('SELECT count(*)::int n FROM finance_movements')
    )[0].n;
    await assert.rejects(
      db.transaction(async (manager) => {
        const loaded = await compiled
          .get(GetProposal)
          .load(
            manager,
            identities.get('1'),
            nativeCandidate.proposal_id,
            'write',
          );
        const changed = structuredClone(storedStep(loaded.steps[0]));
        if (tamper === 'amount_number')
          changed.commandTemplate.command.amount = 20000;
        if (tamper === 'owner_scope') changed.scope.subject_user_id = '2';
        if (tamper === 'unsupported_binding')
          changed.outputBindings = [{ source: 'invented' }];
        await compiled.get(Effect).execute(changed, loaded.context);
      }),
      (error) => [400, 403, 409].includes(error.getStatus?.()),
    );
    check(
      `native effect port rejects ${tamper} instead of interpreting another command`,
      (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n ===
        count,
    );
  }

  const staleCategory = await admit(await proposal());
  const staleBefore = await snapshot(staleCategory.execution_id);
  await db.query(
    'UPDATE finance_categories SET is_active=false,updated_at=clock_timestamp() WHERE id=$1',
    [category.id],
  );
  await assert.rejects(
    run(staleCategory.execution_id),
    (error) => error.getStatus?.() === 409,
  );
  check(
    'changed category after human confirmation rejects execution without effects',
    JSON.stringify(await snapshot(staleCategory.execution_id)) ===
      JSON.stringify(staleBefore),
  );
  await closeRejected(staleCategory.execution_id);
  await db.query(
    'UPDATE finance_categories SET is_active=true,updated_at=clock_timestamp() WHERE id=$1',
    [category.id],
  );

  const revoked = await admit(await proposal());
  const revokedBefore = await snapshot(revoked.execution_id);
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [
    destination.id,
  ]);
  await assert.rejects(
    run(revoked.execution_id),
    (error) => error.getStatus?.() === 403,
  );
  check(
    'destination module revocation fences an admitted execution before the financial effect',
    JSON.stringify(await snapshot(revoked.execution_id)) ===
      JSON.stringify(revokedBefore),
  );
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
    destination.id,
  ]);
  await db.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
    [identities.get('1').sessionId],
  );
  await assert.rejects(
    run(revoked.execution_id),
    (error) => error.getStatus?.() === 401,
  );
  check(
    'session revocation prevents dispatch even after a valid human confirmation',
    JSON.stringify(await snapshot(revoked.execution_id)) ===
      JSON.stringify(revokedBefore),
  );
  await db.query(
    'UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1',
    [identities.get('1').sessionId],
  );
  await assert.rejects(run(revoked.execution_id, '3'), (error) =>
    [403, 404].includes(error.getStatus?.()),
  );
  check(
    'omniscient administrator cannot execute an operation belonging to a foreign chat',
    JSON.stringify(await snapshot(revoked.execution_id)) ===
      JSON.stringify(revokedBefore),
  );
  await closeRejected(revoked.execution_id);

  const admin = await proposal({
    actor: '3',
    partial: { owner_id: '2', category_id: category2.id },
  });
  const adminQueued = await admit(admin, '3');
  await run(adminQueued.execution_id, '3');
  const [adminEffect] = await db.query(
    "SELECT e.actor_id,e.chat_owner_id,m.user_id FROM nodia_ai_executions e JOIN nodia_ai_execution_steps s ON s.execution_id=e.id JOIN finance_movements m ON m.id=(s.minimal_receipt->>'resource_id')::bigint WHERE e.id=$1",
    [adminQueued.execution_id],
  );
  check(
    'administrator on own chat creates for explicit other owner while preserving actual actor',
    adminEffect.actor_id === '3' &&
      adminEffect.chat_owner_id === '3' &&
      adminEffect.user_id === '2',
  );

  // A real legacy writer and the new executor share the native obligation lock.
  const Create = await loadAi(
    'finance-movement/use-case/create-finance-movement.use-case',
    'CreateFinanceMovementUseCase',
  );
  const nativeCreate = compiled.get(Create);
  const [obligation] = await db.query(
    "INSERT INTO finance_obligations(user_id,name,key,type,amount) VALUES(1,'Synthetic AI19 debt','synthetic_ai19_debt','debt',100) RETURNING id",
  );
  await db.query(
    "INSERT INTO finance_movements(user_id,category_id,obligation_id,name,amount,type,status) VALUES(1,$1,$2,'Synthetic AI19 origin',100,'income','received')",
    [category.id, obligation.id],
  );
  const payment = await admit(
    await proposal({
      partial: {
        name: 'Synthetic AI19 repayment',
        amount: '60',
        obligation_id: obligation.id,
      },
    }),
  );
  const raced = await Promise.allSettled([
    run(payment.execution_id),
    nativeCreate.execute(identities.get('1'), {
      name: 'Synthetic legacy payment',
      amount: '60',
      type: 'expense',
      status: 'paid',
      category_id: category.id,
      obligation_id: obligation.id,
    }),
  ]);
  const [paid] = await db.query(
    "SELECT COALESCE(sum(amount),0)::text amount,count(*)::int n FROM finance_movements WHERE obligation_id=$1 AND type='expense' AND status='paid'",
    [obligation.id],
  );
  check(
    'AI executor and legacy writer race cannot exceed repayment capacity',
    raced.filter((x) => x.status === 'fulfilled').length === 1 &&
      paid.amount === '60' &&
      paid.n === 1,
  );

  const Expire = await loadAi(
    'nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case',
    'ExpireNodiaAiConversationsUseCase',
  );
  await db.query(
    "UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [exact.chat],
  );
  await compiled.get(Expire).execute();
  check(
    'expired chat removes its resolved receipt and execution while financial record remains independent',
    (
      await db.query(
        'SELECT count(*)::int n FROM nodia_ai_executions WHERE id=$1',
        [queued.execution_id],
      )
    )[0].n === 0 &&
      (
        await db.query(
          'SELECT count(*)::int n FROM finance_movements WHERE id=$1',
          [movement.id],
        )
      )[0].n === 1,
  );
  check(
    'all effect checks call no provider or model and use only disposable synthetic data',
    providerCalls === 0,
  );
  console.log(
    JSON.stringify(
      {
        stage: 'AI-19',
        scope:
          'compiled_http_disposable_postgresql_real_native_finance_atomic_witness_fixture_only_admission_no_provider',
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
