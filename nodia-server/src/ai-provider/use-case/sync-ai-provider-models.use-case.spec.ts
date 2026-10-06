import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncAiProviderModelsUseCase } from './sync-ai-provider-models.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';

describe('SyncAiProviderModelsUseCase', () => {
  let useCase: SyncAiProviderModelsUseCase;
  let aiProviderServiceMock: Partial<AiProviderService>;
  let geminiServiceMock: Partial<GeminiService>;

  beforeEach(() => {
    aiProviderServiceMock = {
      findProviderById: vi.fn(),
      updateProviderFields: vi.fn(),
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

  it('should discover models from gemini microservice when mode is WEB_SESSION', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      name: 'Gemini Web Plan',
      mode: AiConnectionMode.WEB_SESSION,
      fields: {
        selected_model: 'gemini-flash',
      },
    } as any);

    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
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
    expect(result.tokenPlan?.authenticated).toBe(true);
    expect(aiProviderServiceMock.updateProviderFields).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        available_models: expect.any(Array),
      }),
    );
  });

  it('should throw BadRequestException if Gemini web session is not authenticated', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      mode: AiConnectionMode.WEB_SESSION,
    } as any);

    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
      authenticated: false,
    });

    await expect(useCase.execute('1')).rejects.toThrow(
      'no está activa o no ha sido autenticada',
    );
  });

  it('should throw BadRequestException if API_KEY provider has no active key', async () => {
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
      'modo API Key no está habilitado',
    );
  });

  it('should flag isSelectedModelAvailable as false if current model was deprecated', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      name: 'Gemini Web Plan',
      mode: AiConnectionMode.WEB_SESSION,
      fields: {
        selected_model: 'gemini-1.5-flash', // Deprecated
      },
    } as any);

    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
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
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({ id: '1', key: 'gemini', mode: AiConnectionMode.WEB_SESSION } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(useCase.execute('1', { mode: 'api_key' })).rejects.toThrow('modo API Key no está habilitado');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(aiProviderServiceMock.getActiveApiKeySecret).not.toHaveBeenCalled();
    expect(aiProviderServiceMock.updateProviderFields).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('should throw BadRequestException when Gemini API key fails, reporting Gemini error', async () => {
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
      'modo API Key no está habilitado',
    );

    vi.unstubAllGlobals();
  });

  it('should throw BadRequestException when unrecognized provider has no baseUrl', async () => {
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
      'modo API Key no está habilitado',
    );
  });

  it('does not infer model capabilities or context from its name', async () => {
    vi.mocked(aiProviderServiceMock.findProviderById!).mockResolvedValue({
      id: '1',
      key: 'gemini',
      mode: AiConnectionMode.WEB_SESSION,
      fields: {},
    } as never);
    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
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
    expect(aiProviderServiceMock.updateProviderFields).not.toHaveBeenCalled();
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
        mode: AiConnectionMode.WEB_SESSION,
      } as never);
      vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({
        authenticated: true,
        models,
      });
      await expect(useCase.execute('1')).rejects.toMatchObject({ status: 502 });
      expect(aiProviderServiceMock.updateProviderFields).not.toHaveBeenCalled();
    },
  );
});
