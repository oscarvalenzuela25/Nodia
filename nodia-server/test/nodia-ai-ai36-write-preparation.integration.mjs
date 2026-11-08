// Compiled worker -> MCP callback -> native preparation -> human HTTP confirmation
// -> atomic domain receipt. PostgreSQL, records, publication and provider are
// disposable/synthetic. No configured DB, account, R2 or live Gemini is touched.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
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
// ai3601 is only an isolated fixture namespace; the implementation stage is AI-36-C01.
const fixture = await createNodiaAiIntegrationFixture('ai3601');
const { db, options, identities } = fixture;
let ports,
  compiled,
  app,
  publication,
  dispatches = 0,
  httpRequests = 0;
const names = [
  'nodia_finance_movements_prepare_create',
  'nodia_providers_prepare_create',
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
  );
  const [
    Stage,
    Create,
    Admit,
    Adapter,
    Redis,
    Registry,
    Claim,
    Execute,
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
    [
      'nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case',
      'ClaimNodiaAiExecutionUseCase',
    ],
    [
      'nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case',
      'ExecuteNodiaAiLocalExecutionUseCase',
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
    'loadNodiaAiWriteContracts',
  );
  const candidateNames = loadContracts().flatMap((bundle) =>
    bundle.tools.map((tool) => tool.tool_name),
  );
  ports = await builder([WriteModule.forPublication(candidateNames)]).compile();
  const candidateFamilies = ports.get(WriteBuilder).execute();
  const candidates = candidateFamilies.flatMap((family) => family.capabilities);
  check(
    'all 73 native domain preparers have distinct candidate MCP contracts without production publication',
    candidates.length === 73 &&
      new Set(candidates.map((tool) => tool.toolName)).size === 73 &&
      candidates.every((tool) => tool.kind === 'prepare_change'),
  );
  const families = candidateFamilies
    .map((family) => ({
      ...family,
      capabilities: family.capabilities.filter((tool) =>
        names.includes(tool.toolName),
      ),
    }))
    .filter((family) => family.capabilities.length);
  assert.equal(families.flatMap((family) => family.capabilities).length, 2);
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
      [Tools, Conversation, Processing, Runtime, Confirmation, Execution],
      [Stage],
    ),
  );
  composition.overrideProvider(Adapter).useValue(external);
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
    const value = response.status === 204 ? null : await response.json();
    assert.ok(
      (Array.isArray(expected) ? expected : [expected]).includes(
        response.status,
      ),
      `${method} ${path}: ${response.status} ${JSON.stringify(value)}`,
    );
    return value;
  }
  const moduleIds = new Map();
  for (const [key, route] of [
    ['personal_finance', '/finances-personal'],
    ['businesses', '/business'],
  ]) {
    let [module] = await db.query(
      'SELECT id::text FROM modules WHERE link=$1',
      [route],
    );
    if (!module)
      [module] = await db.query(
        "INSERT INTO modules(module_group_id,sort_order,link,key) SELECT module_group_id,(SELECT COALESCE(MAX(m.sort_order),-1)+1 FROM modules m WHERE m.module_group_id=modules.module_group_id),$1,$2 FROM modules WHERE key='nodia_ai' RETURNING id::text",
        [route, key],
      );
    moduleIds.set(route, module.id);
    await db.query(
      'INSERT INTO user_modules(user_id,module_id) VALUES(1,$1) ON CONFLICT DO NOTHING',
      [module.id],
    );
  }
  const [provider] = await db.query(
    "INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI36 MCP adapter','{}') RETURNING id::text",
  );
  const [category] = await db.query(
    "INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic food','ai36_mcp_food') RETURNING id::text",
  );
  const [business] = await db.query(
    "INSERT INTO businesses(owner_id,name) VALUES(1,'Synthetic MCP business') RETURNING id::text",
  );
  const selection = {
    connection_id: provider.id,
    mode: 'agentic',
    model_id: 'synthetic-ai36-mcp-model',
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
    const lease = await compiled.get(Claim).execute(randomUUID());
    assert.equal(lease?.executionId, accepted.execution.execution_id);
    const result = await compiled
      .get(Execute)
      .execute(identity, accepted.execution.execution_id, lease);
    assert.equal(result.state, 'completed');
    return accepted.execution.execution_id;
  }

  let financial, supplier, supplierDraft;
  const first = await runScenario(async (request) => {
    check(
      'real admission and worker expose the two explicitly synthetic-published native preparers',
      names.every((name) => request.tools.some((tool) => tool.name === name)),
    );
    const id = randomUUID(),
      arguments1 = { partial: { name: 'Synthetic lunch', amount: '20000' } };
    const incomplete = await call(request, names[0], arguments1, id);
    check(
      'MCP produces clarification and a durable draft revision without a financial write',
      incomplete.status === 'needs_clarification' &&
        incomplete.draft_revision === 1 &&
        incomplete.missing_fields.includes('category_id') &&
        (await count('finance_movements')) === 0,
    );
    const [draft] = await db.query(
      'SELECT * FROM nodia_ai_drafts WHERE id=$1',
      [incomplete.draft_id],
    );
    const [toolCall] = await db.query(
      'SELECT * FROM nodia_ai_tool_calls WHERE id=$1',
      [draft.tool_call_id],
    );
    check(
      'server context binds draft actor, chat, run and tool-call FK rather than accepting model identities',
      draft.actor_id === '1' &&
        draft.conversation_id === activeChat &&
        toolCall.run_id === activeRun &&
        toolCall.conversation_id === activeChat &&
        toolCall.adapter_call_id === id,
    );
    const replay = await call(request, names[0], arguments1, id);
    check(
      'replaying a completed MCP call returns the exact clarification without creating another draft',
      isDeepStrictEqual(replay, incomplete) &&
        (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
          1,
    );
    await assert.rejects(
      call(
        request,
        names[0],
        { partial: { name: 'Different', amount: '20000' } },
        id,
      ),
      /request_conflict/u,
    );
    check(
      'reusing the adapter call ID for different arguments fails before any proposal or effect',
      (await count('nodia_ai_proposals', 'conversation_id=$1', [
        activeChat,
      ])) === 0,
    );
    const completion = {
      partial: { type: 'expense', status: 'paid', category_id: category.id },
      draft_id: incomplete.draft_id,
      expected_draft_revision: 1,
    };
    await assert.rejects(
      call(request, names[0], { ...completion, expected_draft_revision: 2 }),
      /revision_conflict/u,
    );
    check(
      'stale MCP draft continuation preserves the original incomplete revision',
      (
        await db.query('SELECT revision FROM nodia_ai_drafts WHERE id=$1', [
          incomplete.draft_id,
        ])
      )[0].revision === 1,
    );
    const continuationId = randomUUID();
    financial = await call(request, names[0], completion, continuationId);
    check(
      'correct CAS continuation merges only the native registered fields into an exact ready preview',
      financial.status === 'ready' &&
        financial.draft_id === incomplete.draft_id &&
        financial.draft_revision === 2 &&
        financial.proposal.steps[0].changes.some(
          (change) => change.field_key === 'amount' && change.after === '20000',
        ) &&
        (await count('finance_movements')) === 0,
    );
    const readyReplay = await call(
      request,
      names[0],
      completion,
      continuationId,
    );
    check(
      'replaying ready preparation returns one proposal and no implicit confirmation',
      isDeepStrictEqual(readyReplay, financial) &&
        (await count('nodia_ai_proposals', 'conversation_id=$1', [
          activeChat,
        ])) === 1 &&
        (await count('nodia_ai_executions')) === 0,
    );
    await assert.rejects(
      call(request, 'nodia_finance_movements_confirm', {
        proposal_id: financial.proposal.proposal_id,
      }),
      /capability_denied/u,
    );
    check(
      'MCP has no financial confirmation operation and never executes a domain effect',
      (await count('finance_movements')) === 0 &&
        (await count('nodia_ai_executions')) === 0,
    );
  });
  await http(
    `/proposals/${financial.proposal.proposal_id}/confirmation-challenge`,
    {
      actor: '2',
      method: 'POST',
      expected: [403, 404],
      body: {
        proposal_revision: financial.proposal.revision,
        expected_hash: financial.proposal.hash,
      },
    },
  );
  const executionId = await humanConfirm(financial.proposal);
  const [receipt] = await db.query(
    'SELECT minimal_receipt FROM nodia_ai_execution_steps WHERE execution_id=$1',
    [executionId],
  );
  check(
    'separate human HTTP confirmation creates one native expense and its atomic receipt',
    (await count('finance_movements', 'user_id=1 AND amount=20000')) === 1 &&
      receipt.minimal_receipt.resource_key === 'finance_movements' &&
      (await count('nodia_ai_executions')) === 1,
  );

  const second = await runScenario(async (request) => {
    supplierDraft = await call(request, names[1], {
      partial: { name: 'Incomplete supplier' },
    });
    assert.equal(supplierDraft.status, 'needs_clarification');
    const typed = {
      kind: 'object',
      fields: [
        {
          key: 'metadata',
          value: {
            kind: 'object',
            fields: [
              { key: 'zero', value: { kind: 'number', value: 0 } },
              { key: 'unset', value: { kind: 'null' } },
            ],
          },
        },
      ],
    };
    const args = {
        partial: {
          business_id: business.id,
          name: 'Synthetic supplier MCP',
          fields: typed,
          tax: 0,
          is_active: true,
        },
      },
      id = randomUUID();
    supplier = await call(request, names[1], args, id);
    const [step] = await db.query(
      'SELECT command_template FROM nodia_ai_proposal_steps WHERE proposal_id=$1',
      [supplier.proposal.proposal_id],
    );
    check(
      'typed closed JSON is explicitly decoded into native supplier metadata preserving zero and null',
      supplier.status === 'ready' &&
        JSON.stringify(step.command_template.command.fields) ===
          JSON.stringify({ metadata: { zero: 0, unset: null } }) &&
        (await count('providers')) === 0,
    );
    await assert.rejects(
      call(request, names[1], {
        partial: {
          business_id: business.id,
          name: 'Synthetic rejected',
          api_key: 'synthetic-secret',
        },
      }),
      /invalid_tool_input/u,
    );
    await assert.rejects(
      call(request, names[1], {
        partial: { business_id: business.id, schema_version: 1 },
      }),
      /invalid_tool_input/u,
    );
    check(
      'unknown and stored-envelope fields are rejected before proposal preparation',
      (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
        2 && (await count('providers')) === 0,
    );
    const counts = await Promise.all(
      ['nodia_ai_drafts', 'nodia_ai_proposals', 'nodia_ai_tool_calls'].map(
        (table) => count(table, 'conversation_id=$1', [activeChat]),
      ),
    );
    const original = registry.validateOutput.bind(registry);
    registry.validateOutput = (tool, value) =>
      original(
        tool,
        tool.toolName === names[1] ? { ...value, uncontracted: true } : value,
      );
    try {
      await assert.rejects(
        call(request, names[1], {
          partial: { business_id: business.id, name: 'Must rollback' },
        }),
        /invalid_tool_output/u,
      );
    } finally {
      registry.validateOutput = original;
    }
    const after = await Promise.all(
      ['nodia_ai_drafts', 'nodia_ai_proposals', 'nodia_ai_tool_calls'].map(
        (table) => count(table, 'conversation_id=$1', [activeChat]),
      ),
    );
    check(
      'an output-contract failure rolls back the native draft, proposal and in-progress MCP receipt together',
      JSON.stringify(counts) === JSON.stringify(after) &&
        (await count('providers')) === 0,
    );
    await db.query(
      'DELETE FROM user_modules WHERE user_id=1 AND module_id=$1',
      [moduleIds.get('/business')],
    );
    const visible = await http('/capabilities');
    check(
      'revoked destination module removes write preparers from current discovery',
      visible.items.every((item) => item.tool_name !== names[1]),
    );
    await assert.rejects(
      call(request, names[1], args, id),
      /capability_denied|capability_unavailable/u,
    );
    check(
      'module revocation denies a previously completed preparation replay without another draft',
      (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
        2,
    );
    await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
      moduleIds.get('/business'),
    ]);
  });
  await runScenario(async (request) => {
    await assert.rejects(
      call(request, names[1], {
        partial: { business_id: business.id },
        draft_id: supplierDraft.draft_id,
        expected_draft_revision: supplierDraft.draft_revision,
      }),
      /revision_conflict/u,
    );
    check(
      'a valid draft from another conversation cannot be continued by the same actor through another run',
      activeChat !== second.chat &&
        (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
          0 &&
        (
          await db.query('SELECT revision FROM nodia_ai_drafts WHERE id=$1', [
            supplierDraft.draft_id,
          ])
        )[0].revision === 1,
    );
    await assert.rejects(
      call(request, names[0], {
        partial: {},
        conversation_id: first.chat,
        actor_id: '3',
        run_id: first.run,
      }),
      /invalid_tool_input/u,
    );
    check(
      'model arguments cannot substitute chat, actor or run context',
      (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
        0,
    );
    let deep = { kind: 'null' };
    for (let depth = 0; depth < 7; depth++)
      deep = { kind: 'object', fields: [{ key: 'child', value: deep }] };
    await assert.rejects(
      call(request, names[1], {
        partial: {
          business_id: business.id,
          name: 'Deep metadata rejected',
          fields: deep,
        },
      }),
      /invalid_tool_input/u,
    );
    check(
      'typed JSON must satisfy the unchanged 16-level MCP wire ceiling even when its decoded native depth is within eight',
      (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
        0 && (await count('providers')) === 0,
    );
    const duplicated = {
      kind: 'object',
      fields: [
        { key: 'same', value: { kind: 'null' } },
        { key: 'same', value: { kind: 'number', value: 0 } },
      ],
    };
    await assert.rejects(
      call(request, names[1], {
        partial: {
          business_id: business.id,
          name: 'Duplicate metadata rejected',
          fields: duplicated,
        },
      }),
      /invalid_tool_input/u,
    );
    check(
      'duplicate typed JSON member keys are rejected without overwriting or preparing a business value',
      (await count('nodia_ai_drafts', 'conversation_id=$1', [activeChat])) ===
        0 && (await count('providers')) === 0,
    );
  });
  const supplierExecution = await humanConfirm(supplier.proposal);
  const [created] = await db.query('SELECT fields,tax FROM providers');
  check(
    'human confirmation executes the exact native supplier metadata and a single atomic receipt',
    (await count('providers')) === 1 &&
      created.tax === 0 &&
      JSON.stringify(created.fields) ===
        JSON.stringify({ metadata: { zero: 0, unset: null } }) &&
      (await count(
        'nodia_ai_execution_steps',
        "execution_id=$1 AND state='completed' AND minimal_receipt IS NOT NULL",
        [supplierExecution],
      )) === 1,
  );
  check(
    'three synthetic worker dispatches have no actual provider, storage or production publication effects',
    dispatches === 3,
  );
  console.log(
    JSON.stringify(
      {
        stage: 'AI-36-C01',
        scope: 'compiled_worker_mcp_native_preparation_human_sql',
        status: 'passed',
        checks: checks.length,
        results: checks,
        elapsed_ms: Date.now() - started,
        migrations: (await db.query('SELECT id FROM migrations')).length,
        synthetic_provider_dispatches: dispatches,
        actual_provider_generations: 0,
        http_requests: httpRequests,
        configured_database_used: false,
        storage_operations: 0,
        actual_domain_effects_in_disposable_database: true,
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
