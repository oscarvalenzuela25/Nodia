import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerifyIaProvidersUseCase } from './verify-ia-providers.use-case.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';

describe('VerifyIaProvidersUseCase', () => {
  let useCase: VerifyIaProvidersUseCase;
  let geminiServiceMock: Partial<GeminiService>;

  beforeEach(() => {
    geminiServiceMock = {
      verifyProvider: vi.fn(),
    };
    useCase = new VerifyIaProvidersUseCase(geminiServiceMock as GeminiService);
  });

  it('should return empty result when no aiProviderService is provided', async () => {
    const result = await useCase.execute();
    expect(result).toEqual({});
  });

  it('should verify providers strictly from ai_providers table with active model and valid credentials', async () => {
    process.env.ENABLED_WEB_AI_PROVIDERS = 'gemini';
    vi.mocked(geminiServiceMock.verifyProvider!).mockResolvedValue(true);

    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            key: 'gemini',
            is_active: true,
            mode: 'web_session',
            fields: {
              selected_model: 'gemini-flash',
            },
          },
          {
            id: '2',
            key: 'mistral',
            is_active: true,
            mode: 'api_key',
            fields: {
              selected_model: 'mistral-large-latest',
            },
            api_keys: [
              {
                id: 'k1',
                is_active: true,
                health_state: 'valid',
              },
            ],
          },
        ],
      }),
    };

    const dbUseCase = new VerifyIaProvidersUseCase(
      geminiServiceMock as GeminiService,
      aiProviderServiceMock as any,
    );

    const result = await dbUseCase.execute();

    expect(result).toEqual({
      gemini: true,
      mistral: true,
    });
  });

  it('should mark provider as false if selected_model is missing or empty', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            key: 'openai',
            is_active: true,
            mode: 'api_key',
            fields: {}, // No selected_model!
            api_keys: [
              {
                id: 'k1',
                is_active: true,
                health_state: 'valid',
              },
            ],
          },
        ],
      }),
    };

    const dbUseCase = new VerifyIaProvidersUseCase(
      geminiServiceMock as GeminiService,
      aiProviderServiceMock as any,
    );

    const result = await dbUseCase.execute();

    expect(result.openai).toBe(false);
  });

  it('should mark provider as false if connection has no active api keys', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '2',
            key: 'mistral',
            is_active: true,
            mode: 'api_key',
            fields: {
              selected_model: 'mistral-large-latest',
            },
            api_keys: [], // No keys
          },
        ],
      }),
    };

    const dbUseCase = new VerifyIaProvidersUseCase(
      geminiServiceMock as GeminiService,
      aiProviderServiceMock as any,
    );

    const result = await dbUseCase.execute();

    expect(result.mistral).toBe(false);
  });
});
