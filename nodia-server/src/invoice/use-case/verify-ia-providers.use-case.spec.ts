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

  it('should return empty array when no aiProviderService is provided', async () => {
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });

  it('should verify providers strictly from ai_providers table with active model and valid credentials', async () => {
    vi.mocked(geminiServiceMock.verifyProvider!).mockResolvedValue(true);

    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            key: 'gemini',
            name: 'Google Gemini',
            is_active: true,
            mode: 'web_session',
            fields: {
              selected_model: 'gemini-flash',
              enable_extended_thinking: true,
              available_models: [
                { id: 'gemini-flash', capabilities: ['reasoning'] },
              ],
            },
          },
          {
            id: '2',
            key: 'mistral',
            name: 'Mistral AI',
            is_active: true,
            mode: 'api_key',
            fields: {
              selected_model: 'mistral-large-latest',
              ocr_model: 'mistral-ocr-latest',
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

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);

    const gemini = result.find((p) => p.key === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.can_use_model).toBe(true);
    expect(gemini?.error).toBeNull();
    expect(gemini?.default_model).toBe('gemini-flash');
    expect(gemini?.supports_thinking).toBe(true);
    expect(gemini?.extended_thinking_enabled).toBe(true);

    const mistral = result.find((p) => p.key === 'mistral');
    expect(mistral).toBeDefined();
    expect(mistral?.can_use_model).toBe(true);
    expect(mistral?.error).toBeNull();
    expect(mistral?.default_model).toBe('mistral-large-latest');
    expect(mistral?.ocr_model).toBe('mistral-ocr-latest');
  });

  it('should mark provider as false with error if selected_model is missing or empty', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            key: 'openai',
            name: 'OpenAI',
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

    expect(result).toHaveLength(1);
    const openai = result[0];
    expect(openai.can_use_model).toBe(false);
    expect(openai.error).toBe('No tiene un modelo por defecto asignado.');
  });

  it('should mark provider as false with error if connection has no active api keys', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '2',
            key: 'mistral',
            name: 'Mistral AI',
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

    expect(result).toHaveLength(1);
    const mistral = result[0];
    expect(mistral.can_use_model).toBe(false);
    expect(mistral.error).toBe('No cuenta con API Keys activas o disponibles.');
  });

  it('should fallback to another enabled mode when default_mode has no configured models', async () => {
    vi.mocked(geminiServiceMock.verifyProvider!).mockResolvedValue(true);

    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            key: 'gemini',
            name: 'Google Gemini',
            is_active: true,
            use_token_plan_agentic: true,
            use_token_plan_web: true,
            default_mode: 'token_plan_agentic',
            fields: {
              // agentic has NO models configured
              token_plan_agentic: { selected_model: null, available_models: [] },
              // web has configured models
              token_plan_web: {
                selected_model: 'gemini-3.8-flash',
                available_models: [{ id: 'gemini-3.8-flash', capabilities: ['vision'] }],
              },
            },
          },
        ],
      }),
    };

    const dbUseCase = new VerifyIaProvidersUseCase(
      geminiServiceMock as GeminiService,
      aiProviderServiceMock as any,
    );

    const result = await dbUseCase.execute();

    expect(result).toHaveLength(1);
    const gemini = result[0];
    expect(gemini.can_use_model).toBe(true);
    expect(gemini.active_mode).toBe('token_plan_web');
    expect(gemini.default_model).toBe('gemini-3.8-flash');
    expect(gemini.ocr_model).toBe('gemini-3.8-flash'); // fallback to default_model because no specific OCR
  });

  it('should fallback to default_model when no specific OCR model exists', async () => {
    const aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '2',
            key: 'mistral',
            name: 'Mistral AI',
            is_active: true,
            use_api_key: true,
            default_mode: 'api_key',
            fields: {
              selected_model: 'mistral-medium',
              // No ocr_model or ocr_focus_model!
            },
            api_keys: [{ id: 'k1', is_active: true, health_state: 'valid' }],
          },
        ],
      }),
    };

    const dbUseCase = new VerifyIaProvidersUseCase(
      geminiServiceMock as GeminiService,
      aiProviderServiceMock as any,
    );

    const result = await dbUseCase.execute();

    expect(result).toHaveLength(1);
    const mistral = result[0];
    expect(mistral.can_use_model).toBe(true);
    expect(mistral.default_model).toBe('mistral-medium');
    expect(mistral.ocr_model).toBe('mistral-medium');
  });
});
