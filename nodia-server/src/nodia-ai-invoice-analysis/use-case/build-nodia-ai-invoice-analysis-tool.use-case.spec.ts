import 'reflect-metadata';
import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { envs } from '../../config/envs.config.js';
import { HttpNodiaAiInvoiceAnalysisContract } from '../adapters/http-nodia-ai-invoice-analysis-contract.js';
import { Business } from '../../business/entities/business.entity.js';
import { Provider } from '../../provider/entities/provider.entity.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiAttachment } from '../../nodia-ai-attachment/entities/nodia-ai-attachment.entity.js';
import { NodiaAiMessage } from '../../nodia-ai-conversation/entities/nodia-ai-message.entity.js';
import { NodiaAiMessagePart } from '../../nodia-ai-conversation/entities/nodia-ai-message-part.entity.js';
import { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import type {
  NodiaAiToolHandlerContext,
  NodiaAiToolRegistration,
} from '../../nodia-ai-tools/types/tool-registry.types.js';
import type {
  NodiaAiJsonObject,
  NodiaAiSelection,
  NodiaAiRoutingTarget,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import type { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  compileNodiaAiToolSchema,
  NodiaAiToolRegistryUseCase,
} from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { ComposeNodiaAiPublishedFamiliesUseCase } from '../../nodia-ai-tools/use-case/compose-nodia-ai-published-families.use-case.js';
import {
  NodiaAiInvoiceAnalysisModule,
  NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES,
} from '../nodia-ai-invoice-analysis.module.js';
import { NodiaAiInvoiceAnalysisContract } from '../types/invoice-analysis-contract.types.js';
import { BuildNodiaAiInvoiceAnalysisToolUseCase } from './build-nodia-ai-invoice-analysis-tool.use-case.js';
import { SnapshotNodiaAiInvoiceAnalysisUseCase } from './snapshot-nodia-ai-invoice-analysis.use-case.js';

const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
  policyEnvelope(),
);
const configuration = vi.fn(async () => undefined);
const adapter = {
  verifyConfiguration: configuration,
} as unknown as NodiaAiAdapterPort;
const native = {
  prepare: vi.fn(async () => ({
    instructions: 'Extrae la factura. No inventes datos.',
  })),
  normalize: vi.fn(async (input: { extraction: NodiaAiJsonObject }) => ({
    extraction: input.extraction,
  })),
} as unknown as NodiaAiInvoiceAnalysisContract;
const snapshots = new SnapshotNodiaAiInvoiceAnalysisUseCase(policy, adapter);
let tool: NodiaAiToolRegistration;
beforeAll(() => {
  tool = new BuildNodiaAiInvoiceAnalysisToolUseCase(
    native,
    snapshots,
  ).execute()[0].capabilities[0];
});
beforeEach(() => vi.clearAllMocks());
const extraction: NodiaAiJsonObject = {
  code: null,
  total_amount: 0,
  data: {
    issue_date: '',
    items: [
      {
        name: 'Producto',
        code: null,
        quantity: 0,
        packages: null,
        units_per_package: null,
        cost_price: 0,
        cost_price_tax: null,
        unit_price: null,
        total_price: 0,
      },
    ],
  },
};
function fixture() {
  const conversationId = randomUUID(),
    runId = randomUUID(),
    attemptId = randomUUID(),
    jobId = randomUUID(),
    messageId = randomUUID(),
    attachmentId = randomUUID(),
    businessId = randomUUID(),
    toolCallId = randomUUID();
  const selection: NodiaAiSelection = {
    connection_id: '2',
    mode: 'token_plan_agentic',
    model_id: 'fixture-model',
    effort_id: null,
  };
  const source = {
    attachment_id: attachmentId,
    generation: randomUUID(),
    content_hash: 'a'.repeat(64),
    byte_count: 123,
    media_type: 'image/png',
    kind: 'image',
    retention_epoch: '1',
  };
  const run = {
    id: runId,
    conversation_id: conversationId,
    actor_id: '1',
    user_message_id: messageId,
    input_through_seq: '3',
    state: 'running',
    retention_epoch: '1',
    deadline_at: new Date(Date.now() + 600000),
    selection_snapshot: selection,
    routing_snapshot: { target: null as NodiaAiRoutingTarget | null },
    context_manifest: {
      configuration_generation: 'b'.repeat(64),
      stage_contexts: {
        [attemptId]: {
          user_message_id: messageId,
          input_through_seq: '3',
          invoice_analysis_sources: [source],
        },
      },
    },
  };
  const attempt = {
    id: attemptId,
    job_id: jobId,
    phase: 'dispatch_armed',
    ended_at: null,
    stage_key: 'inference',
    selection_snapshot: selection,
  };
  const conversation = {
    id: conversationId,
    lifecycle: 'active',
    expires_at: new Date(Date.now() + 600000),
    retention_epoch: '1',
  };
  const attachment = {
    id: attachmentId,
    conversation_id: conversationId,
    state: 'ready',
    retention_epoch: '1',
    expires_at: new Date(Date.now() + 600000),
    kind: 'image',
    content_hash: source.content_hash,
    byte_count: '123',
    media_type: 'image/png',
    page_count: null,
    generation: source.generation,
  };
  const part = {
    message_id: messageId,
    conversation_id: conversationId,
    attachment_id: attachmentId,
    kind: 'image',
    text: null,
  };
  const provider = {
    id: '9',
    business_id: businessId,
    tax: 19,
    fields: {
      code: { value: 'sku', instructions: 'Código impreso' },
      unrelated_secret: 'do-not-forward',
    },
  };
  type Row = Record<string, unknown>;
  const calls: Row[] = [];
  const rows = new Map<unknown, Row[]>([
    [NodiaAiRun, [run]],
    [NodiaAiJobAttempt, [attempt]],
    [
      NodiaAiJob,
      [{ id: jobId, run_id: runId, conversation_id: conversationId }],
    ],
    [NodiaAiConversation, [conversation]],
    [NodiaAiAttachment, [attachment]],
    [
      NodiaAiMessage,
      [
        {
          id: messageId,
          conversation_id: conversationId,
          role: 'user',
          author_id: '1',
          seq: '3',
        },
      ],
    ],
    [NodiaAiMessagePart, [part]],
    [Business, [{ id: businessId }]],
    [Provider, [provider]],
    [NodiaAiToolCall, calls],
  ]);
  const saves: unknown[] = [];
  const manager = {
    queryRunner: { isTransactionActive: true },
    getRepository: (entity: unknown) => {
      const data = rows.get(entity) ?? [];
      const find = (where: Row) =>
        data.find((row) =>
          Object.entries(where).every(
            ([k, v]) => v !== undefined && row[k] === v,
          ),
        ) ?? null;
      return {
        findOneBy: vi.fn(async (where: Row) => find(where)),
        findOne: vi.fn(async (options: { where: Row }) => find(options.where)),
        save: vi.fn(async (row: Row) => {
          saves.push(row);
          const index = data.findIndex((old) => old.id === row.id);
          if (index < 0) data.push(row);
          else data[index] = row;
          return row;
        }),
      };
    },
  } as unknown as EntityManager;
  const context: NodiaAiToolHandlerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: randomUUID(),
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/tools/nodia-ai', '/tools/business'],
    conversationId,
    runId,
    attemptId,
    toolCallId,
    signal: new AbortController().signal,
    deadlineAt: Date.now() + 30000,
  };
  const input: NodiaAiJsonObject = {
    action: 'prepare',
    business_id: businessId,
    attachment_id: attachmentId,
    provider_id: '9',
  };
  function receipt(
    id: string,
    args: NodiaAiJsonObject,
    state = 'validated',
    result: NodiaAiJsonObject | null = null,
  ) {
    const row = {
      id,
      run_id: runId,
      conversation_id: conversationId,
      tool_name: 'nodia_invoices_analyze',
      arguments: args,
      public_result: result,
      state,
      scope_manifest: { schema_version: 1 },
    };
    calls.push(row);
    return row;
  }
  async function prepare() {
    const operation = await tool.external!.prepare(input, context);
    const result = await operation.execute(context.signal!);
    const row = receipt(toolCallId, input);
    await tool.verifyResultAuthority!(input, result, context);
    Object.assign(row, { state: 'completed', public_result: result });
    return { operation, result, row };
  }
  return {
    context,
    input,
    rows,
    run,
    attempt,
    conversation,
    attachment,
    part,
    provider,
    source,
    calls,
    saves,
    receipt,
    prepare,
  };
}

describe('Invoice analysis MCP contract and publication', () => {
  it('compiles a single closed discriminated candidate without native inference or publication', () => {
    const families = new BuildNodiaAiInvoiceAnalysisToolUseCase(
      native,
      snapshots,
    ).execute();
    const registry = new NodiaAiToolRegistryUseCase(
      families,
      'fixture-catalog',
    );
    expect(registry.list(['/tools/business'])).toHaveLength(1);
    expect(tool.kind).toBe('analyze_attachment');
    expect(tool.actionKeys).toEqual([]);
    expect(vi.mocked(native.prepare)).not.toHaveBeenCalled();
    expect(vi.mocked(native.normalize)).not.toHaveBeenCalled();
  });
  it('keeps empty publication free of HTTP and SQL providers', () => {
    const module = NodiaAiInvoiceAnalysisModule.forPublication([]);
    expect(module.imports).toBeUndefined();
    expect(module.providers).toEqual([
      { provide: NODIA_AI_CANDIDATE_INVOICE_ANALYSIS_FAMILIES, useValue: [] },
    ]);
    expect(() =>
      NodiaAiInvoiceAnalysisModule.forPublication(['other']),
    ).toThrow();
    expect(() =>
      NodiaAiInvoiceAnalysisModule.forPublication([
        'nodia_invoices_analyze',
        'nodia_invoices_analyze',
      ]),
    ).toThrow();
  });
  it.each([
    'url',
    'storage_key',
    'model',
    'mode',
    'actor_id',
    'selection',
    'ai_provider_id',
  ])('rejects model-supplied %s', (key) => {
    const f = fixture();
    expect(
      compileNodiaAiToolSchema(tool.inputSchema).validate({
        ...f.input,
        [key]: 'untrusted',
      }),
    ).toBe(false);
  });
  it('closes extraction fields while preserving zero, null and unknown date', () => {
    const input = compileNodiaAiToolSchema(tool.inputSchema).validate;
    expect(
      input({ action: 'complete', analysis_id: randomUUID(), extraction }),
    ).toBe(true);
    expect(
      input({
        action: 'complete',
        analysis_id: randomUUID(),
        extraction: { ...extraction, raw_data: { secret: 1 } },
      }),
    ).toBe(false);
    expect(
      input({
        action: 'prepare',
        business_id: randomUUID(),
        attachment_id: randomUUID(),
        extraction,
      }),
    ).toBe(false);
  });
  it('merges under the existing invoices resource and canonical business module', () => {
    const read = {
      familyKey: 'read',
      modules: [
        { key: 'business', route: '/tools/business', label: 'Negocios' },
      ],
      resources: [
        {
          key: 'invoices',
          label: 'Facturas',
          requiredModuleRoutes: ['/tools/business'],
        },
      ],
      capabilities: [
        {
          ...tool,
          capabilityId: 'nodia_invoices_get',
          toolName: 'nodia_invoices_get',
          kind: 'read' as const,
          moduleKey: 'business',
        },
      ],
    };
    const joined = new ComposeNodiaAiPublishedFamiliesUseCase().execute(
      [read],
      new BuildNodiaAiInvoiceAnalysisToolUseCase(native, snapshots).execute(),
    );
    expect(joined).toHaveLength(1);
    expect(joined[0].resources).toHaveLength(1);
    expect(joined[0].capabilities[1].moduleKey).toBe('business');
  });
});
describe('Current-generation invoice provenance and completion', () => {
  it('prepares rules and stores private provenance without changing invoice or interpretation', async () => {
    const f = fixture();
    const { result, row } = await f.prepare();
    expect(result.status).toBe('prepared');
    expect(result.analysis_id).toBe(f.context.toolCallId);
    expect(result.source).toEqual({
      attachment_id: f.attachment.id,
      kind: 'image',
      media_type: 'image/png',
      byte_count: 123,
    });
    expect(JSON.stringify(result)).not.toContain(f.source.content_hash);
    expect(JSON.stringify(result)).not.toContain(f.source.generation);
    expect(row.scope_manifest).toHaveProperty('invoice_analysis_snapshot');
    expect(f.saves).toHaveLength(1);
    expect(vi.mocked(native.prepare)).toHaveBeenCalledWith(
      expect.objectContaining({
        providerFields: {
          code: { value: 'sku', instructions: 'Código impreso' },
        },
        tax: 19,
      }),
    );
  });
  it('normalizes exactly once and links a new completion receipt without modifying the prepared public result', async () => {
    const f = fixture();
    const prepared = await f.prepare();
    const original = JSON.stringify(prepared.row.public_result);
    const context = { ...f.context, toolCallId: randomUUID() };
    const input = {
      action: 'complete',
      analysis_id: f.context.toolCallId!,
      extraction,
    };
    const operation = await tool.external!.prepare(input, context);
    const result = await operation.execute(context.signal!);
    const receipt = f.receipt(context.toolCallId, input);
    await tool.verifyResultAuthority!(input, result, context);
    Object.assign(receipt, { state: 'completed', public_result: result });
    expect(result.extraction).toEqual(extraction);
    expect(JSON.stringify(prepared.row.public_result)).toBe(original);
    expect(prepared.row.scope_manifest).toHaveProperty(
      'invoice_analysis_completion',
      context.toolCallId,
    );
    await tool.verifyResultAuthority!(input, result, context);
    expect(vi.mocked(native.normalize)).toHaveBeenCalledTimes(1);
    await expect(
      tool.verifyAuthority(input, { ...context, toolCallId: randomUUID() }),
    ).rejects.toThrow('request_conflict');
  });
  it('reopens the immutable result after terminal run/attempt and expired runtime deadline without mutation', async () => {
    const f = fixture();
    const { result } = await f.prepare();
    f.run.state = 'completed';
    f.run.deadline_at = new Date(0);
    Object.assign(f.attempt, { phase: 'completed', ended_at: new Date() });
    const context = { ...f.context, attemptId: undefined };
    const count = f.saves.length;
    await tool.verifyAuthority(f.input, context);
    await tool.verifyResultAuthority!(f.input, result, context);
    expect(f.saves).toHaveLength(count);
    await expect(tool.external!.prepare(f.input, context)).rejects.toThrow();
  });
  it('allows super_admin historical inspection but rejects a different live actor', async () => {
    const f = fixture();
    const { result } = await f.prepare();
    const actor = { ...f.context.actor, actorId: '99', isSuperAdmin: true };
    await tool.verifyResultAuthority!(f.input, result, {
      ...f.context,
      attemptId: undefined,
      actor,
    });
    await expect(
      tool.verifyAuthority(f.input, { ...f.context, actor }),
    ).rejects.toThrow();
  });
  it('rejects altered public projection even when the stored snapshot is unchanged', async () => {
    const f = fixture();
    const { result } = await f.prepare();
    await expect(
      tool.verifyResultAuthority!(
        f.input,
        { ...result, instructions: 'Reemplazadas' },
        f.context,
      ),
    ).rejects.toThrow('invalid_tool_output');
  });
  it('rejects corruption of the stored public body against its private result hash', async () => {
    const f = fixture();
    const prepared = await f.prepare();
    const corrupted = { ...prepared.result, instructions: 'Corruptas' };
    prepared.row.public_result = corrupted;
    await expect(
      tool.verifyResultAuthority!(f.input, corrupted, {
        ...f.context,
        attemptId: undefined,
      }),
    ).rejects.toThrow('invalid_tool_output');
    const input = {
      action: 'complete',
      analysis_id: f.context.toolCallId!,
      extraction,
    };
    await expect(
      tool.verifyAuthority(input, { ...f.context, toolCallId: randomUUID() }),
    ).rejects.toThrow('tool_not_available');
  });
  it('rejects supplier changes between pure execution and final SQL verification', async () => {
    const f = fixture();
    const operation = await tool.external!.prepare(f.input, f.context);
    await operation.execute(f.context.signal!);
    f.provider.tax = 20;
    await expect(operation.verify(f.context)).rejects.toThrow(
      'request_conflict',
    );
  });
  it('verifies the actual frozen configuration on every authority check', async () => {
    const f = fixture();
    configuration.mockRejectedValueOnce(
      new Error('nodia_ai:adapter_configuration_changed'),
    );
    await expect(tool.verifyAuthority(f.input, f.context)).rejects.toThrow(
      'tool_not_available',
    );
    expect(vi.mocked(native.prepare)).not.toHaveBeenCalled();
  });
  it('accepts delegated Agentic only with its exact frozen target selection and generation', async () => {
    const f = fixture();
    f.attempt.stage_key = 'delegated_inference';
    f.run.routing_snapshot.target = {
      selection: {
        ...f.attempt.selection_snapshot,
        mode: 'token_plan_agentic',
      },
      session_generation: 's'.repeat(32),
      configuration_generation: 'c'.repeat(64),
    };
    f.run.selection_snapshot = {
      ...f.run.selection_snapshot,
      mode: 'token_plan_web',
    };
    await tool.verifyAuthority(f.input, f.context);
    expect(configuration).toHaveBeenLastCalledWith(
      f.attempt.selection_snapshot,
      'c'.repeat(64),
      f.context.manager,
    );
  });
  it.each([
    [
      'foreign actor',
      (f: ReturnType<typeof fixture>) => {
        f.context.actor.actorId = '2';
      },
    ],
    [
      'foreign conversation',
      (f: ReturnType<typeof fixture>) => {
        f.run.conversation_id = randomUUID();
      },
    ],
    [
      'unarmed attempt',
      (f: ReturnType<typeof fixture>) => {
        f.attempt.phase = 'claimed';
      },
    ],
    [
      'ended attempt',
      (f: ReturnType<typeof fixture>) => {
        Object.assign(f.attempt, { ended_at: new Date() });
      },
    ],
    [
      'web mode',
      (f: ReturnType<typeof fixture>) => {
        f.attempt.selection_snapshot.mode = 'token_plan_web';
      },
    ],
    [
      'missing attempt',
      (f: ReturnType<typeof fixture>) => {
        Object.assign(f.context, { attemptId: undefined });
      },
    ],
    [
      'reviewed text',
      (f: ReturnType<typeof fixture>) => {
        Object.assign(f.part, { text: 'Texto revisado' });
      },
    ],
    [
      'audio source',
      (f: ReturnType<typeof fixture>) => {
        f.attachment.kind = 'audio';
      },
    ],
    [
      'source hash',
      (f: ReturnType<typeof fixture>) => {
        f.attachment.content_hash = 'd'.repeat(64);
      },
    ],
    [
      'source generation',
      (f: ReturnType<typeof fixture>) => {
        f.attachment.generation = randomUUID();
      },
    ],
    [
      'retention epoch',
      (f: ReturnType<typeof fixture>) => {
        f.attachment.retention_epoch = '2';
      },
    ],
    [
      'expired source',
      (f: ReturnType<typeof fixture>) => {
        f.attachment.expires_at = new Date(0);
      },
    ],
    [
      'invoice byte limit',
      (f: ReturnType<typeof fixture>) => {
        f.attachment.byte_count = String(10 * 1024 * 1024 + 1);
      },
    ],
    [
      'foreign supplier',
      (f: ReturnType<typeof fixture>) => {
        f.provider.business_id = randomUUID();
      },
    ],
    [
      'missing business',
      (f: ReturnType<typeof fixture>) => {
        f.rows.set(Business, []);
      },
    ],
    [
      'revoked module',
      (f: ReturnType<typeof fixture>) => {
        Object.assign(f.context, { moduleRoutes: [] });
      },
    ],
  ])('rejects %s before native rules execute', async (_label, mutate) => {
    const f = fixture();
    (mutate as (f: ReturnType<typeof fixture>) => void)(f);
    await expect(tool.verifyAuthority(f.input, f.context)).rejects.toThrow();
    expect(vi.mocked(native.prepare)).not.toHaveBeenCalled();
  });
});

const originalUrl = envs.GEMINI_MICROSERVICE_URL,
  originalToken = envs.GEMINI_SERVICE_TOKEN;
afterEach(() => {
  envs.GEMINI_MICROSERVICE_URL = originalUrl;
  envs.GEMINI_SERVICE_TOKEN = originalToken;
  vi.unstubAllGlobals();
});
describe('Invoice contract HTTP transport through the MCP use case', () => {
  let httpTool: NodiaAiToolRegistration;
  beforeAll(() => {
    httpTool = new BuildNodiaAiInvoiceAnalysisToolUseCase(
      new HttpNodiaAiInvoiceAnalysisContract(),
      snapshots,
    ).execute()[0].capabilities[0];
  });
  function configure() {
    envs.GEMINI_MICROSERVICE_URL = 'http://127.0.0.1:1';
    envs.GEMINI_SERVICE_TOKEN = 'a'.repeat(64);
  }
  it('uses the authenticated pure route without sending attachment bytes, URLs or profile inputs', async () => {
    configure();
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            contract_version: 'nodia-ai-invoice-analysis/1',
            instructions: 'Reglas nativas',
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    const f = fixture();
    const operation = await httpTool.external!.prepare(f.input, f.context);
    const result = await operation.execute(f.context.signal!);
    expect(result.instructions).toBe('Reglas nativas');
    const [url, request] = fetcher.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.pathname).toBe('/nodia-ai/invoice-analysis/contract');
    expect(request.redirect).toBe('error');
    expect(request.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Nodia-Service-Token': 'a'.repeat(64),
    });
    const body = JSON.parse(String(request.body));
    expect(Object.keys(body).sort()).toEqual([
      'action',
      'provider_fields',
      'tax',
    ]);
    expect(body.action).toBe('prepare');
    expect(JSON.stringify(body)).not.toContain(f.source.content_hash);
  });
  it.each([
    ['invalid JSON', '{broken', 200],
    [
      'duplicate keys',
      '{"contract_version":"nodia-ai-invoice-analysis/1","instructions":"a","instructions":"b"}',
      200,
    ],
    [
      'wrong version',
      JSON.stringify({ contract_version: 'other', instructions: 'x' }),
      200,
    ],
    [
      'unknown response key',
      JSON.stringify({
        contract_version: 'nodia-ai-invoice-analysis/1',
        instructions: 'x',
        secret: 'must-not-leak',
      }),
      200,
    ],
    ['oversized response', 'x'.repeat(131073), 200],
    ['unsafe upstream error', 'private-profile-cookie', 503],
  ])('rejects %s with a stable safe error', async (_label, body, status) => {
    configure();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status })),
    );
    const f = fixture();
    const operation = await httpTool.external!.prepare(f.input, f.context);
    await expect(operation.execute(f.context.signal!)).rejects.toThrow(
      'nodia_ai:invoice_analysis_contract_unavailable',
    );
    expect(f.saves).toHaveLength(0);
  });
  it('rejects an expired deadline without a remote request', async () => {
    configure();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const f = fixture();
    const operation = await httpTool.external!.prepare(f.input, {
      ...f.context,
      deadlineAt: Date.now() - 1,
    });
    await expect(operation.execute(f.context.signal!)).rejects.toThrow(
      'nodia_ai:invoice_analysis_contract_unavailable',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
