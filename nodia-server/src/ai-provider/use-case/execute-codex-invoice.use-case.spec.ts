import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecuteCodexInvoiceUseCase } from './execute-codex-invoice.use-case.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { AiProvider } from '../entities/ai-provider.entity.js';

const png = {
  mimetype: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=',
    'base64',
  ),
} as Express.Multer.File;
const invoice = {
  code: 'SYNTHETIC',
  issue_date: null,
  total_amount: 0,
  items: [],
};
describe('Codex invoice extraction use case', () => {
  let runtime: CodexRuntimeService;
  let useCase: ExecuteCodexInvoiceUseCase;
  let provider: AiProvider;
  let rpc: EventEmitter & { request: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    provider = {
      id: '42',
      is_active: true,
      use_token_plan_agentic: true,
      catalog: {
        key: 'openai',
        is_active: true,
        can_use_token_plan_agentic: true,
      },
      fields: {
        api_key: { selected_model: 'API-UNCHANGED' },
        token_plan_agentic: {
          selected_model: 'synthetic-model',
          thinking_levels: { 'synthetic-model': 'new_effort' },
        },
      },
    } as AiProvider;
    runtime = new CodexRuntimeService();
    rpc = Object.assign(new EventEmitter(), {
      request: vi.fn(async (method: string) => {
        if (method === 'account/read')
          return { account: { type: 'chatgpt', planType: 'synthetic' } };
        if (method === 'account/rateLimits/read')
          return {
            rateLimits: {
              primary: {
                usedPercent: 0,
                windowDurationMins: null,
                resetsAt: null,
              },
            },
          };
        if (method === 'model/list')
          return {
            data: [
              {
                model: 'synthetic-model',
                inputModalities: ['text', 'image'],
                supportedReasoningEfforts: [{ reasoningEffort: 'new_effort' }],
              },
            ],
            nextCursor: null,
          };
        if (method === 'thread/start')
          return { thread: { id: 'synthetic-thread' } };
        if (method === 'turn/start') {
          rpc.emit('notification', 'item/completed', {
            threadId: 'synthetic-thread',
            item: {
              type: 'agentMessage',
              id: 'answer',
              phase: 'final_answer',
              text: JSON.stringify(invoice),
            },
          });
          rpc.emit('notification', 'turn/completed', {
            threadId: 'synthetic-thread',
            turn: { id: 'synthetic-turn', status: 'completed' },
          });
          return { turn: { id: 'synthetic-turn', status: 'inProgress' } };
        }
        return {};
      }),
    });
    const profile = {
      rpc,
      cwd: '/tmp',
      busy: false,
      lastUsed: Date.now(),
      lastInferenceAt: null,
    } as unknown as Awaited<ReturnType<CodexRuntimeService['get']>>;
    vi.spyOn(runtime, 'get').mockResolvedValue(profile);
    vi.spyOn(runtime, 'stop').mockResolvedValue();
    useCase = new ExecuteCodexInvoiceUseCase(
      {
        findProviderById: vi.fn(async () => provider),
      } as unknown as AiProviderService,
      runtime,
    );
  });
  afterEach(async () => {
    await runtime.onModuleDestroy();
  });
  it('discovers exact model/effort, creates an ephemeral context and accepts only a terminal validated invoice', async () => {
    const result = await useCase.execute('42', undefined, png);
    expect(result).toMatchObject({
      code: 'SYNTHETIC',
      total_amount: 0,
      items: [],
    });
    expect(rpc.request).toHaveBeenCalledWith(
      'thread/start',
      expect.objectContaining({
        model: 'synthetic-model',
        ephemeral: true,
        sandbox: 'read-only',
        approvalPolicy: 'never',
      }),
    );
    expect(rpc.request).toHaveBeenCalledWith(
      'turn/start',
      expect.objectContaining({
        effort: 'new_effort',
        model: 'synthetic-model',
        sandboxPolicy: expect.objectContaining({
          type: 'readOnly',
          networkAccess: false,
        }),
        outputSchema: expect.any(Object),
      }),
      15000,
    );
    expect(provider.fields.api_key.selected_model).toBe('API-UNCHANGED');
  });
  it('releases the ephemeral context after a completed extraction', async () => {
    await useCase.execute('42', undefined, png);
    expect(rpc.request).toHaveBeenCalledWith(
      'thread/unsubscribe',
      { threadId: 'synthetic-thread' },
      2000,
    );
  });
  it('rejects a truncated or excessive image before starting generation', async () => {
    const invalid = { ...png, buffer: Buffer.from('89504e470d0a1a0a', 'hex') };
    await expect(
      useCase.execute('42', undefined, invalid),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      rpc.request.mock.calls.some(([method]) => method === 'turn/start'),
    ).toBe(false);
  });
  it('honors an explicit exhausted quota without inferring it from percentages', async () => {
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation((method: string) =>
      method === 'account/rateLimits/read'
        ? Promise.resolve({ rateLimits: null, ordinaryUsageAllowed: false })
        : original(method),
    );
    await expect(useCase.execute('42', undefined, png)).rejects.toMatchObject({
      status: 429,
    });
    expect(
      rpc.request.mock.calls.some(([method]) => method === 'turn/start'),
    ).toBe(false);
  });
  it('enforces the total deadline without replaying the document', async () => {
    vi.stubEnv('NODIA_CODEX_INVOICE_TIMEOUT_MS', '1000');
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation((method: string) =>
      method === 'turn/start'
        ? Promise.resolve({ turn: { id: 'synthetic-turn' } })
        : original(method),
    );
    try {
      await expect(useCase.execute('42', undefined, png)).rejects.toMatchObject(
        { status: 504 },
      );
      expect(
        rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
      ).toHaveLength(1);
      expect(runtime.stop).toHaveBeenCalledWith('42');
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('clears an individual Codex effort without inheriting the general preference', async () => {
    provider.fields.token_plan_agentic.thinking_level = 'unavailable';
    provider.fields.token_plan_agentic.thinking_levels = {
      'synthetic-model': null,
    };
    await useCase.execute('42', undefined, png);
    const call = rpc.request.mock.calls.find(
      ([method]) => method === 'turn/start',
    );
    expect(call?.[1]).not.toHaveProperty('effort');
  });
  it('never assigns a model from another mode or the first discovered model', async () => {
    provider.fields.token_plan_agentic = {};
    await expect(useCase.execute('42', undefined, png)).rejects.toMatchObject({
      status: 400,
    });
    expect(rpc.request).not.toHaveBeenCalled();
  });
  it.each(['removed-model', 'API-UNCHANGED'])(
    'rejects selected model %s before inference without changing selection',
    async (model) => {
      await expect(useCase.execute('42', model, png)).rejects.toMatchObject({
        status: 400,
      });
      expect(
        rpc.request.mock.calls.some(([method]) => method === 'turn/start'),
      ).toBe(false);
    },
  );
  it('rejects historical incompatible effort and unknown image support without guessing by name', async () => {
    await expect(
      useCase.execute('42', undefined, png, undefined, 19, 'high'),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      rpc.request.mock.calls.some(([method]) => method === 'turn/start'),
    ).toBe(false);
  });
  it('preserves real zero usage and unknown duration/reset in session observations', async () => {
    const session = await runtime.observe('42');
    expect(session.quotas?.[0].primary).toEqual({
      usedPercent: 0,
      windowDurationMins: null,
      resetsAt: null,
    });
    expect(session.lastInferenceAt).toBeNull();
  });
  it('requires ChatGPT authentication instead of an API account', async () => {
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation((method: string) =>
      method === 'account/read'
        ? Promise.resolve({ account: { type: 'apiKey' } })
        : original(method),
    );
    await expect(useCase.execute('42', undefined, png)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      rpc.request.mock.calls.some(([method]) => method === 'turn/start'),
    ).toBe(false);
  });
  it.each(['failed', 'interrupted'])(
    'rejects terminal %s and never replays generation',
    async (status) => {
      const original = rpc.request.getMockImplementation()!;
      rpc.request.mockImplementation((method: string) => {
        if (method !== 'turn/start') return original(method);
        rpc.emit('notification', 'turn/completed', {
          threadId: 'synthetic-thread',
          turn: { id: 'synthetic-turn', status },
        });
        return Promise.resolve({ turn: { id: 'synthetic-turn' } });
      });
      await expect(useCase.execute('42', undefined, png)).rejects.toMatchObject(
        { status: 502 },
      );
      expect(
        rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
      ).toHaveLength(1);
      expect(runtime.stop).toHaveBeenCalledWith('42');
    },
  );
  it('interrupts and closes an uncertain extraction on caller disconnect', async () => {
    const cancellation = new AbortController();
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation((method: string) => {
      if (method !== 'turn/start') return original(method);
      setTimeout(() => cancellation.abort(), 0);
      return Promise.resolve({ turn: { id: 'synthetic-turn' } });
    });
    await expect(
      useCase.execute(
        '42',
        undefined,
        png,
        undefined,
        19,
        undefined,
        cancellation.signal,
      ),
    ).rejects.toMatchObject({ status: 499 });
    expect(
      rpc.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
    expect(runtime.stop).toHaveBeenCalledWith('42');
  });
  it('rejects JSON that omits required invoice data', async () => {
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation((method: string) => {
      if (method !== 'turn/start') return original(method);
      rpc.emit('notification', 'item/completed', {
        threadId: 'synthetic-thread',
        item: { type: 'agentMessage', id: 'answer', text: '{}' },
      });
      rpc.emit('notification', 'turn/completed', {
        threadId: 'synthetic-thread',
        turn: { id: 'synthetic-turn', status: 'completed' },
      });
      return Promise.resolve({ turn: { id: 'synthetic-turn' } });
    });
    await expect(useCase.execute('42', undefined, png)).rejects.toMatchObject({
      status: 502,
    });
  });
  it('blocks tool use even if the runtime requests it', async () => {
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation((method: string) => {
      if (method !== 'turn/start') return original(method);
      rpc.emit('toolRejected');
      return Promise.resolve({ turn: { id: 'synthetic-turn' } });
    });
    await expect(useCase.execute('42', undefined, png)).rejects.toMatchObject({
      status: 502,
    });
    expect(runtime.stop).toHaveBeenCalledWith('42');
  });
  it('does not consider turn/start acceptance a successful extraction', async () => {
    const cancellation = new AbortController();
    const original = rpc.request.getMockImplementation()!;
    rpc.request.mockImplementation((method: string) =>
      method === 'turn/start'
        ? Promise.resolve({ turn: { id: 'synthetic-turn' } })
        : original(method),
    );
    const extraction = useCase.execute(
      '42',
      undefined,
      png,
      undefined,
      19,
      undefined,
      cancellation.signal,
    );
    await vi.waitFor(() =>
      expect(
        rpc.request.mock.calls.some(([method]) => method === 'turn/start'),
      ).toBe(true),
    );
    let settled = false;
    void extraction
      .then(() => {
        settled = true;
      })
      .catch(() => undefined);
    await Promise.resolve();
    expect(settled).toBe(false);
    cancellation.abort();
    await expect(extraction).rejects.toMatchObject({ status: 499 });
  });
});
