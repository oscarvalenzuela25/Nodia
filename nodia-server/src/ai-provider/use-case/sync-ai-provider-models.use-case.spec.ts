import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncAiProviderModelsUseCase } from './sync-ai-provider-models.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';
import { AiProviderService as RealAiProviderService } from '../ai-provider.service.js';
import { SaveAiProviderConfigurationUseCase } from './save-ai-provider-configuration.use-case.js';
import { configurationFixture } from '../../../test/fixtures/ai-provider-configuration.fixture.js';

describe('SyncAiProviderModelsUseCase', () => {
  let useCase: SyncAiProviderModelsUseCase;
  let aiProviderServiceMock: Partial<AiProviderService>;
  let geminiServiceMock: Partial<GeminiService>;

  beforeEach(() => {
    aiProviderServiceMock = {
      findProviderById: vi.fn(),
      mergeDiscoveredModels: vi.fn(),
      getActiveApiKeySecret: vi.fn(),
    };
    geminiServiceMock = {
      getModelsAndQuota: vi.fn(),
    };
    useCase = new SyncAiProviderModelsUseCase(
      aiProviderServiceMock as AiProviderService,
      geminiServiceMock as GeminiService,
    );
  });

  it('should throw NotFoundException if provider does not exist', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue(
      null as any,
    );

    await expect(useCase.execute('999')).rejects.toThrow('not found');
  });

  it('should discover models from gemini microservice when mode is AGENTIC', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      name: 'Gemini Agentic Plan',
      mode: AiConnectionMode.AGENTIC,
      fields: {
        selected_model: 'gemini-flash',
      },
    } as any);

    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
      available: true,
      authenticated: true,
      tier: 'PRO',
      plan_label: 'Google One AI Premium',
      models: [
        {
          id: 'gemini-flash',
          name: 'gemini-flash',
          display_name: 'Gemini 3.8 Flash',
          description: 'Ultra fast',
          capabilities: ['text', 'vision'],
          context_window: 1000000,
        },
        {
          id: 'gemini-pro',
          name: 'gemini-pro',
          display_name: 'Gemini 3.1 Pro',
          description: 'Deep reasoning',
          capabilities: ['text', 'vision', 'reasoning'],
          context_window: 2000000,
        },
      ],
    });

    const result = await useCase.execute('1');

    expect(result.providerId).toBe('1');
    expect(result.currentSelectedModel).toBe('gemini-flash');
    expect(result.isSelectedModelAvailable).toBe(true);
    expect(result.models).toHaveLength(2);
    expect(result.models[0].displayName).toBe('Gemini 3.8 Flash');
    expect(result.models[1].capabilities).toContain('reasoning');
    expect(result.agenticPlan?.authenticated).toBe(true);
    expect(aiProviderServiceMock.mergeDiscoveredModels).toHaveBeenCalledWith(
      '1',
      'agentic',
      result.models,
    );
  });

  it('should throw BadRequestException if Gemini agentic session is not authenticated', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      mode: AiConnectionMode.AGENTIC,
    } as any);

    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
      authenticated: false,
    });

    await expect(useCase.execute('1')).rejects.toThrow(
      'Agentic no esta disponible o no tiene sesion activa',
    );
  });

  it('rejects a historical API provider that has no enabled API channel', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '2',
      key: 'openai',
      name: 'OpenAI',
      mode: AiConnectionMode.API_KEY,
    } as any);

    vi.mocked(aiProviderServiceMock.getActiveApiKeySecret!).mockResolvedValue(
      null,
    );

    await expect(useCase.execute('2')).rejects.toThrow(
      'El canal API no está habilitado',
    );
  });

  it('should flag isSelectedModelAvailable as false if current model was deprecated', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      name: 'Gemini Agentic Plan',
      mode: AiConnectionMode.AGENTIC,
      fields: {
        selected_model: 'gemini-1.5-flash', // Deprecated
      },
    } as any);

    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
      available: true,
      authenticated: true,
      tier: 'PRO',
      models: [
        {
          id: 'gemini-flash',
          name: 'gemini-flash',
          display_name: 'Gemini 3.8 Flash',
        },
      ],
    });

    const result = await useCase.execute('1');

    expect(result.isSelectedModelAvailable).toBe(false);
  });

  it('rejects API mode without reading a key, network calls or persisting a catalogue', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      mode: AiConnectionMode.AGENTIC,
    } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(useCase.execute('1', { mode: 'api_key' })).rejects.toThrow(
      'El canal API no está habilitado',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(aiProviderServiceMock.getActiveApiKeySecret).not.toHaveBeenCalled();
    expect(aiProviderServiceMock.mergeDiscoveredModels).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('rejects historical Gemini API configuration before reading its key', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      name: 'Google Gemini',
      default_mode: 'api_key',
    } as any);

    vi.mocked(aiProviderServiceMock.getActiveApiKeySecret!).mockResolvedValue(
      'AQ.invalid_key',
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({ error: { message: 'API key not valid' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(useCase.execute('1', { mode: 'api_key' })).rejects.toThrow(
      'El canal API no está habilitado',
    );

    vi.unstubAllGlobals();
  });

  it('rejects an unconfigured API channel for an unknown provider', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '99',
      key: 'unknown-custom-llm',
      name: 'Custom LLM',
      default_mode: 'api_key',
    } as any);

    vi.mocked(aiProviderServiceMock.getActiveApiKeySecret!).mockResolvedValue(
      'some_secret_key',
    );

    await expect(useCase.execute('99', { mode: 'api_key' })).rejects.toThrow(
      'El canal API no está habilitado',
    );
  });

  it('does not infer model capabilities or context from its name', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      mode: AiConnectionMode.AGENTIC,
      fields: {},
    } as never);
    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
      available: true,
      authenticated: true,
      models: [{ id: 'discovered-flash' }],
    });
    const result = await useCase.execute('1', { persist: false });
    expect(result.models[0]).toMatchObject({
      contextWindow: null,
      capabilities: [],
      isRecommended: false,
    });
    expect(result.models[0]).not.toHaveProperty('role');
    expect(aiProviderServiceMock.mergeDiscoveredModels).not.toHaveBeenCalled();
  });

  it.each([
    { models: { invalid: true } },
    { models: [null] },
    { models: [{ name: 123 }] },
  ])(
    'rejects invalid discovery output with a controlled upstream error',
    async ({ models }) => {
      vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
        id: '1',
        key: 'gemini',
        mode: AiConnectionMode.AGENTIC,
      } as never);
      vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
        available: true,
        authenticated: true,
        models,
      });
      await expect(useCase.execute('1')).rejects.toMatchObject({ status: 502 });
      expect(
        aiProviderServiceMock.mergeDiscoveredModels,
      ).not.toHaveBeenCalled();
    },
  );
  it('merges discovery after remote I/O without overwriting a concurrently confirmed model, effort or hidden fields', async () => {
    const f = configurationFixture();
    const update = vi.fn(
      async (_id: string, patch: { fields?: Record<string, unknown> }) => {
        Object.assign(f.existing, patch);
        return {};
      },
    );
    const repository = Object.assign(f.providerRepo, {
      manager: f.manager,
      update,
    });
    Object.assign(f.manager, {
      transaction: async (
        work: (manager: typeof f.manager) => Promise<unknown>,
      ) => work(f.manager),
    });
    const service = new RealAiProviderService(
      repository as never,
      null as never,
      null as never,
      f.catalogRepo as never,
      f.translations,
    );
    let release!: (value: unknown) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const remote = new Promise((resolve) => {
      release = resolve;
    });
    const gemini = {
      getModelsAndQuota: vi.fn(() => {
        entered();
        return remote;
      }),
    };
    const sync = new SyncAiProviderModelsUseCase(service, gemini as never);
    const pending = sync.execute(f.existing.id, { mode: 'agentic' });
    await started;
    await new SaveAiProviderConfigurationUseCase(
      f.source,
      f.translations,
    ).execute(
      f.existing.id,
      {
        name: 'Confirmed meanwhile',
        fields: {
          agentic: {
            selected_model: 'new-confirmed-model',
            thinking_levels: { 'new-confirmed-model': 'new-effort' },
          },
        },
      },
      f.actor,
    );
    release({
      available: true,
      authenticated: true,
      models: [{ id: 'freshly-discovered-id' }],
    });
    await pending;
    expect(f.existing.name).toBe('Confirmed meanwhile');
    expect(f.existing.fields.agentic).toMatchObject({
      selected_model: 'new-confirmed-model',
      secret: 'synthetic-mode-secret',
      thinking_levels: { 'new-confirmed-model': 'new-effort', other: 'low' },
      available_models: [{ id: 'freshly-discovered-id' }],
    });
    expect(f.existing.fields.legacy.token).toBe('synthetic-private-value');
    expect(update).toHaveBeenCalledTimes(1);
  });
});
