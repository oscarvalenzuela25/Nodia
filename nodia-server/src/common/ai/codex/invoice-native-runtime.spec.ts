import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecuteCodexInvoiceUseCase } from '../../../ai-provider/use-case/execute-codex-invoice.use-case.js';
import type { AiProviderService } from '../../../ai-provider/ai-provider.service.js';
import {
  CodexChatJournal,
  type CodexChatRecord,
} from './codex-chat-journal.js';
import { CodexRuntimeService } from './codex-runtime.service.js';
import { CodexChatRuntime } from './codex-chat-runtime.js';
import {
  CodexChatAdmissionError,
  type CodexChatIdentity,
} from './codex-chat-contract.js';
import { codexError } from './codex-contract.js';
import type { CodexNativeInvoiceRequest } from './invoice-native-runtime.js';
import { invoicePrompt } from '../api-invoice-contract.js';

vi.mock('./codex-process-ownership.js', () => ({
  codexProcessIdentity: vi.fn(async () => ({
    pid: 222,
    group: 222,
    birth: '123',
    boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })),
}));

const clone = <T>(value: T): T => structuredClone(value);
const identity: CodexChatIdentity = {
  engine: 'agentic',
  attemptId: '11111111-1111-4111-8111-111111111111',
  operationRef: '11111111-1111-4111-8111-111111111111',
  resourceKey: `codex-profile:${'a'.repeat(64)}`,
  sessionGeneration: 'b'.repeat(32),
  adapterIdentity: {
    providerKey: 'openai',
    connectionId: '42',
    contractVersion: 'nodia-ai-codex-chat/1',
  },
};
const invoice = {
  code: null,
  issue_date: null,
  total_amount: 0,
  items: [
    {
      code: null,
      name: 'Synthetic item',
      quantity: 0,
      cost_price: null,
      cost_price_tax: null,
      unit_price: null,
      total_price: null,
      packages: null,
      units_per_package: null,
    },
  ],
};
const file = {
  mimetype: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=',
    'base64',
  ),
} as Express.Multer.File;

describe('durable Codex Products invoice core', () => {
  let stored: CodexChatRecord | null;
  let records: CodexChatRecord[];
  let runtime: CodexRuntimeService;
  let useCase: ExecuteCodexInvoiceUseCase;
  let input: CodexNativeInvoiceRequest;
  let release: ReturnType<typeof vi.fn<() => void>>;
  let rpc: EventEmitter & {
    request: ReturnType<
      typeof vi.fn<
        (method: string, ...args: unknown[]) => Promise<Record<string, unknown>>
      >
    >;
    observeProtocol: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    stored = null;
    records = [];
    vi.spyOn(CodexChatJournal.prototype, 'identity').mockResolvedValue({
      resourceKey: identity.resourceKey,
      runtimeSessionId: identity.sessionGeneration,
    });
    vi.spyOn(CodexChatJournal.prototype, 'read').mockImplementation(async () =>
      stored ? clone(stored) : null,
    );
    vi.spyOn(CodexChatJournal.prototype, 'locked').mockImplementation(
      async (_id, work) => work(),
    );
    vi.spyOn(CodexChatJournal.prototype, 'admission').mockImplementation(
      async (work) => work(),
    );
    vi.spyOn(CodexChatJournal.prototype, 'reserve').mockImplementation(
      async function (this: CodexChatJournal, value) {
        this.decode(value);
        if (stored) throw codexError('codex_request_conflict', 409);
        stored = clone(value);
        records.push(clone(value));
      },
    );
    vi.spyOn(CodexChatJournal.prototype, 'write').mockImplementation(
      async function (this: CodexChatJournal, value) {
        this.decode(value);
        stored = clone(value);
        records.push(clone(value));
      },
    );
    runtime = new CodexRuntimeService();
    rpc = Object.assign(new EventEmitter(), {
      observeProtocol: vi.fn(() => async () => undefined),
      request: vi.fn(async (method: string) => {
        if (method === 'thread/start') return { thread: { id: 'thread' } };
        if (method === 'turn/start') {
          expect(stored?.state).toBe('submitted');
          expect(stored?.native).not.toBeNull();
          rpc.emit('notification', 'item/completed', {
            threadId: 'thread',
            item: {
              type: 'agentMessage',
              id: 'answer',
              phase: 'final_answer',
              text: JSON.stringify(invoice),
            },
          });
          rpc.emit('notification', 'turn/completed', {
            threadId: 'thread',
            turn: { id: 'turn', status: 'completed' },
          });
          return { turn: { id: 'turn' } };
        }
        return {};
      }),
    });
    release = vi.fn(() => {
      expect(['completed', 'abandoned_unknown']).toContain(stored?.state);
    });
    vi.spyOn(runtime, 'acquire').mockRejectedValue(
      new Error('Nested legacy acquisition'),
    );
    vi.spyOn(runtime, 'acquireChat').mockImplementation(
      async (_id, _signal, beforeNativeStart) => {
        expect(stored?.state).toBe('reserved');
        await beforeNativeStart(
          {
            pid: 333,
            group: 333,
            birth: '456',
            boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          },
          rpc as never,
        );
        expect(stored?.state).toBe('prepared'); // Durable certificate before the real child gate releases.
        return {
          profile: {
            rpc,
            cwd: '/synthetic-private',
            lastInferenceAt: null,
          } as never,
          release,
        };
      },
    );
    vi.spyOn(runtime, 'observe').mockResolvedValue({
      available: true,
      authenticated: true,
      usageAllowed: null,
    } as never);
    vi.spyOn(runtime, 'listModels').mockResolvedValue([
      {
        id: 'fixture-model',
        inputModalities: ['image'],
        supportedReasoningEfforts: ['configured-effort'],
      },
    ] as never);
    vi.spyOn(runtime, 'stop').mockResolvedValue();
    useCase = new ExecuteCodexInvoiceUseCase(
      {
        findProviderById: vi.fn(async () => ({
          is_active: true,
          use_agentic: true,
          catalog: {
            key: 'openai',
            is_active: true,
            can_use_agentic: true,
          },
          fields: {
            agentic: {
              selected_model: 'OTHER-CONFIGURED-MODEL',
              thinking_level: 'configured-effort',
            },
          },
        })),
      } as unknown as AiProviderService,
      runtime,
    );
    input = {
      identity: clone(identity),
      modelId: 'fixture-model',
      effortId: null,
      configurationGeneration: 'c'.repeat(64),
      file,
      fields: { code: 'PRIVATE supplier mapping' },
      tax: null,
      deadlineAt: new Date(Date.now() + 10000),
      signal: new AbortController().signal,
      assertLease: vi.fn(async () => undefined),
    };
  });
  afterEach(async () => {
    await runtime.onModuleDestroy();
    vi.restoreAllMocks();
  });
  it('reuses Products conversion/parser with exact null effort and a real chat/1 proof after closure', async () => {
    const result = await useCase.executeNative(input);
    expect(result.extraction.total_amount).toBe(0);
    expect(result.extraction.items[0].quantity).toBe(0);
    expect(result.extraction.items[0].cost_price).toBeNull();
    expect(result.terminalProof).toMatchObject({
      ...identity,
      processClosed: true,
      outcome: 'completed',
    });
    expect(runtime.acquire).not.toHaveBeenCalled();
    expect(runtime.acquireChat).toHaveBeenCalledOnce();
    expect(runtime.stop).toHaveBeenCalledWith('42');
    expect(release).toHaveBeenCalledOnce();
    const turn = rpc.request.mock.calls.find(
      ([method]) => method === 'turn/start',
    )!;
    expect(turn[1]).not.toHaveProperty('effort');
    expect((turn[1] as { input: { text: string }[] }).input[0].text).toContain(
      'Supplier tax: null.',
    );
    expect(records.map((v) => v.state)).toEqual([
      'reserved',
      'prepared',
      'submitted',
      'completed',
    ]);
    expect(JSON.stringify(records)).not.toContain('PRIVATE');
    expect(JSON.stringify(records)).not.toContain(
      file.buffer.toString('base64'),
    );
    expect(JSON.stringify(result).length).toBeLessThan(64 * 1024);
    const proof = new CodexChatJournal().proof(stored!);
    expect(proof).toEqual(result.terminalProof);
    const recovery = new CodexChatRuntime(runtime, new CodexChatJournal());
    expect(await recovery.reconcile(identity, input.signal)).toEqual(proof);
    await recovery.acknowledge(proof, input.signal);
    expect(stored?.acknowledged).toBe(true);
  });
  it('does not claim closure or release before process shutdown resolves', async () => {
    let allowStop!: () => void;
    vi.mocked(runtime.stop).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          allowStop = resolve;
        }),
    );
    const work = useCase.executeNative(input);
    await vi.waitFor(() => expect(runtime.stop).toHaveBeenCalled());
    expect(stored?.terminalProofId).toBeNull();
    expect(release).not.toHaveBeenCalled();
    allowStop();
    expect((await work).terminalProof.processClosed).toBe(true);
  });
  it('preserves the pending journal if actual process closure fails', async () => {
    release.mockImplementation(() => undefined);
    vi.mocked(runtime.stop).mockRejectedValue(
      codexError('codex_login_unknown', 409),
    );
    await expect(useCase.executeNative(input)).rejects.toMatchObject({
      outcome: 'unknown',
    });
    expect(stored?.state).toBe('submitted');
    expect(stored?.terminalProofId).toBeNull();
    expect(
      rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
  });
  it('preflight rejection closes the accepted receipt without generating', async () => {
    vi.mocked(runtime.listModels).mockResolvedValue([]);
    await expect(useCase.executeNative(input)).rejects.toMatchObject({
      outcome: 'unknown',
    });
    expect(stored?.state).toBe('abandoned_unknown');
    expect(stored?.terminalProofId).not.toBeNull();
    expect(
      rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(0);
  });
  it('busy admission never closes another owner and uses the supervisor rollback certificate', async () => {
    vi.mocked(runtime.acquireChat).mockRejectedValue(
      new CodexChatAdmissionError('codex_profile_busy'),
    );
    await expect(useCase.executeNative(input)).rejects.toMatchObject({
      outcome: 'unknown',
    });
    expect(stored?.state).toBe('abandoned_unknown');
    expect(runtime.stop).not.toHaveBeenCalled();
  });
  it('lost turn/start result creates one unknown receipt and never resends', async () => {
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation(async (method: string) => {
      if (method === 'turn/start') throw new Error('PRIVATE response');
      return original(method);
    });
    await expect(useCase.executeNative(input)).rejects.toMatchObject({
      outcome: 'unknown',
    });
    expect(stored?.state).toBe('abandoned_unknown');
    expect(
      rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
    await expect(useCase.executeNative(input)).rejects.toBeDefined();
    expect(runtime.acquireChat).toHaveBeenCalledOnce();
  });
  it('rejects oversized extraction before committing completed', async () => {
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation(async (method: string) => {
      if (method !== 'turn/start') return original(method);
      rpc.emit('notification', 'item/completed', {
        threadId: 'thread',
        item: {
          type: 'agentMessage',
          id: 'answer',
          text: JSON.stringify({
            ...invoice,
            items: Array.from({ length: 1000 }, () => invoice.items[0]),
          }),
        },
      });
      rpc.emit('notification', 'turn/completed', {
        threadId: 'thread',
        turn: { id: 'turn', status: 'completed' },
      });
      return { turn: { id: 'turn' } };
    });
    await expect(useCase.executeNative(input)).rejects.toMatchObject({
      outcome: 'unknown',
    });
    expect(stored?.state).toBe('abandoned_unknown');
    expect(records.some((v) => v.state === 'completed')).toBe(false);
  });
  it('keeps tax zero and unknown distinct in the common Products prompt', () => {
    expect(invoicePrompt(undefined, 0)).toContain('Supplier tax: 0.');
    expect(invoicePrompt(undefined, null)).toContain('Supplier tax: null.');
    expect(invoicePrompt(undefined, 19)).toContain('Supplier tax: 19.');
  });
  it('pins the exact document and selection before asynchronous journal work', async () => {
    const mutable = {
      ...input,
      identity: clone(identity),
      file: { ...file, buffer: Buffer.from(file.buffer) },
      fields: { code: 'PRIVATE original mapping' },
    };
    vi.mocked(CodexChatJournal.prototype.identity)
      .mockImplementationOnce(async () => {
        mutable.modelId = 'changed-after-admission';
        mutable.fields.code = 'changed-after-admission';
        mutable.file.buffer.fill(0);
        mutable.identity.sessionGeneration = 'd'.repeat(32);
        return {
          resourceKey: identity.resourceKey,
          runtimeSessionId: identity.sessionGeneration,
        };
      })
      .mockResolvedValue({
        resourceKey: identity.resourceKey,
        runtimeSessionId: identity.sessionGeneration,
      });
    const reply = await useCase.executeNative(mutable);
    expect(reply.terminalProof.sessionGeneration).toBe(
      identity.sessionGeneration,
    );
    const turn = rpc.request.mock.calls.find(
      ([method]) => method === 'turn/start',
    )!;
    expect(turn[1]).toHaveProperty('model', 'fixture-model');
    expect(JSON.stringify(turn[1])).not.toContain('changed-after-admission');
    expect(JSON.stringify(turn[1])).toContain(file.buffer.toString('base64'));
  });
  it('cancellation after submission closes once and does not replay the OCR turn', async () => {
    const controller = new AbortController();
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation(async (method: string) =>
      method === 'turn/start' ? { turn: { id: 'turn' } } : original(method),
    );
    const work = useCase.executeNative({ ...input, signal: controller.signal });
    const rejection = expect(work).rejects.toMatchObject({
      outcome: 'unknown',
    });
    await vi.waitFor(() => expect(stored?.state).toBe('submitted'));
    controller.abort();
    await rejection;
    expect(stored?.state).toBe('abandoned_unknown');
    expect(stored?.terminalProofId).not.toBeNull();
    expect(
      rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
  });
  it('honors existing journal reconciliation cancellation while the owning core is active', async () => {
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation(async (method: string) =>
      method === 'turn/start' ? { turn: { id: 'turn' } } : original(method),
    );
    const work = useCase.executeNative(input);
    const rejection = expect(work).rejects.toMatchObject({
      outcome: 'unknown',
    });
    await vi.waitFor(() => expect(stored?.state).toBe('submitted'));
    stored!.cancelRequested = true;
    await rejection;
    expect(stored?.state).toBe('abandoned_unknown');
    expect(stored?.cancelRequested).toBe(true);
  });
  it('session replacement during core preflight prevents turn/start and closes the exact accepted identity', async () => {
    vi.mocked(CodexChatJournal.prototype.identity)
      .mockResolvedValueOnce({
        resourceKey: identity.resourceKey,
        runtimeSessionId: identity.sessionGeneration,
      })
      .mockResolvedValue({
        resourceKey: identity.resourceKey,
        runtimeSessionId: 'd'.repeat(32),
      });
    await expect(useCase.executeNative(input)).rejects.toMatchObject({
      outcome: 'unknown',
    });
    expect(stored?.identity.sessionGeneration).toBe(identity.sessionGeneration);
    expect(stored?.state).toBe('abandoned_unknown');
    expect(
      rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(0);
  });
  it('failed terminal fsync never becomes a terminal proof or a retry', async () => {
    release.mockImplementation(() => undefined);
    vi.mocked(CodexChatJournal.prototype.write).mockImplementation(
      async function (this: CodexChatJournal, value) {
        this.decode(value);
        if (value.terminalProofId) throw new Error('PRIVATE durable IO');
        stored = clone(value);
      },
    );
    await expect(useCase.executeNative(input)).rejects.toMatchObject({
      outcome: 'unknown',
    });
    expect(stored?.state).toBe('submitted');
    expect(stored?.terminalProofId).toBeNull();
    expect(() => new CodexChatJournal().proof(stored!)).toThrow();
    expect(
      rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
  });
  it('rejects excessive metadata and deadline before reserving or starting a native process', async () => {
    for (const changed of [
      { deadlineAt: new Date(Date.now() + 121000) },
      { fields: { code: 'x'.repeat(64 * 1024) } },
    ]) {
      await expect(
        useCase.executeNative({ ...input, ...changed }),
      ).rejects.toBeDefined();
      expect(stored).toBeNull();
      expect(runtime.acquireChat).not.toHaveBeenCalled();
    }
  });
  it('rejects a changed session before spawning or creating a journal', async () => {
    vi.mocked(CodexChatJournal.prototype.identity).mockResolvedValue({
      resourceKey: identity.resourceKey,
      runtimeSessionId: 'd'.repeat(32),
    });
    await expect(useCase.executeNative(input)).rejects.toBeDefined();
    expect(stored).toBeNull();
    expect(runtime.acquireChat).not.toHaveBeenCalled();
  });
});
