import { NodiaAiReportToolsUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { GeminiNodiaAiAdapterUseCase } from './gemini-nodia-ai-adapter.use-case.js';
import { NodiaAiAdapterTransport } from '../nodia-ai-adapter.service.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NODIA_AI_MCP_CATALOG_LIMITS,
  nodiaAiMcpCatalogUtf8Bytes,
  type NodiaAiAdapterTool,
} from '../types/nodia-ai-adapter.types.js';

vi.mock('../../config/envs.config.js', () => ({
  envs: {
    GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:8000',
    GEMINI_SERVICE_TOKEN: 'ab'.repeat(32),
  },
}));

const selection: NodiaAiSelection = {
  connection_id: '9007199254740993',
  mode: 'token_plan_web',
  model_id: 'fixture-discovered-model',
  effort_id: null,
};
function fixture() {
  const row = {
    id: selection.connection_id,
    is_active: true,
    catalog_active: true,
    provider_key: 'gemini',
    use_token_plan_web: true,
    use_token_plan_agentic: true,
    can_use_token_plan_web: true,
    can_use_token_plan_agentic: true,
    fields: {
      token_plan_web: {
        selected_model: selection.model_id,
        available_models: [{ id: selection.model_id }],
        thinking_levels: { [selection.model_id]: null },
      },
      api_key: { irrelevant: 'never-sent' },
    },
    updated_at: '2026-10-15T00:00:00Z',
  };
  const query = vi.fn().mockResolvedValue([row]);
  const source = { manager: { query } } as unknown as DataSource;
  const execute = new GeminiNodiaAiAdapterUseCase(
    source,
    new NodiaAiAdapterTransport(),
  );
  const observation = {
    available: true,
    observed_at: new Date().toISOString(),
    source: 'gemini_live_session_and_catalog',
    resource_key: 'gemini-profile:' + '1'.repeat(64),
    session_generation: '2'.repeat(32),
    adapter_contract_version: 'nodia-ai-gemini-chat/1',
    supports_mcp: false,
    reason: null,
  };
  const replies: unknown[] = [];
  const respond = (reply: unknown) => replies.push(reply);
  const fetch = vi
    .fn()
    .mockImplementation(async (url: URL, options: RequestInit) => {
      if (String(url).endsWith('/turn')) {
        const input = JSON.parse(String(options.body));
        return new Response(
          JSON.stringify({
            reply: replies.shift(),
            terminal_proof: {
              attempt_id: input.attempt_id,
              resource_key: input.resource_key,
              session_generation: input.session_generation,
              operation_ref: input.attempt_id,
              terminal_proof_id: randomUUID(),
              process_closed: true,
              outcome: 'completed',
              observed_at: new Date().toISOString(),
            },
          }),
        );
      }
      return new Response(JSON.stringify(observation), { status: 200 });
    });
  vi.stubGlobal('fetch', fetch);
  return { row, query, execute, observation, fetch, respond };
}
afterEach(() => vi.unstubAllGlobals());

describe('Gemini NodiaAI adapter use case', () => {
  const measured = (canonicalPrompt = 'Contexto ñ') => ({
    measurement_contract_version: 'nodia-ai-context-budget/1', measurement_scope: 'initial_native_prompt',
    measurement_kind: 'exact', canonical_utf8_bytes: Buffer.byteLength(canonicalPrompt, 'utf8'),
    catalog_utf8_bytes: 0, overhead_utf8_bytes: 1000,
    total_utf8_bytes: Buffer.byteLength(canonicalPrompt, 'utf8') + 1000, max_utf8_bytes: 262144,
    model_context_tokens: null,
    first_mcp_listing_upper_bound_utf8_bytes: 0,
  });
  it('measures a pure initial native prompt through the private authenticated route without querying configuration or invoking generation', async () => {
    const f = fixture(); f.fetch.mockResolvedValueOnce(new Response(JSON.stringify(measured())));
    const result = await f.execute.measureContext({ selection, canonicalPrompt: 'Contexto ñ' });
    expect(result).toEqual({ measurementContractVersion: 'nodia-ai-context-budget/1', measurementScope: 'initial_native_prompt',
      measurementKind: 'exact', canonicalUtf8Bytes: Buffer.byteLength('Contexto ñ', 'utf8'), catalogUtf8Bytes: 0,
      overheadUtf8Bytes: 1000, totalUtf8Bytes: Buffer.byteLength('Contexto ñ', 'utf8') + 1000,
      maxUtf8Bytes: 262144, modelContextTokens: null, firstMcpListingUpperBoundUtf8Bytes: 0 });
    expect(f.query).not.toHaveBeenCalled();
    expect(String(f.fetch.mock.calls[0][0])).toBe('http://127.0.0.1:8000/nodia-ai/web/measure-context');
    const body = JSON.parse(String(f.fetch.mock.calls[0][1].body));
    expect(body).toEqual({ model_id: selection.model_id, effort_id: null, canonical_prompt: 'Contexto ñ', tools: [], attachments: [] });
    expect(f.fetch).toHaveBeenCalledOnce();
  });
  it('returns a measured overflow for the orchestrator to compact instead of truncating history', async () => {
    const f = fixture(); const raw = measured(); raw.overhead_utf8_bytes = 300000;
    raw.total_utf8_bytes = raw.canonical_utf8_bytes + raw.overhead_utf8_bytes;
    f.fetch.mockResolvedValueOnce(new Response(JSON.stringify(raw)));
    const result = await f.execute.measureContext({ selection, canonicalPrompt: 'Contexto ñ' });
    expect(result.totalUtf8Bytes).toBeGreaterThan(result.maxUtf8Bytes);
    expect(result.modelContextTokens).toBeNull();
  });
  it('accepts an explicitly declared Agentic attachment bound without sending original bytes or requiring MIME inspection', async () => {
    const f = fixture(); const raw = { ...measured(), measurement_kind: 'upper_bound' };
    f.fetch.mockResolvedValueOnce(new Response(JSON.stringify(raw)));
    const result = await f.execute.measureContext({ selection: { ...selection, mode: 'token_plan_agentic' },
      canonicalPrompt: 'Contexto ñ', attachments: [{ kind: 'audio' }] });
    expect(result.measurementKind).toBe('upper_bound');
    const body = JSON.parse(String(f.fetch.mock.calls[0][1].body));
    expect(body.attachments).toEqual([{ kind: 'audio' }]);
    expect(body).not.toHaveProperty('attempt_id');
    expect(body).not.toHaveProperty('session_generation');
  });
  it.each([
    { model_context_tokens: 1000000 }, { max_utf8_bytes: 9999999 }, { total_utf8_bytes: 1 },
    { catalog_utf8_bytes: 12 }, { canonical_utf8_bytes: 1 }, { overhead_utf8_bytes: -1 },
    { overhead_utf8_bytes: 1.5 }, { measurement_kind: 'unknown' }, { measurement_scope: 'all_provider_tokens' },
    { secret: 'fixture-secret' },
  ])('rejects untrusted context measurements %j without claiming provider capacity', async (change) => {
    const f = fixture(); f.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ...measured(), ...change })));
    await expect(f.execute.measureContext({ selection, canonicalPrompt: 'Contexto ñ' })).rejects.toMatchObject({
      code: 'adapter_invalid_context_measurement', outcome: 'not_dispatched',
    });
    expect(f.query).not.toHaveBeenCalled();
  });
  it('binds exact bigint connection, mode, dynamic model and truthful observation', async () => {
    const f = fixture();
    const observed = await f.execute.observe(selection);
    expect(observed.available).toBe(true);
    expect(observed.supportsMcp).toBe(false);
    expect(observed.observedAt).toBeInstanceOf(Date);
    expect(observed.configurationGeneration).toMatch(/^[0-9a-f]{64}$/);
    expect(f.query.mock.calls[0][1]).toEqual([selection.connection_id]);
    expect(String(f.fetch.mock.calls[0][0])).toBe(
      'http://127.0.0.1:8000/nodia-ai/web/observe',
    );
    expect(JSON.parse(f.fetch.mock.calls[0][1].body)).toEqual({
      model_id: selection.model_id,
      effort_id: null,
      configuration_generation: observed.configurationGeneration,
    });
    expect(f.fetch.mock.calls[0][1].body).not.toContain('never-sent');
  });
  it.each(['api_key', 'unknown'])(
    'rejects unsupported mode %s before HTTP',
    async (mode) => {
      const f = fixture();
      await expect(
        f.execute.observe({ ...selection, mode } as NodiaAiSelection),
      ).rejects.toMatchObject({
        code: 'adapter_mode_unsupported',
        outcome: 'not_dispatched',
      });
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it.each([
    { provider_key: 'openai' },
    { is_active: false },
    { catalog_active: false },
    { use_token_plan_web: false },
    { can_use_token_plan_web: false },
  ])(
    'rejects stale/foreign configuration %j without provider request',
    async (patch) => {
      const f = fixture();
      Object.assign(f.row, patch);
      await expect(f.execute.observe(selection)).rejects.toMatchObject({
        code: 'adapter_connection_unavailable',
      });
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it('future effort IDs are passed exactly to live protocol validation', async () => {
    const f = fixture();
    await f.execute.observe({
      ...selection,
      effort_id: 'future-observed-effort',
    });
    expect(JSON.parse(f.fetch.mock.calls[0][1].body).effort_id).toBe(
      'future-observed-effort',
    );
  });
  it('accepts explicit unavailability with no invented runtime resource', async () => {
    const f = fixture();
    Object.assign(f.observation, {
      available: false,
      resource_key: null,
      reason: 'runtime_unconfigured',
    });
    const observed = await f.execute.observe(selection);
    expect(observed.available).toBe(false);
    expect(observed.resourceKey).toBeNull();
  });
  it.each([
    { supports_mcp: true },
    { available: true, reason: 'unverified' },
    { source: 'invented' },
    { session_generation: null },
    { observed_at: 'invalid' },
    { observed_at: '2020-01-01T00:00:00Z' },
    { unknown_field: true },
  ])('rejects malformed or unverifiable observation %j', async (patch) => {
    const f = fixture();
    Object.assign(f.observation, patch);
    await expect(f.execute.observe(selection)).rejects.toMatchObject({
      code: 'adapter_invalid_observation',
    });
  });
  it('rechecks configuration after live observation and inside caller transaction without HTTP', async () => {
    const f = fixture();
    const observation = await f.execute.observe(selection);
    const manager = {
      query: f.query,
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager;
    const count = f.fetch.mock.calls.length;
    await f.execute.verifyConfiguration(
      selection,
      observation.configurationGeneration,
      manager,
    );
    expect(f.fetch).toHaveBeenCalledTimes(count);
    expect(f.query.mock.calls.at(-1)?.[0]).toContain('FOR SHARE OF p,c');
    f.row.fields.token_plan_web.selected_model = 'changed';
    await expect(
      f.execute.verifyConfiguration(
        selection,
        observation.configurationGeneration,
        manager,
      ),
    ).rejects.toMatchObject({ code: 'adapter_configuration_changed' });
  });
  it('configuration generation includes the actual PostgreSQL Date timestamp', async () => {
    const f = fixture();
    f.row.updated_at = new Date('2026-10-15T00:00:00Z') as unknown as string;
    const observation = await f.execute.observe(selection);
    f.row.updated_at = new Date('2026-10-15T00:00:01Z') as unknown as string;
    await expect(
      f.execute.verifyConfiguration(
        selection,
        observation.configurationGeneration,
      ),
    ).rejects.toMatchObject({ code: 'adapter_configuration_changed' });
  });
  it('executes one attempt with canonical prompt, exact selection and deadline; no retry', async () => {
    const f = fixture();
    const observation = await f.execute.observe(selection);
    f.respond({ kind: 'answer', text: 'Resultado' });
    const reply = await f.execute.execute({
      attemptId: randomUUID(),
      selection,
      canonicalPrompt: 'Historia canónica',
      deadlineAt: new Date(Date.now() + 60000),
      resourceKey: observation.resourceKey!,
      sessionGeneration: observation.sessionGeneration,
      configurationGeneration: observation.configurationGeneration,
    });
    expect(reply).toMatchObject({
      kind: 'answer',
      text: 'Resultado',
      terminalProof: { outcome: 'completed', processClosed: true },
    });
    expect(f.fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(f.fetch.mock.calls[1][1].body);
    expect(body.model_id).toBe(selection.model_id);
    expect(body.canonical_prompt).toBe('Historia canónica');
    expect(body.timeout_seconds).toBeGreaterThan(0);
    expect(body.timeout_seconds).toBeLessThanOrEqual(60);
    expect(body).not.toHaveProperty('tools');
  });
  it('unknown network result never retries or changes mode', async () => {
    const f = fixture();
    const observation = await f.execute.observe(selection);
    f.fetch.mockRejectedValueOnce(new Error('sensitive provider failure'));
    await expect(
      f.execute.execute({
        attemptId: randomUUID(),
        selection,
        canonicalPrompt: 'x',
        deadlineAt: new Date(Date.now() + 60000),
        resourceKey: observation.resourceKey!,
        sessionGeneration: observation.sessionGeneration,
        configurationGeneration: observation.configurationGeneration,
      }),
    ).rejects.toMatchObject({
      code: 'adapter_transport_unavailable',
      outcome: 'unknown',
    });
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    { kind: 'answer', text: '', sql: 'bad' },
    { kind: 'tool_request', name: 'sql' },
    { kind: 'answer', text: 'x'.repeat(32769) },
  ])('invalid reply is uncertain %j', async (payload) => {
    const f = fixture();
    const observation = await f.execute.observe(selection);
    f.respond(payload);
    await expect(
      f.execute.execute({
        attemptId: randomUUID(),
        selection,
        canonicalPrompt: 'x',
        deadlineAt: new Date(Date.now() + 60000),
        resourceKey: observation.resourceKey!,
        sessionGeneration: observation.sessionGeneration,
        configurationGeneration: observation.configurationGeneration,
      }),
    ).rejects.toMatchObject({ outcome: 'unknown' });
  });
  it('Web delegation is only a typed request; Agentic cannot recursively delegate', async () => {
    const f = fixture();
    const observation = await f.execute.observe(selection);
    const request = {
      attemptId: randomUUID(),
      selection,
      canonicalPrompt: 'x',
      deadlineAt: new Date(Date.now() + 60000),
      resourceKey: observation.resourceKey!,
      sessionGeneration: observation.sessionGeneration,
      configurationGeneration: observation.configurationGeneration,
    };
    f.respond({
      kind: 'delegation_request',
      reason: 'Needs authorized tools',
    });
    await expect(f.execute.execute(request)).resolves.toMatchObject({
      kind: 'delegation_request',
      reason: 'Needs authorized tools',
    });
    const agentic = { ...selection, mode: 'token_plan_agentic' } as const;
    const target = await f.execute.observe(agentic);
    f.respond({ kind: 'delegation_request', reason: 'Again' });
    await expect(
      f.execute.execute({
        ...request,
        attemptId: randomUUID(),
        selection: agentic,
        configurationGeneration: target.configurationGeneration,
      }),
    ).rejects.toMatchObject({
      code: 'adapter_invalid_reply',
      outcome: 'unknown',
    });
  });
  it('rejects expired deadline before dispatch', async () => {
    const f = fixture();
    const observation = await f.execute.observe(selection);
    await expect(
      f.execute.execute({
        attemptId: randomUUID(),
        selection,
        canonicalPrompt: 'x',
        deadlineAt: new Date(0),
        resourceKey: observation.resourceKey!,
        sessionGeneration: observation.sessionGeneration,
        configurationGeneration: observation.configurationGeneration,
      }),
    ).rejects.toMatchObject({
      code: 'adapter_deadline_expired',
      outcome: 'not_dispatched',
    });
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it('bounds streamed remote bytes without leaking or resending', async () => {
    const f = fixture();
    f.fetch.mockResolvedValueOnce(new Response('x'.repeat(131073)));
    await expect(f.execute.observe(selection)).rejects.toMatchObject({
      code: 'adapter_invalid_response',
      outcome: 'not_dispatched',
    });
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });
});

function mcpFixture() {
  const f = fixture();
  const progress = vi.fn().mockResolvedValue(undefined);
  const callback = vi.fn().mockResolvedValue({ marker: 'SYNTHETIC_MARKER' });
  const attemptId = randomUUID();
  const tools: NodiaAiAdapterTool[] = [
    {
      name: 'fixture_read',
      description: 'Synthetic only',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  ];
  const request = {
    attemptId,
    selection: { ...selection, mode: 'token_plan_agentic' } as NodiaAiSelection,
    canonicalPrompt: 'Synthetic fixture only',
    deadlineAt: new Date(Date.now() + 60000),
    resourceKey: f.observation.resource_key,
    sessionGeneration: f.observation.session_generation,
    configurationGeneration: '',
    tools,
    onToolCall: callback,
    onProtocolProgress: progress,
  };
  const proof = {
    attempt_id: attemptId,
    resource_key: request.resourceKey,
    session_generation: request.sessionGeneration,
    operation_ref: attemptId,
    terminal_proof_id: randomUUID(),
    process_closed: true,
    outcome: 'completed',
    observed_at: new Date().toISOString(),
  };
  const snapshots: unknown[] = [
    {
      attempt_id: attemptId,
      state: 'running',
      rpc_messages: 4,
      unforwarded_tool_requests: 0,
      events: [
        {
          seq: 1,
          kind: 'tool_request',
          call_id: randomUUID(),
          name: 'fixture_read',
          arguments: { query: 'x' },
        },
      ],
    },
    {
      attempt_id: attemptId,
      state: 'completed',
      rpc_messages: 5,
      unforwarded_tool_requests: 0,
      events: [
        {
          seq: 2,
          kind: 'answer',
          text: 'SYNTHETIC_MARKER',
          terminal_proof: proof,
        },
      ],
    },
  ];
  const wire = vi
    .fn()
    .mockImplementation(async (url: URL, options: RequestInit) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/observe'))
        return new Response(JSON.stringify(f.observation));
      if (path.endsWith('/mcp/start'))
        return new Response(
          JSON.stringify({ attempt_id: attemptId, state: 'running' }),
        );
      if (path.endsWith('/mcp/events'))
        return new Response(JSON.stringify(snapshots.shift()));
      if (path.endsWith('/mcp/results'))
        return new Response(JSON.stringify({ accepted: true }));
      if (path.endsWith('/mcp/attest'))
        return new Response(
          JSON.stringify({
            verified: true,
            adapter_contract_version: 'nodia-ai-gemini-chat/1',
          }),
        );
      if (path.endsWith('/mcp/cancel'))
        return new Response(
          JSON.stringify({ attempt_id: attemptId, state: 'unknown' }),
        );
      throw Error(
        'Unexpected synthetic request ' + path + String(options.method),
      );
    });
  vi.stubGlobal('fetch', wire);
  return {
    ...f,
    request,
    proof,
    snapshots,
    wire,
    progress,
    callback,
    configure: async () => {
      request.configurationGeneration = (
        await f.execute.observe(request.selection)
      ).configurationGeneration;
    },
  };
}

describe('Gemini NodiaAI bounded native MCP loop', () => {
  it('preserves all 74 real read/report descriptors across the private wire', async () => {
    const f = mcpFixture();
    await f.configure();
    const candidateTools = JSON.parse(
      readFileSync(
        new URL(
          '../../../../nodia-gemini-microservice/tests/fixtures/nodia-ai-ai15-mcp-tools.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as {
      name: string;
      description: string;
      input_schema: Record<string, unknown>;
    }[];
    expect(candidateTools).toHaveLength(72);
    const reports = new NodiaAiReportToolsUseCase(
      {} as ConstructorParameters<typeof NodiaAiReportToolsUseCase>[0],
      {} as ConstructorParameters<typeof NodiaAiReportToolsUseCase>[1],
      {} as ConstructorParameters<typeof NodiaAiReportToolsUseCase>[2],
    );
    candidateTools.push(
      ...reports
        .descriptors()
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        })),
    );
    expect(candidateTools).toHaveLength(74);
    expect(candidateTools.at(-1)?.name).toBe('nodia_reports_run');
    f.request.tools = candidateTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema,
    }));
    expect(nodiaAiMcpCatalogUtf8Bytes(f.request.tools)).toBeLessThanOrEqual(
      131072,
    );
    const snapshot = f.snapshots[0] as { events: { name: string }[] };
    snapshot.events[0].name = candidateTools.at(-1)!.name;
    await f.execute.execute(f.request);
    const start = f.wire.mock.calls.find(([url]) =>
      String(url).endsWith('/mcp/start'),
    )!;
    expect(JSON.parse(String(start[1].body)).tools).toEqual(candidateTools);
    expect(f.callback.mock.calls[0][0].name).toBe(candidateTools.at(-1)!.name);
  });
  it('dispatches all 74 descriptors and routes the last registered name without truncation', async () => {
    const f = mcpFixture();
    await f.configure();
    const first = f.request.tools[0];
    f.request.tools = Array.from({ length: 74 }, (_, index) => ({
      ...first,
      name: index === 0 ? first.name : `fixture_read_${index}`,
    }));
    const snapshot = f.snapshots[0] as { events: { name: string }[] };
    snapshot.events[0].name = f.request.tools.at(-1)!.name;
    await f.execute.execute(f.request);
    const start = f.wire.mock.calls.find(([url]) =>
      String(url).endsWith('/mcp/start'),
    )!;
    const sent = JSON.parse(String(start[1].body)) as {
      tools: { name: string }[];
    };
    expect(sent.tools.map((tool) => tool.name)).toEqual(
      f.request.tools.map((tool) => tool.name),
    );
    expect(f.callback.mock.calls[0][0].name).toBe(f.request.tools.at(-1)!.name);
  });
  it('rejects 75 tools before sending mcp/start', async () => {
    const f = mcpFixture();
    await f.configure();
    f.request.tools = Array.from({ length: 75 }, (_, index) => ({
      ...f.request.tools[0],
      name: `fixture_read_${index}`,
    }));
    await expect(f.execute.execute(f.request)).rejects.toMatchObject({
      outcome: 'not_dispatched',
    });
    expect(
      f.wire.mock.calls.some(([url]) => String(url).endsWith('/mcp/start')),
    ).toBe(false);
  });
  it.each([0, 1])(
    'enforces the exact catalog byte boundary plus %i byte before dispatch',
    async (extra) => {
      const f = mcpFixture();
      await f.configure();
      f.request.tools = Array.from({ length: 4 }, (_, index) => ({
        ...f.request.tools[0],
        name: index === 0 ? 'fixture_read' : `fixture_read_${index}`,
        inputSchema: {
          ...f.request.tools[0].inputSchema,
          description: 'x'.repeat(30000),
        },
      }));
      const schema = f.request.tools[0].inputSchema as Record<string, unknown>;
      schema.description =
        String(schema.description) +
        'x'.repeat(
          NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes -
            nodiaAiMcpCatalogUtf8Bytes(f.request.tools) +
            extra,
        );
      expect(nodiaAiMcpCatalogUtf8Bytes(f.request.tools)).toBe(131072 + extra);
      if (extra) {
        await expect(f.execute.execute(f.request)).rejects.toMatchObject({
          code: 'mcp_catalog_invalid',
          outcome: 'not_dispatched',
        });
        expect(
          f.wire.mock.calls.some(([url]) => String(url).endsWith('/mcp/start')),
        ).toBe(false);
      } else
        await expect(f.execute.execute(f.request)).resolves.toMatchObject({
          kind: 'answer',
        });
    },
  );
  it('reports denied or replayed native attempts without double counting visible callbacks', async () => {
    const f = mcpFixture();
    await f.configure();
    (
      f.snapshots[0] as { unforwarded_tool_requests: number }
    ).unforwarded_tool_requests = 2;
    (
      f.snapshots[1] as { unforwarded_tool_requests: number }
    ).unforwarded_tool_requests = 3;
    await f.execute.execute(f.request);
    expect(
      f.progress.mock.calls.map(([rpc, , hidden]) => [rpc, hidden]),
    ).toEqual([
      [4, 2],
      [5, 3],
    ]);
    expect(f.callback).toHaveBeenCalledOnce();
  });
  it.each(['missing', 'negative', 'fractional', 'decreasing', 'over-budget'])(
    'rejects %s hidden tool progress and cancels without replay',
    async (kind) => {
      const f = mcpFixture();
      await f.configure();
      const first = f.snapshots[0] as Record<string, unknown>;
      const second = f.snapshots[1] as Record<string, unknown>;
      if (kind === 'missing') delete first.unforwarded_tool_requests;
      if (kind === 'negative') first.unforwarded_tool_requests = -1;
      if (kind === 'fractional') first.unforwarded_tool_requests = 0.5;
      if (kind === 'over-budget') first.unforwarded_tool_requests = 13;
      if (kind === 'decreasing') {
        first.unforwarded_tool_requests = 1;
        second.unforwarded_tool_requests = 0;
      }
      await expect(f.execute.execute(f.request)).rejects.toMatchObject({
        code: 'mcp_events_invalid',
        outcome: 'unknown',
      });
      expect(
        f.wire.mock.calls.filter(([url]) => String(url).endsWith('/mcp/start')),
      ).toHaveLength(1);
      expect(
        f.wire.mock.calls.filter(([url]) =>
          String(url).endsWith('/mcp/cancel'),
        ),
      ).toHaveLength(1);
    },
  );
  it('bounds hidden plus visible requests before the next callback', async () => {
    const f = mcpFixture();
    await f.configure();
    Object.assign(f.snapshots[0] as object, {
      rpc_messages: 20,
      unforwarded_tool_requests: 12,
    });
    await expect(f.execute.execute(f.request)).rejects.toMatchObject({
      code: 'mcp_call_invalid',
      outcome: 'unknown',
    });
    expect(f.callback).not.toHaveBeenCalled();
    expect(f.progress.mock.calls[0][2]).toBe(12);
  });
  it('rejects combined budget overflow on a terminal snapshot without returning its answer', async () => {
    const f = mcpFixture();
    await f.configure();
    Object.assign(f.snapshots[1] as object, {
      rpc_messages: 20,
      unforwarded_tool_requests: 12,
    });
    await expect(f.execute.execute(f.request)).rejects.toMatchObject({
      code: 'mcp_events_invalid',
      outcome: 'unknown',
    });
    expect(f.callback).toHaveBeenCalledOnce();
  });
  it('polls one registered callback, reserves real RPC progress and returns native terminal proof', async () => {
    const f = mcpFixture();
    await f.configure();
    const reply = await f.execute.execute(f.request);
    expect(reply).toMatchObject({
      kind: 'answer',
      text: 'SYNTHETIC_MARKER',
      terminalProof: {
        attemptId: f.request.attemptId,
        outcome: 'completed',
        processClosed: true,
      },
    });
    expect(f.progress.mock.calls.map(([count]) => count)).toEqual([4, 5]);
    expect(f.callback).toHaveBeenCalledOnce();
    expect(f.callback.mock.calls[0][0]).toMatchObject({
      name: 'fixture_read',
      arguments: { query: 'x' },
    });
    const result = f.wire.mock.calls.find(([url]) =>
      String(url).endsWith('/mcp/results'),
    );
    expect(JSON.parse(String(result?.[1].body))).toMatchObject({
      operation_ref: f.request.attemptId,
      result: { marker: 'SYNTHETIC_MARKER' },
    });
    expect(
      f.wire.mock.calls.filter(([url]) => String(url).endsWith('/mcp/start')),
    ).toHaveLength(1);
    expect(
      f.wire.mock.calls.some(([url]) => String(url).endsWith('/mcp/attest')),
    ).toBe(false);
  });
  it('only explicit operator probe requests attestation; health observation remains non-generative', async () => {
    const f = mcpFixture();
    await f.configure();
    await f.execute.probeMcp(f.request);
    const start = f.wire.mock.calls.find(([url]) =>
      String(url).endsWith('/mcp/start'),
    );
    expect(JSON.parse(String(start?.[1].body)).diagnostic).toBe(true);
    expect(
      f.wire.mock.calls.filter(([url]) => String(url).endsWith('/mcp/attest')),
    ).toHaveLength(1);
  });
  it('refuses unregistered tool names before callback, requests native cancellation and never retries', async () => {
    const f = mcpFixture();
    await f.configure();
    (f.snapshots[0] as { events: Record<string, unknown>[] }).events[0].name =
      'sql';
    await expect(f.execute.execute(f.request)).rejects.toMatchObject({
      code: 'mcp_call_invalid',
      outcome: 'unknown',
    });
    expect(f.callback).not.toHaveBeenCalled();
    expect(
      f.wire.mock.calls.filter(([url]) => String(url).endsWith('/mcp/cancel')),
    ).toHaveLength(1);
    expect(
      f.wire.mock.calls.filter(([url]) => String(url).endsWith('/mcp/start')),
    ).toHaveLength(1);
  });
  it('exhausted actual RPC count cancels before a tool callback', async () => {
    const f = mcpFixture();
    await f.configure();
    (f.snapshots[0] as { rpc_messages: number }).rpc_messages = 129;
    await expect(f.execute.execute(f.request)).rejects.toMatchObject({
      code: 'mcp_events_invalid',
    });
    expect(f.callback).not.toHaveBeenCalled();
  });
  it('revoked callback cannot continue the agent or send a fabricated tool result', async () => {
    const f = mcpFixture();
    await f.configure();
    f.callback.mockRejectedValueOnce(new Error('grant-revoked'));
    await expect(f.execute.execute(f.request)).rejects.toThrow('grant-revoked');
    expect(
      f.wire.mock.calls.some(([url]) => String(url).endsWith('/mcp/results')),
    ).toBe(false);
    expect(
      f.wire.mock.calls.some(([url]) => String(url).endsWith('/mcp/cancel')),
    ).toBe(true);
  });
  it('a terminal proof for another attempt is never accepted', async () => {
    const f = mcpFixture();
    await f.configure();
    f.proof.attempt_id = randomUUID();
    await expect(f.execute.execute(f.request)).rejects.toMatchObject({
      code: 'adapter_terminal_proof_invalid',
      outcome: 'unknown',
    });
  });
  it('Web cannot receive MCP descriptors even with opt-in or a callback', async () => {
    const f = mcpFixture();
    f.request.selection = selection;
    await f.configure();
    await expect(f.execute.execute(f.request)).rejects.toMatchObject({
      code: 'web_tools_prohibited',
      outcome: 'not_dispatched',
    });
    expect(
      f.wire.mock.calls.some(([url]) => String(url).endsWith('/mcp/start')),
    ).toBe(false);
  });
});

describe('AI-32 native private attachment protocol', () => {
  it('requires strict optional known modality proofs and keeps absence unknown', async () => {
    const f = fixture();
    expect((await f.execute.observe(selection)).verifiedModalities).toEqual([]);
    Object.assign(f.observation, { verified_modalities: ['image', 'pdf'] });
    expect((await f.execute.observe(selection)).verifiedModalities).toEqual([
      'image',
      'pdf',
    ]);
    Object.assign(f.observation, {
      verified_modalities: ['image', 'future-invented-modality'],
    });
    await expect(f.execute.observe(selection)).rejects.toMatchObject({
      code: 'adapter_invalid_observation',
      outcome: 'not_dispatched',
    });
  });
  it('validates optional MIME evidence without promoting legacy summaries', async () => {
    const f = fixture();
    Object.assign(f.observation, { verified_modalities: ['audio'] });
    expect((await f.execute.observe(selection)).verifiedAttachmentMediaTypes).toEqual([]);
    Object.assign(f.observation, { verified_attachment_media_types: ['audio/wav'] });
    expect((await f.execute.observe(selection)).verifiedAttachmentMediaTypes).toEqual(['audio/wav']);
    for (const formats of [['audio/wav', 'audio/wav'], ['audio/invented'], [7], null]) {
      Object.assign(f.observation, { verified_attachment_media_types: formats });
      await expect(f.execute.observe(selection)).rejects.toMatchObject({ code: 'adapter_invalid_observation' });
    }
  });
  it('binds a native payload and exact configuration to one Web attempt', async () => {
    const f = fixture();
    const observation = await f.execute.observe(selection);
    f.respond({ kind: 'answer', text: 'Synthetic decoded answer' });
    const buffer = Buffer.from('synthetic file');
    const files = [
      {
        kind: 'pdf' as const,
        media_type: 'application/pdf',
        sha256: createHash('sha256').update(buffer).digest('hex'),
        content_base64: buffer.toString('base64'),
      },
    ];
    await f.execute.execute({
      attemptId: randomUUID(),
      selection,
      canonicalPrompt: 'Read the explicitly attached file',
      deadlineAt: new Date(Date.now() + 60000),
      resourceKey: observation.resourceKey!,
      sessionGeneration: observation.sessionGeneration,
      configurationGeneration: observation.configurationGeneration,
      attachments: files,
    });
    const call = f.fetch.mock.calls.find(([url]) =>
      String(url).endsWith('/turn'),
    )!;
    const wire = JSON.parse(String(call[1].body));
    expect(wire.attachments).toEqual(files);
    expect(wire.configuration_generation).toBe(
      observation.configurationGeneration,
    );
  });
  it.each(['tampered-hash', 'noncanonical-base64', 'oversize-count'])(
    'rejects %s before provider dispatch',
    async (kind) => {
      const f = fixture();
      const observation = await f.execute.observe(selection);
      const buffer = Buffer.from('synthetic file');
      const file = {
        kind: 'pdf' as const,
        media_type: 'application/pdf',
        sha256: createHash('sha256').update(buffer).digest('hex'),
        content_base64: buffer.toString('base64'),
      };
      if (kind === 'tampered-hash') file.sha256 = '0'.repeat(64);
      if (kind === 'noncanonical-base64') file.content_base64 += '\n';
      const attachments =
        kind === 'oversize-count' ? Array(5).fill(file) : [file];
      await expect(
        f.execute.execute({
          attemptId: randomUUID(),
          selection,
          canonicalPrompt: 'Synthetic input',
          deadlineAt: new Date(Date.now() + 60000),
          resourceKey: observation.resourceKey!,
          sessionGeneration: observation.sessionGeneration,
          configurationGeneration: observation.configurationGeneration,
          attachments,
        }),
      ).rejects.toMatchObject({
        code: 'adapter_invalid_attachments',
        outcome: 'not_dispatched',
      });
      expect(
        f.fetch.mock.calls.some(([url]) => String(url).endsWith('/turn')),
      ).toBe(false);
    },
  );
});
