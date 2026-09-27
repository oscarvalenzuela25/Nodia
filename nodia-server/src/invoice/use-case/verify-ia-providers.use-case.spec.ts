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

  it('should return gemini true and mistral true when gemini service is active', async () => {
    vi.mocked(geminiServiceMock.verifyProvider!).mockResolvedValue(true);

    const result = await useCase.execute();

    expect(result).toEqual({
      gemini: true,
      mistral: true,
    });
    expect(geminiServiceMock.verifyProvider).toHaveBeenCalledTimes(1);
  });

  it('should return gemini false and mistral true when gemini service is inactive or session expired', async () => {
    vi.mocked(geminiServiceMock.verifyProvider!).mockResolvedValue(false);

    const result = await useCase.execute();

    expect(result).toEqual({
      gemini: false,
      mistral: true,
    });
    expect(geminiServiceMock.verifyProvider).toHaveBeenCalledTimes(1);
  });

  it('should verify providers using aiProviderService directly when available', async () => {
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
          },
          {
            id: '2',
            key: 'mistral',
            is_active: true,
            mode: 'api_key',
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

  it('should mark provider as false if connection has no active api keys', async () => {
    process.env.ENABLED_WEB_AI_PROVIDERS = 'gemini';
    vi.mocked(geminiServiceMock.verifyProvider!).mockResolvedValue(true);

    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '2',
            key: 'mistral',
            is_active: true,
            mode: 'api_key',
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
