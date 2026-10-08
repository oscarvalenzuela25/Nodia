import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerifyIaProvidersUseCase } from './verify-ia-providers.use-case.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';

describe('VerifyIaProvidersUseCase', () => {
  let useCase: VerifyIaProvidersUseCase;
  let geminiServiceMock: Partial<GeminiService>;

  beforeEach(() => {
    geminiServiceMock = {
      verifyProvider: vi.fn(),
      getModelsAndQuota: vi.fn().mockResolvedValue({ authenticated: true, available: true, supported_options: { extended_thinking: true }, models: [
        { id: 'gemini-flash', capabilities: ['reasoning'] }, { id: 'gemini-3.8-flash', capabilities: ['vision'] },
      ] }),
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
    expect(mistral?.can_use_model).toBe(false);
    expect(mistral?.error).toContain('no tiene una integración de sesión admitida');
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
    expect(openai.use_api_key).toBe(true);
    expect(openai.use_token_plan_web).toBe(false);
    expect(openai.use_token_plan_agentic).toBe(false);
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
    expect(mistral.error).toBe('El modo API Key no tiene una integración de sesión admitida.');
  });

  it('does not switch modes when the configured default has no model', async () => {
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
    expect(gemini.can_use_model).toBe(false);
    expect(gemini.active_mode).toBeNull();
    expect(gemini.default_model).toBeNull();
    expect(gemini.ocr_model).toBeNull();
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
    expect(mistral.can_use_model).toBe(false);
    expect(mistral.default_model).toBe('mistral-medium');
    expect(mistral.ocr_model).toBe('mistral-medium');
  });
  it('does not infer reasoning or an assigned model from cached recommendations', async () => {
    const provider = { id: '1', key: 'gemini', is_active: true, mode: 'web_session',
      fields: { selected_model: 'gemini-thinking-model', enable_extended_thinking: true,
        available_models: [{ id: 'gemini-thinking-model', isRecommended: true, capabilities: ['reasoning'] }] } };
    const list = { findAllProviders: vi.fn().mockResolvedValue({ data: [provider] }) };
    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({ authenticated: true, models: [{ id: 'gemini-thinking-model' }] });
    const verifier = new VerifyIaProvidersUseCase(geminiServiceMock as GeminiService, list as never);
    const [result] = await verifier.execute();
    expect(result.can_use_model).toBe(true);
    expect(result.supports_thinking).toBe(false);
    expect(result.extended_thinking_enabled).toBe(false);
    provider.fields.selected_model = '';
    expect((await verifier.execute())[0].can_use_model).toBe(false);
  });
  it('uses confirmed Web SDK options with a model that reports no reasoning capability', async () => {
    const provider = { id: '1', key: 'gemini', is_active: true, mode: 'web_session', fields: { selected_model: 'opaque-live-id', enable_extended_thinking: true } };
    const list = { findAllProviders: vi.fn().mockResolvedValue({ data: [provider] }) };
    const verifier = new VerifyIaProvidersUseCase(geminiServiceMock as GeminiService, list as never);
    for (const option of [true, false, undefined, 'true']) {
      vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({ authenticated: true, supported_options: { extended_thinking: option }, models: [{ id: 'opaque-live-id' }] });
      const [result] = await verifier.execute();
      expect(result.supports_thinking).toBe(option === true);
      expect(result.extended_thinking_enabled).toBe(option === true);
      expect(result.can_use_model).toBe(true);
    }
  });
  it('does not allow a configured model missing from discovery', async () => {
    const list = { findAllProviders: vi.fn().mockResolvedValue({ data: [{ id: '1', key: 'gemini', is_active: true, mode: 'web_session', fields: { selected_model: 'obsolete' } }] }) };
    const [result] = await new VerifyIaProvidersUseCase(geminiServiceMock as GeminiService, list as never).execute();
    expect(result.can_use_model).toBe(false);
    expect(result.error).toContain('no está en el catálogo descubierto');
  });
  it.each([false, true])('resolves only a unique exact discovered name (ambiguous=%s)', async (ambiguous) => {
    const list = { findAllProviders: vi.fn().mockResolvedValue({ data: [{ id: '1', key: 'gemini', is_active: true, mode: 'web_session', fields: { selected_model: 'reported-name' } }] }) };
    vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue({ authenticated: true, models: [
      { id: 'live-id', name: 'reported-name' }, ...(ambiguous ? [{ id: 'other-id', name: 'reported-name' }] : []),
    ] });
    const [result] = await new VerifyIaProvidersUseCase(geminiServiceMock as GeminiService, list as never).execute();
    expect(result.can_use_model).toBe(!ambiguous);
    if (!ambiguous) expect(result.default_model).toBe('live-id');
  });
  it('propagates discovery failure instead of presenting an empty successful verification', async () => {
    const list = { findAllProviders: vi.fn().mockRejectedValue(new Error('DB unavailable')) };
    await expect(new VerifyIaProvidersUseCase(geminiServiceMock as GeminiService, list as never).execute()).rejects.toMatchObject({ status: 502 });
  });

});
