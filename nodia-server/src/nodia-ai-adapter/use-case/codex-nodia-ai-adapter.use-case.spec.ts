import { CodexChatImageAcceptanceStore } from '../../common/ai/codex/codex-chat-image-acceptance.js';
import { CodexChatAudioAcceptanceStore } from '../../common/ai/codex/codex-chat-audio-acceptance.js';
import { CODEX_CHAT_AUDIO_MIMES } from '../../common/ai/codex/codex-chat-audio.js';
import { CODEX_CHAT_IMAGE_MIMES } from '../../common/ai/codex/codex-chat-images.js';
import { describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
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
    mode: 'agentic' as const,
    model_id: 'fixture-discovered-model',
    effort_id: 'new_effort',
  };
  const row = {
    id: selection.connection_id,
    provider_key: 'openai',
    is_active: true,
    catalog_active: true,
    use_agentic: true,
    can_use_agentic: true,
    updated_at: '2026-10-22T00:00:00Z',
    fields: {
      agentic: {
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
  const imageStores = new Map(
    CODEX_CHAT_IMAGE_MIMES.map((mime) => {
      const store = new CodexChatImageAcceptanceStore(mime);
      let proof: ReturnType<typeof store.decode> | null = null;
      vi.spyOn(store, 'read').mockImplementation(async () => proof);
      vi.spyOn(store, 'write').mockImplementation(async (value) => {
        proof = store.decode(value);
      });
      vi.spyOn(store, 'invalidate').mockImplementation(async () => {
        proof = null;
      });
      return [mime, store] as const;
    }),
  );
  const audioStores = new Map(CODEX_CHAT_AUDIO_MIMES.map((mime) => {
    const store = new CodexChatAudioAcceptanceStore(mime);
    let proof: ReturnType<typeof store.decode> | null = null;
    vi.spyOn(store, 'read').mockImplementation(async () => proof);
    vi.spyOn(store, 'write').mockImplementation(async (value) => { proof = store.decode(value); });
    vi.spyOn(store, 'invalidate').mockImplementation(async () => { proof = null; });
    return [mime, store] as const;
  }));
  const adapter = new CodexNodiaAiAdapterUseCase(
    { manager: { query } } as unknown as DataSource,
    runtime as unknown as CodexChatRuntime,
    new ValidateNodiaAiRuntimePolicyUseCase().execute(policyEnvelope()),
    acceptance,
    imageStores,
    audioStores,
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
    imageStores,
    audioStores,
  };
}

describe('Codex explicit image generation adapter lane', () => {
  const contentBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=';
  const generatedImage = () => ({ contentBase64, mediaType: 'image/png' as const,
    sha256: createHash('sha256').update(Buffer.from(contentBase64, 'base64')).digest('hex') });
  it('returns one verified image without requiring text/MCP or changing the selected model', async () => {
    const f = fixture(), request = await f.request();
    request.imageGeneration = { prompt: 'Generate a synthetic circle' };
    const original = f.runtime.execute.getMockImplementation()!;
    f.runtime.execute.mockImplementationOnce(async (...args) => ({ ...await original(...args), text: '',
      generatedImage: { ...generatedImage(), savedPath: '/private/not-public', revisedPrompt: 'not-public' } }));
    const reply = await f.adapter.execute(request);
    expect(reply).toMatchObject({ kind: 'answer', text: '', generatedImage: generatedImage() });
    if (reply.kind === 'answer') expect(reply.generatedImage).toEqual(generatedImage());
    expect(f.runtime.execute.mock.calls[0][0]).toMatchObject({ modelId: request.selection.model_id,
      effort: request.selection.effort_id, prompt: request.imageGeneration.prompt,
      imageGeneration: request.imageGeneration, tools: [] });
    expect(f.acceptance.write).not.toHaveBeenCalled();
  });
  it('rejects mixed tool authority before entering the runtime', async () => {
    const f = fixture(), request = await f.request();
    request.imageGeneration = { prompt: 'Synthetic image' };
    request.tools = [{ name: 'fixture_tool', description: 'Synthetic', inputSchema: { type: 'object', additionalProperties: false } }];
    await expect(f.adapter.execute(request)).rejects.toMatchObject({ outcome: 'not_dispatched' });
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
  it('missing image remains unknown without invalidating unrelated MCP/image qualifications', async () => {
    const f = fixture(), request = await f.request();
    request.imageGeneration = { prompt: 'Synthetic image' };
    await expect(f.adapter.execute(request)).rejects.toMatchObject({ outcome: 'unknown' });
    expect(f.acceptance.invalidate).not.toHaveBeenCalled();
    for (const store of f.imageStores.values()) expect(store.invalidate).not.toHaveBeenCalled();
  });
  it('rejects forged MIME/hash and unsolicited images in the ordinary lane', async () => {
    for (const optIn of [true, false]) {
      const f = fixture(), request = await f.request();
      if (optIn) request.imageGeneration = { prompt: 'Synthetic image' };
      const original = f.runtime.execute.getMockImplementation()!;
      f.runtime.execute.mockImplementationOnce(async (...args) => ({ ...await original(...args),
        generatedImage: { ...generatedImage(), sha256: '0'.repeat(64) } }));
      await expect(f.adapter.execute(request)).rejects.toMatchObject({ outcome: 'unknown' });
    }
  });
});

describe('Codex empty response after acknowledged technical selection', () => {
  const ids = ['nodia_finance_movements_list', 'nodia_products_list'];
  const ack = () => ({ status: 'selection_requested', selected_capability_ids: [...ids], next_action: 'finish_current_generation', business_effects: false });
  async function selectionFixture(result: unknown = ack(), options: {
    invoke?: boolean; name?: string; args?: unknown; replyText?: string;
    proof?: (proof: NodiaAiRuntimeTerminalProof) => NodiaAiRuntimeTerminalProof;
    mutateArguments?: (args: unknown) => void;
  } = {}) {
    const f = fixture(), request = await f.request();
    const name = options.name ?? 'nodia_capabilities_select';
    const args = options.args ?? { catalog_version: 'fixture-catalog', capability_ids: [...ids].reverse() };
    request.tools = [{ name, description: 'Published technical selection fixture', inputSchema: { type: 'object', additionalProperties: false, properties: {} } }];
    request.onToolCall = vi.fn(async (call) => { options.mutateArguments?.(call.arguments); return result; });
    const execute = f.runtime.execute.getMockImplementation()!;
    f.runtime.execute.mockImplementationOnce(async (native, callbacks) => {
      if (options.invoke !== false) await callbacks.onToolCall({ callId: 'fixture-real-selection-callback', name, arguments: args }, native.signal);
      const reply = await execute(native, callbacks);
      return { ...reply, text: options.replyText ?? '', terminalProof: options.proof?.(reply.terminalProof) ?? reply.terminalProof };
    });
    return { ...f, request };
  }
  it('accepts exactly empty text only after the real forwarded selection callback acknowledged the same unique capability set', async () => {
    const f = await selectionFixture();
    const reply = await f.adapter.execute(f.request);
    expect(reply).toMatchObject({ kind: 'answer', text: '', terminalProof: { processClosed: true, outcome: 'completed' } });
    expect(f.request.onToolCall).toHaveBeenCalledOnce(); expect(f.runtime.execute).toHaveBeenCalledOnce();
    expect(f.runtime.reconcile).not.toHaveBeenCalled(); expect(f.runtime.acknowledge).not.toHaveBeenCalled();
  });
  it.each([
    { label: 'no callback', options: { invoke: false } },
    { label: 'another granted tool', options: { name: 'fixture_read' } },
    { label: 'whitespace content', options: { replyText: ' \n ' } },
    { label: 'missing requested IDs', options: { args: { catalog_version: 'fixture-catalog' } } },
    { label: 'duplicate requested IDs', options: { args: { catalog_version: 'fixture-catalog', capability_ids: [ids[0], ids[0]] } } },
    { label: 'extra argument field', options: { args: { catalog_version: 'fixture-catalog', capability_ids: ids, execute: true } } },
  ])('rejects empty ordinary or unverified responses: $label', async ({ options }) => {
    const f = await selectionFixture(ack(), options);
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({ code: 'adapter_invalid_reply', outcome: 'unknown' });
    expect(f.runtime.execute).toHaveBeenCalledOnce();
  });
  it.each([
    { status: 'completed' }, { next_action: 'execute' }, { business_effects: true },
    { selected_capability_ids: [ids[0]] }, { selected_capability_ids: [...ids, 'nodia_users_list'] },
    { selected_capability_ids: [ids[0], ids[0]] }, { selected_capability_ids: [] },
    { selected_capability_ids: 'not-an-array' }, { extra: true },
  ])('rejects a malformed or mismatching selection ACK %j', async (change) => {
    const f = await selectionFixture({ ...ack(), ...change });
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({ code: 'adapter_invalid_reply', outcome: 'unknown' });
  });
  it('snapshots requested IDs before the gateway awaits and cannot authorize a mutated intent', async () => {
    const f = await selectionFixture({ ...ack(), selected_capability_ids: ['nodia_users_list'] }, {
      mutateArguments: args => { (args as { capability_ids: string[] }).capability_ids = ['nodia_users_list']; },
    });
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({ code: 'adapter_invalid_reply', outcome: 'unknown' });
  });
  it.each(['not_closed', 'abandoned_unknown', 'future_proof'] as const)('still requires exact completed closed native proof after a valid ACK: %s', async change => {
    const f = await selectionFixture(ack(), { proof: proof => ({ ...proof,
      ...(change === 'not_closed' ? { processClosed: false as never } :
        change === 'abandoned_unknown' ? { outcome: 'abandoned_unknown' as const } : { observedAt: new Date(Date.now() + 60000) }),
    }) });
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({ outcome: 'unknown' });
  });
});

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

function fixtureWav() {
  const bytes = Buffer.alloc(44 + 3200);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(3200, 40);
  return bytes;
}
async function imageProbe(kind: 'image' | 'audio' = 'image') {
  const f = fixture(),
    request = await f.request();
  const bytes = kind === 'audio' ? fixtureWav() : Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  );
  const { createHash } = await import('node:crypto');
  request.attachments = [
    {
      kind,
      media_type: kind === 'image' ? 'image/png' : 'audio/wav',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      content_base64: bytes.toString('base64'),
    },
  ];
  const expected = kind === 'image' ? 'SYNTHETICIMAGECODE123456' : 'El velero naranja visita la isla tranquila';
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
    expect(native.prompt).not.toContain(expected);
    expect(native.tools).toEqual([]);
    expect((kind === 'image' ? native.images : native.audio)?.[0].sha256).toBe(request.attachments![0].sha256);
    await callbacks.onPrepared(native.identity);
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
      rpcCount: 0,
      frames: 10,
      bytes: 300,
      unforwardedRequests: 0,
      cancelRequested: false,
      terminalProofId: randomUUID(),
      observedAt: new Date().toISOString(),
      acknowledged: false,
    };
    return { text: expected, terminalProof: f.runtime.journal.proof(record) };
  });
  const reply = kind === 'image' ? await f.adapter.probeImage(request, expected)
    : await f.adapter.probeAudio(request, expected);
  return { ...f, request, reply, receipt: () => record };
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
    const priorInvalidations = vi.mocked(f.acceptance.invalidate).mock.calls
      .length;
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
      { mode: 'api_key' as const },
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
  it('measures unresolved current-turn image references without inventing a MIME or granting original authority', async () => {
    const f = fixture(),
      native = new CodexChatRuntime({} as CodexRuntimeService);
    f.runtime.measure.mockImplementation((payload) => native.measure(payload));
    const result = await f.adapter.measureContext({
      selection: f.selection,
      canonicalPrompt: 'synthetic',
      attachments: [{ kind: 'image' }, { kind: 'image' }],
    });
    expect(result.maxUtf8Bytes).toBe(262144);
    expect(f.runtime.measure).toHaveBeenCalledWith(
      expect.objectContaining({ images: [{}, {}] }),
    );
    expect(f.runtime.observe).not.toHaveBeenCalled();
    expect(f.runtime.execute).not.toHaveBeenCalled();
    expect(f.imageStores.get('image/png')!.read).not.toHaveBeenCalled();
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

describe('Codex original WAV acceptance', () => {
  it('cannot erase another runtime fingerprint acceptance after an uncertain candidate turn', async () => {
    const f = await imageProbe('audio'); f.receipt().acknowledged = true;
    await f.adapter.acceptAudioProbe(f.reply.terminalProof, AbortSignal.timeout(1000));
    f.runtime.fingerprint.mockResolvedValue('e'.repeat(64));
    const request = { ...f.request, attachments: undefined };
    f.runtime.execute.mockRejectedValueOnce(new CodexChatRuntimeError('candidate_unknown', 'unknown'));
    await expect(f.adapter.execute(request)).rejects.toMatchObject({ outcome: 'unknown' });
    f.runtime.fingerprint.mockResolvedValue('f'.repeat(64));
    expect((await f.adapter.observe(f.selection)).verifiedAttachmentMediaTypes).toEqual(['audio/wav']);
    expect(f.runtime.execute).toHaveBeenCalledTimes(2);
  });
  it('requires semantic result and exact ACK before granting only WAV, independently of MCP', async () => {
    const f = await imageProbe('audio');
    expect((await f.adapter.observe(f.selection)).verifiedAttachmentMediaTypes).toEqual([]);
    await expect(f.adapter.acceptAudioProbe(f.reply.terminalProof, AbortSignal.timeout(1000)))
      .rejects.toMatchObject({ code: 'mcp_probe_unverified' });
    f.receipt().acknowledged = true;
    await expect(f.adapter.acceptImageProbe(f.reply.terminalProof, AbortSignal.timeout(1000)))
      .rejects.toMatchObject({ code: 'mcp_probe_unverified' });
    await expect(f.adapter.acceptMcpProbe(f.reply.terminalProof, AbortSignal.timeout(1000)))
      .rejects.toMatchObject({ code: 'mcp_probe_unverified' });
    await f.adapter.acceptAudioProbe(f.reply.terminalProof, AbortSignal.timeout(1000));
    expect(await f.adapter.observe(f.selection)).toMatchObject({
      verifiedAttachmentMediaTypes: ['audio/wav'], verifiedModalities: ['audio'], supportsMcp: false,
    });
    await f.adapter.measureContext({ selection: f.selection, canonicalPrompt: 'bounded recording',
      attachments: [{ kind: 'audio', media_type: 'audio/wav' }] });
    expect(f.runtime.measure).toHaveBeenLastCalledWith(expect.objectContaining({
      audio: [{ mediaType: 'audio/wav' }], mediaOrder: ['audio'],
    }));
    await f.adapter.execute(f.request);
    const native = f.runtime.execute.mock.lastCall![0];
    expect(native.audio?.[0].contentBase64).toBe(f.request.attachments![0].content_base64);
    expect(native.images).toBeUndefined();
    expect(native.audioLimits?.seconds).toBe(300);
    for (const mime of ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'application/pdf']) {
      await expect(f.adapter.execute({ ...f.request, attachments: [{ ...f.request.attachments![0], media_type: mime }] }))
        .rejects.toMatchObject({ code: 'adapter_attachments_unverified', outcome: 'not_dispatched' });
    }
  });
  it.each(['runtime', 'session', 'model', 'configuration'] as const)('does not inherit WAV after a %s change', async (change) => {
    const f = await imageProbe('audio'); f.receipt().acknowledged = true;
    await f.adapter.acceptAudioProbe(f.reply.terminalProof, AbortSignal.timeout(1000));
    if (change === 'runtime') f.runtime.fingerprint.mockResolvedValue('e'.repeat(64));
    if (change === 'session') f.observed.runtimeSessionId = 'c'.repeat(32);
    if (change === 'model') { f.selection.model_id += '-changed'; f.observed.models[0].id = f.selection.model_id; }
    if (change === 'configuration') f.row.updated_at = '2026-10-23T03:00:00Z';
    expect((await f.adapter.observe(f.selection)).verifiedAttachmentMediaTypes).toEqual([]);
    expect(f.runtime.execute).toHaveBeenCalledOnce();
  });
  it('keeps audio unverified on semantic mismatch and rejects expected words in the prompt before dispatch', async () => {
    const f = fixture(), request = await f.request();
    const bytes = fixtureWav(), { createHash } = await import('node:crypto');
    request.attachments = [{ kind: 'audio', media_type: 'audio/wav',
      sha256: createHash('sha256').update(bytes).digest('hex'), content_base64: bytes.toString('base64') }];
    await expect(f.adapter.probeAudio({ ...request, canonicalPrompt: 'El velero naranja visita la isla tranquila.' },
      'El velero naranja visita la isla tranquila')).rejects.toMatchObject({ code: 'audio_probe_invalid' });
    expect(f.runtime.execute).not.toHaveBeenCalled();
    await expect(f.adapter.probeAudio(request, 'El velero naranja visita la isla tranquila'))
      .rejects.toMatchObject({ code: 'audio_probe_unverified', outcome: 'unknown' });
    expect(f.runtime.execute).toHaveBeenCalledOnce();
    expect(f.audioStores.get('audio/wav')!.write).not.toHaveBeenCalled();
  });
  it('invalidates a WAV proof after an uncertain generation without replay', async () => {
    const f = await imageProbe('audio'); f.receipt().acknowledged = true;
    await f.adapter.acceptAudioProbe(f.reply.terminalProof, AbortSignal.timeout(1000));
    f.runtime.execute.mockRejectedValueOnce(new CodexChatRuntimeError('fixture_unknown', 'unknown'));
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({ outcome: 'unknown' });
    expect((await f.adapter.observe(f.selection)).verifiedAttachmentMediaTypes).toEqual([]);
    expect(f.runtime.execute).toHaveBeenCalledTimes(2);
  });
  it('measures an untyped audio reference without granting original-file authority', async () => {
    const f = fixture();
    await f.adapter.measureContext({ selection: f.selection, canonicalPrompt: 'budget', attachments: [{ kind: 'audio' }] });
    expect(f.runtime.measure).toHaveBeenLastCalledWith(expect.objectContaining({ audio: [{}], mediaOrder: ['audio'] }));
    await expect(f.adapter.measureContext({ selection: f.selection, canonicalPrompt: 'budget',
      attachments: [{ kind: 'audio', media_type: 'audio/wav' }] }))
      .rejects.toMatchObject({ code: 'adapter_attachments_unverified' });
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
});

describe('Codex original image acceptance', () => {
  it('enables only the proved MIME after exact completed receipt and ACK, separately from MCP', async () => {
    const f = await imageProbe();
    expect(
      (await f.adapter.observe(f.selection)).verifiedAttachmentMediaTypes,
    ).toEqual([]);
    await expect(
      f.adapter.acceptImageProbe(
        f.reply.terminalProof,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'mcp_probe_unverified' });
    f.receipt().acknowledged = true;
    await f.adapter.acceptImageProbe(
      f.reply.terminalProof,
      new AbortController().signal,
    );
    const observed = await f.adapter.observe(f.selection);
    expect(observed).toMatchObject({
      verifiedAttachmentMediaTypes: ['image/png'],
      verifiedModalities: ['image'],
      supportsMcp: false,
    });
    await f.adapter.measureContext({
      selection: f.selection,
      canonicalPrompt: 'synthetic',
      attachments: [{ kind: 'image', media_type: 'image/png' }],
    });
    expect(f.runtime.measure).toHaveBeenLastCalledWith(
      expect.objectContaining({ images: [{ mediaType: 'image/png' }] }),
    );
    await f.adapter.execute(f.request);
    await expect(
      f.adapter.execute({
        ...f.request,
        attachments: [
          { ...f.request.attachments![0], media_type: 'image/jpeg' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'adapter_attachments_unverified' });
    expect(f.imageStores.get('image/jpeg')!.write).not.toHaveBeenCalled();
  });
  it('rejects cross-purpose proofs, altered terminal identity and configuration after probing', async () => {
    const f = await imageProbe();
    f.receipt().acknowledged = true;
    await expect(
      f.adapter.acceptMcpProbe(
        f.reply.terminalProof,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'mcp_probe_unverified' });
    await expect(
      f.adapter.acceptImageProbe(
        { ...f.reply.terminalProof, terminalProofId: randomUUID() },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    f.row.updated_at = '2026-10-23T01:00:00Z';
    await expect(
      f.adapter.acceptImageProbe(
        f.reply.terminalProof,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(f.imageStores.get('image/png')!.write).not.toHaveBeenCalled();
  });
  it.each(['model', 'effort', 'session', 'runtime', 'configuration'] as const)(
    'does not inherit an image proof after changing %s',
    async (change) => {
      const f = await imageProbe();
      f.receipt().acknowledged = true;
      await f.adapter.acceptImageProbe(
        f.reply.terminalProof,
        new AbortController().signal,
      );
      if (change === 'model') {
        f.selection.model_id += '-new';
        f.observed.models[0].id = f.selection.model_id;
      }
      if (change === 'effort') {
        f.selection.effort_id = 'other_effort';
        f.observed.models[0].supportedReasoningEfforts.push('other_effort');
      }
      if (change === 'session') f.observed.runtimeSessionId = 'c'.repeat(32);
      if (change === 'runtime')
        f.runtime.fingerprint.mockResolvedValue('e'.repeat(64));
      if (change === 'configuration') f.row.updated_at = '2026-10-23T02:00:00Z';
      expect(
        (await f.adapter.observe(f.selection)).verifiedAttachmentMediaTypes,
      ).toEqual([]);
    },
  );
  it('invalidates accepted original formats after an uncertain native generation without replay', async () => {
    const f = await imageProbe();
    f.receipt().acknowledged = true;
    await f.adapter.acceptImageProbe(
      f.reply.terminalProof,
      new AbortController().signal,
    );
    f.runtime.execute.mockRejectedValueOnce(
      new CodexChatRuntimeError('codex_runtime_unavailable', 'unknown'),
    );
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({
      code: 'codex_result_unknown',
      outcome: 'unknown',
    });
    expect(
      (await f.adapter.observe(f.selection)).verifiedAttachmentMediaTypes,
    ).toEqual([]);
    expect(f.runtime.execute).toHaveBeenCalledTimes(2);
    expect(f.runtime.acknowledge).not.toHaveBeenCalled();
  });
  it('does not accept a completed turn whose answer fails the image-only semantic challenge', async () => {
    const f = fixture(),
      request = await f.request();
    const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    );
    const { createHash } = await import('node:crypto');
    request.attachments = [
      {
        kind: 'image',
        media_type: 'image/png',
        sha256: createHash('sha256').update(bytes).digest('hex'),
        content_base64: bytes.toString('base64'),
      },
    ];
    await expect(
      f.adapter.probeImage(request, 'SYNTHETICCODE1234'),
    ).rejects.toMatchObject({
      code: 'image_probe_unverified',
      outcome: 'unknown',
    });
    expect(f.runtime.execute).toHaveBeenCalledOnce();
    expect(f.imageStores.get('image/png')!.write).not.toHaveBeenCalled();
  });
  it('does not create a proof for incorrect semantics or PDF/audio or a code present in the prompt', async () => {
    const f = fixture(),
      request = await f.request();
    request.attachments = [
      {
        kind: 'image',
        media_type: 'image/png',
        sha256: 'a'.repeat(64),
        content_base64: 'AAAA',
      },
    ];
    for (const change of [
      { kind: 'pdf', media_type: 'application/pdf' },
      { kind: 'audio', media_type: 'audio/wav' },
    ] as const)
      await expect(
        f.adapter.probeImage(
          {
            ...request,
            attachments: [{ ...request.attachments[0], ...change }],
          },
          'SYNTHETICCODE1234',
        ),
      ).rejects.toMatchObject({ code: 'image_probe_invalid' });
    await expect(
      f.adapter.probeImage(
        { ...request, canonicalPrompt: 'SYNTHETICCODE1234' },
        'SYNTHETICCODE1234',
      ),
    ).rejects.toMatchObject({ code: 'image_probe_invalid' });
    expect(f.runtime.execute).not.toHaveBeenCalled();
  });
});
