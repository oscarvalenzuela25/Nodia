import { describe, expect, it, vi } from 'vitest';
import { SyncAiProviderModelsUseCase } from './sync-ai-provider-models.use-case.js';
import { GetSelectableModelsUseCase } from './get-selectable-models.use-case.js';
import { GetAiProvidersHealthUseCase } from './get-ai-providers-health.use-case.js';
import { VerifyIaProvidersUseCase } from '../../invoice/use-case/verify-ia-providers.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import type { CodexSession } from '../../common/ai/codex/codex-contract.js';
import type { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type { AiProvider } from '../entities/ai-provider.entity.js';

const setup = () => {
  const provider = {
    id: '42',
    key: 'openai',
    name: 'Synthetic',
    is_active: true,
    use_api_key: true,
    use_token_plan_agentic: true,
    default_mode: 'token_plan_agentic',
    api_keys: [],
    catalog: {
      key: 'openai',
      name: 'OpenAI',
      is_active: true,
      can_use_api_key: true,
      can_use_token_plan_agentic: true,
    },
    fields: {
      api_key: { selected_model: 'synthetic-api', thinking_level: 'low' },
      token_plan_agentic: {
        selected_model: 'synthetic-codex',
        thinking_level: 'new_effort',
      },
    },
  } as unknown as AiProvider;
  const model = {
    id: 'synthetic-codex',
    name: 'Display name',
    displayName: 'Display name',
    description: '',
    contextWindow: null,
    capabilities: ['vision', 'reasoning'],
    inputModalities: ['text', 'image'],
    supportedReasoningEfforts: ['new_effort'],
    isRecommended: false,
  };
  const session: CodexSession = {
    available: true,
    authenticated: true,
    planType: null,
    checkedAt: '2026-10-08T12:00:00Z',
    reason: null,
    usageAllowed: null,
    quotas: null,
    lastInferenceAt: null,
  };
  const providers = {
    findProviderById: vi.fn(async () => provider),
    findAllProviders: vi.fn(async () => ({ data: [provider] })),
    updateProviderFields: vi.fn(),
    getActiveApiKeySecret: vi.fn(),
  };
  const gemini = { getDualEngineStatus: vi.fn(), getModelsAndQuota: vi.fn() };
  const codex = {
    observe: vi.fn(async () => session),
    snapshot: vi.fn(async () => session),
    listModels: vi.fn(async () => [model]),
  };
  return {
    provider,
    model,
    session,
    providers,
    gemini,
    codex,
    p: providers as unknown as AiProviderService,
    g: gemini as unknown as GeminiService,
    c: codex as unknown as CodexRuntimeService,
  };
};
describe('Codex provider use-case contracts', () => {
  it('persists discovery only in Agentic, without selecting the first model or inventing a plan', async () => {
    const x = setup();
    x.provider.fields.token_plan_agentic = {};
    const result = await new SyncAiProviderModelsUseCase(
      x.p,
      x.g,
      undefined,
      x.c,
    ).execute('42', { mode: 'token_plan_agentic' });
    expect(result.currentSelectedModel).toBeNull();
    expect(result.tokenPlan).toBeNull();
    expect(x.providers.updateProviderFields).toHaveBeenCalledWith('42', {
      api_key: x.provider.fields.api_key,
      token_plan_agentic: { available_models: [x.model] },
    });
    expect(x.gemini.getModelsAndQuota).not.toHaveBeenCalled();
  });
  it('leaves saved configuration untouched on an empty/failed catalogue', async () => {
    const x = setup();
    x.codex.listModels.mockResolvedValue([]);
    await expect(
      new SyncAiProviderModelsUseCase(x.p, x.g, undefined, x.c).execute('42', {
        mode: 'token_plan_agentic',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(x.providers.updateProviderFields).not.toHaveBeenCalled();
  });
  it('returns live arbitrary efforts without inferring a capability from the model name', async () => {
    const x = setup();
    x.model.capabilities = [];
    x.model.inputModalities = [];
    const [result] = await new GetSelectableModelsUseCase(
      x.p,
      x.g,
      undefined,
      x.c,
    ).execute({ provider_id: '42', mode: 'token_plan_agentic' });
    expect(result.models[0]).toMatchObject({
      capabilities: [],
      supportedReasoningEfforts: ['new_effort'],
    });
    expect(result.tokenPlan).toBeNull();
  });
  it('uses snapshots for health and does not certify authentication as successful inference', async () => {
    const x = setup();
    const result = await new GetAiProvidersHealthUseCase(
      x.p,
      x.g,
      x.c,
    ).execute();
    expect(x.codex.snapshot).toHaveBeenCalledWith('42');
    expect(x.codex.observe).not.toHaveBeenCalled();
    expect(result.providers[0]).toMatchObject({
      status: 'unverified',
      latencyMs: null,
      codexSession: { lastInferenceAt: null, quotas: null },
    });
  });
  it.each(['missing-session', 'quota', 'effort', 'alias'])(
    'does not fall back to API/Gemini when %s invalidates Codex',
    async (cause) => {
      const x = setup();
      if (cause === 'missing-session') x.session.authenticated = false;
      if (cause === 'quota') x.session.usageAllowed = false;
      if (cause === 'effort')
        x.provider.fields.token_plan_agentic.thinking_level = 'unavailable';
      if (cause === 'alias')
        x.provider.fields.token_plan_agentic.selected_model = x.model.name;
      const result = await new VerifyIaProvidersUseCase(
        x.g,
        x.p,
        undefined,
        x.c,
      ).execute();
      expect(result[0].can_use_model).toBe(false);
      expect(result[0].active_mode).toBeNull();
      expect(x.providers.getActiveApiKeySecret).not.toHaveBeenCalled();
      expect(x.gemini.getModelsAndQuota).not.toHaveBeenCalled();
    },
  );
  it.each([true, false])('does not activate Codex when the selected API channel is unavailable (enabled=%s)', async (enabled) => {
    const x = setup(); x.provider.default_mode = 'api_key'; x.provider.use_api_key = enabled;
    const result = await new VerifyIaProvidersUseCase(x.g, x.p, undefined, x.c).execute();
    expect(result[0].can_use_model).toBe(false); expect(result[0].active_mode).toBeNull();
    expect(x.codex.observe).not.toHaveBeenCalled(); expect(x.codex.listModels).not.toHaveBeenCalled();
  });
  it('verifies an exact configured model with observed vision and an advertised effort', async () => {
    const x = setup();
    const result = await new VerifyIaProvidersUseCase(
      x.g,
      x.p,
      undefined,
      x.c,
    ).execute();
    expect(result[0]).toMatchObject({
      can_use_model: true,
      active_mode: 'token_plan_agentic',
      ocr_model: 'synthetic-codex',
    });
  });
});
