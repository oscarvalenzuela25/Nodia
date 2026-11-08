import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import { CodexChatJournal } from '../../common/ai/codex/codex-chat-journal.js';
import { ManageCodexSessionUseCase } from './manage-codex-session.use-case.js';
import { GetSelectableModelsUseCase } from './get-selectable-models.use-case.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import type { AiProviderService } from '../ai-provider.service.js';

const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const runtimes: CodexRuntimeService[] = [];
beforeEach(() => {
  Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
  vi.stubEnv('NODIA_CODEX_ENABLED', 'true');
});
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.onModuleDestroy();
  Object.defineProperty(process, 'platform', platform);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function fixture() {
  let generation = 'a'.repeat(32);
  vi.spyOn(CodexChatJournal.prototype, 'identity').mockImplementation(
    async () => ({
      resourceKey: `codex-profile:${'b'.repeat(64)}`,
      runtimeSessionId: generation,
    }),
  );
  const runtime = new CodexRuntimeService();
  runtimes.push(runtime);
  const rpc = {
    alive: true,
    request: vi.fn(async (method: string) => {
      if (method === 'account/read')
        return { account: { type: 'chatgpt', planType: 'synthetic' } };
      if (method === 'account/rateLimits/read')
        return { ordinaryUsageAllowed: true };
      if (method === 'model/list')
        return {
          data: [
            {
              model: 'synthetic-model',
              supportedReasoningEfforts: [{ reasoningEffort: 'high' }],
            },
          ],
          nextCursor: null,
        };
      if (method === 'account/logout') return {};
      throw Error('Unexpected native method');
    }),
  };
  const profile = {
    rpc,
    cwd: '/synthetic/work',
    busy: false,
    lastUsed: Date.now(),
    lastInferenceAt: null,
  } as unknown as Awaited<ReturnType<CodexRuntimeService['get']>>;
  const map = (
    runtime as unknown as { profiles: Map<string, Promise<typeof profile>> }
  ).profiles;
  map.set('4', Promise.resolve(profile));
  vi.spyOn(runtime, 'get').mockImplementation(async () => {
    map.set('4', Promise.resolve(profile));
    return profile;
  });
  const stop = vi.spyOn(runtime, 'stop').mockImplementation(async () => {
    map.delete('4');
  });
  const useCase = new ManageCodexSessionUseCase(
    {
      findProviderById: vi.fn(async () => ({
        id: '4',
        is_active: true,
        catalog: { key: 'openai', is_active: true },
      })),
    } as unknown as AiProviderService,
    runtime,
  );
  return {
    runtime,
    useCase,
    rpc,
    profile,
    map,
    stop,
    rotate: () => {
      generation = 'c'.repeat(32);
    },
  };
}
describe('Codex profile observation use cases', () => {
  it('yields the physical owner after a public session read while preserving actual health metadata', async () => {
    const f = fixture();
    const observed = await f.useCase.session('4');
    expect(observed.authenticated).toBe(true);
    expect(f.stop).toHaveBeenCalledWith('4');
    expect(f.map.size).toBe(0);
    const calls = f.rpc.request.mock.calls.length;
    const snapshot = await f.runtime.snapshot('4');
    expect(snapshot).toEqual(observed);
    expect(f.rpc.request).toHaveBeenCalledTimes(calls);
  });
  it('expires cached health after 30 seconds without starting a profile or reading the account', async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.useCase.session('4');
    const calls = f.rpc.request.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30001);
    expect(await f.runtime.snapshot('4')).toMatchObject({
      available: false,
      authenticated: null,
      checkedAt: null,
      reason: 'codex_runtime_unverified',
    });
    expect(f.rpc.request).toHaveBeenCalledTimes(calls);
    expect(f.runtime.get).toHaveBeenCalledTimes(1);
  });
  it('invalidates metadata when another process rotates the logical authentication generation', async () => {
    const f = fixture();
    await f.useCase.session('4');
    const calls = f.rpc.request.mock.calls.length;
    f.rotate();
    expect(await f.runtime.snapshot('4')).toMatchObject({
      available: false,
      authenticated: null,
      checkedAt: null,
    });
    expect(f.rpc.request).toHaveBeenCalledTimes(calls);
  });
  it('clears local metadata before a login/logout generation rotation', async () => {
    const f = fixture();
    await f.useCase.session('4');
    await f.useCase.logout('4');
    expect(await f.runtime.snapshot('4')).toMatchObject({
      available: false,
      authenticated: null,
    });
    expect(CodexChatJournal.prototype.identity).toHaveBeenCalledWith('4', true);
  });
  it('does not observe through or stop another local owner when public health competes with a lease', async () => {
    const f = fixture();
    const owner = await f.runtime.acquire('4');
    try {
      expect(await f.useCase.session('4')).toMatchObject({
        available: false,
        reason: 'codex_profile_busy',
      });
      expect(f.rpc.request).not.toHaveBeenCalled();
      expect(f.stop).not.toHaveBeenCalled();
      expect(f.profile.busy).toBe(true);
    } finally {
      owner.release();
    }
  });
  it('uses one owned catalog observation and yields its profile on completion', async () => {
    const f = fixture();
    const catalog = new GetSelectableModelsUseCase(
      {
        findAllProviders: vi.fn(async () => ({
          data: [
            {
              id: '4',
              is_active: true,
              use_agentic: true,
              default_mode: 'agentic',
              catalog: {
                key: 'openai',
                is_active: true,
                can_use_agentic: true,
              },
              fields: {
                agentic: { selected_model: 'synthetic-model' },
              },
            },
          ],
        })),
      } as unknown as AiProviderService,
      {} as GeminiService,
      undefined,
      f.runtime,
    );
    expect(
      await catalog.execute({ provider_id: '4', mode: 'agentic' }),
    ).toMatchObject([
      {
        providerId: '4',
        models_source: 'provider',
        models: [{ id: 'synthetic-model' }],
      },
    ]);
    expect(
      f.rpc.request.mock.calls.filter(([method]) => method === 'model/list'),
    ).toHaveLength(1);
    expect(f.stop).toHaveBeenCalledTimes(2);
    expect(f.map.size).toBe(0);
  });
});
