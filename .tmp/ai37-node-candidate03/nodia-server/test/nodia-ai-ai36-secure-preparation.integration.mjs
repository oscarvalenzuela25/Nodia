// Compiled worker -> MCP callback -> native preparation -> human HTTP confirmation
// -> atomic domain receipt. PostgreSQL, records, publication and provider are
// disposable/synthetic. No configured DB, account, R2 or live Gemini is touched.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import { createAi15PublicationFixture } from './nodia-ai-ai15.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';

const started = Date.now(),
  checks = [];
const check = (name, condition = true) => {
  assert.ok(condition, name);
  checks.push(name);
};
// ai3602 is only an isolated fixture namespace; the implementation stage is AI-36-C02.
process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
const fixture = await createNodiaAiIntegrationFixture('ai3602');
const { db, options, identities } = fixture;
let ports,
  compiled,
  app,
  publication,
  dispatches = 0,
  httpRequests = 0;
const names = [
  'nodia_secure_flows_prepare_api_key_create',
  'nodia_secure_flows_prepare_api_key_update',
  'nodia_secure_flows_prepare_connection_login',
  'nodia_secure_flows_prepare_nodia_logout',
];
const load = async (...entries) =>
  Promise.all(entries.map(([file, name]) => loadAi(file, name)));
try {
  const [
    WriteModule,
    WriteBuilder,
    Tools,
    Conversation,
    Processing,
    Runtime,
    Confirmation,
    Execution,
    Secure,
  ] = await load(
    [
      'nodia-ai-write-tools/nodia-ai-write-tools.module',
      'NodiaAiWriteToolsModule',
    ],
    [
      'nodia-ai-write-tools/use-case/build-nodia-ai-write-tools.use-case',
      'BuildNodiaAiWriteToolsUseCase',
    ],
    ['nodia-ai-tools/nodia-ai-tools.module', 'NodiaAiToolsModule'],
    [
      'nodia-ai-conversation/nodia-ai-conversation.module',
      'NodiaAiConversationModule',
    ],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    [
      'nodia-ai-confirmation/nodia-ai-confirmation.module',
      'NodiaAiConfirmationModule',
    ],
    ['nodia-ai-execution/nodia-ai-execution.module', 'NodiaAiExecutionModule'],
    [
      'nodia-ai-secure-flow/nodia-ai-secure-flow.module',
      'NodiaAiSecureFlowModule',
    ],
  );
  const [
    Stage,
    Create,
    Admit,
    Adapter,
    Redis,
    Registry,
    Filter,
    Policy,
    bodyParser,
  ] = await load(
    [
      'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
      'RunNodiaAiStageUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
      'CreateNodiaAiConversationUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case',
      'AdmitNodiaAiMessageUseCase',
    ],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['common/redis/redis.service', 'RedisService'],
    [
      'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
      'NodiaAiToolRegistryUseCase',
    ],
    ['common/filters/all-exceptions.filter', 'AllExceptionsFilter'],
    ['nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY'],
    [
      'nodia-ai-conversation/nodia-ai-conversation-body-parser',
      'createNodiaAiConversationBodyParser',
    ],
  );
  const builder = (imports, providers = []) =>
    Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () => options,
          dataSourceFactory: async () => db,
        }),
        ...imports,
      ],
      providers,
    })
      .overrideProvider(Redis)
      .useValue({
        get: async () => null,
        set: async () => {},
        del: async () => {},
        keys: async () => [],
      });
  const loadContracts = await loadAi(
    'nodia-ai-write-tools/types/write-tool-contract.types',
    'loadNodiaAiSecureContracts',
  );
  const candidateNames = names;
  ports = await builder([WriteModule.forPublication(candidateNames)]).compile();
  const candidateFamilies = ports.get(WriteBuilder).execute(loadContracts());
  const candidates = candidateFamilies.flatMap((family) => family.capabilities);
  check(
    'four secure preparers have distinct candidate MCP contracts without production publication',
    names.every((name) =>
      candidates.some(
        (tool) => tool.toolName === name && tool.kind === 'prepare_secure_flow',
      ),
    ),
  );
  const families = candidateFamilies
    .map((family) => ({
      ...family,
      capabilities: family.capabilities.filter((tool) =>
        names.includes(tool.toolName),
      ),
    }))
    .filter((family) => family.capabilities.length);
  assert.equal(families.flatMap((family) => family.capabilities).length, 4);
  publication = await createAi15PublicationFixture(families);
  let scenario = async () => {},
    callbackError;
  const external = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() {
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey: 'gemini-profile:' + 'a'.repeat(64),
        configurationGeneration: 'b'.repeat(64),
        sessionGeneration: 'c'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: true,
        reason: null,
      };
    },
    async verifyConfiguration() {},
    async execute(request, signal) {
      dispatches++;
      try {
        await scenario(request, signal);
      } catch (error) {
        callbackError = error;
        throw error;
      }
      return {
        kind: 'answer',
        text: 'Synthetic MCP preparation verification.',
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
  const composition = publication.override(
    builder(
      [
        Tools,
        Conversation,
        Processing,
        Runtime,
        Confirmation,
        Execution,
        Secure,
      ],
      [Stage],
    ),
  );
  composition.overrideProvider(Adapter).useValue(external);
  const Gemini = await loadAi('common/ai/gemini.service', 'GeminiService');
  let nativeStarts = 0;
  const nativeJobs = new Map();
  const nativeJob = (id, actor) => {
    const job = nativeJobs.get(id);
    if (!job || job.actor !== actor)
      throw new NotFoundException('Synthetic owner mismatch');
    return { id, state: job.state };
  };
  composition.overrideProvider(Gemini).useValue({
    async acknowledgeLoginRequest() {},
    async durableLoginRequest(engine, action, id, provider, actor) {
      const key = id.replaceAll('-', '');
      if (action === 'start') {
        nativeStarts++;
        nativeJobs.set(key, { actor, provider, state: 'running' });
      }
      if (action === 'cancel') {
        const job = nativeJobs.get(key);
        if (job) job.state = 'cancelled';
        else nativeJobs.set(key, { actor, provider, state: 'cancelled' });
      }
      return nativeJob(key, actor);
    },
    async getInteractiveLoginStatus(id, actor) {
      return nativeJob(id, actor);
    },
    async cancelInteractiveLogin(id, actor) {
      nativeJob(id, actor);
      nativeJobs.get(id).state = 'cancelled';
      return nativeJob(id, actor);
    },
    async getInteractiveLoginFrame(id, actor) {
      nativeJob(id, actor);
      return {
        ready: false,
        frame_id: null,
        image: null,
        width: 1280,
        height: 850,
      };
    },
    async sendInteractiveLoginInput(id, actor) {
      return nativeJob(id, actor);
    },
  });
  compiled = await composition.compile();
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use(
    '/api/v1/nodia-ai',
    bodyParser(compiled.get(Policy).admission.http_json_bytes),
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
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1/nodia-ai`;
  async function http(
    path,
    { method = 'GET', actor = '1', body, expected = 200 } = {},
  ) {
    httpRequests++;
    const response = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-fixture-actor': actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (path.includes('/secure-flow'))
      assert.equal(response.headers.get('cache-control'), 'no-store');
    const value = response.status === 204 ? null : await response.json();
    assert.ok(
      (Array.isArray(expected) ? expected : [expected]).includes(
        response.status,
      ),
      `${method} ${path}: ${response.status} ${JSON.stringify(value)}`,
    );
    return value;
  }
  const [group] = await db.query(
    "SELECT module_group_id AS id FROM modules WHERE key='nodia_ai'",
  );
  let [destination] = await db.query(
    "SELECT id::text FROM modules WHERE link='/settings/ai-providers'",
  );
  if (!destination)
    [destination] = await db.query(
      "INSERT INTO modules(key,link,module_group_id) VALUES('synthetic_ai3602_providers','/settings/ai-providers',$1) RETURNING id::text",
      [group.id],
    );
  await db.query(
    'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1),(2,$1) ON CONFLICT DO NOTHING',
    [destination.id],
  );
  let [manage] = await db.query(
    "SELECT id::text FROM actions WHERE key='ai:manage'",
  );
  if (!manage)
    [manage] = await db.query(
      "INSERT INTO actions(key) VALUES('ai:manage') RETURNING id::text",
    );
  const [role] = await db.query(
    "INSERT INTO roles(key) VALUES('synthetic_ai3602_manager') RETURNING id::text",
  );
  await db.query('INSERT INTO role_actions(role_id,action_id) VALUES($1,$2)', [
    role.id,
    manage.id,
  ]);
  await db.query(
    'INSERT INTO user_roles(user_id,role_id) VALUES(1,$1),(2,$1)',
    [role.id],
  );
  const [catalog] = await db.query(
    "INSERT INTO ai_provider_catalog(key,name,can_use_api_key,can_use_token_plan_web,can_use_token_plan_agentic) VALUES('gemini','Synthetic secure catalog',true,true,true) ON CONFLICT(key) DO UPDATE SET is_active=true,can_use_api_key=true,can_use_token_plan_web=true,can_use_token_plan_agentic=true RETURNING id::text",
  );
  const [provider] = await db.query(
    "INSERT INTO ai_providers(catalog_id,name,use_api_key,use_token_plan_web,use_token_plan_agentic,default_mode) VALUES($1,'Synthetic AI36 secure connection',true,true,true,'token_plan_web') RETURNING id::text",
    [catalog.id],
  );
  const selection = {
    connection_id: provider.id,
    mode: 'token_plan_agentic',
    model_id: 'synthetic-ai3602-mcp-model',
    effort_id: null,
  };
  const identity = identities.get('1'),
    stage = compiled.get(Stage),
    registry = compiled.get(Registry),
    signal = new AbortController().signal;
  let activeRun, activeChat;
  const count = async (table, where = 'true', args = []) =>
    (
      await db.query(
        `SELECT count(*)::int n FROM ${table} WHERE ${where}`,
        args,
      )
    )[0].n;
  const call = (request, name, args, callId = randomUUID()) =>
    request.onToolCall({ callId, name, arguments: args }, signal);
  async function runScenario(callback) {
    callbackError = undefined;
    scenario = callback;
    const chat = await compiled
      .get(Create)
      .execute(identity, { client_request_id: randomUUID(), selection });
    activeChat = chat.conversation_id;
    const accepted = await compiled.get(Admit).execute(identity, activeChat, {
      client_message_id: randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [{ kind: 'text', text: 'Synthetic native MCP preparation only.' }],
    });
    activeRun = accepted.run.run_id;
    await stage.execute(randomUUID(), signal);
    await stage.execute(randomUUID(), signal);
    if (callbackError) throw callbackError;
    const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
      activeRun,
    ]);
    assert.equal(
      run.state,
      'completed',
      JSON.stringify({ state: run.state, error: run.error_code }),
    );
    return { chat: activeChat, run: activeRun };
  }
  const RunExecution = await loadAi(
    'nodia-ai-execution/use-case/run-nodia-ai-execution.use-case',
    'RunNodiaAiExecutionUseCase',
  );
  async function humanConfirm(proposal) {
    const challenge = await http(
      `/proposals/${proposal.proposal_id}/confirmation-challenge`,
      {
        method: 'POST',
        body: {
          proposal_revision: proposal.revision,
          expected_hash: proposal.hash,
        },
      },
    );
    const body = {
      client_request_id: randomUUID(),
      proposal_revision: proposal.revision,
      expected_hash: proposal.hash,
      confirmation_token: challenge.confirmation_token,
    };
    const accepted = await http(`/proposals/${proposal.proposal_id}/confirm`, {
      method: 'POST',
      body,
      expected: 202,
    });
    const repeated = await http(`/proposals/${proposal.proposal_id}/confirm`, {
      method: 'POST',
      body,
      expected: 202,
    });
    assert.equal(
      accepted.execution.execution_id,
      repeated.execution.execution_id,
    );
    assert.equal(
      await compiled.get(RunExecution).execute(randomUUID(), signal),
      true,
    );
    const [paused] = await db.query(
      'SELECT * FROM nodia_ai_executions WHERE id=$1',
      [accepted.execution.execution_id],
    );
    assert.equal(paused.state, 'waiting_for_user');
    return accepted.execution.execution_id;
  }

  const sensitive = 'synthetic-mcp-forbidden-marker-' + randomUUID();
  const assertPublic = (value) => {
    const forbiddenKeys = new Set([
      'reference',
      'native_reference',
      'native_request',
      'authorization_url',
      'verificationUrl',
      'userCode',
      'frame_id',
      'image',
      'secret',
      'secret_ciphertext',
      'password',
      'cookie',
      'cookies',
      'token',
      'code',
    ]);
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (node && typeof node === 'object')
        for (const [key, item] of Object.entries(node)) {
          assert.ok(!forbiddenKeys.has(key), 'Sensitive output key: ' + key);
          visit(item);
        }
    };
    visit(value);
    assert.ok(!JSON.stringify(value).includes(sensitive));
    return value;
  };
  const modelTables = [
    'nodia_ai_drafts',
    'nodia_ai_proposals',
    'nodia_ai_proposal_steps',
    'nodia_ai_tool_calls',
    'nodia_ai_messages',
    'nodia_ai_events',
    'nodia_ai_executions',
    'nodia_ai_execution_steps',
    'nodia_ai_jobs',
    'nodia_ai_job_attempts',
    'nodia_ai_execution_grants',
  ];
  const noPersistedMarker = async (marker) => {
    for (const table of modelTables) {
      const records = await db.query(
        `SELECT row_to_json(t)::text value FROM ${table} t`,
      );
      assert.ok(
        records.every((record) => !record.value.includes(marker)),
        'Marker persisted in ' + table,
      );
    }
  };
  const proposalCounts = () =>
    Promise.all(
      ['nodia_ai_drafts', 'nodia_ai_proposals', 'nodia_ai_tool_calls'].map(
        (table) => count(table, 'conversation_id=$1', [activeChat]),
      ),
    );
  let createPreparation, loginPreparation, logoutPreparation, incomplete;
  await runScenario(async (request) => {
    check(
      'worker admission exposes exactly four explicitly synthetic-published secure preparers',
      request.tools.filter((tool) => names.includes(tool.name)).length === 4 &&
        names.every((name) => request.tools.some((tool) => tool.name === name)),
    );
    const args = { partial: {} },
      id = randomUUID();
    incomplete = assertPublic(await call(request, names[0], args, id));
    check(
      'empty public metadata asks for required fields and persists a draft without credentials or a login',
      incomplete.status === 'needs_clarification' &&
        incomplete.draft_revision === 1 &&
        incomplete.missing_fields.includes('provider_id') &&
        (await count('ai_api_keys')) === 0 &&
        nativeStarts === 0,
    );
    const replay = await call(request, names[0], args, id);
    check(
      'secure incomplete replay returns the exact completed receipt once',
      isDeepStrictEqual(replay, incomplete) &&
        (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
          1,
    );
    await assert.rejects(
      call(request, names[0], { partial: { label: 'Different intent' } }, id),
      /request_conflict/u,
    );
    await assert.rejects(
      call(request, names[0], {
        partial: { provider_id: provider.id, label: 'Synthetic human key' },
        draft_id: incomplete.draft_id,
        expected_draft_revision: 2,
      }),
      /revision_conflict/u,
    );
    check(
      'changed payload and stale continuation cannot overwrite the incomplete secure draft',
      (
        await db.query('SELECT revision FROM nodia_ai_drafts WHERE id=$1', [
          incomplete.draft_id,
        ])
      )[0].revision === 1,
    );
    const continuation = {
        partial: { provider_id: provider.id, label: 'Synthetic human key' },
        draft_id: incomplete.draft_id,
        expected_draft_revision: 1,
      },
      readyId = randomUUID();
    createPreparation = assertPublic(
      await call(request, names[0], continuation, readyId),
    );
    const readyReplay = await call(request, names[0], continuation, readyId);
    check(
      'CAS continuation creates a single exact secure preview and no effect or human flow',
      createPreparation.status === 'ready' &&
        createPreparation.draft_revision === 2 &&
        isDeepStrictEqual(readyReplay, createPreparation) &&
        (await count('nodia_ai_proposals', 'conversation_id=$1', [
          activeChat,
        ])) === 1 &&
        (await count('nodia_ai_executions')) === 0 &&
        (await count('ai_api_keys')) === 0 &&
        nativeStarts === 0,
    );
    loginPreparation = assertPublic(
      await call(request, names[2], {
        partial: { provider_id: provider.id, mode: 'token_plan_web' },
      }),
    );
    logoutPreparation = assertPublic(
      await call(request, names[3], { partial: {} }),
    );
    check(
      'login and own-session logout prepare public proposals without starting or revoking a session',
      loginPreparation.status === 'ready' &&
        logoutPreparation.status === 'ready' &&
        nativeStarts === 0 &&
        (
          await db.query(
            'SELECT revoked_at FROM auth_sessions WHERE public_id=$1',
            [identity.sessionId],
          )
        )[0].revoked_at === null,
    );
  });
  for (let index = 0; index < names.length; index++)
    await runScenario(async (request) => {
      const before = await proposalCounts();
      for (const key of [
        'secret',
        'password',
        'cookies',
        'code',
        'authorization_url',
        'frame_id',
      ]) {
        try {
          await call(request, names[index], { partial: { [key]: sensitive } });
          assert.fail('Sensitive field accepted');
        } catch (error) {
          assert.match(String(error), /invalid_tool_input/u);
          assert.ok(!String(error).includes(sensitive));
        }
      }
      await assert.rejects(
        call(request, names[index], {
          partial: {},
          actor_id: '2',
          session_id: identities.get('2').sessionId,
          conversation_id: randomUUID(),
        }),
        /invalid_tool_input/u,
      );
      check(
        'closed secure input ' +
          names[index] +
          ' rejects secret and identity fields without echoing or storing the marker',
        isDeepStrictEqual(before, await proposalCounts()),
      );
    });
  await noPersistedMarker(sensitive);
  check(
    'rejected MCP secrets are absent from drafts proposals steps messages tool receipts and events',
    true,
  );
  await runScenario(async (request) => {
    for (const name of [
      'nodia_secure_flows_start',
      'nodia_secure_flows_code',
      'nodia_secure_flows_input',
      'nodia_secure_flows_submit_credentials',
      'nodia_secure_flows_confirm',
      'nodia_secure_flows_logout',
      'nodia_secure_flows_frame',
      'nodia_secure_flows_key',
    ])
      await assert.rejects(
        call(request, name, { secret: sensitive }),
        /capability_denied/u,
      );
    check(
      'MCP cannot directly start login send code input submit credentials confirm logout read frames or save keys',
      (await count('nodia_ai_executions')) === 0 &&
        (await count('ai_api_keys')) === 0 &&
        nativeStarts === 0,
    );
  });
  const flowDetail = (id, actor = '1') =>
    http(`/operations/${id}/secure-flow`, { actor });
  async function humanAction(id, flow, name, payload) {
    const value = await http(
      `/operations/${id}/secure-flow/${flow.reference}/${name}`,
      {
        method: 'POST',
        body: {
          expected_execution_revision: flow.revision,
          client_request_id: randomUUID(),
          ...(payload === undefined ? {} : { payload }),
        },
      },
    );
    return value;
  }
  await http(
    `/proposals/${createPreparation.proposal.proposal_id}/confirmation-challenge`,
    {
      actor: '2',
      method: 'POST',
      expected: [403, 404],
      body: {
        proposal_revision: createPreparation.proposal.revision,
        expected_hash: createPreparation.proposal.hash,
      },
    },
  );
  const slotsBeforeHumanPause = await count('nodia_ai_runtime_slots');
  const createExecution = await humanConfirm(createPreparation.proposal),
    createFlow = (await flowDetail(createExecution)).flow;
  const [pausedJob] = await db.query(
    'SELECT * FROM nodia_ai_jobs WHERE execution_id=$1',
    [createExecution],
  );
  check(
    'only separate human exact confirmation makes the worker pause with no key and no nested inference slot',
    createFlow.kind === 'api_key_create' &&
      createFlow.status === 'waiting' &&
      pausedJob.state === 'waiting' &&
      pausedJob.lease_owner === null &&
      (await count('ai_api_keys')) === 0 &&
      (await count('nodia_ai_runtime_slots')) === slotsBeforeHumanPause &&
      (await count('nodia_ai_runtime_slots', "state <> 'free'")) === 0 &&
      nativeStarts === 0,
  );
  await http(`/operations/${createExecution}/secure-flow`, {
    actor: '2',
    expected: 404,
  });
  const secondSession = { ...identity, sessionId: randomUUID() };
  identities.set('same-user-other-session', secondSession);
  await db.query(
    "INSERT INTO auth_sessions(public_id,user_id,refresh_token_hash,expires_at) VALUES($1,1,'synthetic',clock_timestamp()+interval '1 hour')",
    [secondSession.sessionId],
  );
  await http(`/operations/${createExecution}/secure-flow`, {
    actor: 'same-user-other-session',
    expected: 404,
  });
  check(
    'another manager or another session of the owner cannot consume the secure human flow',
    true,
  );
  const humanSecret = 'synthetic-human-channel-only-' + randomUUID();
  await humanAction(createExecution, createFlow, 'key', {
    secret: humanSecret,
  });
  const [created] = await db.query(
    'SELECT * FROM ai_api_keys WHERE provider_id=$1',
    [provider.id],
  );
  const [keyReceipt] = await db.query(
    'SELECT minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1',
    [createExecution],
  );
  check(
    'the authenticated human channel alone commits one encrypted key with its atomic opaque receipt',
    created.secret_ciphertext.startsWith('v2:') &&
      !created.secret_ciphertext.includes(humanSecret) &&
      keyReceipt.minimal_receipt.operation === 'api_key_create' &&
      (await count('ai_api_keys')) === 1,
  );
  await noPersistedMarker(humanSecret);
  check(
    'human-entered key material never enters model-facing data or execution job attempt grant and receipt rows',
    true,
  );
  let updatePreparation;
  await runScenario(async (request) => {
    const args = {
        partial: {
          provider_id: provider.id,
          key_id: created.id,
          label: 'Synthetic human rename',
        },
      },
      id = randomUUID();
    updatePreparation = assertPublic(await call(request, names[1], args, id));
    assert.equal(updatePreparation.status, 'ready');
    await assert.rejects(
      call(request, names[0], {
        partial: { provider_id: provider.id, label: 'Other chat' },
        draft_id: incomplete.draft_id,
        expected_draft_revision: 2,
      }),
      /revision_conflict/u,
    );
    check(
      'secure draft continuation cannot cross conversations even for the same authenticated owner',
      (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
        1,
    );
    const before = await proposalCounts(),
      validate = registry.validateOutput.bind(registry);
    registry.validateOutput = (tool, value) =>
      validate(
        tool,
        tool.toolName === names[2]
          ? { ...value, reference: randomUUID() }
          : value,
      );
    try {
      await assert.rejects(
        call(request, names[2], {
          partial: { provider_id: provider.id, mode: 'token_plan_web' },
        }),
        /invalid_tool_output/u,
      );
    } finally {
      registry.validateOutput = validate;
    }
    check(
      'a sensitive uncontracted output rolls back draft proposal and validated MCP receipt atomically',
      isDeepStrictEqual(before, await proposalCounts()),
    );
    await db.query(
      'DELETE FROM role_actions WHERE role_id=$1 AND action_id=$2',
      [role.id, manage.id],
    );
    await assert.rejects(
      call(request, names[1], args, id),
      /capability_denied|capability_unavailable/u,
    );
    const discovery = await http('/capabilities');
    check(
      'revoking ai:manage removes provider secure tools and denies completed replay while retaining own logout',
      discovery.items.every(
        (tool) => !names.slice(0, 3).includes(tool.tool_name),
      ) && discovery.items.some((tool) => tool.tool_name === names[3]),
    );
    await db.query(
      'INSERT INTO role_actions(role_id,action_id) VALUES($1,$2)',
      [role.id, manage.id],
    );
    await db.query(
      'DELETE FROM user_modules WHERE user_id=1 AND module_id=$1',
      [destination.id],
    );
    await assert.rejects(
      call(request, names[1], args, id),
      /capability_denied|capability_unavailable/u,
    );
    check(
      'revoked destination module prevents secure proposal replay without changing its durable receipt',
      (await count('nodia_ai_proposals', 'conversation_id=$1', [
        activeChat,
      ])) === 1,
    );
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
      destination.id,
    ]);
  });
  const updateExecution = await humanConfirm(updatePreparation.proposal),
    updateFlow = (await flowDetail(updateExecution)).flow;
  await humanAction(updateExecution, updateFlow, 'key', {});
  const [updated] = await db.query('SELECT * FROM ai_api_keys WHERE id=$1', [
    created.id,
  ]);
  check(
    'secure update retains key identity and ciphertext while applying only the exact confirmed metadata',
    updated.label === 'Synthetic human rename' &&
      updated.secret_ciphertext === created.secret_ciphertext &&
      (await count('ai_api_keys')) === 1,
  );
  const loginExecution = await humanConfirm(loginPreparation.proposal),
    loginFlow = (await flowDetail(loginExecution)).flow;
  check(
    'confirming login still pauses before any native start and keeps native channels outside MCP',
    loginFlow.kind === 'connection_login' && nativeStarts === 0,
  );
  const startedLogin = await humanAction(loginExecution, loginFlow, 'start');
  const [privateLogin] = await db.query(
    'SELECT recovery_descriptor FROM nodia_ai_execution_steps WHERE execution_id=$1',
    [loginExecution],
  );
  check(
    'only the authenticated human login action starts the exact configured native connection',
    nativeStarts === 1 &&
      startedLogin.interaction.kind === 'gemini_web' &&
      privateLogin.recovery_descriptor.native_reference.provider_id ===
        provider.id,
  );
  const modelResults = await db.query(
    'SELECT public_result FROM nodia_ai_tool_calls WHERE public_result IS NOT NULL',
  );
  for (const result of modelResults) assertPublic(result.public_result);
  check(
    'completed MCP receipts expose no human flow reference native job URL frame code or credentials',
    modelResults.every(
      (result) =>
        !JSON.stringify(result.public_result).includes(loginFlow.reference) &&
        !JSON.stringify(result.public_result).includes(
          privateLogin.recovery_descriptor.native_reference.job_id,
        ),
    ),
  );
  await humanAction(loginExecution, startedLogin.flow, 'cancel');
  check(
    'synthetic human login cancellation completes without inference or native login replay',
    (
      await db.query('SELECT state FROM nodia_ai_executions WHERE id=$1', [
        loginExecution,
      ])
    )[0].state === 'cancelled' && nativeStarts === 1,
  );
  await db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [
    destination.id,
  ]);
  await db.query('DELETE FROM role_actions WHERE role_id=$1 AND action_id=$2', [
    role.id,
    manage.id,
  ]);
  await runScenario(async (request) => {
    check(
      'own logout remains discoverable with NodiaAI access and no provider-management authority',
      request.tools.some((tool) => tool.name === names[3]) &&
        request.tools.every((tool) => !names.slice(0, 3).includes(tool.name)),
    );
    const ownPreparation = assertPublic(
      await call(request, names[3], { partial: {} }),
    );
    check(
      'own logout preparation needs neither another target session nor the provider module',
      ownPreparation.status === 'ready' &&
        ownPreparation.proposal.steps[0].tool_name === names[3],
    );
  });
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
    destination.id,
  ]);
  await db.query('INSERT INTO role_actions(role_id,action_id) VALUES($1,$2)', [
    role.id,
    manage.id,
  ]);
  const logoutExecution = await humanConfirm(logoutPreparation.proposal),
    logoutFlow = (await flowDetail(logoutExecution)).flow;
  check(
    'own Nodia logout waits for a distinct human action and never targets another session',
    (
      await db.query(
        'SELECT revoked_at FROM auth_sessions WHERE public_id=$1',
        [identity.sessionId],
      )
    )[0].revoked_at === null && logoutFlow.kind === 'nodia_logout',
  );
  await humanAction(logoutExecution, logoutFlow, 'logout');
  const own = (
      await db.query(
        'SELECT revoked_at FROM auth_sessions WHERE public_id=$1',
        [identity.sessionId],
      )
    )[0],
    other = (
      await db.query(
        'SELECT revoked_at FROM auth_sessions WHERE public_id=$1',
        [secondSession.sessionId],
      )
    )[0];
  check(
    'human-confirmed own logout revokes only the originating session and leaves another session active',
    own.revoked_at !== null && other.revoked_at === null,
  );
  await noPersistedMarker(sensitive);
  await noPersistedMarker(humanSecret);
  check(
    'final model-facing data remains free of rejected or human-only credentials',
    true,
  );
  console.log(
    JSON.stringify(
      {
        stage: 'AI-36-C02',
        scope: 'compiled_worker_mcp_secure_preparation_human_sql',
        status: 'passed',
        checks: checks.length,
        results: checks,
        elapsed_ms: Date.now() - started,
        migrations: (await db.query('SELECT id FROM migrations')).length,
        synthetic_provider_dispatches: dispatches,
        native_login_starts_in_mock: nativeStarts,
        actual_provider_generations: 0,
        http_requests: httpRequests,
        configured_database_used: false,
        storage_operations: 0,
        synthetic_publication: true,
        production_publication: false,
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  else if (compiled) await compiled.close();
  if (ports) await ports.close();
  publication?.close();
  await fixture.close();
}
