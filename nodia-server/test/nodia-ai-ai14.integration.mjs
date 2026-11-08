// Compiled Nest, actual durable worker callbacks and disposable PostgreSQL. No provider account, inference or configured database.
import assert from 'node:assert/strict';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import { createAi14PublicationFixture } from './nodia-ai-ai14.fixture.mjs';
import { createNodiaAiUnpublishedFixture } from './nodia-ai-unpublished.fixture.mjs';

const checks = [],
  check = (name, value) => {
    assert.ok(value, name);
    checks.push(name);
  };
let app, publication;
const Module = await loadAi(
  'nodia-ai-tools/nodia-ai-tools.module',
  'NodiaAiToolsModule',
);
const Conversation = await loadAi(
  'nodia-ai-conversation/nodia-ai-conversation.module',
  'NodiaAiConversationModule',
);
const Processing = await loadAi(
  'nodia-ai-context/nodia-ai-processing.module',
  'NodiaAiProcessingModule',
);
const Runtime = await loadAi(
  'nodia-ai-runtime/nodia-ai-runtime.module',
  'NodiaAiRuntimeModule',
);
const Stage = await loadAi(
  'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
  'RunNodiaAiStageUseCase',
);
const Create = await loadAi(
  'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
  'CreateNodiaAiConversationUseCase',
);
const Admit = await loadAi(
  'nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case',
  'AdmitNodiaAiMessageUseCase',
);
const Adapter = await loadAi(
  'nodia-ai-adapter/types/nodia-ai-adapter.types',
  'NodiaAiAdapterPort',
);
const fixture = await createNodiaAiIntegrationFixture('ai14');
const { db, options, identities } = fixture;

async function startApplication(builder) {
  const compiled = await builder.compile();
  const instance = compiled.createNestApplication({ logger: false });
  instance.setGlobalPrefix('api/v1');
  instance.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  instance.useGlobalGuards({
    canActivate(context) {
      const request = context.switchToHttp().getRequest(),
        identity = identities.get(request.headers['x-fixture-actor']);
      if (!identity) throw new UnauthorizedException();
      request.auth = {
        user: { id: identity.userId },
        sessionId: identity.sessionId,
      };
      return true;
    },
  });
  await instance.listen(0, '127.0.0.1');
  const base = `${await instance.getUrl()}/api/v1/nodia-ai/capabilities`;
  return {
    instance,
    compiled,
    async request(path = '', { actor = '1', status = 200 } = {}) {
      const response = await fetch(base + path, {
        headers: { 'x-fixture-actor': actor },
      });
      const body = await response.json();
      assert.equal(response.status, status, JSON.stringify(body));
      if (status === 200)
        assert.equal(response.headers.get('cache-control'), 'no-store');
      return body;
    },
  };
}
const unpublished = await createNodiaAiUnpublishedFixture();
const builder = (...imports) =>
  unpublished.override(
    Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => options,
          dataSourceFactory: async () => db,
        }),
        ...imports,
      ],
      providers: imports.includes(Processing) ? [Stage] : [],
    }),
  );

try {
  const empty = await startApplication(builder(Module));
  app = empty.instance;
  const initial = await empty.request();
  check(
    'explicit empty composition publishes no draft capability regardless of the installed publication',
    initial.items.length === 0 && initial.next_cursor === null,
  );
  await empty.request('', { actor: 'missing', status: 401 });
  check('discovery requires authenticated identity', true);
  await empty.request('?all=true', { status: 400 });
  check('discovery rejects unbounded unknown query parameters', true);
  await empty.request(
    '/nodia_not_registered?catalog_version=' +
      encodeURIComponent(initial.catalog_version),
    { status: 404 },
  );
  check('unknown capabilities have no executable projection', true);
  await app.close();
  app = undefined;
  if (!db.isInitialized) await db.initialize();

  publication = await createAi14PublicationFixture();
  const p = publication;
  const [destination] = await db.query(
    `INSERT INTO modules(module_group_id,link,key) SELECT module_group_id,'/tools/ai14-fixture','ai14_fixture' FROM modules WHERE key='nodia_ai' RETURNING id`,
  );
  const [role] = await db.query(
    `INSERT INTO roles(key) VALUES('ai14_fixture_role') RETURNING id`,
  );
  const [action] = await db.query(
    `INSERT INTO actions(key) VALUES('ai14:read') RETURNING id`,
  );
  await db.query('INSERT INTO user_roles(user_id,role_id) VALUES(1,$1)', [
    role.id,
  ]);
  const addModule = () =>
    db.query(
      'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING',
      [destination.id],
    );
  const addAction = () =>
    db.query(
      'INSERT INTO role_actions(role_id,action_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [role.id, action.id],
    );
  let currentScenario = async () => {},
    callbackError,
    dispatches = 0;
  const resourceKey = 'gemini-profile:' + 'e'.repeat(64);
  const external = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() {
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey,
        configurationGeneration: 'f'.repeat(64),
        sessionGeneration: 'e'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: true,
        reason: null,
      };
    },
    async verifyConfiguration() {},
    async execute(request, signal) {
      dispatches++;
      try {
        await currentScenario(request, signal);
      } catch (error) {
        callbackError = error;
        throw error;
      }
      return {
        kind: 'answer',
        text: 'Synthetic AI14 fixture completed.',
        terminalProof: {
          engine: 'agentic',
          attemptId: request.attemptId,
          resourceKey: request.resourceKey,
          sessionGeneration: request.sessionGeneration,
          operationRef: request.attemptId,
          terminalProofId: randomUUID(),
          processClosed: true,
          outcome: 'completed',
          observedAt: new Date(),
        },
      };
    },
  };
  const composed = publication.override(
    builder(Module, Conversation, Processing, Runtime),
  );
  composed.overrideProvider(Adapter).useValue(external);
  const live = await startApplication(composed);
  app = live.instance;
  check(
    'ordinary caller without destination assignment cannot discover fixture tools',
    (await live.request()).items.length === 0,
  );
  await addModule();
  check(
    'destination assignment alone cannot bypass a registered action requirement',
    (await live.request()).items.length === 0,
  );
  await addAction();
  const found = await live.request();
  check(
    'assigned current module and action reveal only explicitly published capabilities',
    found.items.length === 3 &&
      found.items.every((item) => item.module_key === 'ai14_fixture'),
  );
  check(
    'super admin discovers the same publication without destination assignment or action role',
    (await live.request('', { actor: '3' })).items.length === 3,
  );
  check(
    'another ordinary actor sees no capabilities from an unassigned destination',
    (await live.request('', { actor: '2' })).items.length === 0,
  );
  check(
    'preparation is described as blocked while its executor is not implemented',
    found.items.find((item) => item.tool_name === p.prepareName)
      ?.availability === 'blocked',
  );
  const version = `?catalog_version=${encodeURIComponent(p.catalogVersion)}`;
  const detail = await live.request(`/${p.readName}${version}`),
    schemas = await live.request(`/${p.readName}/schema${version}`);
  check(
    'public descriptor identifies exact required and optional fields and contract hash',
    detail.required_fields.join(',') === 'id' &&
      detail.optional_fields.length === 0 &&
      detail.contract_hash === schemas.contract_hash,
  );
  check(
    'public schemas contain no handler, repository, sourceJson, private field or provider secret',
    !JSON.stringify(schemas).includes('sourceJson') &&
      !JSON.stringify(schemas).includes('handler') &&
      !JSON.stringify(schemas).includes('synthetic-private-value') &&
      schemas.input_schema.additionalProperties === false,
  );
  await live.request(`/${p.readName}?catalog_version=stale`, { status: 409 });
  check('stale catalog version is an explicit HTTP conflict', true);
  await live.request(`/${p.readName}`, { status: 400 });
  check('describe requires the exact catalog version', true);
  await live.request(`/${p.readName}${version}`, { actor: '2', status: 404 });
  check('describe and schema share the discovery authorization boundary', true);
  await live.request('?cursor=malformed', { status: 400 });
  check('malformed catalog cursors cannot expand discovery', true);

  const [provider] = await db.query(
    `INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI14 adapter','{}') RETURNING id`,
  );
  const selection = {
    connection_id: provider.id,
    mode: 'agentic',
    model_id: 'synthetic-ai14-model',
    effort_id: null,
  };
  const stage = live.compiled.get(Stage),
    create = live.compiled.get(Create),
    admit = live.compiled.get(Admit),
    worker = randomUUID(),
    signal = new AbortController().signal;
  let activeRun;
  const sqlRun = async () =>
    (await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [activeRun]))[0];
  const call = (request, name, args, callId = randomUUID()) =>
    request.onToolCall({ callId, name, arguments: args }, signal);
  const reject = async (request, name, args, pattern, callId) => {
    await assert.rejects(call(request, name, args, callId), pattern);
  };
  async function runScenario(scenario) {
    currentScenario = scenario;
    callbackError = undefined;
    const identity = identities.get('1'),
      chat = await create.execute(identity, {
        client_request_id: randomUUID(),
        selection,
      });
    const accepted = await admit.execute(identity, chat.conversation_id, {
      client_message_id: randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [{ kind: 'text', text: 'Synthetic AI14 request.' }],
    });
    activeRun = accepted.run.run_id;
    await stage.execute(worker, signal);
    await stage.execute(worker, signal);
    if (callbackError) throw callbackError;
    const run = await sqlRun();
    assert.equal(
      run.state,
      'completed',
      JSON.stringify({ state: run.state, error: run.error_code }),
    );
    return run;
  }
  const first = await runScenario(async (request) => {
    check(
      'real worker exposes only grant-frozen read handlers and technical MCP tools',
      request.tools.some((tool) => tool.name === p.readName) &&
        request.tools.some((tool) => tool.name === 'nodia_entities_search') &&
        !request.tools.some((tool) => tool.name === p.prepareName),
    );
    const [grant] = await db.query(
      'SELECT allowed_operations FROM nodia_ai_execution_grants WHERE run_id=$1',
      [activeRun],
    );
    check(
      'admission grant freezes verified reads and excludes unimplemented preparation',
      grant.allowed_operations.includes(p.readName) &&
        !grant.allowed_operations.includes(p.prepareName),
    );
    const id = randomUUID(),
      before = { ...p.counters },
      result = await call(request, p.readName, { id: '2' }, id);
    const replay = await call(request, p.readName, { id: '2' }, id);
    check(
      'typed read uses the checkpoint manager and returns the allowlisted SQL projection',
      result.id === '2' &&
        result.label === 'Synthetic 2' &&
        !('email' in result),
    );
    check(
      'durable duplicate result rechecks resource authority without repeating the handler',
      JSON.stringify(replay) === JSON.stringify(result) &&
        p.counters.handlers === before.handlers + 1 &&
        p.counters.authorities === before.authorities + 2,
    );
    const handlers = p.counters.handlers;
    await reject(
      request,
      p.readName,
      { id: '2', sql: 'untrusted' },
      /invalid_tool_input/,
    );
    check(
      'unknown input fields fail before the domain handler',
      p.counters.handlers === handlers,
    );
    await reject(request, 'nodia_unregistered', {}, /capability_denied/);
    p.controls.invalidOutput = true;
    const invalidId = randomUUID();
    await reject(
      request,
      p.readName,
      { id: '2' },
      /invalid_tool_output/,
      invalidId,
    );
    p.controls.invalidOutput = false;
    check(
      'invalid handler output commits no public tool result',
      (
        await db.query(
          'SELECT id FROM nodia_ai_tool_calls WHERE run_id=$1 AND adapter_call_id=$2',
          [activeRun, invalidId],
        )
      ).length === 0,
    );
    await reject(request, p.prepareName, {}, /capability_denied/);
    await reject(request, p.readName, { id: '1' }, /request_conflict/, id);
    check(
      'all rejected, invalid and replayed requests consume the same durable budget',
      (await sqlRun()).tool_calls_used === 7,
    );
  });
  check(
    'completed callback run stores one reusable result despite seven requests',
    (
      await db.query('SELECT id FROM nodia_ai_tool_calls WHERE run_id=$1', [
        first.id,
      ])
    ).length === 1,
  );
  await runScenario(async (request) => {
    const id = randomUUID();
    await call(request, p.readName, { id: '2' }, id);
    const handlers = p.counters.handlers;
    await db.query('UPDATE users SET is_active=false WHERE id=2');
    await reject(request, p.readName, { id: '2' }, /capability_denied/, id);
    await db.query('UPDATE users SET is_active=true WHERE id=2');
    check(
      'SQL resource authority revocation prevents cached results',
      p.counters.handlers === handlers,
    );
    await db.query(
      'DELETE FROM role_actions WHERE role_id=$1 AND action_id=$2',
      [role.id, action.id],
    );
    await reject(request, p.readName, { id: '2' }, /capability_denied/, id);
    await addAction();
    check(
      'action revocation prevents replay from the previous grant',
      p.counters.handlers === handlers,
    );
    await db.query(
      'DELETE FROM user_modules WHERE user_id=1 AND module_id=$1',
      [destination.id],
    );
    await reject(request, p.readName, { id: '2' }, /capability_denied/, id);
    await addModule();
    check(
      'destination module revocation prevents replay from frozen history',
      p.counters.handlers === handlers,
    );
    await db.query(
      'UPDATE nodia_ai_execution_grants SET session_public_id=$2 WHERE run_id=$1',
      [activeRun, identities.get('2').sessionId],
    );
    await reject(
      request,
      p.readName,
      { id: '2' },
      /lease|catalog_changed|grant|session|authority/i,
      id,
    );
    await db.query(
      'UPDATE nodia_ai_execution_grants SET session_public_id=$2 WHERE run_id=$1',
      [activeRun, identities.get('1').sessionId],
    );
    check(
      'another session cannot reuse the durable execution grant',
      p.counters.handlers === handlers,
    );
    const original = (await sqlRun()).context_manifest;
    await db.query(
      `UPDATE nodia_ai_runs SET context_manifest=jsonb_set(context_manifest,'{tool_contracts,$invalid}', '"untrusted"'::jsonb) WHERE id=$1`,
      [activeRun],
    );
    await reject(request, p.readName, { id: '2' }, /catalog_changed/, id);
    await db.query('UPDATE nodia_ai_runs SET context_manifest=$2 WHERE id=$1', [
      activeRun,
      original,
    ]);
    check(
      'changed persisted tool contracts cannot reuse the frozen callback',
      p.counters.handlers === handlers,
    );
  });
  await runScenario(async (request) => {
    const input = {
      catalog_version: p.catalogVersion,
      resource_key: 'ai14_users',
      term: 'Synthetic',
      scope: { subject_user_id: '2' },
    };
    const unique = await call(request, 'nodia_entities_search', input);
    check(
      'registered resolver preserves exact bigint identity and unambiguous cardinality',
      unique.status === 'unique' &&
        unique.candidates[0].id === '2' &&
        unique.next_cursor === null,
    );
    const ambiguous = await call(request, 'nodia_entities_search', {
      ...input,
      scope: {},
    });
    check(
      'multiple actual SQL candidates remain ambiguous rather than selecting the first',
      ambiguous.status === 'ambiguous' && ambiguous.candidates.length === 3,
    );
    p.controls.wrongResource = true;
    await reject(
      request,
      'nodia_entities_search',
      input,
      /invalid_tool_output/,
    );
    p.controls.wrongResource = false;
    p.controls.uncertainUnique = true;
    await reject(
      request,
      'nodia_entities_search',
      input,
      /invalid_tool_output/,
    );
    p.controls.uncertainUnique = false;
    check(
      'resolver rejects wrong resource projections and uniqueness while another page exists',
      true,
    );
    await reject(
      request,
      'nodia_entities_search',
      { ...input, scope: { arbitrary_sql: 'select' } },
      /invalid_tool_input/,
    );
    await reject(
      request,
      'nodia_entities_search',
      { ...input, resource_key: 'not_registered' },
      /capability_denied/,
    );
    check(
      'resource scopes remain validated filters and unknown resolvers are denied',
      true,
    );
    const resolverCount = p.counters.resolvers;
    await reject(
      request,
      p.resolveName,
      { ...input, resource_key: 'not_registered' },
      /invalid_tool_input|capability_denied/,
    );
    check(
      'direct resolver tool cannot substitute its registered resource before calling the handler',
      p.counters.resolvers === resolverCount,
    );
    p.controls.wrongResource = true;
    await reject(request, p.resolveName, input, /invalid_tool_output/);
    p.controls.wrongResource = false;
    p.controls.oversizedId = true;
    await reject(request, p.resolveName, input, /invalid_tool_output/);
    p.controls.oversizedId = false;
    p.controls.uncertainUnique = true;
    await reject(request, p.resolveName, input, /invalid_tool_output/);
    p.controls.uncertainUnique = false;
    check(
      'direct resolver enforces the shared resource, bigint and uniqueness invariants',
      true,
    );
    const directId = randomUUID(),
      direct = await call(request, p.resolveName, input, directId);
    check(
      'valid direct resolver preserves the same authorized entity contract',
      direct.status === 'unique' &&
        direct.candidates[0].resource_key === input.resource_key,
    );
    const tampered = {
      ...direct,
      candidates: [{ ...direct.candidates[0], resource_key: 'wrong_resource' }],
    };
    await db.query(
      'UPDATE nodia_ai_tool_calls SET public_result=$3 WHERE run_id=$1 AND adapter_call_id=$2',
      [activeRun, directId, tampered],
    );
    await reject(
      request,
      p.resolveName,
      input,
      /invalid_tool_output/,
      directId,
    );
    await db.query(
      'UPDATE nodia_ai_tool_calls SET public_result=$3 WHERE run_id=$1 AND adapter_call_id=$2',
      [activeRun, directId, direct],
    );
    check(
      'durable direct resolver replay also revalidates cached entity provenance',
      true,
    );
    check(
      'resolver alias, direct calls and rejected replays share twelve SQL-budgeted requests',
      (await sqlRun()).tool_calls_used === 12,
    );
  });
  const limited = await runScenario(async (request) => {
    for (let index = 0; index < 12; index++)
      await reject(request, 'nodia_unregistered', {}, /capability_denied/);
    await reject(request, 'nodia_unregistered', {}, /execution_limit/);
  });
  check(
    'actual SQL budget rejects the thirteenth request without exceeding its frozen bound',
    limited.tool_calls_used === 12,
  );
  check(
    'all four actual worker executions remain synthetic with no provider inference',
    dispatches === 4,
  );
  console.log(
    JSON.stringify(
      {
        stage: 'AI-14',
        scope:
          'compiled_nest_http_postgresql_actual_worker_synthetic_adapter_only',
        checks: checks.length,
        passed: checks,
        real_business_tools_published: 0,
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  if (publication) publication.close();
  unpublished.close();
  await fixture.close();
}
