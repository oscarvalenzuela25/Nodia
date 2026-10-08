import { afterEach, describe, expect, it, vi } from 'vitest';
import { SyncAiProviderModelsUseCase } from './sync-ai-provider-models.use-case.js';
import { GetSelectableModelsUseCase } from './get-selectable-models.use-case.js';
import { VerifyIaProvidersUseCase } from '../../invoice/use-case/verify-ia-providers.use-case.js';
import { ApiProviderService } from '../../common/ai/api-provider.service.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';

function setup(key = 'openai') {
  const provider = {
    id: '42',
    name: 'Configured API',
    is_active: true,
    use_api_key: true,
    use_token_plan_web: false,
    use_token_plan_agentic: false,
    default_mode: 'api_key',
    catalog: { key, can_use_api_key: true },
    fields: {
      token_plan_web: { selected_model: 'other-mode' },
      api_key: {
        selected_model: 'live-account-model',
        available_models: [{ id: 'live-account-model' }],
      },
    },
  };
  const service = {
    findProviderById: vi.fn().mockResolvedValue(provider),
    findAllProviders: vi.fn().mockResolvedValue({ data: [provider] }),
    getActiveApiKeySecret: vi.fn().mockResolvedValue('synthetic-key'),
    updateProviderFields: vi.fn(),
  };
  const api = new ApiProviderService();
  const providers = service as unknown as AiProviderService;
  const gemini = { getModelsAndQuota: vi.fn() } as unknown as GeminiService;
  return {
    provider,
    service,
    sync: new SyncAiProviderModelsUseCase(providers, gemini, api),
    selectable: new GetSelectableModelsUseCase(providers, gemini, api),
    verify: new VerifyIaProvidersUseCase(gemini, providers, api),
  };
}
const models = () =>
  new Response(
    JSON.stringify({
      data: [
        { id: 'live-account-model', object: 'model' },
        { id: 'newly-released-model' },
      ],
    }),
  );
afterEach(() => vi.unstubAllGlobals());
describe('API models discovered through use cases', () => {
  it('keeps the saved model visible but blocks execution when its catalogue disables API', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { provider, verify } = setup();
    provider.catalog.can_use_api_key = false;
    const [result] = await verify.execute();
    expect(result.can_use_model).toBe(false);
    expect(result.default_model).toBe('live-account-model');
    expect(result.error).toContain('catálogo');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not inherit a historical root model when API configuration is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(models));
    const { provider, sync } = setup();
    (provider.fields as Record<string, unknown>).selected_model =
      'historical-root-model';
    delete (provider.fields as Record<string, unknown>).api_key;
    const result = await sync.execute('42', {
      mode: 'api_key',
      persist: false,
    });
    expect(result.currentSelectedModel).toBeNull();
    expect(result.isSelectedModelAvailable).toBe(false);
  });
  it('discovers new versions dynamically without inventing capabilities, quota or selection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(models));
    const { sync, service } = setup();
    const result = await sync.execute('42', {
      mode: 'api_key',
      persist: false,
    });
    expect(result.models.map((model) => model.id)).toEqual([
      'live-account-model',
      'newly-released-model',
    ]);
    expect(
      result.models.every(
        (model) =>
          model.contextWindow === null && model.capabilities.length === 0,
      ),
    ).toBe(true);
    expect(result.tokenPlan).toBeNull();
    expect(service.updateProviderFields).not.toHaveBeenCalled();
    await sync.execute('42', { mode: 'api_key' });
    expect(service.updateProviderFields).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({
        token_plan_web: { selected_model: 'other-mode' },
        api_key: expect.objectContaining({
          selected_model: 'live-account-model',
        }),
      }),
    );
  });
  it('exposes observed API models and verifies configuration without fabricating a successful inference', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(models));
    const { selectable, verify } = setup();
    const list = await selectable.execute({
      provider_id: '42',
      mode: 'api_key',
    });
    expect(list[0]).toMatchObject({
      providerId: '42',
      models_source: 'provider',
      selectedModel: 'live-account-model',
    });
    const result = await verify.execute();
    expect(result[0]).toMatchObject({
      can_use_model: true,
      active_mode: 'api_key',
      default_model: 'live-account-model',
      supports_thinking: false,
    });
  });
  it('handles no key, invalid discovery and disabled API without using another mode', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: null }] })),
      );
    vi.stubGlobal('fetch', fetch);
    const { sync, service, provider } = setup();
    service.getActiveApiKeySecret.mockResolvedValueOnce(null);
    await expect(sync.execute('42', { mode: 'api_key' })).rejects.toThrow(
      'API key activa',
    );
    expect(fetch).not.toHaveBeenCalled();
    await expect(sync.execute('42', { mode: 'api_key' })).rejects.toThrow(
      'identificador',
    );
    provider.use_api_key = false;
    await expect(sync.execute('42', { mode: 'api_key' })).rejects.toThrow(
      'no está habilitado',
    );
  });
  it('reads Gemini API pagination and only provider-reported metadata', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              {
                name: 'models/account-gemini',
                displayName: 'Account Gemini',
                inputTokenLimit: 123,
                supportedGenerationMethods: ['generateContent'],
              },
            ],
            nextPageToken: 'second-page',
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              {
                name: 'models/another-version',
                supportedGenerationMethods: ['generateContent'],
              },
            ],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const { sync } = setup('gemini');
    const result = await sync.execute('42', {
      mode: 'api_key',
      persist: false,
    });
    expect(result.models).toHaveLength(2);
    expect(result.models[0]).toMatchObject({
      id: 'account-gemini',
      contextWindow: 123,
      capabilities: [],
    });
    expect(fetch.mock.calls[1][0]).toContain('pageToken=second-page');
    expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe(
      'synthetic-key',
    );
  });
});
