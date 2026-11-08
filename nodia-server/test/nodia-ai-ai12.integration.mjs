// Full compiled admission -> context -> inference -> seal. The external adapter is explicitly synthetic.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createNodiaAiUnpublishedFixture } from './nodia-ai-unpublished.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';

const fixture = await createNodiaAiIntegrationFixture('ai12');
const unpublished = await createNodiaAiUnpublishedFixture();
const { db, options, identities } = fixture;
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
};
let application;
try {
  const names = [
    [
      'nodia-ai-conversation/nodia-ai-conversation.module',
      'NodiaAiConversationModule',
    ],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
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
      'nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case',
      'LoadNodiaAiKnowledgeUseCase',
    ],
    [
      'nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case',
      'RecoverNodiaAiJobsUseCase',
    ],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
  ];
  const [
    ConversationModule,
    ProcessingModule,
    Adapter,
    RunStage,
    Create,
    Admit,
    Knowledge,
    Recover,
    RuntimeModule,
  ] = await Promise.all(names.map(([file, name]) => loadAi(file, name)));
  const [provider] = await db.query(
    "INSERT INTO ai_providers(name,fields) VALUES('Synthetic AI12 adapter','{}') RETURNING id",
  );
  const selection = {
    connection_id: provider.id,
    mode: 'agentic',
    model_id: 'synthetic-ai12-model',
    effort_id: null,
  };
  const resourceKey = 'gemini-profile:' + 'b'.repeat(64);
  let calls = 0,
    observations = 0,
    failTransport = false;
  const external = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() {
      observations++;
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_fixture_only',
        resourceKey,
        configurationGeneration: 'c'.repeat(64),
        sessionGeneration: 'd'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: false,
        reason: null,
      };
    },
    async verifyConfiguration() {},
    async execute(request) {
      calls++;
      const [attempt] = await db.query(
        'SELECT phase,external_operation_ref FROM nodia_ai_job_attempts WHERE id=$1',
        [request.attemptId],
      );
      check(
        'external call starts only after durable dispatch arming',
        attempt.phase === 'dispatch_armed' &&
          attempt.external_operation_ref === request.attemptId,
      );
      const [run] = await db.query(
        'SELECT provider_dispatches_used FROM nodia_ai_runs WHERE id=(SELECT run_id FROM nodia_ai_jobs WHERE id=(SELECT job_id FROM nodia_ai_job_attempts WHERE id=$1))',
        [request.attemptId],
      );
      check(
        'shared dispatch budget is durable before provider I/O',
        run.provider_dispatches_used === 1,
      );
      const prompt = JSON.parse(request.canonicalPrompt);
      check(
        'adapter receives canonical history without invented product knowledge',
        prompt.messages.at(-1).content === 'Synthetic greeting' &&
          prompt.knowledge.length === 0,
      );
      if (failTransport) throw Error('Synthetic connection lost after send');
      return { kind: 'answer', text: 'Synthetic answer without product tools', terminalProof: {
        engine:'agentic',attemptId:request.attemptId,
        resourceKey:request.resourceKey,sessionGeneration:request.sessionGeneration,operationRef:request.attemptId,
        terminalProofId:randomUUID(),processClosed:true,outcome:'completed',observedAt:new Date(),
      }};
    },
  };
  const module = await unpublished.override(Test.createTestingModule({
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
  }))
    .overrideProvider(Adapter)
    .useValue(external)
    .compile();
  application = module.createNestApplication({ logger: false });
  await application.init();
  const create = module.get(Create),
    admit = module.get(Admit),
    stage = module.get(RunStage),
    knowledge = module.get(Knowledge),
    recover = module.get(Recover);
  check(
    'explicit unpublished release loads no draft documents or tools even when the installed release publishes products',
    knowledge.manifest.documents.length === 0 &&
      knowledge.manifest.capability_contracts.length === 0,
  );
  const identity = identities.get('1');
  const chat = await create.execute(identity, {
    client_request_id: randomUUID(),
    selection,
  });
  const input = {
    client_message_id: randomUUID(),
    expected_conversation_revision: chat.revision,
    parts: [{ kind: 'text', text: 'Synthetic greeting' }],
  };
  const accepted = await admit.execute(identity, chat.conversation_id, input);
  check(
    'real admission freezes current release, policy and session grant',
    (
      await db.query('SELECT context_manifest FROM nodia_ai_runs WHERE id=$1', [
        accepted.run.run_id,
      ])
    )[0].context_manifest.knowledge_release === knowledge.manifest.release_id,
  );
  const expires = (
    await db.query(
      'SELECT expires_at FROM nodia_ai_conversations WHERE id=$1',
      [chat.conversation_id],
    )
  )[0].expires_at;
  const retry = await admit.execute(identity, chat.conversation_id, input);
  check(
    'retry recovers the same run before a second provider observation',
    retry.run.run_id === accepted.run.run_id && observations === 1,
  );
  const worker = randomUUID(),
    signal = new AbortController().signal;
  check(
    'first attempt advances context without provider dispatch',
    (await stage.execute(worker, signal)) && calls === 0,
  );
  const [context] = await db.query(
    'SELECT context_manifest FROM nodia_ai_runs WHERE id=$1',
    [accepted.run.run_id],
  );
  check(
    'context manifest pins exact history and compiled release',
    context.context_manifest.through_seq === '1' &&
      context.context_manifest.context_sha256.length === 64 &&
      context.context_manifest.admission_conversation_revision === 2,
  );
  check(
    'second attempt completes inference once',
    (await stage.execute(worker, signal)) && calls === 1,
  );
  const [run] = await db.query('SELECT * FROM nodia_ai_runs WHERE id=$1', [
    accepted.run.run_id,
  ]);
  const [resultChat] = await db.query(
    'SELECT * FROM nodia_ai_conversations WHERE id=$1',
    [chat.conversation_id],
  );
  const messages = await db.query(
    'SELECT m.seq,m.role,p.text FROM nodia_ai_messages m JOIN nodia_ai_message_parts p ON p.message_id=m.id WHERE m.conversation_id=$1 ORDER BY m.seq',
    [chat.conversation_id],
  );
  const [slot] = await db.query(
    'SELECT * FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [resourceKey],
  );
  check(
    'answer, assistant reference and activity close atomically',
    run.state === 'completed' &&
      run.assistant_message_id &&
      resultChat.active_job_id === null &&
      messages.length === 2 &&
      messages[1].role === 'assistant',
  );
  check(
    'successful response releases physical runtime and preserves fence',
    slot.state === 'free' && slot.fence === '1',
  );
  check(
    'background stages and assistant reply do not renew retention',
    resultChat.expires_at.getTime() === expires.getTime(),
  );
  check(
    'completed job is never dispatched a second time',
    (await stage.execute(worker, signal)) === false && calls === 1,
  );

  const chat2 = await create.execute(identity, {
    client_request_id: randomUUID(),
    selection,
  });
  const accepted2 = await admit.execute(identity, chat2.conversation_id, {
    ...input,
    client_message_id: randomUUID(),
    expected_conversation_revision: chat2.revision,
  });
  await stage.execute(worker, signal);
  failTransport = true;
  await stage.execute(worker, signal);
  await recover.execute();
  const [uncertain] = await db.query(
    'SELECT state FROM nodia_ai_runs WHERE id=$1',
    [accepted2.run.run_id],
  );
  const [unknownSlot] = await db.query(
    'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1',
    [resourceKey],
  );
  check(
    'lost response becomes unknown with profile quarantined',
    uncertain.state === 'unknown' && unknownSlot.state === 'unknown',
  );
  check(
    'unknown inference does not replay on recovery',
    (await stage.execute(worker, signal)) === false && calls === 2,
  );
  const WorkerModule = await loadAi(
    'nodia-ai-worker.module',
    'NodiaAiWorkerModule',
  );
  const Worker = await loadAi(
    'nodia-ai-runtime/nodia-ai.worker',
    'NodiaAiWorker',
  );
  const DataSource = (await import('typeorm')).DataSource;
  // forRoot captures its options object; redirect this test composition before it creates a connection.
  const config=await loadAi('config/db.config','postgresConfig');
  Object.assign(config,{...options,entities:[],autoLoadEntities:true});
  const Redis = await loadAi('common/redis/redis.service','RedisService');
  let redisOperations = 0;
  const syntheticRedis = Object.fromEntries(['get','set','del','keys'].map(name => [name, async () => { redisOperations++; return name === 'keys' ? [] : null; }]));
  const workerContext = await unpublished.override(Test.createTestingModule({
    imports: [WorkerModule],
  }))
    .overrideProvider(Worker)
    .useValue({})
    .overrideProvider(Adapter)
    .useValue(external)
    .overrideProvider(Redis)
    .useValue(syntheticRedis)
    .compile();
  check(
    'standalone worker composition resolves dependencies without an HTTP listener',
    !!workerContext.get(RunStage),
  );
  const workerSource=workerContext.get(DataSource);
  const Run=await loadAi('nodia-ai-run/entities/nodia-ai-run.entity','NodiaAiRun');
  const m1Names = ['NodiaAiConversation','NodiaAiMessage','NodiaAiMessagePart','NodiaAiRun','NodiaAiToolCall','NodiaAiEvent','NodiaAiJob','NodiaAiJobAttempt','NodiaAiExecutionGrant','NodiaAiRuntimeSlot','NodiaAiAuditEvent'];
  // TypeORM's forFeature metadata storage also sees statically imported domain
  // module definitions. Count the required identities, not an obsolete global size.
  check('standalone autoLoadEntities registers the run and all eleven M1 entities',
    workerSource.hasMetadata(Run) && m1Names.every(name => workerSource.entityMetadatas.some(metadata => metadata.name === name)));
  const CandidateFamilies = await loadAi('nodia-ai-products/nodia-ai-product-reads.module','NODIA_AI_CANDIDATE_READ_FAMILIES');
  const FinanceFamily = await loadAi('nodia-ai-products/finance/finance-read.family','NODIA_AI_FINANCE_READ_FAMILY');
  check('unpublished worker composition instantiates no candidate domain read family',
    workerContext.get(CandidateFamilies).length === 0);
  assert.throws(() => workerContext.get(FinanceFamily));
  // Later native-effect modules legitimately register Redis for post-commit
  // invalidation. An empty worker setup must still perform no Redis operation.
  check('empty worker setup performs no Redis operation despite later native-effect DI dependencies',
    workerContext.get(Redis) === syntheticRedis && redisOperations === 0);
  await workerContext.close();
  console.log(
    JSON.stringify(
      {
        task: 'AI-12',
        checks: checks.length,
        passed: checks,
        external_adapter: 'synthetic',
        real_inference: false,
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
