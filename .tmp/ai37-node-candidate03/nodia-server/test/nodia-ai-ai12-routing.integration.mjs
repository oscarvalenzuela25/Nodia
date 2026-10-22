// Real PostgreSQL/compiled Nest composition; provider and terminal proofs are explicit synthetic fixtures.
import assert from 'node:assert/strict';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai12');
const { db, options, identities } = fixture;
const passed = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  passed.push(name);
};
let app;
try {
  const definitions = [
    [
      'nodia-ai-conversation/nodia-ai-conversation.module',
      'NodiaAiConversationModule',
    ],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    [
      'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
      'CreateNodiaAiConversationUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case',
      'AdmitNodiaAiMessageUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/update-nodia-ai-routing.use-case',
      'UpdateNodiaAiRoutingUseCase',
    ],
    [
      'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
      'RunNodiaAiStageUseCase',
    ],
  ];
  const [
    Conversation,
    Processing,
    Runtime,
    Adapter,
    Create,
    Admit,
    Routing,
    Stage,
  ] = await Promise.all(definitions.map(([file, name]) => loadAi(file, name)));
  const agentModel = 'synthetic-agentic-configured',
    webModel = 'synthetic-web-selected';
  const [provider] = await db.query(
    'INSERT INTO ai_providers(name,fields) VALUES($1,$2::jsonb) RETURNING id',
    [
      'Synthetic routing fixture only',
      JSON.stringify({
        token_plan_agentic: {
          selected_model: agentModel,
          thinking_level: null,
        },
      }),
    ],
  );
  const selection = {
    connection_id: provider.id,
    mode: 'token_plan_web',
    model_id: webModel,
    effort_id: null,
  };
  const target = {
    selection: {
      ...selection,
      mode: 'token_plan_agentic',
      model_id: agentModel,
    },
    configuration_generation: 'c'.repeat(64),
    session_generation: 'd'.repeat(32),
  };
  const key = (mode) =>
    'gemini-profile:' + (mode === 'token_plan_web' ? 'a' : 'b').repeat(64);
  const calls = [];
  let protocolTotal = 0;
  let exerciseDeniedCallbacks = false;
  const external = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe(selected) {
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey: key(selected.mode),
        configurationGeneration: target.configuration_generation,
        sessionGeneration: target.session_generation,
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: selected.mode === 'token_plan_agentic',
        reason: null,
      };
    },
    async verifyConfiguration() {},
    async execute(request, signal) {
      calls.push(request.selection.mode);
      const [attempt] = await db.query(
        'SELECT phase,selection_snapshot,routing_phase FROM nodia_ai_job_attempts WHERE id=$1',
        [request.attemptId],
      );
      check(
        'dispatch is armed with the actual phase selection',
        attempt.phase === 'dispatch_armed' &&
          attempt.selection_snapshot.mode === request.selection.mode,
      );
      const proof = {
        engine: request.selection.mode === 'token_plan_web' ? 'web' : 'agentic',
        attemptId: request.attemptId,
        resourceKey: request.resourceKey,
        sessionGeneration: request.sessionGeneration,
        operationRef: request.attemptId,
        terminalProofId: randomUUID(),
        processClosed: true,
        outcome: 'completed',
        observedAt: new Date(),
      };
      if (request.selection.mode === 'token_plan_web') {
        check(
          'Web never receives MCP tools or callbacks',
          request.tools === undefined && request.onToolCall === undefined,
        );
        return {
          kind: 'delegation_request',
          reason: 'Synthetic explicit knowledge request',
          terminalProof: proof,
        };
      }
      check(
        'Agentic receives exactly seven current infrastructure and report tools and no unpublished domain capability',
        request.tools.length === 7 && new Set(request.tools.map((tool) => tool.name)).size === 7 &&
          request.tools.every((t) =>
            ['nodia_knowledge_index', 'nodia_knowledge_get', 'nodia_capabilities_search', 'nodia_capabilities_describe', 'nodia_entities_search', 'nodia_reports_describe', 'nodia_reports_run'].includes(t.name),
          ),
      );
      if (exerciseDeniedCallbacks) {
        await assert.rejects(request.onToolCall({callId: 'synthetic-invalid-' + request.attemptId,
          name: 'nodia_knowledge_index', arguments: {forbidden: true}}, signal), /nodia_ai:invalid_knowledge_request/);
        // Reading through a separate connection observes only committed work;
        // rejected arguments must not roll back their request reservation.
        const [charged] = await db.query(`SELECT r.tool_calls_used,
          (SELECT count(*)::integer FROM nodia_ai_tool_calls t WHERE t.run_id=r.id) AS receipts
          FROM nodia_ai_runs r JOIN nodia_ai_jobs j ON j.run_id=r.id
          JOIN nodia_ai_job_attempts a ON a.job_id=j.id WHERE a.id=$1`, [request.attemptId]);
        check('rejected callback commits request cost without a tool receipt', charged.tool_calls_used === 1 && charged.receipts === 0);
        await assert.rejects(request.onToolCall({callId: 'synthetic-missing-' + request.attemptId,
          name: 'nodia_knowledge_get', arguments: {fragment_ids: ['synthetic:unpublished:fragment']}}, signal));
        const [rolledBackRead] = await db.query(`SELECT r.tool_calls_used,
          (SELECT count(*)::integer FROM nodia_ai_tool_calls t WHERE t.run_id=r.id) AS receipts
          FROM nodia_ai_runs r JOIN nodia_ai_jobs j ON j.run_id=r.id
          JOIN nodia_ai_job_attempts a ON a.job_id=j.id WHERE a.id=$1`, [request.attemptId]);
        check('knowledge read rollback preserves the separately committed request cost', rolledBackRead.tool_calls_used === 2 && rolledBackRead.receipts === 0);
      }
      await request.onProtocolProgress(3, signal).catch((error) => {
        console.error('Synthetic progress failure', error);
        throw error;
      });
      await request.onProtocolProgress(3, signal);
      protocolTotal += 3;
      const call = {
        callId: 'synthetic-call-' + request.attemptId,
        name: 'nodia_knowledge_index',
        arguments: {},
      };
      const result = await request.onToolCall(call, signal).catch((error) => {
        console.error('Synthetic tool failure', error);
        throw error;
      });
      assert.deepEqual(await request.onToolCall(call, signal), result);
      if (exerciseDeniedCallbacks) {
        await request.onProtocolProgress(9, signal, 2);
        await request.onProtocolProgress(9, signal, 2);
        await assert.rejects(request.onProtocolProgress(10, signal, 11), /nodia_ai:execution_limit/);
        const [hidden] = await db.query(`SELECT r.tool_calls_used,r.mcp_rpc_messages_used
          FROM nodia_ai_runs r JOIN nodia_ai_jobs j ON j.run_id=r.id
          JOIN nodia_ai_job_attempts a ON a.job_id=j.id WHERE a.id=$1`, [request.attemptId]);
        check('Native hidden requests share the SQL callback budget and repeated progress does not spend twice', hidden.tool_calls_used === 6 && hidden.mcp_rpc_messages_used === 9);
      }
      check(
        'technical callback cannot publish draft knowledge',
        Array.isArray(result.items) && result.items.length === 0,
      );
      return {
        kind: 'answer',
        text: 'Synthetic Agentic answer',
        terminalProof: proof,
      };
    },
  };
  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      Conversation,
      Processing,
      Runtime,
    ],
    providers: [Stage],
  })
    .overrideProvider(Adapter)
    .useValue(external)
    .compile();
  app = module.createNestApplication({ logger: false });
  await app.init();
  const create = module.get(Create),
    admit = module.get(Admit),
    routing = module.get(Routing),
    stage = module.get(Stage),
    identity = identities.get('1');
  const worker = randomUUID(),
    signal = new AbortController().signal;
  async function start() {
    const chat = await create.execute(identity, {
      client_request_id: randomUUID(),
      selection,
    });
    const enabled = await routing.execute(identity, chat.conversation_id, {
      expected_conversation_revision: chat.revision,
      expected_routing_revision: chat.routing.revision,
      enabled: true,
      target,
    });
    check(
      'explicit consent persists the exact configured Agentic target',
      enabled.routing.enabled &&
        enabled.routing.target.selection.model_id === agentModel,
    );
    const accepted = await admit.execute(identity, chat.conversation_id, {
      client_message_id: randomUUID(),
      expected_conversation_revision: enabled.revision,
      parts: [{ kind: 'text', text: 'Synthetic knowledge request' }],
    });
    await stage.execute(worker, signal); // context, no provider
    await stage.execute(worker, signal); // Web typed delegation
    return { chat: enabled, accepted };
  }
  const first = await start();
  const [queued] = await db.query(
    'SELECT j.state,j.stage_key,r.provider_dispatches_used,r.delegations_used FROM nodia_ai_jobs j JOIN nodia_ai_runs r ON r.id=j.run_id WHERE r.id=$1',
    [first.accepted.run.run_id],
  );
  check(
    'Web terminal seal queues one delegated phase within the same run',
    queued.state === 'ready' &&
      queued.stage_key === 'delegated_inference' &&
      queued.provider_dispatches_used === 1 &&
      queued.delegations_used === 0,
  );
  check(
    'Web profile is released before Agentic can begin',
    (
      await db.query(
        'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
        [key('token_plan_web')],
      )
    )[0].state === 'free',
  );
  await stage.execute(worker, signal);
  const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
    first.accepted.run.run_id,
  ]);
  if (run.state !== 'completed')
    console.error(
      JSON.stringify({
        state: run.state,
        error_code: run.error_code,
        calls,
        attempts: await db.query(
          'SELECT a.phase,a.error_code,a.stage_key FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1',
          [run.id],
        ),
      }),
    );
  check(
    'one run shares dispatch/delegation/tool/protocol budgets across phases',
    run.state === 'completed' &&
      run.provider_dispatches_used === 2 &&
      run.delegations_used === 1 &&
      run.tool_calls_used === 2 &&
      run.mcp_rpc_messages_used === 3 &&
      protocolTotal === 3,
  );
  check(
    'base selection stays Web after Agentic completion',
    run.selection_snapshot.mode === 'token_plan_web' &&
      (
        await db.query(
          'SELECT selected_mode FROM nodia_ai_conversations WHERE id=$1',
          [first.chat.conversation_id],
        )
      )[0].selected_mode === 'token_plan_web',
  );
  check(
    'callback idempotency stores one durable result',
    (
      await db.query('SELECT id FROM nodia_ai_tool_calls WHERE run_id=$1', [
        run.id,
      ])
    ).length === 1,
  );
  const attempts = await db.query(
    'SELECT a.routing_phase,a.phase FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE j.run_id=$1 ORDER BY a.started_at',
    [run.id],
  );
  check(
    'completed attempts preserve base/delegated phase provenance',
    attempts.some(
      (a) => a.routing_phase === 'base' && a.phase === 'completed',
    ) &&
      attempts.some(
        (a) => a.routing_phase === 'delegated' && a.phase === 'completed',
      ),
  );
  const acks = await db.query(
    "SELECT recovery_descriptor FROM nodia_ai_jobs WHERE kind='reconcile' AND stage_key='reconcile_ack'",
  );
  check(
    'both native closures enqueue detached acknowledgements',
    acks.length === 2 &&
      acks.every((a) => a.recovery_descriptor.terminal_proof),
  );

  const second = await start();
  const [current] = await db.query(
    'SELECT revision,routing_revision FROM nodia_ai_conversations WHERE id=$1',
    [second.chat.conversation_id],
  );
  await routing.execute(identity, second.chat.conversation_id, {
    expected_conversation_revision: current.revision,
    expected_routing_revision: current.routing_revision,
    enabled: false,
    target: null,
  });
  const beforeDisable = calls.length;
  await stage.execute(worker, signal);
  const [disabled] = await db.query(
    'SELECT state,provider_dispatches_used,delegations_used FROM nodia_ai_runs WHERE id=$1',
    [second.accepted.run.run_id],
  );
  check(
    'withdrawing consent fences Agentic before profile reservation/dispatch',
    disabled.state === 'failed' &&
      disabled.provider_dispatches_used === 1 &&
      disabled.delegations_used === 0 &&
      calls.length === beforeDisable,
  );
  check(
    'disabled run does not strand its conversation active job',
    (
      await db.query(
        'SELECT active_job_id FROM nodia_ai_conversations WHERE id=$1',
        [second.chat.conversation_id],
      )
    )[0].active_job_id === null,
  );

  const third = await start();
  await db.query('UPDATE nodia_ai_runs SET delegations_used=1 WHERE id=$1', [
    third.accepted.run.run_id,
  ]);
  const beforeExhaustion = calls.length;
  await stage.execute(worker, signal);
  const [exhausted] = await db.query(
    'SELECT state,provider_dispatches_used,delegations_used FROM nodia_ai_runs WHERE id=$1',
    [third.accepted.run.run_id],
  );
  check(
    'exhausted shared delegation budget cannot send another inference',
    exhausted.state === 'failed' &&
      exhausted.provider_dispatches_used === 1 &&
      exhausted.delegations_used === 1 &&
      calls.length === beforeExhaustion,
  );
  check(
    'known pre-arm failure releases the local Agentic slot',
    (
      await db.query(
        'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
        [key('token_plan_agentic')],
      )
    )[0].state === 'free',
  );
  const exhaustedProvider = await start();
  const [spentProviderBudget] = await db.query(
    "WITH spent AS (UPDATE nodia_ai_runs SET provider_dispatches_used=(budget_snapshot->>'provider_dispatches')::integer WHERE id=$1 RETURNING provider_dispatches_used) SELECT provider_dispatches_used FROM spent",
    [exhaustedProvider.accepted.run.run_id],
  );
  const callsBeforeProviderExhaustion = calls.length;
  await stage.execute(worker, signal);
  const [rejectedProviderBudget] = await db.query(
    'SELECT state,error_code,provider_dispatches_used,delegations_used FROM nodia_ai_runs WHERE id=$1',
    [exhaustedProvider.accepted.run.run_id],
  );
  if (rejectedProviderBudget.state !== 'failed' || rejectedProviderBudget.error_code !== 'nodia_ai:execution_limit' || rejectedProviderBudget.delegations_used !== 0 || rejectedProviderBudget.provider_dispatches_used !== spentProviderBudget.provider_dispatches_used || calls.length !== callsBeforeProviderExhaustion)
    console.error(JSON.stringify({ diagnostic: 'synthetic_provider_budget_rejection', ...rejectedProviderBudget, calls_before: callsBeforeProviderExhaustion, calls_after: calls.length, expected_provider_dispatches_used: spentProviderBudget.provider_dispatches_used }));
  check(
    'exhausted shared provider dispatch budget fails before inference and rolls back the delegated charge',
    rejectedProviderBudget.state === 'failed' &&
      rejectedProviderBudget.error_code === 'nodia_ai:execution_limit' &&
      rejectedProviderBudget.provider_dispatches_used === spentProviderBudget.provider_dispatches_used &&
      rejectedProviderBudget.delegations_used === 0 &&
      calls.length === callsBeforeProviderExhaustion,
  );
  const [providerBudgetSlot] = await db.query(
    'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [key('token_plan_agentic')],
  );
  const [providerBudgetAttempt] = await db.query(
    "SELECT count(*)::int AS count FROM nodia_ai_job_attempts WHERE job_id IN (SELECT id FROM nodia_ai_jobs WHERE run_id=$1) AND (ended_at IS NULL OR phase='unknown')",
    [exhaustedProvider.accepted.run.run_id],
  );
  check(
    'known provider budget rejection releases its Agentic profile and closes all attempts without quarantine',
    providerBudgetSlot.state === 'free' && providerBudgetAttempt.count === 0,
  );
  const fourth = await start();
  exerciseDeniedCallbacks = true;
  await stage.execute(worker, signal);
  const [denied] = await db.query('SELECT state,tool_calls_used FROM nodia_ai_runs WHERE id=$1', [fourth.accepted.run.run_id]);
  check('invalid, rolled back, repeated and hidden callbacks share one durable request budget', denied.state === 'completed' && denied.tool_calls_used === 6);
  console.log(
    JSON.stringify(
      {
        task: 'AI-12 routing and technical knowledge',
        checks: passed.length,
        passed,
        external_adapter: 'synthetic',
        real_inference: false,
      },
      null,
      2,
    ),
  );
} finally {
  await app?.close();
  await fixture.close();
}
