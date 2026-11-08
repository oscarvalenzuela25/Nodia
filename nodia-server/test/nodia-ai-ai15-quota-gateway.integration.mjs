// Zero-inference PostgreSQL regression: native-normalized numeric quota timestamps through the actual MCP Gateway.
// Provider observations and adapter are explicitly synthetic; authorization, SQL, schemas and Gateway are real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  createNodiaAiIntegrationFixture,
  loadAi,
} from './nodia-ai.integration.fixture.mjs';
import { measureSyntheticNodiaAiContext } from './nodia-ai-context-budget.fixture.mjs';
const root = process.env.NODIA_AI_LAB_KNOWLEDGE_ROOT;
const pinPath = process.env.NODIA_AI_LAB_KNOWLEDGE_PIN;
assert.ok(root && pinPath, 'An explicit compiled candidate bundle is required');
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
);
const pin = JSON.parse(fs.readFileSync(pinPath, 'utf8'));
const expectedRejection = process.argv.includes('--expect-schema-rejection');
const fixture = await createNodiaAiIntegrationFixture('ai1504');
const { db, options, identities } = fixture;
let module, ports, application, callbackError;
const nativeTimestamp = Date.now() / 1000;
const shapes = [],
  callbacks = [];
try {
  const normalize = await loadAi(
    'common/ai/gemini-engine-status',
    'normalizeGeminiEngineStatus',
  );
  const native = normalize({
    default_engine: 'agentic',
    agentic: {
      available: true,
      has_active_session: true,
      quota_source: 'agentic_cli',
      quota_observed_at: nativeTimestamp,
      quota: { synthetic_zero: { usage_percentage: 0 } },
    },
  });
  assert.equal(typeof native.agentic.quota_observed_at, 'number');
  const entries = [
    [
      'nodia-ai-tools/nodia-ai-tool-registry.module',
      'NodiaAiToolRegistryModule',
    ],
    [
      'nodia-ai-tools/types/tool-registry.types',
      'NODIA_AI_TOOL_FAMILIES',
    ],
    ['common/ai/gemini.service', 'GeminiService'],
    [
      'nodia-ai-conversation/nodia-ai-conversation.module',
      'NodiaAiConversationModule',
    ],
    ['nodia-ai-context/nodia-ai-processing.module', 'NodiaAiProcessingModule'],
    ['nodia-ai-runtime/nodia-ai-runtime.module', 'NodiaAiRuntimeModule'],
    [
      'nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case',
      'RunNodiaAiStageUseCase',
    ],
    ['nodia-ai-adapter/types/nodia-ai-adapter.types', 'NodiaAiAdapterPort'],
    ['nodia-ai-tools/types/tool-registry.types', 'NODIA_AI_TOOL_FAMILIES'],
    [
      'nodia-ai-tools/types/tool-registry.types',
      'NODIA_AI_CAPABILITIES_CATALOG_VERSION',
    ],
    ['nodia-ai-context/types/knowledge.types', 'NODIA_AI_KNOWLEDGE_ROOT'],
    ['nodia-ai-context/types/knowledge.types', 'NODIA_AI_KNOWLEDGE_PIN'],
    ['nodia-ai-context/types/knowledge.types', 'NODIA_AI_KNOWLEDGE_SCHEMA'],
    [
      'nodia-ai-conversation/use-case/create-nodia-ai-conversation.use-case',
      'CreateNodiaAiConversationUseCase',
    ],
    [
      'nodia-ai-conversation/use-case/admit-nodia-ai-message.use-case',
      'AdmitNodiaAiMessageUseCase',
    ],
    ['common/ai/codex/codex-runtime.service', 'CodexRuntimeService'],
  ];
  const [
    Products,
    Candidate,
    Gemini,
    Conversations,
    Processing,
    Runtime,
    Stage,
    Adapter,
    Families,
    Catalog,
    KnowledgeRoot,
    KnowledgePin,
    KnowledgeSchema,
    Create,
    Admit,
    Codex,
  ] = await Promise.all(entries.map(([file, name]) => loadAi(file, name)));
  const database = () =>
    TypeOrmModule.forRootAsync({
      useFactory: () => options,
      dataSourceFactory: async () => db,
    });
  const unavailableCodex = async () => ({
    available: false,
    authenticated: null,
    planType: null,
    checkedAt: null,
    reason: 'codex_runtime_unavailable',
    quotas: null,
    lastInferenceAt: null,
    usageAllowed: null,
  });
  ports = await Test.createTestingModule({
    imports: [
      database(),
      Products,
    ],
  })
    .overrideProvider(Gemini)
    .useValue({
      getDualEngineStatus: async () => structuredClone(native),
      getModelsAndQuota: async () => ({
        authenticated: true,
        available: true,
        models: [
          {
            id: 'synthetic-quota-regression',
            name: 'Synthetic quota regression',
          },
        ],
        supported_options: {},
      }),
    })
    .overrideProvider(Codex)
    .useValue({
      observe: unavailableCodex,
      snapshot: unavailableCodex,
      listModels: async () => [],
    })
    .compile();
  const families = ports.get(Candidate);
  for (const route of ['/ai-providers', '/business'])
    if (
      !(await db.query('SELECT id FROM modules WHERE link=$1', [route])).length
    )
      await db.query(
        "INSERT INTO modules(module_group_id,key,link) SELECT module_group_id,$1,$2 FROM modules WHERE key='nodia_ai'",
        [`quota_${randomUUID()}`, route],
      );
  const [catalog] = await db.query(
    "SELECT id FROM ai_provider_catalog WHERE key='gemini'",
  );
  const [provider] = await db.query(
    "INSERT INTO ai_providers(name,catalog_id,use_agentic,fields) VALUES('Synthetic quota regression',$1,true,$2::jsonb) RETURNING id",
    [
      catalog.id,
      JSON.stringify({
        agentic: { selected_model: 'synthetic-quota-regression' },
      }),
    ],
  );
  const [openaiCatalog] = await db.query(
    "SELECT id FROM ai_provider_catalog WHERE key='openai'",
  );
  const [openai] = await db.query(
    "INSERT INTO ai_providers(name,catalog_id,use_agentic,fields) VALUES('Synthetic Codex observation',$1,true,'{}') RETURNING id",
    [openaiCatalog.id],
  );
  const observationTools = ['nodia_ai_providers_health', 'nodia_ai_providers_gemini_engines',
    'nodia_ai_providers_codex_session', 'nodia_ai_providers_models', 'nodia_invoices_eligible_invoice_connections'];
  const Proofs = await loadAi('nodia-ai-runtime/types/reconciliation.types', 'NodiaAiRuntimeReconciliationPort');
  const Cleanup = await loadAi('nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case', 'CleanupNodiaAiRuntimeProofsUseCase');
  const proof = request => ({ engine: 'agentic', attemptId: request.attemptId,
    resourceKey: request.resourceKey, sessionGeneration: request.sessionGeneration,
    operationRef: request.attemptId, terminalProofId: randomUUID(), processClosed: true,
    outcome: 'completed', observedAt: new Date() });
  const adapter = {
    measureContext: measureSyntheticNodiaAiContext,
    async observe() {
      return {
        available: true,
        observedAt: new Date(),
        source: 'synthetic_quota_regression',
        resourceKey: `gemini-profile:${'a'.repeat(64)}`,
        configurationGeneration: 'a'.repeat(64),
        sessionGeneration: 'a'.repeat(32),
        adapterContractVersion: 'nodia-ai-gemini-chat/1',
        supportsMcp: true,
        reason: null,
      };
    },
    async verifyConfiguration() {},
    async execute(request, signal) {
      if (request.tools?.some(tool => tool.name === 'nodia_capabilities_select')) {
        const selected = await request.onToolCall({ callId: randomUUID(), name: 'nodia_capabilities_select',
          arguments: { catalog_version: manifest.catalog_release, capability_ids: observationTools } }, signal);
        assert.equal(selected.status, 'selection_requested');
        return { kind: 'answer', text: 'Synthetic observation selection ready.', terminalProof: proof(request) };
      }
      try {
        for (const [name, args] of [
          ['nodia_ai_providers_health', {}],
          ['nodia_ai_providers_gemini_engines', {}],
          ['nodia_ai_providers_codex_session', { provider_id: openai.id }],
          [
            'nodia_ai_providers_models',
            { provider_id: provider.id, mode: 'agentic' },
          ],
          ['nodia_invoices_eligible_invoice_connections', {}],
        ]) {
          callbacks.push(name);
          const result = await request.onToolCall(
            { callId: randomUUID(), name, arguments: args },
            signal,
          );
          for (const engine of result.engines ? ['agentic'] : []) {
            assert.equal(
              result.engines[engine].quota_observed_at,
              new Date(nativeTimestamp * 1000).toISOString(),
            );
            shapes.push({
              tool: name,
              engine,
              timestamp_type: typeof result.engines[engine].quota_observed_at,
            });
          }
        }
      } catch (error) {
        callbackError = error;
        throw error;
      }
      return {
        kind: 'answer',
        text: 'Synthetic quota regression completed.',
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
  const builder = Test.createTestingModule({
    imports: [database(), Conversations, Processing, Runtime],
    providers: [Stage],
  });
  builder.overrideProvider(Adapter).useValue(adapter);
  builder.overrideProvider(Proofs).useValue({ async acknowledge() {}, async reconcile() { throw Error('Unexpected synthetic reconciliation'); } });
  builder.overrideProvider(Families).useValue(families);
  builder.overrideProvider(Catalog).useValue(manifest.catalog_release);
  builder.overrideProvider(KnowledgeRoot).useValue(path.resolve(root));
  builder.overrideProvider(KnowledgePin).useValue(pin);
  builder
    .overrideProvider(KnowledgeSchema)
    .useValue(
      fs.readFileSync(
        path.join(path.dirname(pinPath), 'knowledge-schema.json'),
      ),
    );
  module = await builder.compile();
  application = module.createNestApplication({ logger: false });
  await application.init();
  const identity = identities.get('3');
  const chat = await module.get(Create).execute(identity, {
    client_request_id: randomUUID(),
    selection: {
      connection_id: provider.id,
      mode: 'agentic',
      model_id: 'synthetic-quota-regression',
      effort_id: null,
    },
  });
  const accepted = await module
    .get(Admit)
    .execute(identity, chat.conversation_id, {
      client_message_id: randomUUID(),
      expected_conversation_revision: chat.revision,
      parts: [
        {
          kind: 'text',
          text: 'Synthetic non-generative quota schema regression.',
        },
      ],
    });
  const worker = randomUUID(),
    signal = new AbortController().signal;
  for (let index = 0; index < 16; index++) {
    const [current] = await db.query('SELECT state FROM nodia_ai_runs WHERE id=$1', [accepted.run.run_id]);
    if (['completed', 'failed', 'unknown', 'cancelled'].includes(current.state)) break;
    await module.get(Stage).execute(worker, signal);
    for (let ack = 0; ack < 8; ack++) if (!(await module.get(Cleanup).execute()).processed) break;
  }
  const [run] = await db.query('SELECT state FROM nodia_ai_runs WHERE id=$1', [
    accepted.run.run_id,
  ]);
  const receipts = await db.query(
    'SELECT tool_name,state FROM nodia_ai_tool_calls WHERE run_id=$1 ORDER BY created_at,id',
    [accepted.run.run_id],
  );
  if (expectedRejection) {
    assert.equal(callbackError?.message, 'nodia_ai:invalid_tool_output');
    assert.equal(receipts.find(item => item.tool_name === observationTools[0])?.state, 'validated');
  } else {
    if (callbackError) throw callbackError;
    assert.equal(run.state, 'completed');
    assert.equal(receipts.filter(item => observationTools.includes(item.tool_name)).length, 5);
    assert.equal(receipts.filter(item => item.tool_name === 'nodia_capabilities_select').length, 1);
    assert.ok(receipts.every((item) => item.state === 'completed'));
  }
  const report = {
    task: 'AI-15',
    scope: 'zero_inference_native_quota_shape_gateway_regression',
    expected_schema_rejection: expectedRejection,
    status: 'passed',
    native_normalizer_timestamp_type: typeof native.agentic.quota_observed_at,
    native_schema_rejection_observed:
      callbackError?.message === 'nodia_ai:invalid_tool_output',
    gateway_receipts: receipts,
    valid_projections: shapes,
    provider_inferences: 0,
    synthetic_adapter: true,
    synthetic_provider_observation: true,
    configured_database_modified: false,
  };
  if (process.env.NODIA_AI_LAB_REPORT_JSON)
    fs.writeFileSync(
      process.env.NODIA_AI_LAB_REPORT_JSON,
      JSON.stringify(report, null, 2),
    );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await application?.close();
  await ports?.close();
  await fixture.close();
}
