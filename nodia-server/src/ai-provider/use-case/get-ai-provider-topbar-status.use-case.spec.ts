import { describe, expect, it, vi } from 'vitest';
import type { CodexSession } from '../../common/ai/codex/codex-contract.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import { GeminiAgenticLogoutService } from '../../common/ai/gemini-agentic-logout.service.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { AiProviderService } from '../ai-provider.service.js';
import { GetAiProviderTopbarStatusUseCase } from './get-ai-provider-topbar-status.use-case.js';

const defaultProvider = {
  id: '9007199254740993',
  key: 'openai',
  name: 'Conexión de prueba',
  catalogName: 'OpenAI',
  isActive: true,
  use_api_key: true,
  use_agentic: true,
  hasApiKey: true,
};

const codexSession: CodexSession = {
  available: true,
  authenticated: true,
  usageAllowed: false,
  reason: null,
  planType: 'synthetic-plan',
  quotas: [
    { id: 'test', name: 'synthetic-quota', primary: null, secondary: null },
  ],
  checkedAt: '2026-11-17T12:00:00Z',
  lastInferenceAt: '2026-11-17T11:00:00Z',
};

function setup() {
  const findDefaultProviderStatus = vi
    .fn<AiProviderService['findDefaultProviderStatus']>()
    .mockResolvedValue(defaultProvider);
  const getDualEngineStatus = vi
    .fn<GeminiService['getDualEngineStatus']>()
    .mockResolvedValue(null);
  const observe = vi
    .fn<CodexRuntimeService['observe']>()
    .mockResolvedValue(codexSession);
  const providers = Object.create(
    AiProviderService.prototype,
  ) as AiProviderService;
  providers.findDefaultProviderStatus = findDefaultProviderStatus;
  const gemini = Object.create(GeminiService.prototype) as GeminiService;
  gemini.getDualEngineStatus = getDualEngineStatus;
  const codex = Object.create(
    CodexRuntimeService.prototype,
  ) as CodexRuntimeService;
  codex.observe = observe;
  return {
    findDefaultProviderStatus,
    getDualEngineStatus,
    observe,
    subject: new GetAiProviderTopbarStatusUseCase(
      providers,
      gemini,
      codex,
      new GeminiAgenticLogoutService(),
    ),
  };
}

describe('GetAiProviderTopbarStatusUseCase', () => {
  it('observes the exact default and projects only configuration and session indicators', async () => {
    const f = setup();
    await expect(f.subject.execute()).resolves.toEqual({
      provider: {
        name: defaultProvider.name,
        key: 'openai',
        isActive: true,
        use_api_key: true,
        use_agentic: true,
        hasApiKey: true,
        agentic: { available: true, authenticated: true, usageAllowed: false },
      },
    });
    expect(f.observe).toHaveBeenCalledExactlyOnceWith(
      defaultProvider.id,
      expect.any(AbortSignal),
    );
    expect(f.getDualEngineStatus).not.toHaveBeenCalled();
  });

  it('returns no provider with no default and avoids disabled or inactive observations', async () => {
    const f = setup();
    f.findDefaultProviderStatus.mockResolvedValueOnce(null);
    await expect(f.subject.execute()).resolves.toEqual({ provider: null });

    f.findDefaultProviderStatus.mockResolvedValueOnce({
      ...defaultProvider,
      isActive: false,
    });
    await expect(f.subject.execute()).resolves.toMatchObject({
      provider: { isActive: false, agentic: null },
    });

    f.findDefaultProviderStatus.mockResolvedValueOnce({
      ...defaultProvider,
      use_agentic: false,
      hasApiKey: false,
    });
    await expect(f.subject.execute()).resolves.toMatchObject({
      provider: {
        use_api_key: true,
        use_agentic: false,
        hasApiKey: false,
        agentic: null,
      },
    });
    expect(f.observe).not.toHaveBeenCalled();
    expect(f.getDualEngineStatus).not.toHaveBeenCalled();
  });

  it('keeps Codex contention unknown and re-observes after failure', async () => {
    const f = setup();
    f.observe
      .mockResolvedValueOnce({
        ...codexSession,
        available: false,
        authenticated: null,
        usageAllowed: null,
        reason: 'codex_profile_busy',
      })
      .mockRejectedValueOnce(new Error('synthetic internal detail'));
    await expect(f.subject.execute()).resolves.toMatchObject({
      provider: {
        agentic: {
          available: null,
          authenticated: null,
          usageAllowed: null,
          reason: 'codex_profile_busy',
        },
      },
    });
    await expect(f.subject.execute()).resolves.toMatchObject({
      provider: { agentic: null },
    });
    await expect(f.subject.execute()).resolves.toMatchObject({
      provider: {
        agentic: { available: true, authenticated: true, usageAllowed: false },
      },
    });
  });

  it('uses Gemini session facts and strips upstream reason/details except known contention', async () => {
    const f = setup();
    f.findDefaultProviderStatus.mockResolvedValue({
      ...defaultProvider,
      name: null,
      catalogName: 'Gemini',
      key: 'gemini',
    });
    f.getDualEngineStatus
      .mockResolvedValueOnce({
        active_engine: 'agentic',
        agentic: {
          available: true,
          has_active_session: false,
          quota: { used: 10 },
          reason: 'agentic_session_required',
        },
      })
      .mockResolvedValueOnce({
        active_engine: 'agentic',
        agentic: {
          available: false,
          authenticated: false,
          reason: 'runtime_busy',
        },
      })
      .mockResolvedValueOnce({
        active_engine: 'agentic',
        agentic: {
          available: false,
          authenticated: false,
          reason: 'agentic_timeout',
        },
      });
    await expect(f.subject.execute()).resolves.toEqual({
      provider: {
        name: 'Gemini',
        key: 'gemini',
        isActive: true,
        use_api_key: true,
        use_agentic: true,
        hasApiKey: true,
        agentic: { available: true, authenticated: false },
      },
    });
    await expect(f.subject.execute()).resolves.toMatchObject({
      provider: {
        agentic: {
          available: null,
          authenticated: null,
          reason: 'runtime_busy',
        },
      },
    });
    await expect(f.subject.execute()).resolves.toMatchObject({
      provider: { agentic: null },
    });
    expect(f.observe).not.toHaveBeenCalled();
  });

  it('coalesces concurrent polls for one profile and never reuses one from a different default', async () => {
    const f = setup();
    let finish: (session: CodexSession) => void = () => undefined;
    f.observe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = f.subject.execute();
    const second = f.subject.execute();
    await vi.waitFor(() =>
      expect(f.findDefaultProviderStatus).toHaveBeenCalledTimes(2),
    );
    expect(f.observe).toHaveBeenCalledOnce();
    f.findDefaultProviderStatus.mockResolvedValueOnce({
      ...defaultProvider,
      id: '12',
    });
    await f.subject.execute();
    expect(f.observe).toHaveBeenLastCalledWith('12', expect.any(AbortSignal));
    finish(codexSession);
    expect(await first).toEqual(await second);
    expect(f.observe).toHaveBeenCalledTimes(2);
  });
});
