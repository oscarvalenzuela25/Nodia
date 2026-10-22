// Compiled ESM/Nest and disposable PostgreSQL16. No configured DB or provider.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  copyFile,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  rmdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Must precede application imports: never resolve the workspace .env.
process.env.DOTENV_CONFIG_PATH =
  process.platform === 'win32' ? 'NUL' : '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';

const load = async (file, name) =>
  (await import('../dist/' + file + '.js'))[name];
const container = `template_ai09_${process.pid}_${randomBytes(4).toString('hex')}`;
const password = randomBytes(20).toString('hex');
const migrationName = 'CreateNodiaAiConversationPersistence1792200000000';
const tableNames = [
  'nodia_ai_conversations',
  'nodia_ai_messages',
  'nodia_ai_message_parts',
  'nodia_ai_runs',
  'nodia_ai_tool_calls',
  'nodia_ai_events',
  'nodia_ai_jobs',
  'nodia_ai_job_attempts',
  'nodia_ai_execution_grants',
  'nodia_ai_runtime_slots',
  'nodia_ai_audit_events',
].sort();
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const checks = [];
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
};
const denies = async (name, operation, status) => {
  await assert.rejects(
    operation,
    (error) => error.getStatus?.() === status,
    name,
  );
  checks.push(name);
};
const rejectsSql = async (name, operation, code) => {
  await assert.rejects(operation, (error) => error.code === code, name);
  checks.push(name);
};
const identities = new Map(
  ['1', '2', '3'].map((userId) => [
    userId,
    {
      userId,
      sessionId: randomUUID(),
    },
  ]),
);
let db,
  app,
  started = false;
const runners = [];
const identifiers = (names) =>
  names.map((name) => {
    assert.match(name, /^[a-z_][a-z0-9_]*$/);
    return '"' + name + '"';
  });
async function insert(table, values, manager = db.manager) {
  assert(tableNames.includes(table));
  const columns = Object.keys(values);
  const rows = await manager.query(
    `INSERT INTO "${table}" (${identifiers(columns).join(',')}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
    Object.values(values).map((value) =>
      Array.isArray(value) ? JSON.stringify(value) : value,
    ),
  );
  return rows[0];
}
async function schemaSnapshot() {
  const columns = await db.query(
    `SELECT c.table_name,c.column_name,c.ordinal_position,
    c.data_type,c.udt_name,c.is_nullable,c.column_default,c.character_maximum_length
    FROM information_schema.columns c WHERE c.table_schema='public'
    AND c.table_name=ANY($1::text[]) ORDER BY c.table_name,c.ordinal_position`,
    [tableNames],
  );
  const constraints = await db.query(
    `SELECT r.relname AS table_name,c.conname,
    c.contype,c.condeferrable,c.condeferred,pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'
    AND r.relname=ANY($1::text[]) ORDER BY r.relname,c.conname`,
    [tableNames],
  );
  const indexes = await db.query(
    `SELECT tablename,indexname,indexdef FROM pg_indexes
    WHERE schemaname='public' AND tablename=ANY($1::text[])
    ORDER BY tablename,indexname`,
    [tableNames],
  );
  return { columns, constraints, indexes };
}

async function checkPolicyPackaging() {
  // Exercise emitted code in its own directory without mutating dist used by other checks.
  const temp = await mkdtemp(join(tmpdir(), 'nodia_ai09_policy_'));
  const loader = join(temp, 'conversation-policy.mjs');
  const asset = join(temp, 'conversation-policy.json');
  try {
    await copyFile(
      new URL(
        '../dist/nodia-ai-conversation/config/conversation-policy.js',
        import.meta.url,
      ),
      loader,
    );
    const bytes = await readFile(
      new URL(
        '../dist/nodia-ai-conversation/config/conversation-policy.json',
        import.meta.url,
      ),
    );
    await writeFile(asset, bytes);
    const { loadNodiaAiConversationPolicy: loadPolicy } = await import(
      pathToFileURL(loader).href
    );
    const valid = loadPolicy();
    check(
      'compiled policy asset loads an immutable verified contract',
      Object.isFrozen(valid) && typeof valid.policyHash === 'string',
    );
    await rm(asset);
    assert.throws(
      () => loadPolicy(),
      /nodia_ai_conversation_policy_unavailable/,
    );
    checks.push('missing packaged runtime policy fails closed');
    await writeFile(asset, '{');
    assert.throws(
      () => loadPolicy(),
      /nodia_ai_conversation_policy_unavailable/,
    );
    checks.push('invalid packaged policy JSON fails closed');
    const value = JSON.parse(bytes.toString('utf8'));
    await writeFile(
      asset,
      JSON.stringify({ ...value, retentionDays: value.retentionDays + 1 }),
    );
    assert.throws(
      () => loadPolicy(),
      /nodia_ai_conversation_policy_unavailable/,
    );
    checks.push('policy content tampering fails its package checksum');
    await writeFile(asset, JSON.stringify({ ...value, injected: true }));
    assert.throws(
      () => loadPolicy(),
      /nodia_ai_conversation_policy_unavailable/,
    );
    checks.push('unexpected packaged policy fields fail closed');
  } finally {
    await rm(asset, { force: true });
    await rm(loader, { force: true });
    await rmdir(temp);
  }
}

try {
  await checkPolicyPackaging();
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-p',
    '127.0.0.1::5432',
    '-e',
    'POSTGRES_USER=ai09',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    'POSTGRES_DB=ai09',
    'postgres:16-alpine',
  );
  started = true;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'ai09');
      break;
    } catch (error) {
      if (attempt === 79) throw error;
      await delay(250);
    }
  }
  const options = {
    type: 'postgres',
    host: '127.0.0.1',
    port: Number(docker('port', container, '5432/tcp').split(':').at(-1)),
    username: 'ai09',
    password,
    database: 'ai09',
    synchronize: false,
    entities: [
      fileURLToPath(new URL('../dist/**/*.entity.js', import.meta.url)),
    ],
    migrations: [
      fileURLToPath(new URL('../dist/migrations/*.js', import.meta.url)),
    ],
  };
  db = await new DataSource(options).initialize();
  const migrated = await db.runMigrations();
  assert.equal(migrated.at(-1)?.name, migrationName);
  check(
    'complete real migration history installs M1 after existing products',
    migrated.length > 1,
  );
  const snapshot = await schemaSnapshot();
  assert.deepEqual(
    [...new Set(snapshot.columns.map((row) => row.table_name))].sort(),
    tableNames,
  );
  checks.push('M1 creates exactly eleven tables without future feature tables');
  for (const table of tableNames) {
    assert.equal(
      snapshot.constraints.filter(
        (row) => row.table_name === table && row.contype === 'p',
      ).length,
      1,
      table,
    );
  }
  checks.push('all eleven tables have actual PostgreSQL primary keys');
  check(
    'same-chat and authority foreign keys exist in PostgreSQL',
    snapshot.constraints.filter((row) => row.contype === 'f').length >= 15,
  );
  check(
    'state and shape checks exist in PostgreSQL',
    snapshot.constraints.filter((row) => row.contype === 'c').length >= 11,
  );
  check(
    'claim and retention indexes include partial predicates',
    snapshot.indexes.filter((row) => row.indexdef.includes(' WHERE ')).length >=
      2,
  );
  const forbiddenColumns = new Set([
    'execution_id',
    'attachment_id',
    'context_snapshot_id',
    'adapter_state_id',
  ]);
  check(
    'future M2/M3/M4/provider references are absent',
    snapshot.columns.every((row) => !forbiddenColumns.has(row.column_name)),
  );
  for (const table of tableNames) {
    const emittedColumns = db
      .getMetadata(table)
      .columns.map((column) => column.databaseName)
      .sort();
    const actualColumns = snapshot.columns
      .filter((column) => column.table_name === table)
      .map((column) => column.column_name)
      .sort();
    assert.deepEqual(emittedColumns, actualColumns, table);
  }
  checks.push(
    'all eleven compiled ORM entities match their actual migrated column sets',
  );

  for (const [id, actor] of identities) {
    await db.query('INSERT INTO users(id,email,name) VALUES($1,$2,$3)', [
      id,
      `synthetic${id}@example.invalid`,
      'Synthetic ' + id,
    ]);
    await db.query(
      "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'synthetic',now()+interval '1 hour')",
      [actor.sessionId, id],
    );
  }
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT 3,id FROM roles WHERE key='super_admin'",
  );
  await db.query(
    "INSERT INTO user_modules(user_id,module_id) SELECT u.id,m.id FROM users u CROSS JOIN modules m WHERE m.key='nodia_ai'",
  );

  const moduleRefs = await Promise.all(
    [
      ['nodia-ai/nodia-ai.module', 'NodiaAiModule'],
      [
        'nodia-ai-conversation/nodia-ai-conversation.module',
        'NodiaAiConversationModule',
      ],
      ['nodia-ai-run/nodia-ai-run.module', 'NodiaAiRunModule'],
      ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ].map(([file, name]) => load(file, name)),
  );
  const CreateConversation = await load(
    'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
    'CreateNodiaAiConversationUseCase',
  );
  class IsolatedRoot {}
  Module({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      ...moduleRefs,
    ],
  })(IsolatedRoot);
  app = await NestFactory.createApplicationContext(IsolatedRoot, {
    logger: false,
  });
  const create = app.get(CreateConversation);
  check(
    'compiled ESM imports all eleven entities and resolves four Nest modules',
    typeof create.execute === 'function',
  );
  const command = {
    client_request_id: randomUUID(),
    title: 'Synthetic persisted chat',
  };
  const chat = await create.execute(identities.get('1'), command);
  const [storedChat] = await db.query(
    'SELECT * FROM nodia_ai_conversations WHERE id=$1',
    [chat.conversation_id],
  );
  check(
    'internal create persists its authenticated owner and initial revision',
    storedChat.owner_id === '1' && storedChat.revision === 1,
  );
  check(
    'new chat has no invented model or provider',
    storedChat.selected_connection_id === null &&
      storedChat.selected_mode === null &&
      storedChat.selected_model_id === null,
  );
  check(
    'new chat disables Agentic delegation by default',
    storedChat.routing_enabled === false && chat.routing.enabled === false,
  );
  const initialLifetime =
    storedChat.expires_at.getTime() - storedChat.created_at.getTime();
  check(
    'new chat expiration is ninety days from server creation',
    initialLifetime === 90 * 24 * 60 * 60 * 1000,
  );
  const duplicate = await create.execute(identities.get('1'), command);
  check(
    'identical create request recovers the persisted chat',
    duplicate.conversation_id === chat.conversation_id,
  );
  await denies(
    'same request key cannot replace an existing chat title',
    () => create.execute(identities.get('1'), { ...command, title: 'Changed' }),
    409,
  );
  const racing = {
    client_request_id: randomUUID(),
    title: 'Concurrent create',
  };
  const [first, second] = await Promise.all([
    create.execute(identities.get('1'), racing),
    create.execute(identities.get('1'), racing),
  ]);
  assert.equal(first.conversation_id, second.conversation_id);
  const [count] = await db.query(
    'SELECT count(*)::int AS count FROM nodia_ai_conversations WHERE owner_id=1 AND client_request_id=$1',
    [racing.client_request_id],
  );
  check(
    'two concurrent identical creates commit one row and recover one identity',
    count.count === 1,
  );
  const conflictKey = randomUUID();
  const conflicting = await Promise.allSettled([
    create.execute(identities.get('1'), {
      client_request_id: conflictKey,
      title: 'First payload',
    }),
    create.execute(identities.get('1'), {
      client_request_id: conflictKey,
      title: 'Second payload',
    }),
  ]);
  check(
    'concurrent reuse with different payload commits one intent and rejects the other',
    conflicting.filter((result) => result.status === 'fulfilled').length ===
      1 &&
      conflicting.some(
        (result) =>
          result.status === 'rejected' && result.reason.getStatus?.() === 409,
      ),
  );
  const other = await create.execute(identities.get('2'), command);
  check(
    'request keys are scoped by owner',
    other.conversation_id !== chat.conversation_id,
  );
  const admin = await create.execute(identities.get('3'), {
    client_request_id: randomUUID(),
  });
  const [adminStored] = await db.query(
    'SELECT owner_id FROM nodia_ai_conversations WHERE id=$1',
    [admin.conversation_id],
  );
  check(
    'super_admin creation retains its actual owner without impersonation',
    adminStored.owner_id === '3',
  );
  for (const [name, input] of [
    ['untrusted owner', { client_request_id: randomUUID(), owner_id: '2' }],
    [
      'multibyte title exceeding UTF-8 budget',
      { client_request_id: randomUUID(), title: 'á'.repeat(129) },
    ],
    [
      'incomplete selection',
      {
        client_request_id: randomUUID(),
        selection: { mode: 'token_plan_web' },
      },
    ],
    [
      'unexpected credential',
      {
        client_request_id: randomUUID(),
        selection: {
          connection_id: '1',
          mode: 'token_plan_web',
          model_id: 'synthetic-model',
          api_key: 'synthetic-forbidden',
        },
      },
    ],
    ['null request', null],
  ]) {
    await denies(
      'internal create rejects ' + name,
      () => create.execute(identities.get('1'), input),
      400,
    );
  }
  await db.query(
    "UPDATE user_modules SET is_active=false WHERE user_id=2 AND module_id=(SELECT id FROM modules WHERE key='nodia_ai')",
  );
  await denies(
    'revoked NodiaAI module denies a new internal create',
    () =>
      create.execute(identities.get('2'), { client_request_id: randomUUID() }),
    403,
  );
  await db.query(
    'UPDATE auth_sessions SET revoked_at=now() WHERE public_id=$1',
    [identities.get('1').sessionId],
  );
  await denies(
    'revoked Nodia session denies a new internal create',
    () =>
      create.execute(identities.get('1'), { client_request_id: randomUUID() }),
    401,
  );
  await db.query(
    'UPDATE auth_sessions SET revoked_at=NULL WHERE public_id=$1',
    [identities.get('1').sessionId],
  );

  const [provider] = await db.query(
    "INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI09 connection','{}') RETURNING id",
  );
  const selection = {
    connection_id: provider.id,
    mode: 'token_plan_web',
    model_id: 'synthetic-discovered-model',
    effort_id: 'synthetic-discovered-effort',
  };
  const selected = await create.execute(identities.get('1'), {
    client_request_id: randomUUID(),
    selection,
  });
  check(
    'exact configured connection mode model and effort survive persistence',
    JSON.stringify(selected.selection) === JSON.stringify(selection),
  );
  const target = {
    selection: { ...selection, mode: 'token_plan_agentic' },
    configuration_generation: 'synthetic-config-generation',
    session_generation: 'synthetic-session-generation',
  };
  await db.query(
    'UPDATE nodia_ai_conversations SET routing_enabled=true,routing_target_selection=$1,routing_revision=2 WHERE id=$2',
    [target, selected.conversation_id],
  );
  await db.query(
    "UPDATE nodia_ai_conversations SET selected_mode='token_plan_agentic' WHERE id=$1",
    [selected.conversation_id],
  );
  const [preservedRouting] = await db.query(
    'SELECT routing_enabled,routing_revision FROM nodia_ai_conversations WHERE id=$1',
    [selected.conversation_id],
  );
  check(
    'changing the base mode can preserve a previously stored routing preference',
    preservedRouting.routing_enabled === true &&
      preservedRouting.routing_revision === 2,
  );
  await rejectsSql(
    'enabled routing cannot omit its same-connection target identity',
    () =>
      db.query(
        'UPDATE nodia_ai_conversations SET routing_target_selection=$1 WHERE id=$2',
        [
          {
            ...target,
            selection: {
              mode: 'token_plan_agentic',
              model_id: selection.model_id,
              effort_id: null,
            },
          },
          selected.conversation_id,
        ],
      ),
    '23514',
  );
  await db.query(
    "UPDATE nodia_ai_conversations SET selected_mode='token_plan_web' WHERE id=$1",
    [selected.conversation_id],
  );
  const policy = JSON.parse(
    await readFile(
      new URL(
        '../../docs/mvp/nodia-ai-v1-runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const budget = {
    schema_version: 1,
    tool_calls: policy.budget.tool_calls_per_run,
    mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run,
    provider_dispatches: policy.budget.provider_dispatches_per_run,
    compactions: policy.budget.compactions_per_run,
    delegations: policy.budget.delegations_per_run,
  };
  const now = new Date();
  const deadline = new Date(now.getTime() + policy.timing.run_seconds * 1000);
  const hash = 'a'.repeat(64);
  const scope = { schema_version: 1, scopes: [] };
  const routing = {
    schema_version: 1,
    enabled: false,
    revision: 1,
    target: null,
  };
  const messageValues = (conversation_id, seq = '1') => ({
    id: randomUUID(),
    conversation_id,
    seq,
    role: 'user',
    author_id: '1',
    client_message_id: randomUUID(),
    status: 'sealed',
    source_scope_manifest: scope,
    sealed_at: now,
    input_hash: hash,
  });
  const message = await insert(
    'nodia_ai_messages',
    messageValues(chat.conversation_id),
  );
  const part = {
    message_id: message.id,
    conversation_id: chat.conversation_id,
    part_index: 0,
    kind: 'text',
    text: 'Synthetic canonical text',
  };
  await insert('nodia_ai_message_parts', part);
  const runValues = (conversation_id, user_message_id) => ({
    id: randomUUID(),
    conversation_id,
    actor_id: '1',
    user_message_id,
    connection_id: provider.id,
    selection_snapshot: selection,
    catalog_version: 'synthetic-catalog-release',
    policy_version: policy.policy_version,
    policy_hash: hash,
    routing_snapshot: routing,
    budget_snapshot: budget,
    input_through_seq: '1',
    state: 'queued',
    phase: 'base',
    deadline_at: deadline,
    retention_epoch: '1',
    context_manifest: { schema_version: 1, sources: [] },
  });
  const run = await insert(
    'nodia_ai_runs',
    runValues(chat.conversation_id, message.id),
  );
  const jobValues = (conversation_id, run_id) => ({
    id: randomUUID(),
    kind: 'turn',
    dedup_key: 'synthetic:' + randomUUID(),
    conversation_id,
    run_id,
    state: 'ready',
    available_at: now,
    deadline_at: deadline,
    stage_key: 'provider_dispatch',
  });
  const job = await insert(
    'nodia_ai_jobs',
    jobValues(chat.conversation_id, run.id),
  );
  await db.query(
    'UPDATE nodia_ai_conversations SET active_job_id=$1 WHERE id=$2',
    [job.id, chat.conversation_id],
  );
  const call = await insert('nodia_ai_tool_calls', {
    id: randomUUID(),
    conversation_id: chat.conversation_id,
    run_id: run.id,
    adapter_call_id: 'synthetic-call',
    tool_name: 'synthetic.read',
    contract_hash: hash,
    arguments_hash: hash,
    arguments: {},
    scope_manifest: scope,
    state: 'completed',
    public_result: { schema_version: 1, empty: true },
    completed_at: now,
  });
  await insert('nodia_ai_events', {
    id: randomUUID(),
    conversation_id: chat.conversation_id,
    seq: '1',
    event_key: 'synthetic-event',
    run_id: run.id,
    public_payload: { schema_version: 1, kind: 'synthetic' },
    scope_manifest: scope,
  });
  await insert('nodia_ai_execution_grants', {
    id: randomUUID(),
    actor_id: '1',
    session_public_id: identities.get('1').sessionId,
    run_id: run.id,
    allowed_modules: [],
    allowed_operations: [],
    allowed_scope: scope,
    policy_version: policy.policy_version,
    expires_at: deadline,
  });
  const runtimeKey = 'synthetic/isolated-profile/' + randomUUID();
  await insert('nodia_ai_runtime_slots', {
    resource_key: runtimeKey,
    state: 'held',
    conversation_id: chat.conversation_id,
    job_id: job.id,
    holder_worker_id: randomUUID(),
    fence: '1',
    lease_until: deadline,
  });
  await insert('nodia_ai_job_attempts', {
    id: randomUUID(),
    job_id: job.id,
    attempt_no: 1,
    fence: '1',
    worker_id: randomUUID(),
    phase: 'dispatch_armed',
    started_at: now,
    runtime_resource_key: runtimeKey,
    runtime_fence: '1',
    stage_key: 'provider_dispatch',
    stage_seq: 1,
    selection_snapshot: selection,
    routing_phase: 'base',
  });
  await insert('nodia_ai_audit_events', {
    id: randomUUID(),
    actor_id: '1',
    session_public_id: identities.get('1').sessionId,
    conversation_id: chat.conversation_id,
    event_key: 'synthetic_fixture',
    correlation_id: randomUUID(),
    minimal_details: { schema_version: 1, code: 'synthetic' },
  });
  checks.push(
    'all eleven M1 tables accept a coherent synthetic conversation graph',
  );
  const originalSeq = '9007199254740993';
  await insert(
    'nodia_ai_messages',
    messageValues(chat.conversation_id, originalSeq),
  );
  const [largeSeq] = await db.query(
    'SELECT seq FROM nodia_ai_messages WHERE conversation_id=$1 AND seq=$2',
    [chat.conversation_id, originalSeq],
  );
  check(
    'bigint message sequences retain exact precision beyond Number safety',
    largeSeq.seq === originalSeq,
  );

  await rejectsSql(
    'message parts cannot point across conversations',
    () =>
      insert('nodia_ai_message_parts', {
        ...part,
        conversation_id: other.conversation_id,
        part_index: 1,
      }),
    '23503',
  );
  const foreignMessage = await insert('nodia_ai_messages', {
    ...messageValues(other.conversation_id),
    author_id: '2',
  });
  await rejectsSql(
    'runs cannot reference an input from another conversation',
    () =>
      insert(
        'nodia_ai_runs',
        runValues(admin.conversation_id, foreignMessage.id),
      ),
    '23503',
  );
  await rejectsSql(
    'tool calls cannot associate a run from another conversation',
    () =>
      insert('nodia_ai_tool_calls', {
        ...call,
        id: randomUUID(),
        conversation_id: other.conversation_id,
        adapter_call_id: 'foreign',
      }),
    '23503',
  );
  await rejectsSql(
    'active job cannot come from another conversation',
    () =>
      db.query(
        'UPDATE nodia_ai_conversations SET active_job_id=$1 WHERE id=$2',
        [job.id, other.conversation_id],
      ),
    '23503',
  );
  await rejectsSql(
    'jobs cannot associate a run from another conversation',
    () => insert('nodia_ai_jobs', jobValues(other.conversation_id, run.id)),
    '23503',
  );
  await rejectsSql(
    'events cannot expose a run from another conversation',
    () =>
      insert('nodia_ai_events', {
        id: randomUUID(),
        conversation_id: other.conversation_id,
        seq: '1',
        event_key: 'synthetic-foreign-event',
        run_id: run.id,
        public_payload: { schema_version: 1, kind: 'synthetic' },
        scope_manifest: scope,
      }),
    '23503',
  );
  await rejectsSql(
    'runtime slots cannot bind a job from another conversation',
    () =>
      insert('nodia_ai_runtime_slots', {
        resource_key: 'synthetic/foreign-profile/' + randomUUID(),
        state: 'unknown',
        conversation_id: other.conversation_id,
        job_id: job.id,
      }),
    '23503',
  );
  await rejectsSql(
    'one adapter call identity is unique inside a run',
    () => insert('nodia_ai_tool_calls', { ...call, id: randomUUID() }),
    '23505',
  );
  await rejectsSql(
    'canonical message sequence is unique inside a conversation',
    () => insert('nodia_ai_messages', messageValues(chat.conversation_id)),
    '23505',
  );
  await rejectsSql(
    'M1 rejects attachments until their migration exists',
    () =>
      insert('nodia_ai_message_parts', {
        ...part,
        part_index: 1,
        kind: 'image',
      }),
    '23514',
  );
  await rejectsSql(
    'M1 bounds UTF-8 text before persistence',
    () =>
      insert('nodia_ai_message_parts', {
        ...part,
        part_index: 1,
        text: 'á'.repeat(16385),
      }),
    '23514',
  );
  await rejectsSql(
    'M1 bounds message part cardinality',
    () => insert('nodia_ai_message_parts', { ...part, part_index: 8 }),
    '23514',
  );
  await rejectsSql(
    'message author and request identity cannot be omitted',
    () =>
      insert('nodia_ai_messages', {
        ...messageValues(chat.conversation_id, '3'),
        author_id: null,
      }),
    '23514',
  );
  await rejectsSql(
    'conversation selection cannot contain only a model',
    () =>
      db.query(
        'UPDATE nodia_ai_conversations SET selected_model_id=$1 WHERE id=$2',
        ['synthetic-orphan-model', admin.conversation_id],
      ),
    '23514',
  );
  await rejectsSql(
    'turn counters cannot exceed their persisted policy budget',
    () =>
      db.query('UPDATE nodia_ai_runs SET tool_calls_used=$1 WHERE id=$2', [
        budget.tool_calls + 1,
        run.id,
      ]),
    '23514',
  );
  await rejectsSql(
    'JSON null cannot disable the durable budget boundary',
    () =>
      db.query(
        "UPDATE nodia_ai_runs SET budget_snapshot=jsonb_set(budget_snapshot,'{tool_calls}','null') WHERE id=$1",
        [run.id],
      ),
    '23514',
  );
  await rejectsSql(
    'malformed scope arrays cannot enter object columns',
    () =>
      db.query(
        "UPDATE nodia_ai_messages SET source_scope_manifest='[]' WHERE id=$1",
        [message.id],
      ),
    '23514',
  );
  await rejectsSql(
    'leases require actual holder identity and fence',
    () =>
      db.query("UPDATE nodia_ai_jobs SET state='leased' WHERE id=$1", [job.id]),
    '23514',
  );
  await rejectsSql(
    'free runtime slot cannot retain active holder state',
    () =>
      db.query(
        "UPDATE nodia_ai_runtime_slots SET state='free' WHERE resource_key=$1",
        [runtimeKey],
      ),
    '23514',
  );
  await rejectsSql(
    'duplicate attempt fence cannot create a second delivery',
    () =>
      insert('nodia_ai_job_attempts', {
        id: randomUUID(),
        job_id: job.id,
        attempt_no: 2,
        fence: '1',
        worker_id: randomUUID(),
        phase: 'queued',
        started_at: now,
        stage_key: 'provider_dispatch',
        stage_seq: 1,
      }),
    '23505',
  );

  const deferredRunner = db.createQueryRunner();
  runners.push(deferredRunner);
  await deferredRunner.connect();
  await deferredRunner.startTransaction();
  const cycleJob = jobValues(admin.conversation_id, null);
  cycleJob.kind = 'expire_chat';
  await deferredRunner.query(
    'UPDATE nodia_ai_conversations SET active_job_id=$1 WHERE id=$2',
    [cycleJob.id, admin.conversation_id],
  );
  await insert('nodia_ai_jobs', cycleJob, deferredRunner.manager);
  await deferredRunner.commitTransaction();
  checks.push(
    'deferred same-chat active-job cycle can commit as one coherent set',
  );
  const rollbackId = randomUUID();
  await assert.rejects(
    () =>
      db.transaction(async (manager) => {
        await insert(
          'nodia_ai_messages',
          {
            ...messageValues(admin.conversation_id),
            id: rollbackId,
            author_id: '3',
          },
          manager,
        );
        await insert(
          'nodia_ai_message_parts',
          {
            message_id: rollbackId,
            conversation_id: admin.conversation_id,
            part_index: 0,
            kind: 'text',
            text: 'Rolled back',
          },
          manager,
        );
        throw new Error('Synthetic transaction failure');
      }),
    /Synthetic transaction failure/,
  );
  const [rolledBack] = await db.query(
    'SELECT count(*)::int AS count FROM nodia_ai_messages WHERE id=$1',
    [rollbackId],
  );
  check(
    'failed transaction removes both canonical message and its parts',
    rolledBack.count === 0,
  );

  await db.query('DELETE FROM ai_providers WHERE id=$1', [provider.id]);
  const [historicalChat] = await db.query(
    'SELECT * FROM nodia_ai_conversations WHERE id=$1',
    [selected.conversation_id],
  );
  const [historicalRun] = await db.query(
    'SELECT connection_id,selection_snapshot FROM nodia_ai_runs WHERE id=$1',
    [run.id],
  );
  check(
    'deleted provider leaves historical selection unavailable without changing model',
    historicalChat.selected_connection_id === null &&
      historicalChat.selected_mode === selection.mode &&
      historicalChat.selected_model_id === selection.model_id &&
      historicalRun.connection_id === null &&
      historicalRun.selection_snapshot.model_id === selection.model_id,
  );

  // Retention protocol removes settled work before deleting its owning chat.
  await db.query(
    'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1',
    [chat.conversation_id],
  );
  const cleanup = await insert('nodia_ai_jobs', {
    ...jobValues(chat.conversation_id, null),
    kind: 'delete_blob',
    state: 'waiting',
    storage_key: 'synthetic-private-object/' + randomUUID(),
    storage_generation: randomUUID(),
    stage_key: 'delete_blob',
  });
  await db.query(
    "UPDATE nodia_ai_runtime_slots SET state='unknown' WHERE resource_key=$1",
    [runtimeKey],
  );
  await db.query(
    "UPDATE nodia_ai_jobs SET state='unknown',recovery_descriptor=$1 WHERE id=$2",
    [
      {
        schema_version: 1,
        kind: 'synthetic-reconciliation',
        operation_ref: randomUUID(),
      },
      job.id,
    ],
  );
  await rejectsSql(
    'chat deletion requires explicit handling of independent cleanup work',
    () =>
      db.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [
        chat.conversation_id,
      ]),
    '23503',
  );
  await db.transaction(async (manager) => {
    await manager.query(
      'UPDATE nodia_ai_jobs SET conversation_id=NULL WHERE id=$1',
      [cleanup.id],
    );
    await manager.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [
      chat.conversation_id,
    ]);
  });
  for (const table of [
    'nodia_ai_messages',
    'nodia_ai_message_parts',
    'nodia_ai_runs',
    'nodia_ai_tool_calls',
    'nodia_ai_events',
    'nodia_ai_audit_events',
  ]) {
    const [row] = await db.query(
      `SELECT count(*)::int AS count FROM "${table}" WHERE conversation_id=$1`,
      [chat.conversation_id],
    );
    assert.equal(row.count, 0, table);
  }
  checks.push(
    'purging a chat cascades canonical content runs tool results events and chat audit',
  );
  const [remainingGrant] = await db.query(
    'SELECT count(*)::int AS count FROM nodia_ai_execution_grants WHERE run_id=$1',
    [run.id],
  );
  check(
    'chat purge removes its turn grant rather than retaining authority',
    remainingGrant.count === 0,
  );
  const [remainingJob] = await db.query(
    'SELECT * FROM nodia_ai_jobs WHERE id=$1',
    [job.id],
  );
  const [remainingSlot] = await db.query(
    'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [runtimeKey],
  );
  check(
    'uncertain reconciliation work survives with detached chat/run and minimal identity',
    remainingJob.conversation_id === null &&
      remainingJob.run_id === null &&
      remainingJob.state === 'unknown' &&
      remainingJob.recovery_descriptor.operation_ref,
  );
  check(
    'uncertain runtime remains quarantined after its chat content disappears',
    remainingSlot.conversation_id === null &&
      remainingSlot.state === 'unknown' &&
      remainingSlot.resource_key === runtimeKey,
  );
  const [remainingCleanup] = await db.query(
    'SELECT * FROM nodia_ai_jobs WHERE id=$1',
    [cleanup.id],
  );
  check(
    'explicit detach preserves only independent cleanup identity after chat purge',
    remainingCleanup.conversation_id === null &&
      remainingCleanup.storage_key === cleanup.storage_key &&
      remainingCleanup.storage_generation === cleanup.storage_generation,
  );
  await db.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [job.id]);
  const [remainingAttempt] = await db.query(
    'SELECT count(*)::int AS count FROM nodia_ai_job_attempts WHERE job_id=$1',
    [job.id],
  );
  check(
    'settled work deletion removes delivery attempts',
    remainingAttempt.count === 0,
  );
  await db.query('DELETE FROM nodia_ai_runtime_slots WHERE resource_key=$1', [
    runtimeKey,
  ]);
  await db.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [cleanup.id]);

  await db.undoLastMigration();
  const [{ count: removedTables }] = await db.query(
    "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'nodia_ai_%'",
  );
  check(
    'M1 down removes all eleven owned tables with populated synthetic data',
    removedTables === 0,
  );
  const [preservedOwner] = await db.query(
    'SELECT count(*)::int AS count FROM users WHERE id IN(1,2,3)',
  );
  check(
    'M1 down preserves pre-existing user and product schema',
    preservedOwner.count === 3,
  );
  const appliedAgain = await db.runMigrations();
  assert.deepEqual(
    appliedAgain.map((migration) => migration.name),
    [migrationName],
  );
  assert.deepEqual(await schemaSnapshot(), snapshot);
  checks.push(
    'up/down/up reproduces identical columns defaults constraints and indexes',
  );
  const afterRollback = await create.execute(identities.get('1'), {
    client_request_id: randomUUID(),
    title: 'After reversible installation',
  });
  check(
    'compiled persistence port remains usable after migration roundtrip',
    typeof afterRollback.conversation_id === 'string',
  );
  console.log(
    JSON.stringify({
      task: 'AI-09',
      scope: 'compiled_internal_use_cases_and_disposable_postgresql16',
      checks: checks.length,
      passed: checks,
      configuredDatabaseTouched: false,
      providersCalled: false,
      httpEndpointsPublished: false,
      runtimeDispatched: false,
    }),
  );
} finally {
  for (const runner of runners) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.release();
  }
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
  if (started) docker('rm', '-f', container);
}
