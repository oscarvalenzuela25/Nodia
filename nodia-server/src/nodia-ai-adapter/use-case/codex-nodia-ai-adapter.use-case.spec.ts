import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import {
  CodexChatAcceptanceStore,
  type CodexMcpAcceptance,
} from '../../common/ai/codex/codex-chat-acceptance.js';
import {
  CodexChatJournal,
  type CodexChatRecord,
} from '../../common/ai/codex/codex-chat-journal.js';
import type { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type {
  CodexChatCallbacks,
  CodexChatRequest,
} from '../../common/ai/codex/codex-chat-contract.js';
import { CodexChatRuntimeError } from '../../common/ai/codex/codex-chat-contract.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { codexError } from '../../common/ai/codex/codex-contract.js';
import { ObserveNodiaAiEligibilityUseCase } from '../../nodia-ai-conversation/use-case/observe-nodia-ai-eligibility.use-case.js';
import { connectionFixture } from '../../nodia-ai-conversation/use-case/nodia-ai-connections.fixture.js';
import { testIdentity } from '../../nodia-ai-conversation/use-case/conversation-admission.fixture.js';
import { CodexNodiaAiAdapterUseCase } from './codex-nodia-ai-adapter.use-case.js';
import { ReconcileCodexNodiaAiRuntimeUseCase } from './reconcile-codex-nodia-ai-runtime.use-case.js';
import type { NodiaAiAdapterRequest } from '../types/nodia-ai-adapter.types.js';
import type { NodiaAiRuntimeTerminalProof } from '../../nodia-ai-runtime/types/reconciliation.types.js';

function fixture() {
  const selection = {
    connection_id: '9007199254740993',
    mode: 'token_plan_agentic' as const,
    model_id: 'fixture-discovered-model',
    effort_id: 'new_effort',
  };
  const row = {
    id: selection.connection_id,
    provider_key: 'openai',
    is_active: true,
    catalog_active: true,
    use_token_plan_agentic: true,
    can_use_token_plan_agentic: true,
    updated_at: '2026-10-22T00:00:00Z',
    fields: {
      token_plan_agentic: {
        selected_model: selection.model_id,
        thinking_levels: { [selection.model_id]: selection.effort_id },
      },
      api_key: { fixture_secret: 'not-sent' },
    },
  };
  const query = vi.fn().mockResolvedValue([row]);
  const observed = {
    resourceKey: 'codex-profile:' + 'a'.repeat(64),
    runtimeSessionId: 'b'.repeat(32),
    supportsMcp: false,
    session: {
      available: true,
      authenticated: true,
      usageAllowed: null,
      reason: null,
    },
    models: [
      {
        id: selection.model_id,
        supportedReasoningEfforts: [selection.effort_id],
      },
    ],
  };
  const runtime = {
    journal: new CodexChatJournal(),
    fingerprint: vi.fn(async () => 'f'.repeat(64)),
    observe: vi.fn().mockResolvedValue(observed),
    measure: vi.fn((payload) => ({
      measurementKind: 'upper_bound' as const,
      canonicalUtf8Bytes: Buffer.byteLength(payload.prompt),
      catalogUtf8Bytes: 0,
      overheadUtf8Bytes: 400,
      totalUtf8Bytes: Buffer.byteLength(payload.prompt) + 400,
      maxUtf8Bytes: 262144,
    })),
    execute: vi.fn(
      async (request: CodexChatRequest, callbacks: CodexChatCallbacks) => {
        await callbacks.onPrepared(request.identity);
        await callbacks.assertLease(request.signal);
        await callbacks.onProtocolProgress(1, request.signal);
        return {
          text: 'fixture answer',
          terminalProof: {
            ...request.identity,
            processClosed: true,
            terminalProofId: randomUUID(),
            outcome: 'completed',
            observedAt: new Date(),
          } as NodiaAiRuntimeTerminalProof,
        };
      },
    ),
    reconcile: vi.fn(async (identity) => ({
      ...identity,
      processClosed: true,
      terminalProofId: randomUUID(),
      outcome: 'abandoned_unknown',
      observedAt: new Date(),
    })),
    acknowledge: vi.fn(),
  };
  let storedAcceptance: CodexMcpAcceptance | null = null;
  const acceptance = new CodexChatAcceptanceStore();
  vi.spyOn(acceptance, 'read').mockImplementation(async () => storedAcceptance);
  vi.spyOn(acceptance, 'invalidate').mockImplementation(async () => {
    storedAcceptance = null;
  });
  vi.spyOn(acceptance, 'write').mockImplementation(async (value) => {
    storedAcceptance = acceptance.decode(value);
  });
  const adapter = new CodexNodiaAiAdapterUseCase(
    { manager: { query } } as unknown as DataSource,
    runtime as unknown as CodexChatRuntime,
    new ValidateNodiaAiRuntimePolicyUseCase().execute(policyEnvelope()),
    acceptance,
  );
  const request = async (): Promise<NodiaAiAdapterRequest> => {
    const observation = await adapter.observe(selection);
    return {
      attemptId: randomUUID(),
      selection,
      canonicalPrompt: 'fixture ñ prompt',
      deadlineAt: new Date(Date.now() + 60000),
      resourceKey: observation.resourceKey!,
      sessionGeneration: observation.sessionGeneration,
      configurationGeneration: observation.configurationGeneration,
      onLeaseCheck: vi.fn(),
      onProtocolProgress: vi.fn(),
    };
  };
  return {
    selection,
    row,
    query,
    observed,
    runtime,
    adapter,
    request,
    acceptance,
  };
}

async function acceptedProbe() {
  const f = fixture(),
    request = await f.request();
  request.tools = [
    {
      name: 'nodia_knowledge_index',
      description: 'Published read',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  ];
  request.onToolCall = vi.fn(async () => ({ facts: [] }));
  let record: CodexChatRecord;
  vi.spyOn(f.runtime.journal, 'admission').mockImplementation(async (work) =>
    work(),
  );
  vi.spyOn(f.runtime.journal, 'identity').mockImplementation(async () => ({
    resourceKey: f.observed.resourceKey,
    runtimeSessionId: f.observed.runtimeSessionId,
  }));
  vi.spyOn(f.runtime.journal, 'read').mockImplementation(async () => record);
  f.runtime.execute.mockImplementationOnce(async (native, callbacks) => {
    await callbacks.onPrepared(native.identity);
    const value = (await callbacks.onToolCall(
      { callId: 'canary', name: 'nodia_knowledge_index', arguments: {} },
      native.signal,
    )) as { verification_nonce: string };
    record = {
      version: 1,
      identity: native.identity,
      expiresAt: native.deadlineAt.toISOString(),
      owner: {
        pid: 42,
        group: 42,
        birth: '123',
        boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      },
      native: {
        pid: 43,
        group: 43,
        birth: '124',
        boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      },
      state: 'completed',
      payloadSha256: 'a'.repeat(64),
      rpcCount: 1,
      frames: 20,
      bytes: 500,
      unforwardedRequests: 0,
      cancelRequested: false,
      terminalProofId: randomUUID(),
      observedAt: new Date().toISOString(),
      acknowledged: false,
    };
    return {
      text: value.verification_nonce,
      terminalProof: f.runtime.journal.proof(record),
    };
  });
  const answer = await f.adapter.probeMcp(request);
  return { ...f, answer, receipt: () => record };
}

describe('Codex NodiaAI adapter use case', () => {
  it('certifies MCP only after its exact nonce receipt is completed, closed and ACKed', async () => {
    const f = await acceptedProbe();
    expect((await f.adapter.observe(f.selection)).supportsMcp).toBe(false);
    await expect(
      f.adapter.acceptMcpProbe(
        f.answer.terminalProof,
        AbortSignal.timeout(1000),
      ),
    ).rejects.toMatchObject({ code: 'mcp_probe_unverified' });
    expect(f.acceptance.write).not.toHaveBeenCalled();
    f.receipt().acknowledged = true;
    await f.adapter.acceptMcpProbe(
      f.answer.terminalProof,
      AbortSignal.timeout(1000),
    );
    expect((await f.adapter.observe(f.selection)).supportsMcp).toBe(true);
    expect(
      (await f.adapter.observe(f.selection)).verifiedAttachmentMediaTypes,
    ).toEqual([]);
    expect(f.runtime.execute).toHaveBeenCalledTimes(1);
  });
  it.each([
    'session',
    'resource',
    'config',
    'model',
    'effort',
    'runtime',
  ] as const)(
    'invalidates accepted MCP on exact %s scope changes without generating',
    async (changed) => {
      const f = await acceptedProbe();
      f.receipt().acknowledged = true;
      await f.adapter.acceptMcpProbe(
        f.answer.terminalProof,
        AbortSignal.timeout(1000),
      );
      expect((await f.adapter.observe(f.selection)).supportsMcp).toBe(true);
      if (changed === 'session') f.observed.runtimeSessionId = 'c'.repeat(32);
      if (changed === 'resource')
        f.observed.resourceKey = 'codex-profile:' + 'd'.repeat(64);
      if (changed === 'config') f.row.updated_at = '2026-10-22T01:00:00Z';
      if (changed === 'model') f.selection.model_id = 'different-dynamic-model';
      if (changed === 'effort') f.selection.effort_id = 'other_effort';
      if (changed === 'runtime')
        f.runtime.fingerprint.mockResolvedValue('e'.repeat(64));
      expect((await f.adapter.observe(f.selection)).supportsMcp).toBe(false);
      expect(f.runtime.execute).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['unknown', 'hidden_requests', 'forged_proof'] as const)(
    'refuses MCP certification for %s despite a successful nonce',
    async (changed) => {
      const f = await acceptedProbe();
      f.receipt().acknowledged = true;
      if (changed === 'unknown') f.receipt().state = 'abandoned_unknown';
      if (changed === 'hidden_requests') f.receipt().unforwardedRequests = 1;
      const proof =
        changed === 'forged_proof'
          ? { ...f.answer.terminalProof, terminalProofId: randomUUID() }
          : f.answer.terminalProof;
      await expect(
        f.adapter.acceptMcpProbe(proof, AbortSignal.timeout(1000)),
      ).rejects.toBeDefined();
      expect(f.acceptance.write).not.toHaveBeenCalled();
    },
  );
  it('degrades an accepted MCP transport on an uncertain generation without ACK or release', async () => {
    const f = await acceptedProbe();
    f.receipt().acknowledged = true;
    await f.adapter.acceptMcpProbe(
      f.answer.terminalProof,
      AbortSignal.timeout(1000),
    );
    const request = await f.request();
    f.runtime.execute.mockRejectedValueOnce(
      new CodexChatRuntimeError('codex_timeout', 'unknown'),
    );
    await expect(f.adapter.execute(request)).rejects.toMatchObject({
      code: 'codex_result_unknown',
      outcome: 'unknown',
    });
    expect((await f.adapter.observe(f.selection)).supportsMcp).toBe(false);
    expect(f.runtime.acknowledge).not.toHaveBeenCalled();
    expect(f.runtime.reconcile).not.toHaveBeenCalled();
  });
  it('explicit canary verifies one gateway callback and a nonce absent from the prompt', async () => {
    const f = fixture(),
      request = await f.request();
    request.tools = [
      {
        name: 'nodia_knowledge_index',
        description: 'Published read',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    ];
    const gateway = vi.fn(async () => ({ facts: [] }));
    request.onToolCall = gateway;
    f.runtime.execute.mockImplementationOnce(async (native, callbacks) => {
      await callbacks.onPrepared(native.identity);
      await callbacks.assertLease(native.signal);
      await callbacks.onProtocolProgress(1, native.signal);
      const result = (await callbacks.onToolCall(
        {
          callId: 'fixture-probe',
          name: request.tools![0].name,
          arguments: {},
        },
        native.signal,
      )) as { result: unknown; verification_nonce: string };
      expect(result.result).toEqual({ facts: [] });
      expect(native.prompt).not.toContain(result.verification_nonce);
      return {
        text: result.verification_nonce,
        terminalProof: {
          ...native.identity,
          processClosed: true,
          terminalProofId: randomUUID(),
          outcome: 'completed',
          observedAt: new Date(),
        },
      };
    });
    const answer = await f.adapter.probeMcp(request);
    expect(answer.kind).toBe('answer');
    expect(gateway).toHaveBeenCalledTimes(1);
    expect(f.runtime.execute).toHaveBeenCalledTimes(1);
    expect(f.runtime.acknowledge).not.toHaveBeenCalled();
  });
  it('a canary without a callback cannot certify even a completed native turn', async () => {
    const f = fixture(),
      request = await f.request();
    request.tools = [
      {
        name: 'nodia_knowledge_index',
        description: 'Published read',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    ];
    request.onToolCall = vi.fn();
    await expect(f.adapter.probeMcp(request)).rejects.toMatchObject({
      code: 'mcp_probe_unverified',
      outcome: 'unknown',
    });
    expect(request.onToolCall).not.toHaveBeenCalled();
    expect(f.runtime.execute).toHaveBeenCalledTimes(1);
  });
  it('canary requires exactly one explicit descriptor before any dispatch', async () => {
    const f = fixture(),
      request = await f.request();
    await expect(f.adapter.probeMcp(request)).rejects.toMatchObject({
      code: 'mcp_probe_invalid',
      outcome: 'not_dispatched',
    });
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
  it.each([
    'codex_runtime_unavailable',
    'codex_profile_busy',
    'codex_session_required',
    'codex_quota_exhausted',
    'codex_protocol_invalid',
  ])(
    'projects native observation failure %s as explicit unavailable, without HTTP500 or private transport details',
    async (code) => {
      const f = fixture(),
        connection = connectionFixture();
      connection.row.id = f.selection.connection_id;
      connection.row.provider_key = 'openai';
      connection.row.fields = f.row.fields;
      f.runtime.observe.mockRejectedValueOnce(codexError(code));
      const result = await new ObserveNodiaAiEligibilityUseCase(
        connection.connections,
        connection.authorize,
        f.adapter,
      ).execute(testIdentity, f.selection.connection_id, {
        mode: f.selection.mode,
        model_id: f.selection.model_id,
        effort_id: f.selection.effort_id,
      });
      expect(result).toMatchObject({
        available: false,
        supports_mcp: false,
        observed_at: null,
        routing_target: null,
        reason:
          code === 'codex_profile_busy'
            ? 'nodia_ai:runtime_busy'
            : 'nodia_ai:adapter_unavailable',
        selection: f.selection,
      });
      expect(JSON.stringify(result)).not.toContain('codex-profile');
      expect(JSON.stringify(result)).not.toContain('fixture_secret');
      expect(f.runtime.execute).not.toHaveBeenCalled();
    },
  );
  it('normalizes only the native busy exception without retrying, mutating readiness or consuming dispatch', async () => {
    const f = fixture();
    f.runtime.observe.mockRejectedValueOnce(
      codexError('codex_profile_busy', 409),
    );
    await expect(f.adapter.observe(f.selection)).rejects.toMatchObject({
      code: 'runtime_busy',
      outcome: 'not_dispatched',
    });
    expect(f.runtime.observe).toHaveBeenCalledTimes(1);
    expect(f.query).toHaveBeenCalledTimes(1);
    expect(f.runtime.execute).not.toHaveBeenCalled();
    expect(f.runtime.acknowledge).not.toHaveBeenCalled();
    expect(f.acceptance.read).not.toHaveBeenCalled();
    expect(f.acceptance.invalidate).not.toHaveBeenCalled();
    expect(f.acceptance.write).not.toHaveBeenCalled();
  });
  it.each(['unavailable', 'unknown_busy_shape'] as const)(
    'preserves %s failures instead of treating them as retryable busy',
    async (kind) => {
      const f = fixture();
      const failure =
        kind === 'unavailable'
          ? codexError('codex_runtime_unavailable')
          : Object.assign(new Error('private provider details'), {
              code: 'codex_profile_busy',
            });
      f.runtime.observe.mockRejectedValueOnce(failure);
      await expect(f.adapter.observe(f.selection)).rejects.toBe(failure);
      expect(f.runtime.observe).toHaveBeenCalledTimes(1);
      expect(f.runtime.execute).not.toHaveBeenCalled();
    },
  );
  it('recovers the same accepted transport after temporary profile contention without certifying or sending again', async () => {
    const f = await acceptedProbe();
    f.receipt().acknowledged = true;
    await f.adapter.acceptMcpProbe(
      f.answer.terminalProof,
      AbortSignal.timeout(1000),
    );
    const before = await f.adapter.observe(f.selection);
    const priorWrites = vi.mocked(f.acceptance.write).mock.calls.length;
    const priorInvalidations = vi.mocked(f.acceptance.invalidate).mock.calls.length;
    f.runtime.observe.mockRejectedValueOnce(
      codexError('codex_profile_busy', 409),
    );
    await expect(f.adapter.observe(f.selection)).rejects.toMatchObject({
      code: 'runtime_busy',
    });
    const after = await f.adapter.observe(f.selection);
    expect(before.supportsMcp).toBe(true);
    expect(after).toMatchObject({
      available: true,
      supportsMcp: true,
      resourceKey: before.resourceKey,
      configurationGeneration: before.configurationGeneration,
      sessionGeneration: before.sessionGeneration,
    });
    expect(f.acceptance.write).toHaveBeenCalledTimes(priorWrites);
    expect(f.acceptance.invalidate).toHaveBeenCalledTimes(priorInvalidations);
    expect(f.runtime.execute).toHaveBeenCalledTimes(1);
    expect(f.runtime.acknowledge).not.toHaveBeenCalled();
  });
  it('observes the exact model/effort and emits an explicit identity without claiming MCP or original formats', async () => {
    const f = fixture();
    const value = await f.adapter.observe(f.selection);
    expect(value).toMatchObject({
      available: true,
      adapterContractVersion: 'nodia-ai-codex-chat/1',
      source: 'codex_live_session_and_catalog',
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-codex-chat/1',
        connectionId: f.selection.connection_id,
      },
      supportsMcp: false,
      verifiedModalities: [],
      verifiedAttachmentMediaTypes: [],
      reason: null,
    });
    expect(f.runtime.observe.mock.calls[0][0]).toBe(f.selection.connection_id);
    expect(JSON.stringify(value)).not.toContain('fixture_secret');
  });
  it.each(['model', 'effort', 'session', 'quota'])(
    'keeps %s unavailable instead of inventing availability',
    async (changed) => {
      const f = fixture();
      if (changed === 'model') f.observed.models = [];
      if (changed === 'effort')
        f.observed.models[0].supportedReasoningEfforts = [];
      if (changed === 'session') f.observed.session.authenticated = false;
      if (changed === 'quota')
        Object.assign(f.observed.session, { usageAllowed: false });
      expect(await f.adapter.observe(f.selection)).toMatchObject({
        available: false,
        supportsMcp: false,
      });
      expect(f.runtime.execute).not.toHaveBeenCalled();
    },
  );
  it('requires an assigned dynamic model and Agentic mode before any SQL or native observation', async () => {
    const f = fixture();
    for (const changed of [
      { model_id: '' },
      { effort_id: '' },
      { connection_id: '04' },
      { mode: 'token_plan_web' as const },
    ])
      await expect(
        f.adapter.observe({ ...f.selection, ...changed }),
      ).rejects.toMatchObject({ outcome: 'not_dispatched' });
    expect(f.query).not.toHaveBeenCalled();
    expect(f.runtime.observe).not.toHaveBeenCalled();
  });
  it('revalidates configuration after native observation and rejects concurrent mutation', async () => {
    const f = fixture();
    f.runtime.observe.mockImplementationOnce(async () => {
      f.row.updated_at = '2026-10-22T01:00:00Z';
      return f.observed;
    });
    await expect(f.adapter.observe(f.selection)).rejects.toMatchObject({
      code: 'adapter_configuration_changed',
      outcome: 'not_dispatched',
    });
  });
  it('verification uses the transaction manager and locks the actual catalog pair without native I/O', async () => {
    const f = fixture(),
      observation = await f.adapter.observe(f.selection);
    f.runtime.observe.mockClear();
    f.query.mockClear();
    const query = vi.fn().mockResolvedValue([f.row]);
    await f.adapter.verifyConfiguration(
      f.selection,
      observation.configurationGeneration,
      {
        query,
        queryRunner: { isTransactionActive: true },
      } as unknown as EntityManager,
    );
    expect(query.mock.calls[0][0]).toContain('FOR SHARE OF p,c');
    expect(f.query).not.toHaveBeenCalled();
    expect(f.runtime.observe).not.toHaveBeenCalled();
  });
  it('measures the runtime native payload with explicit dynamic IDs and no fabricated model token context', async () => {
    const f = fixture();
    const value = await f.adapter.measureContext({
      selection: f.selection,
      canonicalPrompt: 'fixture ñ',
    });
    expect(value).toMatchObject({
      measurementKind: 'upper_bound',
      modelContextTokens: null,
      firstMcpListingUpperBoundUtf8Bytes: 0,
      canonicalUtf8Bytes: Buffer.byteLength('fixture ñ'),
      totalUtf8Bytes: Buffer.byteLength('fixture ñ') + 400,
    });
    expect(f.runtime.measure).toHaveBeenCalledWith({
      modelId: f.selection.model_id,
      effort: f.selection.effort_id,
      prompt: 'fixture ñ',
      tools: [],
    });
    expect(f.runtime.observe).not.toHaveBeenCalled();
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
  it('returns actual native-wrapper overflow to the orchestrator so it can compact without a generation', async () => {
    const f = fixture();
    const native = new CodexChatRuntime({} as CodexRuntimeService);
    f.runtime.measure.mockImplementation((payload) => native.measure(payload));
    const prompt = 'ñ'.repeat(131072);
    const value = await f.adapter.measureContext({
      selection: f.selection,
      canonicalPrompt: prompt,
    });
    expect(value.canonicalUtf8Bytes).toBe(262144);
    expect(value.totalUtf8Bytes).toBeGreaterThan(value.maxUtf8Bytes);
    expect(value.measurementKind).toBe('upper_bound');
    expect(value.modelContextTokens).toBeNull();
    expect(f.runtime.observe).not.toHaveBeenCalled();
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
  it('blocks all original attachments before measurement or execution until Codex format acceptance', async () => {
    const f = fixture();
    await expect(
      f.adapter.measureContext({
        selection: f.selection,
        canonicalPrompt: 'fixture',
        attachments: [{ kind: 'image', media_type: 'image/png' }],
      }),
    ).rejects.toMatchObject({
      code: 'adapter_attachments_unverified',
      outcome: 'not_dispatched',
    });
    const request = await f.request();
    request.attachments = [
      {
        kind: 'image',
        media_type: 'image/png',
        sha256: 'a'.repeat(64),
        content_base64: 'Zml4dHVyZQ==',
      },
    ];
    await expect(f.adapter.execute(request)).rejects.toMatchObject({
      code: 'adapter_attachments_unverified',
      outcome: 'not_dispatched',
    });
    expect(f.runtime.measure).not.toHaveBeenCalled();
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
  it('binds native dispatch and the durable progress/lease hooks to the already armed exact identity', async () => {
    const f = fixture();
    const request = await f.request();
    const reply = await f.adapter.execute(request);
    expect(reply).toMatchObject({
      kind: 'answer',
      text: 'fixture answer',
      terminalProof: {
        attemptId: request.attemptId,
        adapterIdentity: { connectionId: request.selection.connection_id },
      },
    });
    expect(request.onLeaseCheck).toHaveBeenCalledTimes(3);
    expect(request.onProtocolProgress).toHaveBeenCalledOnce();
    expect(f.runtime.execute.mock.calls[0][0]).toMatchObject({
      modelId: request.selection.model_id,
      effort: request.selection.effort_id,
      identity: {
        resourceKey: request.resourceKey,
        sessionGeneration: request.sessionGeneration,
        operationRef: request.attemptId,
      },
    });
  });
  it.each(['onLeaseCheck', 'onProtocolProgress'])(
    'does not enter the runtime without %s even in a text-only turn',
    async (hook) => {
      const f = fixture(),
        request = await f.request();
      delete request[hook as 'onLeaseCheck' | 'onProtocolProgress'];
      await expect(f.adapter.execute(request)).rejects.toMatchObject({
        code: 'mcp_callback_unconfigured',
        outcome: 'not_dispatched',
      });
      expect(f.runtime.execute).not.toHaveBeenCalled();
    },
  );
  it('rejects expired, cancelled and malformed identities before native dispatch', async () => {
    const f = fixture(),
      request = await f.request();
    await expect(
      f.adapter.execute({ ...request, deadlineAt: new Date(0) }),
    ).rejects.toMatchObject({ outcome: 'not_dispatched' });
    await expect(
      f.adapter.execute({
        ...request,
        resourceKey: 'gemini-profile:' + 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ outcome: 'not_dispatched' });
    await expect(
      f.adapter.execute(request, AbortSignal.abort()),
    ).rejects.toMatchObject({ outcome: 'not_dispatched' });
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
  it('rejects a changed configuration or lost lease without entering the native runtime', async () => {
    const f = fixture(),
      request = await f.request();
    f.row.is_active = false;
    await expect(f.adapter.execute(request)).rejects.toMatchObject({
      outcome: 'not_dispatched',
    });
    expect(f.runtime.execute).not.toHaveBeenCalled();
    f.row.is_active = true;
    request.onLeaseCheck = vi
      .fn()
      .mockRejectedValue(new Error('fixture lease lost'));
    await expect(f.adapter.execute(request)).rejects.toThrow(
      'fixture lease lost',
    );
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
  it('preserves unknown after an unclassified native error without replay or another mode', async () => {
    const f = fixture(),
      request = await f.request();
    f.runtime.execute.mockRejectedValueOnce(
      new Error('fixture private failure'),
    );
    await expect(f.adapter.execute(request)).rejects.toMatchObject({
      code: 'codex_result_unknown',
      outcome: 'unknown',
    });
    expect(f.runtime.execute).toHaveBeenCalledOnce();
  });
  it('preserves a runtime-certified predispatch rejection', async () => {
    const f = fixture(),
      request = await f.request();
    f.runtime.execute.mockRejectedValueOnce(
      new CodexChatRuntimeError('codex_profile_busy', 'not_dispatched'),
    );
    await expect(f.adapter.execute(request)).rejects.toMatchObject({
      code: 'codex_profile_busy',
      outcome: 'not_dispatched',
    });
    expect(f.runtime.execute).toHaveBeenCalledOnce();
  });
  it('does not accept a terminal proof from another connection', async () => {
    const f = fixture(),
      request = await f.request();
    const execute = f.runtime.execute.getMockImplementation()!;
    f.runtime.execute.mockImplementationOnce(async (...args) => {
      const reply = await execute(...args);
      return {
        ...reply,
        terminalProof: {
          ...reply.terminalProof,
          adapterIdentity: {
            ...reply.terminalProof.adapterIdentity!,
            connectionId: '4',
          },
        },
      };
    });
    await expect(f.adapter.execute(request)).rejects.toMatchObject({
      outcome: 'unknown',
    });
  });
  it('only forwards a frozen catalog tool to the existing gateway callback', async () => {
    const f = fixture(),
      request = await f.request();
    request.tools = [
      {
        name: 'fixture_read',
        description: 'Synthetic read only',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {},
        },
      },
    ];
    request.onToolCall = vi.fn().mockResolvedValue({ value: 'fixture' });
    const execute = f.runtime.execute.getMockImplementation()!;
    f.runtime.execute.mockImplementationOnce(async (native, callbacks) => {
      await callbacks.onToolCall(
        { callId: 'native-call-fixture', name: 'fixture_read', arguments: {} },
        native.signal,
      );
      await expect(
        callbacks.onToolCall(
          { callId: 'native-call-other', name: 'not_granted', arguments: {} },
          native.signal,
        ),
      ).rejects.toMatchObject({ outcome: 'unknown' });
      return execute(native, callbacks);
    });
    await f.adapter.execute(request);
    expect(request.onToolCall).toHaveBeenCalledOnce();
    expect(request.onToolCall).toHaveBeenCalledWith(
      { callId: 'native-call-fixture', name: 'fixture_read', arguments: {} },
      expect.any(AbortSignal),
    );
  });
  it('rejects a prepared identity from a different attempt before granting the native start gate', async () => {
    const f = fixture(),
      request = await f.request();
    f.runtime.execute.mockImplementationOnce(async (native, callbacks) => {
      await callbacks.onPrepared({
        ...native.identity,
        attemptId: randomUUID(),
      });
      throw Error('fixture start gate must not open');
    });
    await expect(f.adapter.execute(request)).rejects.toMatchObject({
      code: 'adapter_prepared_identity_invalid',
      outcome: 'not_dispatched',
    });
    expect(request.onProtocolProgress).not.toHaveBeenCalled();
  });
  it('does not trust an arbitrary thrown object claiming that a native turn was not dispatched', async () => {
    const f = fixture(),
      request = await f.request();
    f.runtime.execute.mockRejectedValueOnce({
      code: 'fixture_forged',
      outcome: 'not_dispatched',
    });
    await expect(f.adapter.execute(request)).rejects.toMatchObject({
      code: 'codex_result_unknown',
      outcome: 'unknown',
    });
  });
  it('recovers and ACKs using persisted identity after the original connection has been disabled', async () => {
    const f = fixture(),
      request = await f.request(),
      reply = await f.adapter.execute(request);
    f.row.is_active = false;
    f.query.mockClear();
    const reconcile = new ReconcileCodexNodiaAiRuntimeUseCase(
      f.runtime as unknown as CodexChatRuntime,
      { manager: { query: f.query } } as unknown as DataSource,
    );
    const proof = await reconcile.reconcile(
      reply.terminalProof,
      new AbortController().signal,
    );
    await reconcile.acknowledge(proof, new AbortController().signal);
    expect(proof.outcome).toBe('abandoned_unknown');
    expect(f.query).not.toHaveBeenCalled();
    expect(f.runtime.acknowledge).toHaveBeenCalledOnce();
  });
  it('rejects Gemini and invalid Codex proofs before native reconciliation or ACK', async () => {
    const f = fixture(),
      request = await f.request(),
      reply = await f.adapter.execute(request);
    const reconcile = new ReconcileCodexNodiaAiRuntimeUseCase(
      f.runtime as unknown as CodexChatRuntime,
      { manager: { query: f.query } } as unknown as DataSource,
    );
    await expect(
      reconcile.reconcile(
        {
          ...reply.terminalProof,
          adapterIdentity: undefined,
          resourceKey: 'gemini-profile:' + 'a'.repeat(64),
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    await expect(
      reconcile.acknowledge(
        {
          ...reply.terminalProof,
          processClosed: false,
        } as unknown as NodiaAiRuntimeTerminalProof,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(f.runtime.reconcile).not.toHaveBeenCalled();
    expect(f.runtime.acknowledge).not.toHaveBeenCalled();
  });
});
