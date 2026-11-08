// Explicit, opt-in real Gemini verification. Business data stays in a disposable PostgreSQL fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { parse } from 'dotenv';

// Web/routing-only phases retired by plan90; generic history and ACK guards remain in Agentic worker phases.
const phase = process.argv
  .find((value) => value.startsWith('--phase='))
  ?.slice(8);
if (['web', 'routing'].includes(phase))
  throw Error('Web/delegation phases are retired; use the Agentic phases or nodia-ai-ai12-routing.integration.mjs for rejection/history checks.');
if (!['agentic', 'unknown', 'probe', 'concurrency'].includes(phase))
  throw Error('Specify an explicit supported live phase');
if (process.env.NODIA_AI_ALLOW_LIVE !== 'yes')
  throw Error('Explicit live opt-in is required');
const privatePath = process.env.NODIA_AI_LAB_API_ENV;
const selectionPath = process.env.NODIA_AI_LAB_SELECTION_JSON;
if (!privatePath || !selectionPath)
  throw Error('Explicit lab configuration paths are required');
const privateConfig = parse(fs.readFileSync(privatePath));
const selectionObservation = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
const configured = selectionObservation.rows.filter(
  (row) => row.provider_key === 'gemini' && row.is_active === true,
);
assert.equal(
  configured.length,
  1,
  'Select one exact configured Gemini connection',
);
const actual = configured[0];
assert.match(privateConfig.GEMINI_SERVICE_TOKEN ?? '', /^[a-f0-9]{64}$/i);
const privateUrl = new URL(privateConfig.GEMINI_MICROSERVICE_URL);
assert.ok(
  ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(privateUrl.hostname),
  'Lab Gemini must remain private',
);
process.env.GEMINI_SERVICE_TOKEN = privateConfig.GEMINI_SERVICE_TOKEN;
process.env.GEMINI_MICROSERVICE_URL = privateUrl.href;
process.env.SECRET_SEED = randomBytes(32).toString('hex'); // Synthetic Nodia sessions only.
process.env.DOTENV_CONFIG_PATH = '/dev/null';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_STORAGE = 'memory';

const { createNodiaAiIntegrationFixture, loadAi } =
  await import('./nodia-ai.integration.fixture.mjs');
const { Test } = await import('@nestjs/testing');
const { TypeOrmModule } = await import('@nestjs/typeorm');
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
const fixture = await createNodiaAiIntegrationFixture('ai12');
const { db, options, identities } = fixture;
let application;
let cleanupProofs, reconcileRuntime, nativeProofs;
const pendingNativeRequests = new Map();
const pendingNativeProofs = new Map();
async function settleNativeProof(proof) {
  pendingNativeProofs.set(proof.attemptId, proof);
  await nativeProofs.acknowledge(proof, AbortSignal.timeout(15000));
  pendingNativeProofs.delete(proof.attemptId);
  pendingNativeRequests.delete(proof.attemptId);
}
async function drainProofCleanup() {
  if (!cleanupProofs) return;
  const jobs = await db.query(
    "SELECT id FROM nodia_ai_jobs WHERE kind='reconcile' AND stage_key='reconcile_ack' ORDER BY id",
  );
  for (const job of jobs) {
    const result = await cleanupProofs.execute(job.id, true);
    assert.equal(
      result.settled,
      1,
      'Live fixture must acknowledge its persisted terminal proof',
    );
  }
}
let generationRequests = 0;
const maximumGenerations = 6;
const reserveGeneration = () => {
  if (++generationRequests > maximumGenerations)
    throw Error('Live diagnostic dispatch budget exhausted');
};
const modeSelection = (mode) => {
  assert.equal(mode, 'agentic', 'Live selection must explicitly use Agentic');
  const model = actual.agentic_model;
  assert.ok(
    typeof model === 'string' && model.trim(),
    'A configured exact model is required',
  );
  return {
    connection_id: actual.connection_id,
    mode,
    model_id: model,
    effort_id: actual.agentic_effort ?? null,
  };
};
try {
  const modules = [
    [
      'nodia-ai-conversation/nodia-ai-conversation.module',
      'NodiaAiConversationModule',
    ],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    [
      'nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case',
      'GeminiNodiaAiAdapterUseCase',
    ],
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
      'nodia-ai-runtime/types/reconciliation.types',
      'NodiaAiRuntimeReconciliationPort',
    ],
  ];
  const [
    ConversationModule,
    ProcessingModule,
    RuntimeModule,
    Adapter,
    ConcreteAdapter,
    RunStage,
    Create,
    Admit,
    CleanupProofs,
    ReconcileRuntime,
    NativeProofs,
  ] = await Promise.all(modules.map(([file, name]) => loadAi(file, name)));
  const [catalog] = await db.query(
    "SELECT id FROM ai_provider_catalog WHERE key='gemini'",
  );
  assert.ok(catalog, 'Gemini catalog must exist in the migrated fixture');
  await db.query(
    `INSERT INTO ai_providers(id,name,catalog_id,is_active,use_agentic,fields)
    VALUES($1,'Explicit real-provider diagnostic fixture',$2,true,true,$3::jsonb)`,
    [
      actual.connection_id,
      catalog.id,
      JSON.stringify({
        agentic: {
          selected_model: actual.agentic_model,
          thinking_level: actual.agentic_effort ?? null,
        },
      }),
    ],
  );
  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => options,
        dataSourceFactory: async () => db,
      }),
      ConversationModule,
      ProcessingModule,
      RuntimeModule,
    ],
    providers: [RunStage],
  }).compile();
  application = module.createNestApplication({ logger: false });
  await application.init();
  const adapter = module.get(Adapter),
    concrete = module.get(ConcreteAdapter),
    create = module.get(Create),
    admit = module.get(Admit),
    stage = module.get(RunStage);
  const profileChecks =
    phase === 'concurrency'
      ? (
          await import('./nodia-ai-live-concurrency.fixture.mjs')
        ).createLiveProfileChecks({
          privateUrl,
          privateConfig,
          modeSelection,
          check,
        })
      : null;
  cleanupProofs = module.get(CleanupProofs);
  reconcileRuntime = module.get(ReconcileRuntime);
  nativeProofs = module.get(NativeProofs);
  const identity = identities.get('1'),
    worker = randomUUID();
  async function rawMcpProbe() {
    const selection = modeSelection('agentic');
    const observed = await adapter.observe(selection);
    if (!observed.available) {
      const reason =
        typeof observed.reason === 'string' &&
        /^[a-z0-9_]{1,128}$/.test(observed.reason)
          ? observed.reason
          : 'unclassified';
      throw Error(`Live eligibility rejected before generation: ${reason}`);
    }
    check(
      'Agentic session/catalog eligible without inferring MCP support',
      observed.available && !!observed.resourceKey,
    );
    const nonce = randomBytes(12).toString('hex');
    const calls = [];
    const tools = [
      {
        name: 'nodia_fixture_availability',
        description:
          'Consulta sintética de disponibilidad para esta prueba aislada.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { day: { type: 'string' } },
          required: ['day'],
        },
      },
      {
        name: 'nodia_fixture_prepare',
        description:
          'Prepara una propuesta sintética sin ejecutar o guardar gastos.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { amount: { type: 'integer', minimum: 1 } },
          required: ['amount'],
        },
      },
    ];
    reserveGeneration();
    const request = {
      attemptId: randomUUID(),
      selection,
      canonicalPrompt: JSON.stringify({
        instructions:
          'Prueba técnica aislada. Llama nodia_fixture_availability con day="2099-01-01" y después nodia_fixture_prepare con amount=42. ' +
          'No ejecutes acciones, archivos, shell o red. Devuelve como respuesta final el nonce recibido en disponibilidad y el ID de propuesta, indicando que no se ejecutó.',
        messages: [],
      }),
      deadlineAt: new Date(Date.now() + 120000),
      resourceKey: observed.resourceKey,
      sessionGeneration: observed.sessionGeneration,
      configurationGeneration: observed.configurationGeneration,
      tools,
      async onToolCall(call) {
        if (profileChecks) await profileChecks('agentic');
        assert.ok(calls.length < 2, 'Only two fixture callbacks are allowed');
        calls.push(call);
        if (call.name === 'nodia_fixture_availability') {
          assert.deepEqual(call.arguments, { day: '2099-01-01' });
          return { fixture_only: true, available: true, nonce };
        }
        assert.equal(call.name, 'nodia_fixture_prepare');
        assert.deepEqual(call.arguments, { amount: 42 });
        return {
          fixture_only: true,
          proposal_id: 'fixture-preview-only',
          requires_confirmation: true,
          executed: false,
        };
      },
      async onProtocolProgress(count) {
        assert.ok(Number.isSafeInteger(count) && count >= 0 && count <= 128);
      },
    };
    assert.equal(
      typeof concrete.probeMcp,
      'function',
      'Explicit non-health MCP verification port must exist',
    );
    pendingNativeRequests.set(request.attemptId, {
      engine: 'agentic',
      attemptId: request.attemptId,
      operationRef: request.attemptId,
      resourceKey: request.resourceKey,
      sessionGeneration: request.sessionGeneration,
    });
    const answer = await concrete.probeMcp(request);
    await settleNativeProof(answer.terminalProof);
    check(
      'real CLI makes both closed MCP fixture callbacks',
      calls.length === 2 && new Set(calls.map((call) => call.name)).size === 2,
    );
    check(
      'real Agentic answer incorporates random callback data',
      answer.kind === 'answer' &&
        answer.text.includes(nonce) &&
        answer.text.includes('fixture-preview-only'),
    );
    check(
      'real MCP loop publishes exact verified support',
      (await adapter.observe(selection)).supportsMcp === true,
    );
    return answer;
  }
  async function sealChat(selection, text) {
    const chat = await create.execute(identity, {
      client_request_id: randomUUID(),
      selection,
    });
    return turn(chat, text);
  }
  async function turn(chat, text) {
    const accepted = await admit.execute(identity, chat.conversation_id, {
      client_message_id: randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [{ kind: 'text', text }],
    });
    const runId = accepted.run.run_id;
    const signal = AbortSignal.timeout(150000);
    let run;
    for (let step = 0; step < 5; step++) {
      [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
        runId,
      ]);
      if (['completed', 'failed', 'cancelled', 'unknown'].includes(run.state))
        break;
      const [job] = await db.query(
        'SELECT stage_key FROM nodia_ai_jobs WHERE run_id=$1',
        [runId],
      );
      if (job && job.stage_key !== 'context') reserveGeneration();
      assert.equal(
        await stage.execute(worker, signal),
        true,
        'Admitted stage must be claimed',
      );
    }
    [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [runId]);
    await drainProofCleanup();
    check('real provider turn seals exactly once', run.state === 'completed');
    const [answer] = await db.query(
      'SELECT text FROM nodia_ai_message_parts WHERE message_id=$1 AND part_index=0',
      [run.assistant_message_id],
    );
    const [updated] = await db.query(
      'SELECT revision FROM nodia_ai_conversations WHERE id=$1',
      [chat.conversation_id],
    );
    return {
      chat: { ...chat, revision: updated.revision },
      run,
      answer: answer.text,
    };
  }
  if (phase === 'probe') await rawMcpProbe();
  else if (phase === 'agentic') {
    await rawMcpProbe();
    const { runWorkerMatrix } =
      await import('./nodia-ai-live-worker.fixture.mjs');
    await runWorkerMatrix({
      db,
      options,
      create,
      admit,
      identity,
      modeSelection,
      check,
      reserveGeneration,
      drainProofCleanup,
    });
  } else if (phase === 'concurrency') {
    await rawMcpProbe();
    const original = concrete.execute;
    concrete.execute = async function (request, signal) {
      const running = original.call(this, request, signal);
      // Wait for the real native profile gate; observations never generate content.
      let held = false;
      try {
        for (let attempt = 0; attempt < 60; attempt++) {
          try {
            const response = await fetch(
              new URL('/nodia-ai/agentic/observe', privateUrl),
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Nodia-Service-Token': privateConfig.GEMINI_SERVICE_TOKEN,
                },
                body: JSON.stringify({
                  model_id: request.selection.model_id,
                  effort_id: request.selection.effort_id,
                }),
                signal: AbortSignal.timeout(5000),
              },
            );
            const observation = await response.json();
            if (
              response.status === 409 &&
              observation.code === 'runtime_busy'
            ) {
              held = true;
              break;
            }
          } catch {
            /* In-flight rejection is asserted by the awaited production request below. */
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        check('real Agentic dispatch holds its native profile', held);
        await profileChecks('agentic');
        return await running;
      } catch (error) {
        await running.catch(() => undefined);
        throw error;
      }
    };
    try {
      await sealChat(
        modeSelection('agentic'),
        'Escribe una explicación de unas 400 palabras sobre por qué un calendario ficticio necesita fechas válidas. Es sólo una prueba de conversación, sin consultar herramientas ni datos externos.',
      );
    } finally {
      delete concrete.execute;
    }
  } else if (phase === 'unknown') {
    await rawMcpProbe();
    const { runUnknownMatrix } =
      await import('./nodia-ai-live-unknown.fixture.mjs');
    await runUnknownMatrix({
      db,
      module,
      adapter,
      concrete,
      stage,
      create,
      admit,
      identity,
      operator: identities.get('3'),
      modeSelection,
      reserveGeneration,
      check,
      worker,
    });
  } else {
    throw Error(
      'Requested matrix phase is not implemented yet; never count it as passed',
    );
  }
  const report = {
    task: 'AI-11/AI-12',
    phase,
    checks: checks.length,
    passed: checks,
    adapterDispatchRequests: generationRequests,
    maximumAdapterDispatchRequests: maximumGenerations,
    real_inference: true,
    configured_business_database_modified: false,
    business_writes: 0,
    selection_source:
      'Read-only configured Gemini connection; new synthetic database for all chat/worker state',
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  let cleanupFailed = false;
  try {
    if (reconcileRuntime) {
      const unresolved = await db.query(
        "SELECT id FROM nodia_ai_jobs WHERE kind='turn' AND state='unknown' ORDER BY id",
      );
      for (const job of unresolved) {
        try {
          await reconcileRuntime.execute(identities.get('3'), job.id);
        } catch {
          cleanupFailed = true;
          console.error(
            'Live fixture retains an unresolved native attempt; operator reconciliation is required.',
          );
        }
      }
    }
    await drainProofCleanup();
    for (const request of pendingNativeRequests.values()) {
      try {
        const proof =
          pendingNativeProofs.get(request.attemptId) ??
          (await nativeProofs.reconcile(request, AbortSignal.timeout(15000)));
        await settleNativeProof(proof);
      } catch {
        cleanupFailed = true;
        console.error(
          'Live diagnostic retains a native terminal-proof receipt or unresolved attempt.',
        );
      }
    }
  } catch {
    cleanupFailed = true;
    console.error(
      'Live terminal-proof cleanup did not settle; no generation was replayed.',
    );
  } finally {
    // A checkpoint may fail after dispatch without publishing SQL `unknown`.
    // Never remove the only durable identity needed to recover that attempt.
    const unsettledJobs = await db.query(
      "SELECT id,kind,state,fence,recovery_descriptor FROM nodia_ai_jobs WHERE (kind='turn' AND state NOT IN ('done','failed','cancelled')) OR (kind='reconcile' AND stage_key='reconcile_ack') ORDER BY id",
    );
    const unsettledAttempts = await db.query(
      "SELECT id,job_id,phase,runtime_resource_key,runtime_fence,external_operation_ref FROM nodia_ai_job_attempts WHERE phase IN ('dispatch_armed','sent','unknown') ORDER BY id",
    );
    const unsettledSlots = await db.query(
      "SELECT resource_key,state,job_id,fence,external_operation_ref FROM nodia_ai_runtime_slots WHERE state<>'free' ORDER BY resource_key",
    );
    if (
      unsettledJobs.length ||
      unsettledAttempts.length ||
      unsettledSlots.length
    ) {
      cleanupFailed = true;
      console.error(
        'Live fixture retains nonterminal SQL runtime identities; preserve its database for recovery without replay.',
      );
    }
    if (cleanupFailed) {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'nodia-ai-live-recovery-'),
      );
      fs.chmodSync(directory, 0o700);
      const recoveryPath = path.join(directory, 'recovery.json');
      fs.writeFileSync(
        recoveryPath,
        JSON.stringify(
          {
            schema_version: 1,
            created_at: new Date().toISOString(),
            phase,
            database: {
              host: options.host,
              port: options.port,
              username: options.username,
              database: options.database,
            },
            pending_jobs: unsettledJobs,
            pending_runtime_attempts: unsettledAttempts,
            pending_runtime_slots: unsettledSlots,
            pending_native_requests: [...pendingNativeRequests.values()],
            pending_native_proofs: [...pendingNativeProofs.values()],
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      console.error(
        `Disposable database preserved for explicit reconciliation. Private recovery identities: ${recoveryPath}`,
      );
      await application?.close();
      if (db.isInitialized) await db.destroy();
    } else {
      await application?.close();
      await fixture.close();
    }
  }
  if (cleanupFailed) process.exitCode = 1;
}
