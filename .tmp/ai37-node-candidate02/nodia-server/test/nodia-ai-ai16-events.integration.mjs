// Compiled producers and transactional journal on disposable PostgreSQL16 only.
// The external adapter is synthetic; configured DB, providers and profiles are never used.
import assert from 'node:assert/strict';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import { createNodiaAiUnpublishedFixture } from './nodia-ai-unpublished.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai16');
const { db, options, identities } = fixture;
const unpublished = await createNodiaAiUnpublishedFixture();
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
let application;
try {
  const [Conversation, Processing, Runtime, Adapter, Create, Admit, Stage] =
    await Promise.all(
      [
        [
          'nodia-ai-conversation/nodia-ai-conversation.module',
          'NodiaAiConversationModule',
        ],
        [
          'nodia-ai-context/nodia-ai-processing.module',
          'NodiaAiProcessingModule',
        ],
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
          'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
          'RunNodiaAiStageUseCase',
        ],
      ].map(([file, name]) => loadAi(file, name)),
    );
  const { appendNodiaAiEvent } =
    await import('../dist/nodia-ai-run/event-journal.js');
  const [provider] = await db.query(
    "INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI16 adapter','{}') RETURNING id",
  );
  const selection = {
    connection_id: provider.id,
    mode: 'token_plan_agentic',
    model_id: 'synthetic-ai16-selected-model',
    effort_id: null,
  };
  const resourceKey = 'gemini-profile:' + '6'.repeat(64);
  let dispatches = 0;
  const external = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() {
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey,
        configurationGeneration: 'c'.repeat(64),
        sessionGeneration: 'd'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: true,
        reason: null,
      };
    },
    async verifyConfiguration() {},
    async execute(request, signal) {
      dispatches++;
      await request.onProtocolProgress(3, signal);
      await request.onProtocolProgress(3, signal);
      const call = {
        callId: `synthetic:${request.attemptId}`,
        name: 'nodia_knowledge_index',
        arguments: {},
      };
      const result = await request.onToolCall(call, signal);
      assert.deepEqual(await request.onToolCall(call, signal), result);
      return {
        kind: 'answer',
        text: 'Synthetic sealed answer',
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
  const module = await unpublished
    .override(
      Test.createTestingModule({
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
      }),
    )
    .overrideProvider(Adapter)
    .useValue(external)
    .compile();
  application = module.createNestApplication({ logger: false });
  await application.init();
  const create = module.get(Create),
    admit = module.get(Admit),
    stage = module.get(Stage);
  const identity = identities.get('1');
  const chat = await create.execute(identity, {
    client_request_id: randomUUID(),
    selection,
  });
  const input = {
    client_message_id: randomUUID(),
    expected_conversation_revision: chat.revision,
    parts: [{ kind: 'text', text: 'Synthetic owner question' }],
  };
  const accepted = await admit.execute(identity, chat.conversation_id, input);
  const count = async (runId = accepted.run.run_id) =>
    Number(
      (
        await db.query(
          'SELECT count(*)::integer AS total FROM nodia_ai_events WHERE run_id=$1',
          [runId],
        )
      )[0].total,
    );
  check(
    'admission writes one accepted event atomically with the new run',
    (await count()) === 1,
  );
  await admit.execute(identity, chat.conversation_id, input);
  check(
    'duplicate admission does not publish another accepted event',
    (await count()) === 1,
  );
  const worker = randomUUID(),
    signal = new AbortController().signal;
  await stage.execute(worker, signal);
  await stage.execute(worker, signal);
  const events = await db.query(
    'SELECT * FROM nodia_ai_events WHERE run_id=$1 ORDER BY seq',
    [accepted.run.run_id],
  );
  const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
    accepted.run.run_id,
  ]);
  check(
    'compiled context and inference producers complete the synthetic run exactly once',
    run.state === 'completed' && dispatches === 1,
  );
  check(
    'state transitions have strictly increasing revisions matching the final run',
    JSON.stringify(
      events
        .filter((e) => e.public_payload.kind === 'run_changed')
        .map((e) => e.public_payload.payload.revision),
    ) === JSON.stringify([2, 3, 4, 5]) && run.revision === 5,
  );
  check(
    'conversation event sequence is contiguous bigint text',
    events.every((e, i) => e.seq === String(i + 1)),
  );
  const receiptEvents = events.filter(
    (e) => e.public_payload.kind === 'tool_completed',
  );
  const receipts = await db.query(
    'SELECT * FROM nodia_ai_tool_calls WHERE run_id=$1',
    [run.id],
  );
  check(
    'callback replay consumes no second receipt or event',
    receipts.length === 1 && receiptEvents.length === 1,
  );
  assert.deepEqual(receiptEvents[0].public_payload, {
    kind: 'tool_completed',
    payload: {
      error: null,
      state: 'completed',
      result_ref: {
        tool_name: receipts[0].tool_name,
        contract_hash: receipts[0].contract_hash,
        tool_call_id: receipts[0].id,
      },
    },
  });
  check(
    'completed tool event references the exact durable receipt without its result or arguments',
    true,
  );
  check(
    'message sealing references the committed assistant without duplicating its text',
    events.some(
      (e) =>
        e.public_payload.kind === 'message_sealed' &&
        e.public_payload.payload.message_id === run.assistant_message_id,
    ) &&
      !JSON.stringify(events).includes('Synthetic sealed answer') &&
      !JSON.stringify(events).includes('Synthetic owner question'),
  );
  check(
    'RPC progress and repeated delivery add no synthetic progress or token events',
    events.length === 7 &&
      events.every((e) =>
        [
          'run_accepted',
          'run_changed',
          'tool_completed',
          'message_sealed',
        ].includes(e.public_payload.kind),
      ),
  );
  const beforeRead = dispatches;
  await db.query('SELECT * FROM nodia_ai_events WHERE run_id=$1 ORDER BY seq', [
    run.id,
  ]);
  await db.query(
    'SELECT public_result FROM nodia_ai_tool_calls WHERE run_id=$1',
    [run.id],
  );
  check(
    'reopening stored observation never reexecutes the adapter or tool',
    dispatches === beforeRead &&
      (await stage.execute(worker, signal)) === false,
  );

  const common = {
    conversationId: chat.conversation_id,
    runId: run.id,
    kind: 'tool_completed',
    payload: {
      result_ref: {
        tool_call_id: receipts[0].id,
        tool_name: receipts[0].tool_name,
        contract_hash: receipts[0].contract_hash,
      },
      state: 'completed',
      error: null,
    },
    moduleRoutes: [],
    maxEvents: 256,
  };
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      db.transaction((manager) =>
        appendNodiaAiEvent(manager, { ...common, eventKey: `concurrent:${i}` }),
      ),
    ),
  );
  const concurrent = await db.query(
    "SELECT seq FROM nodia_ai_events WHERE run_id=$1 AND event_key LIKE 'concurrent:%' ORDER BY seq",
    [run.id],
  );
  check(
    'concurrent producers serialize unique contiguous sequences on the conversation row',
    concurrent.length === 8 &&
      concurrent.every((e, i) => e.seq === String(events.length + i + 1)),
  );
  await Promise.all(
    Array.from({ length: 8 }, () =>
      db.transaction((manager) =>
        appendNodiaAiEvent(manager, { ...common, eventKey: 'same-intent' }),
      ),
    ),
  );
  check(
    'concurrent duplicate publication has one identity and one quota cost',
    Number(
      (
        await db.query(
          "SELECT count(*)::integer AS total FROM nodia_ai_events WHERE run_id=$1 AND event_key='same-intent'",
          [run.id],
        )
      )[0].total,
    ) === 1,
  );
  await assert.rejects(
    db.transaction((manager) =>
      appendNodiaAiEvent(manager, {
        ...common,
        eventKey: 'same-intent',
        moduleRoutes: ['/finance'],
      }),
    ),
    /request_conflict/,
  );
  check(
    'same event key with a different authority manifest is a conflict',
    true,
  );

  const [beforeRollback] = await db.query(
    'SELECT next_event_seq FROM nodia_ai_conversations WHERE id=$1',
    [chat.conversation_id],
  );
  const rolledBackReceipt = randomUUID();
  await assert.rejects(
    db.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO nodia_ai_tool_calls(id,conversation_id,run_id,adapter_call_id,tool_name,contract_hash,arguments_hash,arguments,public_result,scope_manifest,state,completed_at)
      VALUES($1,$2,$3,'synthetic-rollback','nodia_knowledge_index',$4,$4,'{}','{}','{}','completed',clock_timestamp())`,
        [rolledBackReceipt, chat.conversation_id, run.id, 'a'.repeat(64)],
      );
      await appendNodiaAiEvent(manager, {
        ...common,
        eventKey: 'rollback',
        payload: {
          ...common.payload,
          result_ref: {
            ...common.payload.result_ref,
            tool_call_id: rolledBackReceipt,
          },
        },
      });
      throw Error('synthetic:rollback');
    }),
    /synthetic:rollback/,
  );
  const [afterRollback] = await db.query(
    'SELECT next_event_seq FROM nodia_ai_conversations WHERE id=$1',
    [chat.conversation_id],
  );
  check(
    'receipt, event and sequence reservation roll back together',
    beforeRollback.next_event_seq === afterRollback.next_event_seq &&
      (
        await db.query('SELECT id FROM nodia_ai_tool_calls WHERE id=$1', [
          rolledBackReceipt,
        ])
      ).length === 0 &&
      (
        await db.query(
          "SELECT id FROM nodia_ai_events WHERE event_key='rollback'",
        )
      ).length === 0,
  );

  const quotaChat = await create.execute(identity, {
    client_request_id: randomUUID(),
    selection,
  });
  const quota = await admit.execute(identity, quotaChat.conversation_id, {
    ...input,
    client_message_id: randomUUID(),
    expected_conversation_revision: quotaChat.revision,
  });
  const quotaCommon = {
    ...common,
    conversationId: quotaChat.conversation_id,
    runId: quota.run.run_id,
    maxEvents: 8,
  };
  for (let i = 0; i < 3; i++)
    await db.transaction((manager) =>
      appendNodiaAiEvent(manager, { ...quotaCommon, eventKey: `quota:${i}` }),
    );
  await assert.rejects(
    db.transaction((manager) =>
      appendNodiaAiEvent(manager, {
        ...quotaCommon,
        eventKey: 'quota:exceeded',
      }),
    ),
    /execution_limit/,
  );
  await db.transaction((manager) =>
    appendNodiaAiEvent(manager, { ...quotaCommon, eventKey: 'quota:0' }),
  );
  check(
    'duplicate recovery is allowed before checking exhausted nonterminal quota',
    (await count(quota.run.run_id)) === 4,
  );
  await db.transaction(async (manager) => {
    // Real terminal transition and its event share the transaction. Deliberately
    // omit terminal:true: the journal must derive reservation use from payload.
    await manager.query(
      "UPDATE nodia_ai_runs SET state='failed',revision=revision+1,completed_at=clock_timestamp() WHERE id=$1",
      [quota.run.run_id],
    );
    await manager.query(
      "UPDATE nodia_ai_jobs SET state='failed' WHERE run_id=$1",
      [quota.run.run_id],
    );
    await manager.query(
      'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1',
      [quotaChat.conversation_id],
    );
    await manager.query(
      'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE run_id=$1',
      [quota.run.run_id],
    );
    await appendNodiaAiEvent(manager, {
      ...quotaCommon,
      eventKey: 'quota:terminal',
      kind: 'run_changed',
      payload: { revision: 2, state: 'failed', error: null },
    });
  });
  check(
    'terminal state derives its reserved slot without a caller terminal hint',
    (await count(quota.run.run_id)) === 5,
  );
  const [quotaTerminal] = await db.query(
    'SELECT state,revision FROM nodia_ai_runs WHERE id=$1',
    [quota.run.run_id],
  );
  check(
    'terminal transition and derived reservation commit together',
    quotaTerminal.state === 'failed' && quotaTerminal.revision === 2,
  );
  check(
    'the run event lookup has a dedicated run-sequence index',
    (
      await db.query(
        "SELECT indexdef FROM pg_indexes WHERE tablename='nodia_ai_events'",
      )
    ).some((e) => /\(run_id, seq\)/.test(e.indexdef)),
  );
  await db.transaction(async (manager) => {
    await manager.query('DELETE FROM nodia_ai_jobs WHERE conversation_id=$1', [
      chat.conversation_id,
    ]);
    await manager.query('DELETE FROM nodia_ai_conversations WHERE id=$1', [
      chat.conversation_id,
    ]);
  });
  check(
    'chat deletion cascades its event journal and stored tool results without an additional archive',
    (await count(run.id)) === 0 &&
      (
        await db.query('SELECT id FROM nodia_ai_tool_calls WHERE run_id=$1', [
          run.id,
        ])
      ).length === 0,
  );
  console.log(
    JSON.stringify(
      {
        task: 'AI-16',
        scope: 'disposable_postgres_compiled_event_producers',
        checks: checks.length,
        passed: checks,
        external_adapter: 'synthetic',
        real_inference: false,
        configured_database_used: false,
      },
      null,
      2,
    ),
  );
} finally {
  await application?.close();
  await fixture.close();
  unpublished.close();
}
