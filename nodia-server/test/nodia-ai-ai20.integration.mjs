// Compiled Nest + disposable PostgreSQL. No configured data or providers.
// Production admission and compiled local worker rules, with disposable synthetic rows only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai20');
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
  const Execute = await loadAi(
    'nodia-ai-execution/use-case/execute-nodia-ai-financial-execution.use-case',
    'ExecuteNodiaAiFinancialExecutionUseCase',
  );
  const Redis = await loadAi('common/redis/redis.service', 'RedisService');
  const Adapter = await loadAi(
    'nodia-ai-adapter/types/nodia-ai-adapter.types',
    'NodiaAiAdapterPort',
  );
  async function start() {
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
            throw Error('Forbidden AI20 provider');
          },
        ]),
      ),
    );
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
    "SELECT id FROM modules WHERE link='/tools/finances-personal'",
  );
  if (!destination)
    [destination] = await db.query(
      "INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/finances-personal','synthetic_ai20_finance' FROM modules WHERE key='nodia_ai' RETURNING id",
    );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',
    [destination.id],
  );
  const [category] = await db.query(
    "INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic AI20 food','synthetic_ai20_food') RETURNING id",
  );
  async function proposal({ actor = '1', partial = {} } = {}) {
    const chat = randomUUID(),
      identity = identities.get(actor);
    await db.query(
      "INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,creation_request_hash,title,expires_at) VALUES($1,$2,$3,$4,'Synthetic AI20 only',clock_timestamp()+interval '90 days')",
      [chat, identity.userId, randomUUID(), 'a'.repeat(64)],
    );
    const result = await db.transaction((manager) =>
      prepare.execute(manager, identity, {
        conversationId: chat,
        toolName: 'nodia_finance_movements_prepare_create',
        partial: {
          name: 'Synthetic AI20 exact expense',
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
  const run = (id, claim, actor = '1') => execute.execute(identities.get(actor), id, claim);
  const snapshot = async (id) => {
    const [row] = await db.query(
      `SELECT (SELECT count(*)::int FROM finance_movements) movements,(SELECT row_to_json(e) FROM nodia_ai_executions e WHERE e.id=$1) execution,(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.position) FROM nodia_ai_execution_steps s WHERE s.execution_id=$1) steps,(SELECT jsonb_agg(to_jsonb(j) ORDER BY j.id) FROM nodia_ai_jobs j WHERE j.execution_id=$1) jobs,(SELECT jsonb_agg(to_jsonb(ev) ORDER BY ev.seq) FROM nodia_ai_events ev WHERE ev.execution_id=$1) events`,
      [id],
    );
    return row;
  };
  await start();
  const Claim = await loadAi('nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case', 'ClaimNodiaAiExecutionUseCase');
  const Recover = await loadAi('nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case', 'RecoverNodiaAiExecutionsUseCase');
  const Run = await loadAi('nodia-ai-execution/use-case/run-nodia-ai-execution.use-case', 'RunNodiaAiExecutionUseCase');
  const claimer = compiled.get(Claim), recovery = compiled.get(Recover), worker = compiled.get(Run);
  const signal = new AbortController().signal;
  const claim = () => claimer.execute(randomUUID());
  const count = async () => (await db.query('SELECT count(*)::int n FROM finance_movements'))[0].n;
  const status = (id, actor = '1') => request(`/operations/${id}`, { actor });
  const cancel = async (id, { actor = '1', body, expected = 200 } = {}) => {
    const current = await status(id, actor);
    return request(`/operations/${id}/cancel`, { actor, method: 'POST', status: expected,
      body: body ?? { client_request_id: randomUUID(), expected_execution_revision: current.revision } });
  };
  const resume = (id, body, expected = 202, actor = '1') => request(`/operations/${id}/resume`, {
    actor, method: 'POST', status: expected, body,
  });
  const identitySnapshot = async (id) => (await db.query(`SELECT e.id,e.origin_proposal_id,e.origin_proposal_revision,e.proposal_hash,e.catalog_version,
    s.id step_id,s.source_step_id,s.template_hash,s.native_request_key,s.minimal_scope,s.bound_command_hash
    FROM nodia_ai_executions e JOIN nodia_ai_execution_steps s ON s.execution_id=e.id WHERE e.id=$1`, [id]))[0];
  const expireLease = (id) => db.query("UPDATE nodia_ai_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE execution_id=$1", [id]);
  const waitFor = async (read, predicate, description, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = await read();
      if (predicate(value)) return value;
      await delay(30);
    }
    throw Error('Timed out: ' + description);
  };
  const children = new Set();
  const childWorker = async () => {
    const child = fork(fileURLToPath(new URL('./nodia-ai-ai20-worker.fixture.mjs', import.meta.url)), [], {
      cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, silent: true,
      env: { ...process.env, DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null',
        NODIA_AI20_FIXTURE_DB: JSON.stringify(options) },
    });
    children.add(child);
    const messages = [];
    let output = '', exited;
    child.on('message', message => messages.push(message));
    child.on('exit', (code, signal) => { exited = { code, signal }; children.delete(child); });
    child.on('error', error => { exited = { message: error.message }; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      output = (output + chunk.toString()).slice(-16384);
    });
    const next = async type => waitFor(async () => {
      const message = messages.find(x => x.type === type || x.type === 'error');
      if (message?.type === 'error') throw Error(JSON.stringify(message));
      if (exited) throw Error(`Child exited ${JSON.stringify(exited)} ${output}`);
      return message;
    }, Boolean, 'child ' + type);
    await next('ready');
    return { child, next, exited: () => exited };
  };
  const kill = async child => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const ended = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGKILL');
    await ended;
  };
  const expireAndRecover = async id => {
    await expireLease(id);
    await recovery.execute();
    return status(id);
  };
  const assertNoEffect = async (id, before) => {
    const after = await snapshot(id);
    assert.equal(after.movements, before);
    assert.equal(after.steps[0].minimal_receipt, null);
    return after;
  };
  try {
    const first = await admit(await proposal());
    check('production registration admits the verified one-step financial command without fixture overrides', first.state === 'queued');
    const claims = await Promise.all([claim(), claim()]);
    const selected = claims.find(Boolean);
    check('two SQL claimants acquire exactly one execution lease', claims.filter(Boolean).length === 1 && selected.executionId === first.execution_id);
    const afterClaim = await snapshot(first.execution_id);
    check('claim records one running step and durable attempt without a domain effect', afterClaim.movements === 0 && afterClaim.execution.state === 'running' &&
      afterClaim.steps[0].state === 'running' && afterClaim.jobs[0].attempt_count === 1);
    const completed = await run(first.execution_id, selected);
    const exact = await snapshot(first.execution_id);
    const [attempt] = await db.query('SELECT * FROM nodia_ai_job_attempts WHERE id=$1', [selected.attemptId]);
    check('claimed native effect receipt terminal state and attempt commit together', completed.state === 'completed' && exact.movements === 1 &&
      exact.steps[0].minimal_receipt !== null && attempt.ended_at !== null && exact.jobs[0].state === 'done');
    await run(first.execution_id, selected);
    check('replaying a completed claimed identity returns its receipt without repeating native create', await count() === 1);
    for (const sql of [
      "UPDATE nodia_ai_execution_steps SET minimal_receipt='{}'::jsonb WHERE execution_id=$1",
      "UPDATE nodia_ai_execution_steps SET bound_command_hash=repeat('f',64) WHERE execution_id=$1",
      "UPDATE nodia_ai_executions SET state='queued' WHERE id=$1",
    ]) await assert.rejects(db.query(sql, [first.execution_id]), /immutable/i);
    check('SQL freezes completed receipts command bindings and terminal execution states', (await snapshot(first.execution_id)).movements === 1);

    const queued = await admit(await proposal());
    const queuedCount = await count();
    const cancelled = await cancel(queued.execution_id);
    check('cancel before claim stops the queued command and releases its chat without an effect', cancelled.status === 'accepted' &&
      cancelled.execution.state === 'cancelled' && await count() === queuedCount && await claim() === null);
    const queuedAgain = await cancel(queued.execution_id);
    check('duplicate cancellation is terminal observation without an effect', queuedAgain.status === 'already_terminal' && await count() === queuedCount);

    const leased = await admit(await proposal());
    const oldClaim = await claim();
    await cancel(leased.execution_id);
    await assert.rejects(run(leased.execution_id, oldClaim));
    check('cancelling a claimed local command fences the stale claimant before native create', await count() === queuedCount);

    // Kill a real Node process after durable claim but before entering its effect transaction.
    const beforeCrash = await admit(await proposal());
    const origin = await identitySnapshot(beforeCrash.execution_id);
    const crashing = await childWorker();
    crashing.child.send({ type: 'claim', workerId: randomUUID() });
    const crashClaim = (await crashing.next('claimed')).claim;
    assert.equal(crashClaim.executionId, beforeCrash.execution_id);
    await kill(crashing.child);
    const recovered = await expireAndRecover(beforeCrash.execution_id);
    await assertNoEffect(beforeCrash.execution_id, queuedCount);
    check('process death after claim recovers a definite local rollback and offers explicit resume', recovered.state === 'failed' && recovered.can_resume === true);
    await assert.rejects(run(beforeCrash.execution_id, crashClaim));
    check('expired claimant cannot create an effect after recovery fenced its attempt', await count() === queuedCount);
    const resumeBody = { client_request_id: randomUUID(), expected_execution_revision: recovered.revision };
    await resume(beforeCrash.execution_id, { ...resumeBody, expected_execution_revision: recovered.revision + 1 }, 409);
    const resumed = await resume(beforeCrash.execution_id, resumeBody);
    const replayedResume = await resume(beforeCrash.execution_id, resumeBody);
    const sameOrigin = await identitySnapshot(beforeCrash.execution_id);
    check('human resume and response-lost replay preserve original execution source native key and command identity',
      resumed.execution.execution_id === beforeCrash.execution_id && replayedResume.execution.execution_id === beforeCrash.execution_id &&
      JSON.stringify(origin) === JSON.stringify(sameOrigin));
    const resumedClaim = await claim();
    await assert.rejects(run(beforeCrash.execution_id, crashClaim));
    await run(beforeCrash.execution_id, resumedClaim);
    check('resumed execution with a new fence commits exactly one original effect', await count() === queuedCount + 1 &&
      resumedClaim.fence !== crashClaim.fence && (await status(beforeCrash.execution_id)).state === 'completed');

    // Inject response transport loss only after the actual PostgreSQL COMMIT returns.
    const lost = await admit(await proposal());
    const lostClaim = await claim(), lostCount = await count();
    const Store = await loadAi('nodia-ai-execution/nodia-ai-execution.service', 'NodiaAiExecutionService');
    const store = compiled.get(Store), transaction = store.transaction.bind(store);
    store.transaction = async work => { await transaction(work); throw Error('synthetic_ai20_post_commit_response_lost'); };
    try { await assert.rejects(run(lost.execution_id, lostClaim), error => error.getStatus?.() === 503); }
    finally { store.transaction = transaction; }
    await recovery.execute();
    await run(lost.execution_id, lostClaim);
    check('lost COMMIT acknowledgement is reconciled from its durable receipt without another native effect', await count() === lostCount + 1 &&
      (await status(lost.execution_id)).state === 'completed');
    const afterCommitCancel = await cancel(lost.execution_id);
    check('cancel after committed effect reports completed and preserves the created record', afterCommitCancel.status === 'already_terminal' &&
      afterCommitCancel.execution.state === 'completed' && await count() === lostCount + 1);

    const committedCrash = await admit(await proposal());
    const committedCount = await count(), committedWorker = await childWorker();
    committedWorker.child.send({ type: 'claim', workerId: randomUUID() });
    await committedWorker.next('claimed');
    committedWorker.child.send({ type: 'execute' });
    await committedWorker.next('completed');
    await kill(committedWorker.child);
    await recovery.execute();
    check('abrupt process death after COMMIT preserves the terminal receipt and cannot reopen the native effect',
      (await status(committedCrash.execution_id)).state === 'completed' && await count() === committedCount + 1);

    // Hold an INSERT in the real DB transaction, kill its process, prove rollback before resume.
    const during = await admit(await proposal());
    const duringCount = await count(), blocked = await childWorker();
    blocked.child.send({ type: 'claim', workerId: randomUUID() });
    await blocked.next('claimed');
    const gate = db.createQueryRunner();
    await gate.connect();
    await gate.startTransaction();
    await gate.query('SELECT pg_advisory_xact_lock(202017,1)');
    await db.query("CREATE FUNCTION synthetic_ai20_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(202017,1); RETURN NEW; END $$; CREATE TRIGGER synthetic_ai20_gate AFTER INSERT ON finance_movements FOR EACH ROW EXECUTE FUNCTION synthetic_ai20_gate()");
    try {
      blocked.child.send({ type: 'execute' });
      const [backend] = await waitFor(() => db.query("SELECT pid FROM pg_stat_activity WHERE application_name='nodia_ai20_fault_worker' AND wait_event='advisory'"), x => x.length === 1, 'native INSERT gated');
      await kill(blocked.child);
      await gate.commitTransaction();
      await waitFor(() => db.query('SELECT pid FROM pg_stat_activity WHERE pid=$1', [backend.pid]), x => x.length === 0, 'dead process PostgreSQL rollback');
    } finally {
      if (gate.isTransactionActive) await gate.rollbackTransaction();
      await gate.release();
      await db.query('DROP TRIGGER synthetic_ai20_gate ON finance_movements; DROP FUNCTION synthetic_ai20_gate()');
    }
    const duringRecovered = await expireAndRecover(during.execution_id);
    await assertNoEffect(during.execution_id, duringCount);
    check('process death after native INSERT before COMMIT leaves neither movement nor receipt and is recoverable', duringRecovered.state === 'failed' && duringRecovered.can_resume);
    await resume(during.execution_id, { client_request_id: randomUUID(), expected_execution_revision: duringRecovered.revision });
    await worker.execute(randomUUID(), signal);
    check('explicit recovery after interrupted effect creates one movement with original identity', await count() === duringCount + 1 &&
      (await status(during.execution_id)).state === 'completed');

    const raced = await admit(await proposal());
    const racingWorker = await childWorker(), raceCount = await count();
    racingWorker.child.send({ type: 'claim', workerId: randomUUID() });
    await racingWorker.next('claimed');
    const raceGate = db.createQueryRunner();
    await raceGate.connect();
    await raceGate.startTransaction();
    await raceGate.query('SELECT pg_advisory_xact_lock(202017,2)');
    await db.query("CREATE FUNCTION synthetic_ai20_race_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(202017,2); RETURN NEW; END $$; CREATE TRIGGER synthetic_ai20_race_gate AFTER INSERT ON finance_movements FOR EACH ROW EXECUTE FUNCTION synthetic_ai20_race_gate()");
    try {
      racingWorker.child.send({ type: 'execute' });
      await waitFor(() => db.query("SELECT pid FROM pg_stat_activity WHERE application_name='nodia_ai20_fault_worker' AND wait_event='advisory'"), x => x.length === 1, 'effect before cancellation race');
      let finishedCancel = false;
      // Use the revision before dispatch; the terminal result is authoritative after it waits.
      const cancelRace = request(`/operations/${raced.execution_id}/cancel`, { method: 'POST', body: {
        client_request_id: randomUUID(), expected_execution_revision: raced.revision + 1,
      } }).then(value => { finishedCancel = true; return value; });
      await delay(100);
      check('cancellation waits for the in-flight local transaction rather than reporting a false rollback', !finishedCancel);
      await raceGate.commitTransaction();
      const racedCancellation = await cancelRace;
      await racingWorker.next('completed');
      check('concurrent cancel after native COMMIT preserves the exact effect and completed receipt',
        racedCancellation.status === 'already_terminal' && racedCancellation.execution.state === 'completed' && await count() === raceCount + 1);
    } finally {
      if (raceGate.isTransactionActive) await raceGate.rollbackTransaction();
      await raceGate.release();
      await db.query('DROP TRIGGER synthetic_ai20_race_gate ON finance_movements; DROP FUNCTION synthetic_ai20_race_gate()');
      await kill(racingWorker.child);
    }

    const changed = await admit(await proposal());
    await db.query('UPDATE finance_categories SET name=$2 WHERE id=$1', [category.id, 'Synthetic AI20 changed']);
    const changedCount = await count();
    await worker.execute(randomUUID(), signal);
    const changedStatus = await status(changed.execution_id);
    check('material precondition changes produce a known failure requiring a new proposal', changedStatus.state === 'failed' && !changedStatus.can_resume && await count() === changedCount);
    await resume(changed.execution_id, { client_request_id: randomUUID(), expected_execution_revision: changedStatus.revision }, 409);
    check('resume never refreshes a changed material snapshot or creates another financial effect', await count() === changedCount);

    const revoked = await admit(await proposal());
    await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [destination.id]);
    const revokedCount = await count();
    await worker.execute(randomUUID(), signal);
    check('module revocation after admission prevents dispatch of the pending effect', await count() === revokedCount);
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [destination.id]);
    const revokedStatus = await status(revoked.execution_id);
    check('permission failure releases the local worker with no false completed receipt', revokedStatus.state === 'failed' &&
      (await snapshot(revoked.execution_id)).steps[0].minimal_receipt === null);

    const sessionOperation = await admit(await proposal());
    const sessionClaim = await claim(), sessionCount = await count();
    const oldSession = identities.get('1').sessionId;
    await db.query('UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1', [oldSession]);
    await assert.rejects(run(sessionOperation.execution_id, sessionClaim), error => error.getStatus?.() === 401);
    await recovery.execute(sessionClaim, 'nodia_ai:session_invalid');
    const newSession = randomUUID();
    await db.query("INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,1,'synthetic',clock_timestamp()+interval '1 hour')", [newSession]);
    identities.set('1', { userId: '1', sessionId: newSession });
    const sessionStatus = await status(sessionOperation.execution_id);
    check('revoked confirmation session prevents effects while a new valid session can inspect the same failed execution',
      sessionStatus.state === 'failed' && sessionStatus.can_resume && await count() === sessionCount);
    await resume(sessionOperation.execution_id, { client_request_id: randomUUID(), expected_execution_revision: sessionStatus.revision });
    const sessionResumedClaim = await claim();
    await run(sessionOperation.execution_id, sessionResumedClaim);
    check('explicit resume renews authority under the new session without changing the original effect identity',
      sessionResumedClaim.identity.sessionId === newSession && await count() === sessionCount + 1 &&
      (await status(sessionOperation.execution_id)).state === 'completed');

    const privateOperation = await admit(await proposal());
    await request(`/operations/${privateOperation.execution_id}/cancel`, { actor: '2', method: 'POST', status: 404,
      body: { client_request_id: randomUUID(), expected_execution_revision: privateOperation.revision } });
    await request(`/operations/${privateOperation.execution_id}/cancel`, { actor: '3', method: 'POST', status: 403,
      body: { client_request_id: randomUUID(), expected_execution_revision: privateOperation.revision } });
    check('foreign users and omniscient administrators cannot cancel a chat owned by another actor', (await status(privateOperation.execution_id)).state === 'queued');
    await cancel(privateOperation.execution_id);

    const expiringProposal = await proposal();
    const expiring = await admit(expiringProposal), expiringClaim = await claim(), expiringCount = await count();
    const Expire = await loadAi('nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case', 'ExpireNodiaAiConversationsUseCase');
    await db.query("UPDATE nodia_ai_conversations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [expiringProposal.chat]);
    await compiled.get(Expire).execute();
    const [detached] = await db.query('SELECT * FROM nodia_ai_jobs WHERE id=$1', [expiringClaim.jobId]);
    check('expiry deletes chat payload while a claimed local execution retains only bounded reconciliation identity',
      (await db.query('SELECT count(*)::int n FROM nodia_ai_conversations WHERE id=$1', [expiringProposal.chat]))[0].n === 0 && await count() === expiringCount &&
      detached.conversation_id === null && detached.execution_id === null &&
      Object.keys(detached.recovery_descriptor).every(key => ['schema_version', 'reason', 'job_id', 'execution_id', 'retention_epoch'].includes(key)));
    await recovery.execute();
    check('SQL reconciliation removes the expired local journal after proving its transaction rolled back',
      (await db.query('SELECT count(*)::int n FROM nodia_ai_executions WHERE id=$1', [expiring.execution_id]))[0].n === 0 &&
      (await db.query('SELECT count(*)::int n FROM nodia_ai_jobs WHERE id=$1', [expiringClaim.jobId]))[0].n === 0 && await count() === expiringCount);
    await assert.rejects(run(expiring.execution_id, expiringClaim));
    check('an expired retained execution never reconstructs a command or dispatches another effect', await count() === expiringCount);

    // The actual production entrypoint proves DI, worker polling, SQL dispatch and restart persistence.
    const standaloneProposal = await proposal();
    const standalone = await admit(standaloneProposal);
    const beforeLeaving = await request(`/conversations/${standaloneProposal.chat}`);
    check('conversation snapshot exposes the admitted execution before leaving its observation',
      beforeLeaving.active_execution?.execution_id === standalone.execution_id);
    const standaloneCount = await count();
    const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/nodia-ai-worker.js', import.meta.url))], {
      cwd: fileURLToPath(new URL('..', import.meta.url)), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null', NODE_ENV: 'test', RATE_LIMIT_STORAGE: 'memory',
        POSTGRES_HOST: options.host, POSTGRES_PORT: String(options.port), POSTGRES_DB: options.database,
        POSTGRES_USER: options.username, POSTGRES_PASSWORD: options.password, GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:1',
        GEMINI_SERVICE_TOKEN: '', REDIS_HOST: '127.0.0.1', REDIS_PORT: '1' },
    });
    children.add(child);
    let output = '', childExit;
    const stopped = new Promise(resolve => child.once('exit', (code, signal) => { childExit = { code, signal }; children.delete(child); resolve(); }));
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-32768); });
    try {
      await waitFor(async () => {
        if (childExit) throw Error(`Standalone worker exited ${JSON.stringify(childExit)} ${output}`);
        return status(standalone.execution_id);
      }, x => x.state === 'completed', 'standalone worker dispatch', 45000);
      check('production standalone worker claims and commits an admitted financial effect without provider access', await count() === standaloneCount + 1);
      child.kill('SIGTERM');
      let drainTimer;
      try {
        await Promise.race([stopped, new Promise((_, reject) => { drainTimer = setTimeout(() => reject(Error('Standalone worker drain timeout')), 15000); })]);
      } finally { clearTimeout(drainTimer); }
      check('standalone worker drains and its completed effect survives process shutdown and observation',
        (childExit.code === 0 || childExit.signal === 'SIGTERM') && (await status(standalone.execution_id)).state === 'completed' && await count() === standaloneCount + 1);
      const reopened = await request(`/conversations/${standaloneProposal.chat}`);
      const linked = await request(`/proposals/${standaloneProposal.proposal_id}`);
      const finished = await status(standalone.execution_id);
      const reference = finished.steps[0].result_refs[0];
      const nativeResponse = await fetch(base.replace(/\/nodia-ai$/, '') + `/finance/movements/${reference.id}`, {
        headers: { 'x-fixture-actor': '1' },
      });
      const nativeMovement = await nativeResponse.json();
      check('reopening chat restores the original execution link and the effect is readable through native Finance API',
        reopened.active_execution === null && linked.execution_id === standalone.execution_id && nativeResponse.status === 200 &&
        nativeMovement.id === reference.id && nativeMovement.name === 'Synthetic AI20 exact expense' && nativeMovement.amount === '20000');
    } finally { await kill(child); }

    check('local confirmed execution never acquires provider runtime slots or invokes model inference',
      providerCalls === 0 && (await db.query('SELECT count(*)::int n FROM nodia_ai_runtime_slots'))[0].n === 0);
    check('all SQL claims are terminal with no abandoned open attempt',
      (await db.query('SELECT count(*)::int n FROM nodia_ai_job_attempts WHERE ended_at IS NULL'))[0].n === 0);
    console.log(JSON.stringify({ stage: 'AI-20', scope: 'compiled_http_standalone_worker_disposable_postgresql_process_crashes_local_native_finance_no_provider',
      checks: checks.length, passed: checks }, null, 2));
  } finally {
    for (const child of children) await kill(child);
  }
} finally {
  if (app) await app.close();
  await fixture.close();
}
