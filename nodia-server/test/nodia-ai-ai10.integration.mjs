// Real compiled HTTP/use cases + PostgreSQL. Provider observation is a labelled synthetic port; no inference is made.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai10');
const { db, options, identities } = fixture;
const checks = [];
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
};
let lastHeaders;
let app,
  observationCount = 0,
  preparationCount = 0;
try {
  const [provider] = await db.query(
    "INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI10 connection','{}') RETURNING id",
  );
  const selection = {
    connection_id: provider.id,
    mode: 'agentic',
    model_id: 'synthetic-ai10-model',
    effort_id: null,
  };
  const module = await loadAi(
    'nodia-ai-conversation/nodia-ai-conversation.module',
    'NodiaAiConversationModule',
  );
  const token = await loadAi(
    'nodia-ai-conversation/types/nodia-ai-admission.types',
    'NODIA_AI_ADMISSION_PREPARER',
  );
  const builder = Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      module,
    ],
  });
  builder.overrideProvider(token).useValue({
    async observe() {
      observationCount++;
      return { synthetic: true };
    },
    async prepare(_manager, actor, chat) {
      preparationCount++;
      return {
        selection: {
          connection_id: chat.selected_connection_id,
          mode: chat.selected_mode,
          model_id: chat.selected_model_id,
          effort_id: chat.selected_effort_id,
        },
        catalogVersion: 'synthetic-catalog/1',
        contextManifest: { schema_version: 1 },
        grantScope: { conversation_id: chat.id },
        allowedModules: actor.modules.map((item) => item.route),
        allowedOperations: ['chat:respond'],
      };
    },
  });
  const compiled = await builder.compile();
  app = compiled.createNestApplication({ logger: false });
  app.useGlobalGuards({
    canActivate(ctx) {
      const req = ctx.switchToHttp().getRequest();
      const identity = identities.get(req.headers['x-fixture-actor']);
      if (!identity) throw new UnauthorizedException();
      req.auth = {
        user: {
          id: identity.userId,
          name: 'Synthetic',
          email: 'synthetic@example.invalid',
          image_url: null,
        },
        sessionId: identity.sessionId,
      };
      return true;
    },
  });
  app.setGlobalPrefix('api/v1');
  const createParser = await loadAi(
    'nodia-ai-conversation/nodia-ai-conversation-body-parser',
    'createNodiaAiConversationBodyParser',
  );
  const policyToken = await loadAi(
    'nodia-ai-runtime/config/runtime-policy',
    'NODIA_AI_RUNTIME_POLICY',
  );
  const Filter = await loadAi(
    'common/filters/all-exceptions.filter',
    'AllExceptionsFilter',
  );
  const policy = app.get(policyToken);
  app.use('/api/v1/nodia-ai', createParser(policy.admission.http_json_bytes));
  app.useGlobalFilters(new Filter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api/v1/nodia-ai/conversations';
  async function request(
    path = '',
    { actor = '1', method = 'GET', body, status = 200 } = {},
  ) {
    const config = {
      method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
    };
    if (body !== undefined && method !== 'GET' && method !== 'HEAD')
      config.body = JSON.stringify(body);
    const response = await fetch(base + path, config);
    lastHeaders = response.headers;
    const value = await response.json();
    assert.equal(response.status, status, JSON.stringify(value));
    return value;
  }
  async function create(actor = '1', title = 'Synthetic chat') {
    return request('', {
      actor,
      method: 'POST',
      status: 201,
      body: { client_request_id: randomUUID(), title, selection },
    });
  }
  async function send(
    chat,
    {
      actor = '1',
      id = randomUUID(),
      revision = chat.revision,
      text = 'Synthetic message',
      status = 202,
    } = {},
  ) {
    return request(`/${chat.conversation_id}/messages`, {
      actor,
      method: 'POST',
      status,
      body: {
        client_message_id: id,
        expected_conversation_revision: revision,
        parts: [{ kind: 'text', text }],
      },
    });
  }
  const chat = await create();
  check(
    'compiled Nest HTTP creates owned chat without provider dispatch',
    chat.owner_user_id === '1' && chat.revision === 1 && observationCount === 0,
  );
  for (const [name, body, headers, status] of [
    [
      'oversized JSON is rejected at policy64KiB before DTO processing',
      JSON.stringify({
        oversized: 'a'.repeat(policy.admission.http_json_bytes),
      }),
      {},
      413,
    ],
    ['malformed JSON is classified as invalid input', '{', {}, 400],
    [
      'compressed JSON is rejected before decompression',
      gzipSync('{}'),
      { 'content-encoding': 'gzip' },
      400,
    ],
  ]) {
    const response = await fetch(base, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-fixture-actor': '1',
        ...headers,
      },
      body,
    });
    assert.equal(response.status, status, await response.text());
    check(
      name,
      response.headers.get('cache-control') === 'no-store' &&
        Boolean(response.headers.get('x-request-id')),
    );
  }
  await request('', {
    method: 'POST',
    body: { client_request_id: randomUUID(), owner_id: '2' },
    status: 400,
  });
  checks.push('HTTP rejects forged owner and unknown fields');
  await request(`/${chat.conversation_id}`, { actor: '2', status: 404 });
  checks.push('ordinary foreign detail hides chat existence');
  const inspected = await request(`/${chat.conversation_id}`, { actor: '3' });
  check(
    'super_admin reads foreign chat read-only without changing owner',
    inspected.conversation.read_only &&
      inspected.conversation.owner_user_id === '1',
  );
  const [{ count: audit }] = await db.query(
    "SELECT count(*)::int count FROM nodia_ai_audit_events WHERE conversation_id=$1 AND actor_id=3 AND event_key='conversation.inspected'",
    [chat.conversation_id],
  );
  check(
    'foreign administrative read leaves actor/session audit linked to chat',
    audit === 1,
  );
  await send(chat, { actor: '3', status: 403 });
  checks.push('super_admin inspection cannot send as another owner');
  await request('?view=all', { actor: '2', status: 403 });
  checks.push('ordinary all-list request is rejected');
  const others = await request('?view=all&owner_user_id=1', { actor: '3' });
  check(
    'explicit super_admin owner-filter returns foreign read-only rows',
    others.items.length === 1 && others.items[0].read_only,
  );
  const messageId = randomUUID();
  const [first, retry] = await Promise.all([
    send(chat, { id: messageId }),
    send(chat, { id: messageId.toUpperCase() }),
  ]);
  check(
    'concurrent identical message identities converge on one message/run',
    first.message_id === retry.message_id &&
      first.run.run_id === retry.run.run_id,
  );
  const [{ messages, runs, jobs, grants }] = await db.query(
    `SELECT (SELECT count(*)::int FROM nodia_ai_messages WHERE conversation_id=$1) messages,(SELECT count(*)::int FROM nodia_ai_runs WHERE conversation_id=$1) runs,(SELECT count(*)::int FROM nodia_ai_jobs WHERE conversation_id=$1) jobs,(SELECT count(*)::int FROM nodia_ai_execution_grants g JOIN nodia_ai_runs r ON r.id=g.run_id WHERE r.conversation_id=$1) grants`,
    [chat.conversation_id],
  );
  check(
    'one admission atomically creates message/run/job/grant',
    messages === 1 && runs === 1 && jobs === 1 && grants === 1,
  );
  const [stored] = await db.query(
    'SELECT * FROM nodia_ai_conversations WHERE id=$1',
    [chat.conversation_id],
  );
  check(
    'new owner message sets exact 90-day retention and busy pointer',
    stored.last_owner_message_at &&
      stored.expires_at - stored.last_owner_message_at === 90 * 86400000 &&
      stored.active_job_id,
  );
  const observedBefore = observationCount,
    preparedBefore = preparationCount;
  const recovered = await send(chat, { id: messageId, revision: 999 });
  check(
    'retry recovers before revision/activity/observation and keeps original accepted revision',
    recovered.message_id === first.message_id &&
      recovered.conversation_revision === 2 &&
      observationCount === observedBefore &&
      preparationCount === preparedBefore,
  );
  const [unchanged] = await db.query(
    'SELECT expires_at,last_owner_message_at FROM nodia_ai_conversations WHERE id=$1',
    [chat.conversation_id],
  );
  check(
    'duplicate does not renew owner activity or expiration',
    unchanged.expires_at.getTime() === stored.expires_at.getTime() &&
      unchanged.last_owner_message_at.getTime() ===
        stored.last_owner_message_at.getTime(),
  );
  await send(chat, {
    id: messageId,
    text: 'Changed identity payload',
    status: 409,
  });
  checks.push('same identity with another payload conflicts');
  await send(chat, { revision: 2, status: 409 });
  checks.push('a second message cannot bypass active chat job');
  await request(`/${chat.conversation_id}/selection`, {
    method: 'PATCH',
    body: { expected_conversation_revision: 2, selection },
    status: 409,
  });
  checks.push('selection cannot change during an active activity');
  const page = await request(`/${chat.conversation_id}/messages?page_limit=1`);
  check(
    'message page projects canonical text without internal manifest',
    page.items.length === 1 &&
      page.items[0].parts[0].text === 'Synthetic message' &&
      page.items[0].source_scope_manifest === undefined,
  );
  await request(`/${chat.conversation_id}/messages?page_limit=101`, {
    status: 400,
  });
  checks.push('HTTP message pagination rejects limits above policy');
  await request(`/${chat.conversation_id}/messages?cursor=garbage`, {
    status: 400,
  });
  checks.push('malformed cursor cannot reach PostgreSQL casts');
  await db.query(
    "UPDATE nodia_ai_messages SET source_scope_manifest='{}' WHERE id=$1",
    [first.message_id],
  );
  const restricted = await request(`/${chat.conversation_id}/messages`);
  check(
    'malformed source scope hides text instead of treating absence as permission',
    restricted.items[0].visibility === 'restricted' &&
      restricted.items[0].parts === undefined,
  );
  await db.query(
    'UPDATE nodia_ai_messages SET source_scope_manifest=\'{"schema_version":1,"module_routes":[]}\' WHERE id=$1',
    [first.message_id],
  );
  await db.query("UPDATE nodia_ai_jobs SET state='done' WHERE run_id=$1", [
    first.run.run_id,
  ]);
  await db.query(
    "UPDATE nodia_ai_runs SET state='completed',completed_at=clock_timestamp() WHERE id=$1",
    [first.run.run_id],
  );
  await db.query(
    'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1',
    [chat.conversation_id],
  );
  const renamed = await request(`/${chat.conversation_id}`, {
    method: 'PATCH',
    body: {
      expected_conversation_revision: 2,
      title: 'Renamed',
      is_pinned: true,
    },
  });
  check(
    'metadata advances revision without renewing retention',
    renamed.revision === 3 &&
      new Date(renamed.expires_at).getTime() === stored.expires_at.getTime(),
  );
  const selectionChanged = await request(`/${chat.conversation_id}/selection`, {
    method: 'PATCH',
    body: {
      expected_conversation_revision: 3,
      selection: { ...selection, model_id: 'synthetic-new-model' },
    },
  });
  check(
    'selection preference changes between turns while preserving history',
    selectionChanged.revision === 4 &&
      selectionChanged.selection.model_id === 'synthetic-new-model',
  );
  const keepHistory = await request(`/${chat.conversation_id}/messages`);
  check(
    'changing selection preserves prior canonical message',
    keepHistory.items[0].message_id === first.message_id,
  );
  const search = await request('?search=Renamed');
  check(
    'bounded parameterized title search finds own live chat',
    search.items.some((item) => item.conversation_id === chat.conversation_id),
  );
  const searchLiteral = await request('?search=%25_%27');
  check(
    'search metacharacters remain literal rather than SQL/wildcards',
    searchLiteral.items.length === 0,
  );
  const micro1 = await create('3', 'Microsecond fixture one'),
    micro2 = await create('3', 'Microsecond fixture two');
  await db.query(
    "UPDATE nodia_ai_conversations SET updated_at='2026-10-15T10:00:00.123456Z' WHERE id=$1",
    [micro1.conversation_id],
  );
  await db.query(
    "UPDATE nodia_ai_conversations SET updated_at='2026-10-15T10:00:00.123457Z' WHERE id=$1",
    [micro2.conversation_id],
  );
  const microPage = await request('?search=Microsecond&page_limit=1', {
    actor: '3',
  });
  const microNext = await request(
    '?search=Microsecond&page_limit=1&cursor=' + microPage.next_cursor,
    { actor: '3' },
  );
  check(
    'conversation cursor preserves PostgreSQL microseconds without skipping a same-millisecond row',
    microPage.items[0].conversation_id === micro2.conversation_id &&
      microNext.items[0].conversation_id === micro1.conversation_id,
  );
  const invalidCursor = JSON.parse(
    Buffer.from(microPage.next_cursor, 'base64url').toString('utf8'),
  );
  invalidCursor.position[1] = '-'.repeat(36);
  await request(
    '?search=Microsecond&page_limit=1&cursor=' +
      Buffer.from(JSON.stringify(invalidCursor)).toString('base64url'),
    { actor: '3', status: 400 },
  );
  checks.push('forged cursor UUID is rejected before PostgreSQL type casting');
  const empty = await create('2', 'Empty expired');
  await db.query(
    'UPDATE nodia_ai_conversations SET expires_at=clock_timestamp() WHERE id=$1',
    [empty.conversation_id],
  );
  await request(`/${empty.conversation_id}`, { actor: '2', status: 410 });
  checks.push('known own expired chat returns 410 immediately before sweep');
  await request(`/${empty.conversation_id}`, { actor: '3', status: 404 });
  checks.push('expired foreign chat returns 404 even to super_admin');
  const ownList = await request('', { actor: '2' });
  check(
    'expired chats are excluded independently of maintenance scheduling',
    ownList.items.every(
      (item) => item.conversation_id !== empty.conversation_id,
    ),
  );
  const queued1 = await create('2', 'Waiting one'),
    queued2 = await create('2', 'Waiting two'),
    queued3 = await create('2', 'Waiting rejected');
  await send(queued1, { actor: '2' });
  await send(queued2, { actor: '2' });
  await send(queued3, { actor: '2', status: 429 });
  check(
    'saturation exposes the policy Retry-After header',
    lastHeaders.get('retry-after') ===
      String(policy.queue.local_retry_after_seconds),
  );
  checks.push(
    'owner waiting limit is atomically enforced across separate conversations',
  );
  const [{ count: rejectedRows }] = await db.query(
    'SELECT count(*)::int count FROM nodia_ai_messages WHERE conversation_id=$1',
    [queued3.conversation_id],
  );
  check(
    'saturation does not leave a message without a runnable admission',
    rejectedRows === 0,
  );
  const racingChats = await Promise.all([
    create('1', 'Queue race one'),
    create('1', 'Queue race two'),
    create('1', 'Queue race three'),
  ]);
  const raceStatuses = await Promise.all(
    racingChats.map(async (racing) => {
      const response = await fetch(
        base + `/${racing.conversation_id}/messages`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-fixture-actor': '1',
          },
          body: JSON.stringify({
            client_message_id: randomUUID(),
            expected_conversation_revision: 1,
            parts: [{ kind: 'text', text: 'Concurrent queue fixture' }],
          }),
        },
      );
      await response.json();
      return response.status;
    }),
  );
  check(
    'concurrent cross-chat admissions do not oversubscribe an owner waiting capacity',
    raceStatuses.sort().join(',') === '202,202,429',
  );
  // Completed historical operation references must not outlive the chat.
  await db.query(
    `INSERT INTO nodia_ai_job_attempts (id,job_id,attempt_no,fence,worker_id,phase,external_operation_ref,started_at,ended_at,stage_key,stage_seq) SELECT $1,id,1,1,$2,'completed','synthetic-completed-ref',clock_timestamp(),clock_timestamp(),'provider',1 FROM nodia_ai_jobs WHERE run_id=$3`,
    [randomUUID(), randomUUID(), first.run.run_id],
  );
  await db.query(
    'UPDATE nodia_ai_conversations SET expires_at=clock_timestamp() WHERE id=$1',
    [chat.conversation_id],
  );
  const Expire = await loadAi(
    'nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case',
    'ExpireNodiaAiConversationsUseCase',
  );
  const purged = await app.get(Expire).execute();
  check(
    'maintenance purges expired chats without browser checks',
    purged.purged_chats >= 2,
  );
  const [{ count: completedResidue }] = await db.query(
    "SELECT count(*)::int count FROM nodia_ai_job_attempts WHERE external_operation_ref='synthetic-completed-ref'",
  );
  check(
    'settled attempts with historical external refs are deleted rather than archived',
    completedResidue === 0,
  );
  await request(`/${chat.conversation_id}`, { status: 404 });
  checks.push('purged own chat becomes 404 without permanent tombstone');
  const [{ count: expiredAudit }] = await db.query(
    'SELECT count(*)::int count FROM nodia_ai_audit_events WHERE conversation_id=$1',
    [chat.conversation_id],
  );
  check('chat audit is removed with expired content', expiredAudit === 0);
  // An active/unknown remote effect only leaves minimal fenced operational work.
  const unknownChat = await create('3', 'Unknown expires');
  const unknownTurn = await send(unknownChat, { actor: '3' });
  const [unknownJob] = await db.query(
    'SELECT * FROM nodia_ai_jobs WHERE run_id=$1',
    [unknownTurn.run.run_id],
  );
  const cleanupId = randomUUID(),
    cleanupGeneration = randomUUID();
  await db.query(
    `INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,storage_key,storage_generation,recovery_descriptor,state,available_at,deadline_at,stage_key,stage_seq)
    VALUES($1,'delete_blob',$2,$3,'synthetic-chat-object',$4,$5,'failed',clock_timestamp(),clock_timestamp()+interval '1 hour','delete_blob',1)`,
    [
      cleanupId,
      'cleanup:' + cleanupId,
      unknownChat.conversation_id,
      cleanupGeneration,
      { synthetic_expired_payload: 'must-disappear' },
    ],
  );
  const worker = randomUUID(),
    resource = 'synthetic-ai10-profile';
  await db.query(
    "UPDATE nodia_ai_jobs SET state='unknown',fence=1,attempt_count=1 WHERE id=$1",
    [unknownJob.id],
  );
  await db.query(
    `INSERT INTO nodia_ai_runtime_slots(resource_key,state,conversation_id,job_id,holder_worker_id,fence,lease_until,external_operation_ref) VALUES($1,'held',$2,$3,$4,1,clock_timestamp()+interval '30s','synthetic-unknown-ref')`,
    [resource, unknownChat.conversation_id, unknownJob.id, worker],
  );
  await db.query(
    `INSERT INTO nodia_ai_job_attempts(id,job_id,attempt_no,fence,worker_id,phase,external_operation_ref,started_at,stage_key,stage_seq,runtime_resource_key,runtime_fence,selection_snapshot,routing_phase) VALUES($1,$2,1,1,$3,'unknown','synthetic-unknown-ref',clock_timestamp(),'provider',1,$4,1,$5,'base')`,
    [randomUUID(), unknownJob.id, worker, resource, selection],
  );
  await db.query(
    'UPDATE nodia_ai_conversations SET expires_at=clock_timestamp() WHERE id=$1',
    [unknownChat.conversation_id],
  );
  const unknownPurge = await app.get(Expire).execute();
  check(
    'unknown effect does not prevent chat content purge',
    unknownPurge.purged_chats === 1 && unknownPurge.unresolved_jobs === 2,
  );
  const [cleanup] = await db.query('SELECT * FROM nodia_ai_jobs WHERE id=$1', [
    cleanupId,
  ]);
  check(
    'failed object cleanup survives purge with exact storage generation and no expired descriptor content',
    cleanup.kind === 'delete_blob' &&
      cleanup.state === 'failed' &&
      cleanup.conversation_id === null &&
      cleanup.storage_key === 'synthetic-chat-object' &&
      cleanup.storage_generation === cleanupGeneration &&
      cleanup.recovery_descriptor.synthetic_expired_payload === undefined,
  );
  const [orphan] = await db.query('SELECT * FROM nodia_ai_jobs WHERE id=$1', [
    unknownJob.id,
  ]);
  check(
    'unknown job detaches from payload and remains non-dispatchable with higher fence',
    orphan.state === 'unknown' &&
      orphan.run_id === null &&
      orphan.conversation_id === null &&
      orphan.fence === '2' &&
      orphan.recovery_descriptor.schema_version === 1 &&
      Object.keys(orphan.recovery_descriptor).sort().join(',') ===
        'job_id,reason,retention_epoch,schema_version',
  );
  const [slot] = await db.query(
    'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [resource],
  );
  check(
    'runtime stays quarantined and fenced without chat or job reference',
    slot.state === 'unknown' &&
      slot.fence === '2' &&
      slot.job_id === null &&
      slot.conversation_id === null &&
      slot.external_operation_ref === 'synthetic-unknown-ref',
  );
  const [attempt] = await db.query(
    'SELECT * FROM nodia_ai_job_attempts WHERE job_id=$1',
    [unknownJob.id],
  );
  check(
    'unresolved attempt keeps only operational references and discards model selection',
    attempt.selection_snapshot === null &&
      attempt.routing_phase === null &&
      attempt.external_operation_ref === 'synthetic-unknown-ref',
  );
  const [{ count: payloadRows }] = await db.query(
    'SELECT count(*)::int count FROM nodia_ai_messages WHERE conversation_id=$1',
    [unknownChat.conversation_id],
  );
  check('unknown recovery does not retain messages', payloadRows === 0);
  // A read waiting on a lock must use current server time after acquiring it.
  const blocked = await create('3', 'Clock boundary');
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(
      'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE',
      [blocked.conversation_id],
    );
    const response = request(`/${blocked.conversation_id}`, {
      actor: '3',
      status: 410,
    }).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    let waiting = false;
    for (let i = 0; i < 50; i++) {
      const [wait] = await db.query(
        "SELECT count(*)::int count FROM pg_stat_activity WHERE wait_event_type='Lock' AND datname=current_database() AND pid<>pg_backend_pid()",
      );
      if (wait.count > 0) {
        waiting = true;
        break;
      }
      await delay(10);
    }
    assert.ok(
      waiting,
      'Read reached the PostgreSQL lock before expiry changed',
    );
    await runner.query(
      'UPDATE nodia_ai_conversations SET expires_at=clock_timestamp() WHERE id=$1',
      [blocked.conversation_id],
    );
    await runner.commitTransaction();
    const blockedResult = await response;
    if (blockedResult.error) throw blockedResult.error;
    checks.push(
      'expiry is checked with a fresh clock after waiting on the chat lock',
    );
  } finally {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.release();
  }
  await db.query(
    'UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE public_id=$1',
    [identities.get('1').sessionId],
  );
  await request('', { status: 401 });
  checks.push(
    'current database session revocation rejects even a fixture guard identity',
  );
  console.log(
    JSON.stringify({
      task: 'AI-10',
      scope: 'compiled_http_and_disposable_postgresql16_synthetic_preparer',
      checks: checks.length,
      passed: checks,
      configuredDatabaseTouched: false,
      providersCalled: false,
      syntheticAdapter: true,
    }),
  );
} finally {
  if (app) await app.close();
  await fixture.close();
}
