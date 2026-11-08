// Disposable SQL + compiled production pipeline, API adapter/ledger, gateway,
// proposal, human HTTP boundary and local executor. Only provider HTTP is fake.
// The authenticated HTTP driver is synthetic, not a UI or real-human acceptance.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const originalFetch = globalThis.fetch;
const checks = [];
let fixture,
  app,
  compiled,
  scenario,
  currentRun,
  phase = 'setup',
  loopbackOrigin;
let syntheticPosts = 0,
  forbiddenNetworkRequests = 0;
const cases = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
const response = (value) =>
  new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
const functionResponse = (name, args, id = randomUUID()) => ({
  status: 'completed',
  output: [
    {
      type: 'function_call',
      name,
      call_id: id,
      arguments: JSON.stringify(args),
    },
  ],
});
const answer = () =>
  response({
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'output_text', text: 'Synthetic gateway test completed.' },
        ],
      },
    ],
  });
// Guard module initialization as well as the actual turn: no constructor may
// contact a provider, Redis HTTP endpoint or external storage during this test.
globalThis.fetch = async () => {
  forbiddenNetworkRequests++;
  throw Error('offline_gateway_forbids_network_during_setup');
};
try {
  // This key encrypts one synthetic fixture key. No configured env/key is read.
  process.env.AI_SECRET_MASTER_KEY = randomBytes(32).toString('hex');
  fixture = await createNodiaAiIntegrationFixture('ai9201');
  phase = 'import_production_modules';
  const { db, options, identities } = fixture;
  const entries = [
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
    [
      'nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case',
      'CleanupNodiaAiRuntimeProofsUseCase',
    ],
    [
      'nodia-ai-runtime/use-case/reconcile-nodia-ai-runtime.use-case',
      'ReconcileNodiaAiRuntimeUseCase',
    ],
    [
      'nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case',
      'RecoverNodiaAiJobsUseCase',
    ],
    [
      'nodia-ai-execution/use-case/claim-nodia-ai-execution.use-case',
      'ClaimNodiaAiExecutionUseCase',
    ],
    [
      'nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case',
      'ExecuteNodiaAiLocalExecutionUseCase',
    ],
    [
      'nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case',
      'NodiaAiToolRegistryUseCase',
    ],
    ['common/redis/redis.service', 'RedisService'],
    ['common/filters/all-exceptions.filter', 'AllExceptionsFilter'],
    ['nodia-ai-runtime/config/runtime-policy', 'NODIA_AI_RUNTIME_POLICY'],
    [
      'nodia-ai-conversation/nodia-ai-conversation-body-parser',
      'createNodiaAiConversationBodyParser',
    ],
  ];
  const [
    Tools,
    Conversation,
    Processing,
    Runtime,
    Confirmation,
    Execution,
    Stage,
    Create,
    Admit,
    Cleanup,
    Reconcile,
    Recover,
    ClaimExecution,
    Execute,
    Registry,
    Redis,
    Filter,
    Policy,
    bodyParser,
  ] = await Promise.all(entries.map(([file, name]) => loadAi(file, name)));
  const builder = Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      Tools,
      Conversation,
      Processing,
      Runtime,
      Confirmation,
      Execution,
    ],
    providers: [Stage],
  });
  builder.overrideProvider(Redis).useValue({
    get: async () => null,
    set: async () => {},
    del: async () => {},
    keys: async () => [],
  });
  phase = 'compose_production_modules';
  compiled = await builder.compile();
  const policy = compiled.get(Policy),
    registry = compiled.get(Registry);
  const stage = compiled.get(Stage),
    cleanup = compiled.get(Cleanup),
    reconcile = compiled.get(Reconcile);
  assert.equal(
    policy.budget.provider_dispatches_per_run,
    3,
    'Shared existing POST budget must remain unchanged',
  );
  const selectionTool = 'nodia_capabilities_select';
  const prepareTool = 'nodia_preferences_prepare',
    readTool = 'nodia_preferences_list';
  for (const name of [prepareTool, readTool, 'nodia_proposals_get'])
    assert.ok(registry.get(name), 'Compiled publication must contain ' + name);
  check(
    'compiled production publication supplies actual read/preparation contracts without fixture registration overrides',
    true,
  );
  app = compiled.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.use('/api/v1/nodia-ai', bodyParser(policy.admission.http_json_bytes));
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
  loopbackOrigin = await app.getUrl();
  async function http(
    path,
    { actor = '1', method = 'GET', body, expected = 200 } = {},
  ) {
    const result = await globalThis.fetch(
      loopbackOrigin + '/api/v1/nodia-ai' + path,
      {
        method,
        headers: {
          'content-type': 'application/json',
          'x-fixture-actor': actor,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    const value = await result.json();
    assert.ok(
      (Array.isArray(expected) ? expected : [expected]).includes(result.status),
      method + ' ' + path + ' status=' + result.status,
    );
    return value;
  }
  // No external request can leave this harness, including discovery or Agentic status.
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.startsWith(loopbackOrigin + '/api/v1/nodia-ai/'))
      return originalFetch(url, init);
    if (
      target !== 'https://api.openai.com/v1/responses' ||
      init?.method !== 'POST'
    ) {
      forbiddenNetworkRequests++;
      throw Error('offline_gateway_forbids_network');
    }
    assert.ok(
      scenario && currentRun,
      'Synthetic HTTP must belong to this exact active run',
    );
    syntheticPosts++;
    scenario.posts++;
    assert.equal(init.redirect, 'error');
    assert.equal(
      init.headers.Authorization,
      'Bearer fixture-only-api-chat-key',
    );
    const payload = JSON.parse(init.body);
    assert.equal(payload.store, false);
    assert.equal(payload.model, 'fixture-only-api-chat-model');
    assert.ok(
      payload.tools.every((tool) => tool.type === 'function'),
      'No hosted provider tools',
    );
    const names = payload.tools.map((tool) => tool.name);
    const [run] = await db.query(
      'SELECT context_manifest FROM nodia_ai_runs WHERE id=$1',
      [currentRun],
    );
    const phaseName = run.context_manifest.tool_selection.phase;
    scenario.phases.push(phaseName);
    if (phaseName === 'discovery') {
      assert.ok(names.includes(selectionTool));
      return response(
        functionResponse(selectionTool, {
          catalog_version: registry.catalogVersion,
          capability_ids: scenario.capabilities,
        }),
      );
    }
    assert.equal(phaseName, 'execution');
    if (scenario.posts === 2) {
      if (scenario.beforeCallback) await scenario.beforeCallback();
      for (const call of scenario.calls)
        if (!scenario.requestUnknownTool)
          assert.ok(
            names.includes(call.name),
            'Exact frozen tool must be supplied to API',
          );
      return response({
        status: 'completed',
        output: scenario.calls.map((next) => ({
          type: 'function_call',
          call_id: randomUUID(),
          name: next.name,
          arguments: JSON.stringify(next.arguments),
        })),
      });
    }
    assert.equal(scenario.posts, 3, 'No retry or extra paid continuation');
    scenario.returnedOutputs = payload.input
      .filter((item) => item.type === 'function_call_output')
      .map((item) => JSON.parse(item.output));
    return answer();
  };
  phase = 'fixture_seed';
  let [financeModule] = await db.query(
    "SELECT id::text FROM modules WHERE link='/finances-personal'",
  );
  if (!financeModule)
    [financeModule] = await db.query(
      "INSERT INTO modules(module_group_id,sort_order,link,key) SELECT m.module_group_id,(SELECT COALESCE(max(sort_order),-1)+1 FROM modules WHERE module_group_id=m.module_group_id),'/finances-personal','synthetic_api_gateway_finance' FROM modules m WHERE m.key='nodia_ai' RETURNING id::text",
    );
  assert.ok(financeModule);
  const [nodiaModule] = await db.query(
    "SELECT id::text FROM modules WHERE link='/nodia-ai'",
  );
  assert.ok(nodiaModule);
  for (const actor of ['1', '2'])
    await db.query(
      'INSERT INTO user_modules(user_id,module_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [actor, financeModule.id],
    );
  const [category] = await db.query(
    "INSERT INTO finance_categories(user_id,name,key) VALUES(1,'Synthetic API gateway category','api_gateway_fixture') RETURNING id::text",
  );
  const [catalog] = await db.query(
    "SELECT id::text FROM ai_provider_catalog WHERE key='openai'",
  );
  assert.ok(catalog);
  await db.query(
    'UPDATE ai_provider_catalog SET can_use_api_key=true,is_active=true WHERE id=$1',
    [catalog.id],
  );
  const [provider] = await db.query(
    `INSERT INTO ai_providers(catalog_id,name,use_api_key,use_agentic,default_mode,fields)
    VALUES($1,'Synthetic API chat gateway',true,false,'api_key',$2::jsonb) RETURNING id::text`,
    [
      catalog.id,
      JSON.stringify({
        api_key: {
          selected_model: 'fixture-only-api-chat-model',
          available_models: [{ id: 'fixture-only-api-chat-model' }],
        },
      }),
    ],
  );
  const { encryptSecret, generateFingerprint } =
    await import('../dist/ai-provider/helpers/ai-key-crypto.helper.js');
  await db.query(
    `INSERT INTO ai_api_keys(provider_id,label,secret_ciphertext,secret_fingerprint,display_hint,is_selected,is_active)
    VALUES($1,'Synthetic fixture', $2,$3,'...fixture',true,true)`,
    [
      provider.id,
      encryptSecret('fixture-only-api-chat-key'),
      generateFingerprint('fixture-only-api-chat-key'),
    ],
  );
  const selection = {
    connection_id: provider.id,
    mode: 'api_key',
    model_id: 'fixture-only-api-chat-model',
    effort_id: null,
  };
  const count = async (table) =>
    Number((await db.query(`SELECT count(*)::int n FROM ${table}`))[0].n);
  const create = async (actor) =>
    compiled.get(Create).execute(identities.get(actor), {
      client_request_id: randomUUID(),
      selection,
    });
  async function cleanProofs() {
    for (let i = 0; i < 4; i++) if (!(await cleanup.execute()).processed) break;
  }
  async function turn({
    actor = '1',
    capabilities,
    calls,
    beforeCallback,
    requestUnknownTool = false,
    expectedSuccess = true,
  }) {
    const chat = await create(actor);
    const admitted = await compiled
      .get(Admit)
      .execute(identities.get(actor), chat.conversation_id, {
        client_message_id: randomUUID(),
        expected_conversation_revision: chat.revision,
        parts: [
          {
            kind: 'text',
            text: 'Synthetic API gateway authorization and proposal fixture.',
          },
        ],
      });
    currentRun = admitted.run.run_id;
    scenario = {
      capabilities,
      calls,
      beforeCallback,
      requestUnknownTool,
      posts: 0,
      phases: [],
      returnedOutputs: [],
    };
    for (let i = 0; i < 8; i++) {
      const [row] = await db.query(
        'SELECT state,error_code FROM nodia_ai_runs WHERE id=$1',
        [currentRun],
      );
      if (
        [
          'completed',
          'failed',
          'unknown',
          'cancelled',
          'waiting_for_user',
        ].includes(row.state)
      )
        break;
      const claimed = await stage.execute(
        randomUUID(),
        AbortSignal.timeout(15000),
      );
      await cleanProofs();
      if (!claimed) break;
    }
    let [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
      currentRun,
    ]);
    if (!expectedSuccess && run.state === 'running') {
      // Revocation deliberately removes authority to checkpoint a live lease.
      // Wait for its real expiry, then use the production recovery fence. A test
      // must not rewrite timestamps, fabricate closure or replay the generation.
      const [pending] = await db.query(
        "SELECT state,lease_until FROM nodia_ai_jobs WHERE run_id=$1 AND kind='turn'",
        [currentRun],
      );
      assert.equal(pending?.state, 'leased');
      const remaining =
        Math.max(0, new Date(pending.lease_until).getTime() - Date.now()) + 100;
      assert.ok(
        remaining <= policy.timing.lease_seconds * 1000 + 1000,
        'Bounded real lease expiry',
      );
      const beforeRecoveryPosts = syntheticPosts;
      await delay(remaining);
      await compiled.get(Recover).execute();
      assert.equal(syntheticPosts, beforeRecoveryPosts);
      [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
        currentRun,
      ]);
    }
    if (expectedSuccess)
      assert.equal(run.state, 'completed', 'run error=' + run.error_code);
    else
      assert.ok(
        ['unknown', 'failed'].includes(run.state),
        'Negative must not complete: ' + run.state,
      );
    const receipts = await db.query(
      'SELECT tool_name,public_result FROM nodia_ai_tool_calls WHERE run_id=$1 ORDER BY created_at,id',
      [currentRun],
    );
    if (run.state === 'unknown') {
      const [job] = await db.query(
        "SELECT id FROM nodia_ai_jobs WHERE run_id=$1 AND state='unknown'",
        [currentRun],
      );
      assert.ok(job);
      const before = syntheticPosts;
      const resolved = await reconcile.execute(identities.get('3'), job.id);
      assert.equal(resolved.resolved, true);
      assert.equal(
        syntheticPosts,
        before,
        'Unknown reconciliation must not replay a POST',
      );
    }
    await cleanProofs();
    cases.push({
      actor,
      success_expected: expectedSuccess,
      terminal_run_state: run.state,
      error_code: run.error_code,
      synthetic_provider_posts: scenario.posts,
      provider_dispatches_used: run.provider_dispatches_used,
      receipt_tools: receipts.map((row) => row.tool_name),
      phases: scenario.phases,
    });
    return {
      chat,
      run,
      receipts,
      outputs: scenario.returnedOutputs,
      posts: scenario.posts,
    };
  }
  phase = 'happy_gateway';
  const partial = {
    scope_key: 'finance',
    scope: {},
    key: 'expense_category_id',
    value: category.id,
  };
  const happy = await turn({
    capabilities: [prepareTool],
    calls: [{ name: prepareTool, arguments: { operation: 'create', partial } }],
  });
  check(
    'real API adapter and durable runtime consume exactly three shared POST dispatches across discovery and tool continuation',
    happy.posts === 3 && happy.run.provider_dispatches_used === 3,
  );
  const prepared = happy.receipts.find(
    (row) => row.tool_name === prepareTool,
  )?.public_result;
  assert.equal(prepared?.status, 'ready');
  assert.ok(prepared.proposal);
  check(
    'real ToolGateway persists a preparation receipt without modifying accepted preference state',
    happy.receipts.some((row) => row.tool_name === prepareTool) &&
      (await count('nodia_ai_preferences')) === 0 &&
      (await count('nodia_ai_executions')) === 0,
  );
  check(
    'API continuation receives actual gateway output rather than mock domain data',
    happy.outputs.some(
      (value) =>
        value.status === 'ready' &&
        value.proposal?.hash === prepared.proposal.hash,
    ),
  );
  const [draft] = await db.query(
    'SELECT partial_command FROM nodia_ai_drafts WHERE id=$1',
    [prepared.draft_id],
  );
  check(
    'prepared command is bound to the exact synthetic category and owner scope',
    draft.partial_command.value === category.id &&
      draft.partial_command.scope_key === 'finance',
  );
  const proposal = prepared.proposal;

  phase = 'human_boundary';
  const challengeBody = {
    proposal_revision: proposal.revision,
    expected_hash: proposal.hash,
  };
  await http(`/proposals/${proposal.proposal_id}/confirmation-challenge`, {
    actor: 'missing',
    method: 'POST',
    body: challengeBody,
    expected: 401,
  });
  await http(`/proposals/${proposal.proposal_id}/confirmation-challenge`, {
    actor: '2',
    method: 'POST',
    body: challengeBody,
    expected: [403, 404],
  });
  await http(`/proposals/${proposal.proposal_id}/confirmation-challenge`, {
    method: 'POST',
    body: { ...challengeBody, expected_hash: 'f'.repeat(64) },
    expected: 409,
  });
  await http(`/proposals/${proposal.proposal_id}/confirm`, {
    method: 'POST',
    body: {
      client_request_id: randomUUID(),
      ...challengeBody,
      confirmation_token: 'fixture-token-not-issued',
    },
    expected: [400, 403, 409],
  });
  check(
    'anonymous foreign owner wrong hash and fabricated token cannot authorize any execution',
    (await count('nodia_ai_executions')) === 0 &&
      (await count('nodia_ai_preferences')) === 0,
  );
  const challenge = await http(
    `/proposals/${proposal.proposal_id}/confirmation-challenge`,
    { method: 'POST', body: challengeBody },
  );
  const confirmationBody = {
    client_request_id: randomUUID(),
    ...challengeBody,
    confirmation_token: challenge.confirmation_token,
  };
  const accepted = await http(`/proposals/${proposal.proposal_id}/confirm`, {
    method: 'POST',
    body: confirmationBody,
    expected: 202,
  });
  const duplicate = await http(`/proposals/${proposal.proposal_id}/confirm`, {
    method: 'POST',
    body: confirmationBody,
    expected: 202,
  });
  check(
    'human HTTP confirmation consumes the exact challenge idempotently and never sends another provider request',
    accepted.execution.execution_id === duplicate.execution.execution_id &&
      syntheticPosts === 3 &&
      (await count('nodia_ai_preferences')) === 0,
  );
  const executionId = accepted.execution.execution_id;
  let executed = accepted.execution;
  for (let i = 0; i < 6 && executed.state === 'queued'; i++) {
    const lease = await compiled.get(ClaimExecution).execute(randomUUID());
    assert.equal(lease?.executionId, executionId);
    executed = await compiled
      .get(Execute)
      .execute(identities.get('1'), executionId, lease);
  }
  assert.equal(executed.state, 'completed');
  const [preference] = await db.query(
    'SELECT id,owner_id::text,scope_key,scope,key,value FROM nodia_ai_preferences',
  );
  const { id: preferenceId, ...actualPreference } = preference;
  assert.deepEqual(actualPreference, { owner_id: '1', ...partial });
  const [receipt] = await db.query(
    'SELECT minimal_receipt,bound_command_hash FROM nodia_ai_execution_steps WHERE execution_id=$1',
    [executionId],
  );
  const snapshot = await db.query(
    'SELECT to_jsonb(p) state FROM nodia_ai_preferences p',
  );
  await compiled.get(Execute).execute(identities.get('1'), executionId);
  check(
    'confirmed native executor writes one exact SQL preference and committed receipt remains idempotent on replay',
    (await count('nodia_ai_preferences')) === 1 &&
      receipt.minimal_receipt.resource_id === preferenceId &&
      /^[a-f0-9]{64}$/.test(receipt.bound_command_hash) &&
      JSON.stringify(
        await db.query('SELECT to_jsonb(p) state FROM nodia_ai_preferences p'),
      ) === JSON.stringify(snapshot),
  );
  phase = 'read_after_confirmed_effect';
  const actualRead = await turn({
    capabilities: [readTool],
    calls: [{ name: readTool, arguments: {} }],
  });
  check(
    'a separate realistic single-function API turn reads the actual committed SQL effect within the same three-POST budget',
    actualRead.posts === 3 &&
      actualRead.run.provider_dispatches_used === 3 &&
      actualRead.outputs.some(
        (value) =>
          Array.isArray(value.items) &&
          value.items.some((item) => item.preference_id === preferenceId),
      ),
  );

  phase = 'foreign_owner';
  const ownerNegative = await turn({
    actor: '2',
    capabilities: ['nodia_proposals_get'],
    calls: [
      {
        name: 'nodia_proposals_get',
        arguments: { proposal_id: proposal.proposal_id },
      },
    ],
    expectedSuccess: false,
  });
  check(
    'API function callback cannot read another owners proposal and leaves no public receipt',
    !ownerNegative.receipts.some(
      (row) => row.tool_name === 'nodia_proposals_get',
    ) && (await count('nodia_ai_preferences')) === 1,
  );
  phase = 'module_revocation';
  await turn({
    capabilities: [prepareTool],
    calls: [{ name: prepareTool, arguments: { operation: 'create', partial } }],
    beforeCallback: () =>
      db.query('DELETE FROM user_modules WHERE user_id=1 AND module_id=$1', [
        financeModule.id,
      ]),
    expectedSuccess: false,
  });
  check(
    'module revocation between HTTP dispatch and callback is revalidated before preparing a new change',
    (await count('nodia_ai_preferences')) === 1 &&
      (await count('nodia_ai_executions')) === 1,
  );
  await db.query('INSERT INTO user_modules(user_id,module_id) VALUES(1,$1)', [
    financeModule.id,
  ]);
  phase = 'grant_revocation';
  const revoked = await turn({
    capabilities: [readTool],
    calls: [{ name: readTool, arguments: {} }],
    beforeCallback: () =>
      db.query(
        'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE run_id=$1',
        [currentRun],
      ),
    expectedSuccess: false,
  });
  check(
    'revoked invocation grant cannot borrow a previously frozen tool or create a receipt',
    !revoked.receipts.some((row) => row.tool_name === readTool),
  );
  phase = 'model_confirmation_denied';
  const confirmNegative = await turn({
    capabilities: [readTool],
    calls: [
      {
        name: 'nodia_proposals_confirm',
        arguments: { proposal_id: proposal.proposal_id },
      },
    ],
    requestUnknownTool: true,
    expectedSuccess: false,
  });
  check(
    'provider-supplied confirmation tool is absent from the catalog and rejected before any gateway or consent action',
    !confirmNegative.receipts.some(
      (row) => row.tool_name === 'nodia_proposals_confirm',
    ) &&
      (await count('nodia_ai_executions')) === 1 &&
      (await count('nodia_ai_preferences')) === 1,
  );
  phase = 'missing_module';
  await db.query('DELETE FROM user_modules WHERE user_id=2 AND module_id=$1', [
    nodiaModule.id,
  ]);
  const beforeDenied = syntheticPosts;
  await assert.rejects(create('2'));
  check(
    'missing NodiaAI module rejects admission without contacting a provider',
    syntheticPosts === beforeDenied,
  );
  const [quiet] = await db.query(`SELECT
    (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) active_jobs,
    (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,
    (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state<>'free') busy_slots,
    (SELECT count(*)::int FROM nodia_ai_api_dispatches WHERE state<>'closed' OR acknowledged_at IS NULL) api_pending`);
  check(
    'all API attempts close and ACK through real reconciliation without replay and final SQL is quiet',
    Object.values(quiet).every((value) => value === 0),
  );
  check(
    'no real provider destination or credential was used',
    forbiddenNetworkRequests === 0,
  );
  console.log(
    JSON.stringify({
      success: true,
      task: 'api_chat_common_gateway_sql',
      checks,
      checks_passed: checks.length,
      cases,
      synthetic_provider_http_posts: syntheticPosts,
      real_provider_http_requests: 0,
      forbidden_network_requests: forbiddenNetworkRequests,
      real_credentials: false,
      synthetic_http_actor: true,
      physical_user_click: false,
      production_database_accessed: false,
      production_gateway_and_api_adapter: true,
      durable_api_runtime: true,
      production_publication: true,
      preference_effects: 1,
      sql_quiet: quiet,
      postgres: '16 disposable',
      cleanup: 'owned container and volumes removed in finally',
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      success: false,
      task: 'api_chat_common_gateway_sql',
      phase,
      checks_passed: checks.length,
      checks,
      error_code:
        typeof error?.code === 'string'
          ? error.code
          : /^nodia_ai:[a-z_]+$/.test(error?.message ?? '')
            ? error.message
            : error instanceof assert.AssertionError
              ? 'assertion_failed'
              : 'gateway_fixture_failed',
      assertion:
        error instanceof assert.AssertionError
          ? String(error.message).slice(0, 300)
          : null,
      code_frames: String(error?.stack ?? '')
        .split('\n')
        .slice(1, 7)
        .map((line) =>
          line.replaceAll(
            '/opt/nodia/operations/api-chat-r01/offline-tests-r01/',
            '<offline-stage>/',
          ),
        ),
      real_provider_http_requests: 0,
      real_credentials: false,
    }),
  );
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  try {
    if (app) await app.close();
    else if (compiled) await compiled.close();
  } finally {
    if (fixture) await fixture.close();
  }
}
