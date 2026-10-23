import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { DataSource } from 'typeorm';
import { CodexNodiaAiAdapterUseCase } from '../../nodia-ai-adapter/use-case/codex-nodia-ai-adapter.use-case.js';
import { ReconcileCodexNodiaAiRuntimeUseCase } from '../../nodia-ai-adapter/use-case/reconcile-codex-nodia-ai-runtime.use-case.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import type { NodiaAiAdapterRequest } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import { CodexChatJournal } from '../../common/ai/codex/codex-chat-journal.js';
import { CodexChatAcceptanceStore } from '../../common/ai/codex/codex-chat-acceptance.js';
import {
  CodexChatAdmissionError,
  type CodexChatRequest,
  type CodexChatCallbacks,
  type CodexChatIdentity,
} from '../../common/ai/codex/codex-chat-contract.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type { CodexChatRecord } from '../../common/ai/codex/codex-chat-journal.js';
import type { CodexChatToolChannel } from '../../common/ai/codex/codex-chat-tool-channel.js';
import type { CodexProtocolProgress } from '../../common/ai/codex/codex-rpc.js';

vi.mock('../../common/ai/codex/codex-process-ownership.js', () => ({
  codexProcessIdentity: vi.fn(async () => ({
    pid: 222,
    group: 222,
    birth: '123',
    boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })),
  sameCodexProcess: vi.fn(async () => false),
  stopCodexGroup: vi.fn(async () => undefined),
}));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const id: CodexChatIdentity = {
  engine: 'agentic',
  attemptId: '11111111-1111-4111-8111-111111111111',
  operationRef: '11111111-1111-4111-8111-111111111111',
  resourceKey: `codex-profile:${'a'.repeat(64)}`,
  sessionGeneration: 'b'.repeat(32),
  adapterIdentity: {
    providerKey: 'openai',
    contractVersion: 'nodia-ai-codex-chat/1',
    connectionId: '4',
  },
};

function fixture(
  options: {
    tool?: boolean;
    rejectTool?: boolean;
    noAnswer?: boolean;
    mutate?: boolean;
    modelMissing?: boolean;
    busy?: boolean;
    stopFails?: boolean;
    notificationBurst?: number;
    threadId?: string;
  } = {},
) {
  let stored: CodexChatRecord | null = null;
  const records: CodexChatRecord[] = [];
  const journal = new CodexChatJournal();
  // Private storage/OS admission are isolated here; Linux integration verifies
  // the actual fsync/flock implementation. Schema and terminal proofs stay real.
  vi.spyOn(journal, 'identity').mockImplementation(async () => ({
    resourceKey: id.resourceKey,
    runtimeSessionId: id.sessionGeneration,
  }));
  vi.spyOn(journal, 'read').mockImplementation(async () =>
    stored ? journal.decode(clone(stored)) : null,
  );
  vi.spyOn(journal, 'locked').mockImplementation(async (_id, work) => work());
  vi.spyOn(journal, 'admission').mockImplementation(async (work) => work());
  vi.spyOn(journal, 'reserve').mockImplementation(async (value) => {
    journal.decode(value);
    if (stored) throw Error('duplicate');
    stored = clone(value);
    records.push(clone(value));
  });
  vi.spyOn(journal, 'write').mockImplementation(async (value) => {
    journal.decode(value);
    stored = clone(value);
    records.push(clone(value));
  });
  let observer: ((p: CodexProtocolProgress) => Promise<void>) | undefined;
  let channel: CodexChatToolChannel | undefined;
  let frames = 0,
    requests = 0,
    hidden = 0;
  const trace: string[] = [];
  const controller = new AbortController();
  const threadId = options.threadId ?? 'synthetic-thread';
  class Rpc extends EventEmitter {
    alive = true;
    observeProtocol(fn: (p: CodexProtocolProgress) => Promise<void>) {
      observer = fn;
      return async () => undefined;
    }
    openChatToolChannel(next: CodexChatToolChannel) {
      channel = next;
      return () => next.close();
    }
    async recordUnforwardedRequest() {
      hidden++;
      await progress();
    }
    request = vi.fn(async (method: string, _params: unknown) => {
      trace.push(method);
      await progress();
      if (method === 'thread/start') return { thread: { id: threadId } };
      if (method === 'turn/start') {
        if (options.mutate)
          request.identity.adapterIdentity.connectionId = '99';
        if (!options.noAnswer)
          setTimeout(() => {
            void (async () => {
              for (let n = 0; n < (options.notificationBurst ?? 0); n++) {
                await progress();
                rpc.emit('notification', 'item/agentMessage/delta', {
                  threadId,
                  turnId: 'synthetic-turn',
                  delta: 'synthetic',
                });
              }
              if (options.tool) {
                requests++;
                await progress();
                await channel!.handle(
                  'item/tool/call',
                  {
                    threadId,
                    turnId: 'synthetic-turn',
                    namespace: null,
                    callId: 'synthetic-call',
                    tool: options.rejectTool ? 'other_tool' : 'nodia_read',
                    arguments: { zero: 0 },
                  },
                  'native-request',
                );
              }
              await progress();
              rpc.emit('notification', 'item/completed', {
                threadId,
                turnId: 'synthetic-turn',
                item: {
                  id: 'synthetic-answer',
                  type: 'agentMessage',
                  text: 'Synthetic answer',
                  phase: 'final_answer',
                },
              });
              await progress();
              rpc.emit('notification', 'turn/completed', {
                threadId,
                turn: { id: 'synthetic-turn', status: 'completed' },
              });
            })().catch((error) => rpc.emit('closed', error));
          }, 0);
        return { turn: { id: 'synthetic-turn' } };
      }
      throw Error('Unexpected method');
    });
  }
  const rpc = new Rpc();
  async function progress() {
    frames++;
    await observer?.({
      frames,
      requests,
      bytes: frames * 10,
      unforwardedRequests: hidden,
      overflow: false,
    });
  }
  const release = vi.fn();
  const runtime = {
    acquire: vi.fn(async () => ({ profile: { rpc }, release })),
    acquireChat: vi.fn(
      async (
        _connection: string,
        _signal: AbortSignal,
        before: (identity: unknown, rpc: Rpc) => Promise<void>,
      ) => {
        if (options.busy)
          throw new CodexChatAdmissionError('codex_profile_busy');
        rpc.alive = true;
        await before(
          {
            pid: 333,
            group: 333,
            birth: '456',
            boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          },
          rpc,
        );
        return { profile: { rpc }, release };
      },
    ),
    observe: vi.fn(async () => ({
      available: true,
      authenticated: true,
      usageAllowed: true,
    })),
    listModels: vi.fn(async () =>
      options.modelMissing
        ? []
        : [{ id: 'synthetic-model', supportedReasoningEfforts: ['high'] }],
    ),
    stop: vi.fn(async () => {
      trace.push('native-closed');
      if (options.stopFails && stored !== null) throw Error('closure unknown');
      rpc.alive = false;
      channel?.close();
      rpc.emit('closed');
    }),
    recoverClosedChat: vi.fn(async () => undefined),
  } as unknown as CodexRuntimeService;
  const callbacks: Pick<
    CodexChatCallbacks,
    'assertLease' | 'onProtocolProgress' | 'onToolCall'
  > = {
    assertLease: vi.fn(async (signal) => {
      signal.throwIfAborted();
      trace.push('lease');
    }),
    onProtocolProgress: vi.fn(async (count, _signal, unforwarded) => {
      trace.push(`durable-progress:${count}:${unforwarded}`);
    }),
    onToolCall: vi.fn(async () => {
      trace.push('gateway');
      return { total: 0, unknown: null };
    }),
  };
  const request: CodexChatRequest = {
    identity: clone(id),
    modelId: 'synthetic-model',
    effort: 'high',
    prompt: 'Synthetic request only',
    tools: [
      {
        name: 'nodia_read',
        description: 'Synthetic read',
        inputSchema: { type: 'object', additionalProperties: false },
      },
    ],
    deadlineAt: new Date(Date.now() + 10000),
    signal: controller.signal,
    limits: {
      requests: 128,
      toolCalls: 12,
      argumentUtf8Bytes: 65536,
      resultUtf8Bytes: 65536,
      jsonDepth: 16,
      collectionItems: 128,
    },
  };
  const facade = new CodexChatRuntime(runtime, journal);
  const selection = {
    connection_id: '4',
    mode: 'token_plan_agentic' as const,
    model_id: request.modelId,
    effort_id: request.effort!,
  };
  const row = {
    id: '4',
    provider_key: 'openai',
    is_active: true,
    catalog_active: true,
    use_token_plan_agentic: true,
    can_use_token_plan_agentic: true,
    updated_at: '2026-10-22T00:00:00.000Z',
    fields: {
      token_plan_agentic: {
        selected_model: selection.model_id,
        thinking_level: selection.effort_id,
      },
    },
  };
  const source = {
    manager: { query: vi.fn(async () => [row]) },
  } as unknown as DataSource;
  const acceptance = new CodexChatAcceptanceStore();
  vi.spyOn(acceptance, 'read').mockResolvedValue(null);
  const adapter = new CodexNodiaAiAdapterUseCase(
    source,
    facade,
    new ValidateNodiaAiRuntimePolicyUseCase().execute(policyEnvelope()),
    acceptance,
  );
  const reconciler = new ReconcileCodexNodiaAiRuntimeUseCase(facade, source);
  // Test helpers adapt fixture inputs only. Every operation enters the actual
  // production adapter/reconciliation use case; no domain decision is stubbed.
  const useCase = {
    measure: (payload: typeof request) =>
      adapter.measureContext({
        selection,
        canonicalPrompt: payload.prompt,
        tools: payload.tools,
      }),
    observe: (_connectionId: string) => adapter.observe(selection),
    execute: async (payload: typeof request, control: typeof callbacks) => {
      const observed = await adapter.observe(selection);
      const command: NodiaAiAdapterRequest = {
        attemptId: payload.identity.attemptId,
        selection: {
          ...selection,
          connection_id: payload.identity.adapterIdentity.connectionId,
        },
        canonicalPrompt: payload.prompt,
        tools: payload.tools,
        deadlineAt: payload.deadlineAt,
        resourceKey: payload.identity.resourceKey,
        sessionGeneration: payload.identity.sessionGeneration,
        configurationGeneration: observed.configurationGeneration,
        onLeaseCheck: control.assertLease,
        onProtocolProgress: control.onProtocolProgress,
        onToolCall: async (call, signal) =>
          (await control.onToolCall(call, signal)) as Record<string, never>,
      };
      const result = await adapter.execute(command, payload.signal);
      if (result.kind !== 'answer')
        throw Error('Unexpected synthetic delegation');
      return result;
    },
    reconcile: (identity: CodexChatIdentity, signal: AbortSignal) =>
      reconciler.reconcile(identity, signal),
    acknowledge: (
      proof: Awaited<
        ReturnType<ReconcileCodexNodiaAiRuntimeUseCase['reconcile']>
      >,
      signal: AbortSignal,
    ) => reconciler.acknowledge(proof, signal),
  };
  return {
    useCase,
    runtime,
    rpc,
    callbacks,
    request,
    controller,
    trace,
    records,
    journal,
    get stored() {
      return stored;
    },
  };
}

describe('Codex adapter and reconciliation use cases with the real chat runtime', () => {
  it('measures the same escaped native envelope and exposes overflow for compaction', async () => {
    const f = fixture();
    const measured = await f.useCase.measure({
      ...f.request,
      prompt: '"'.repeat(260000),
    });
    expect(measured.totalUtf8Bytes).toBeGreaterThan(measured.maxUtf8Bytes);
    expect(measured.canonicalUtf8Bytes).toBe(260000);
    expect(measured.overheadUtf8Bytes).toBeGreaterThan(260000);
    expect(measured.measurementKind).toBe('upper_bound');
  });
  it('returns an exact answer and only proves terminal after its own native group closes', async () => {
    const f = fixture();
    const result = await f.useCase.execute(f.request, f.callbacks);
    expect(result.text).toBe('Synthetic answer');
    expect(result.terminalProof).toMatchObject({
      ...id,
      outcome: 'completed',
      processClosed: true,
    });
    expect(
      f.rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
    expect(f.runtime.stop).toHaveBeenCalledWith('4');
    expect(f.stored?.state).toBe('completed');
    const serialized = JSON.stringify(f.records);
    expect(serialized).not.toContain('Synthetic request only');
    expect(serialized).not.toContain('Synthetic answer');
    expect(serialized).not.toContain('nodia_read');
  });
  it('uses the real private tool policy and awaits durable progress before gateway dispatch', async () => {
    const f = fixture({ tool: true });
    await f.useCase.execute(f.request, f.callbacks);
    expect(f.callbacks.onToolCall).toHaveBeenCalledTimes(1);
    expect(f.trace.indexOf('durable-progress:1:0')).toBeLessThan(
      f.trace.indexOf('gateway'),
    );
    expect(f.stored?.rpcCount).toBe(1);
    expect(f.stored?.unforwardedRequests).toBe(0);
  });
  it('charges invalid tool requests without forwarding them or resetting the RPC budget', async () => {
    const f = fixture({ tool: true, rejectTool: true });
    await f.useCase.execute(f.request, f.callbacks);
    expect(f.callbacks.onToolCall).not.toHaveBeenCalled();
    expect(f.callbacks.onProtocolProgress).toHaveBeenCalledWith(
      1,
      expect.any(AbortSignal),
      1,
    );
    expect(f.stored?.unforwardedRequests).toBe(1);
  });
  it('coalesces notification telemetry instead of fsync and SQL for every token delta', async () => {
    const f = fixture({ notificationBurst: 80 });
    await f.useCase.execute(f.request, f.callbacks);
    expect(f.callbacks.onProtocolProgress).toHaveBeenCalledTimes(1);
    expect(f.stored?.frames).toBeGreaterThanOrEqual(84);
    expect(f.stored?.rpcCount).toBe(0);
  });
  it('keeps the captured identity after the caller mutates its original object', async () => {
    const f = fixture({ mutate: true });
    const result = await f.useCase.execute(f.request, f.callbacks);
    expect(result.terminalProof.adapterIdentity?.connectionId).toBe('4');
    expect(f.runtime.stop).toHaveBeenCalledWith('4');
  });
  it('does not start a turn when the exact discovered model has disappeared', async () => {
    const f = fixture({ modelMissing: true });
    await expect(
      f.useCase.execute(f.request, f.callbacks),
    ).rejects.toMatchObject({
      code: 'codex_result_unknown',
      outcome: 'unknown',
    });
    expect(f.rpc.request).not.toHaveBeenCalled();
    expect(f.stored?.state).toBe('abandoned_unknown');
    expect(
      (await f.useCase.reconcile(id, new AbortController().signal))
        .processClosed,
    ).toBe(true);
  });
  it('closes a preflight busy attempt using the supervisor rollback certificate', async () => {
    const f = fixture({ busy: true });
    await expect(
      f.useCase.execute(f.request, f.callbacks),
    ).rejects.toMatchObject({
      code: 'codex_result_unknown',
      outcome: 'unknown',
    });
    expect(f.stored?.native).toBeNull();
    expect(f.stored?.state).toBe('abandoned_unknown');
    const proof = await f.useCase.reconcile(id, new AbortController().signal);
    await f.useCase.acknowledge(proof, new AbortController().signal);
    expect(f.stored?.acknowledged).toBe(true);
    // Only preparation's real adapter observation closed its idle transport;
    // the failed generation acquisition never stops a competing native owner.
    expect(f.runtime.stop).toHaveBeenCalledTimes(1);
  });
  it('preserves quarantine if native closure cannot be proved', async () => {
    const f = fixture({ stopFails: true });
    await expect(
      f.useCase.execute(f.request, f.callbacks),
    ).rejects.toMatchObject({ outcome: 'unknown' });
    expect(f.stored?.state).toBe('submitted');
    expect(f.stored?.terminalProofId).toBeNull();
  });
  it('cancels its own native owner promptly and never replays the turn', async () => {
    const f = fixture({ noAnswer: true });
    const execution = f.useCase.execute(f.request, f.callbacks);
    await vi.waitFor(() =>
      expect(f.rpc.request).toHaveBeenCalledWith(
        'turn/start',
        expect.any(Object),
        expect.any(Number),
      ),
    );
    f.controller.abort();
    await expect(execution).rejects.toMatchObject({ outcome: 'unknown' });
    expect(
      f.rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
    expect(f.stored?.state).toBe('abandoned_unknown');
  });
  it('rejects a mismatched session before reserve or native acquisition', async () => {
    const f = fixture();
    f.request.identity.sessionGeneration = 'c'.repeat(32);
    await expect(
      f.useCase.execute(f.request, f.callbacks),
    ).rejects.toMatchObject({ outcome: 'not_dispatched' });
    expect(f.journal.reserve).not.toHaveBeenCalled();
    expect(f.runtime.acquireChat).not.toHaveBeenCalled();
  });
  it('yields the profile after a non-generative observation', async () => {
    const f = fixture();
    const observed = await f.useCase.observe('4');
    expect(observed.supportsMcp).toBe(false);
    expect(observed.available).toBe(true);
    expect(observed.verifiedAttachmentMediaTypes).toEqual([]);
    expect(f.runtime.stop).toHaveBeenCalledWith('4');
  });
  it('bounds the actual native envelope even when the thread ID contains 128 escaped bytes', async () => {
    const f = fixture({ threadId: '\\'.repeat(128) }),
      measured = await f.useCase.measure(f.request);
    await f.useCase.execute(f.request, f.callbacks);
    const thread = f.rpc.request.mock.calls.find(
      ([method]) => method === 'thread/start',
    )![1];
    const turn = f.rpc.request.mock.calls.find(
      ([method]) => method === 'turn/start',
    )![1];
    expect(Buffer.byteLength(JSON.stringify({ thread, turn }))).toBe(
      measured.totalUtf8Bytes,
    );
  });
  it('does not silently acknowledge an absent receipt or a malformed proof', async () => {
    const f = fixture(),
      { terminalProof } = await f.useCase.execute(f.request, f.callbacks);
    vi.mocked(f.journal.read).mockResolvedValue(null);
    await expect(
      f.useCase.acknowledge(terminalProof, new AbortController().signal),
    ).rejects.toThrow('nodia_ai:reconciliation_cleanup_pending');
    vi.mocked(f.journal.read).mockClear();
    await expect(
      f.useCase.acknowledge(
        { ...terminalProof, observedAt: new Date(NaN) },
        new AbortController().signal,
      ),
    ).rejects.toThrow('nodia_ai:invalid_terminal_proof');
    expect(f.journal.read).not.toHaveBeenCalled();
  });
});
