import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSelectableModelsUseCase } from './get-selectable-models.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import { AiConnectionMode, AiKeyHealthState } from '../types/ai-provider.types.js';

describe('GetSelectableModelsUseCase', () => {
  let useCase: GetSelectableModelsUseCase;
  let aiProviderServiceMock: Partial<AiProviderService>;
  let geminiServiceMock: Partial<GeminiService>;

  beforeEach(() => {
    aiProviderServiceMock = {
      findAllProviders: vi.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            key: 'gemini',
            is_active: true,
            mode: AiConnectionMode.WEB_SESSION,
            fields: { model: 'gemini-flash' },
            api_keys: [
              {
                id: 'k1',
                label: 'Primary Gemini Key',
                display_hint: '...a1b2',
                health_state: AiKeyHealthState.VALID,
                is_selected: true,
                is_active: true,
                cooldown_until: null,
                last_success_at: new Date('2026-09-25T10:00:00Z'),
                last_error_at: null,
                last_error_code: null,
              },
            ],
          },
          {
            id: '2',
            key: 'mistral',
            is_active: true,
            mode: AiConnectionMode.API_KEY,
            fields: {
              selected_model: 'mistral-large-latest',
              ocr_model: 'mistral-ocr-latest',
              available_models: [
                {
                  id: 'mistral-large-latest',
                  name: 'mistral-large-latest',
                  displayName: 'Mistral Large',
                  description: 'Modelo de razonamiento',
                  capabilities: ['text', 'json'],
                  isRecommended: true,
                },
              ],
            },
            api_keys: [
              {
                id: 'k2',
                label: 'Mistral Prod Key',
                display_hint: '...c3d4',
                health_state: AiKeyHealthState.COOLDOWN,
                is_selected: true,
                is_active: true,
                cooldown_until: new Date('2026-09-26T05:00:00Z'),
                last_success_at: null,
                last_error_at: new Date('2026-09-26T02:00:00Z'),
                last_error_code: '429',
              },
            ],
          },
        ],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      }),
    };

    geminiServiceMock = {
      getModelsAndQuota: vi.fn().mockResolvedValue({
        authenticated: true,
        tier: 'PRO',
        plan_label: 'Google One AI Premium (Gemini Advanced)',
        active_model: 'gemini-flash',
        models: [
          {
            id: 'gemini-flash',
            name: 'gemini-flash',
            display_name: '3.8 Flash',
            description: 'Asistencia general rápida',
            capabilities: ['text', 'vision', 'documents'],
            context_window: 1000000,
            remaining_credits: 48263,
            total_credits: 48384,
            usage_percentage: 0,
            reset_time: 1790408828,
          },
          {
            id: 'gemini-pro',
            name: 'gemini-pro',
            display_name: '3.1 Pro',
            description: 'Razonamiento avanzado',
            capabilities: ['text', 'vision', 'documents', 'deep_research'],
            context_window: 2000000,
            remaining_credits: 48262,
            total_credits: 48384,
            usage_percentage: 0,
            reset_time: 1790408828,
          },
        ],
        usage_info: {
          current_5h: {
            window: '5h',
            remaining_credits: 2400,
            usage_percentage: 0,
            reset_at: '2026-09-26T04:47:08-03:00',
          },
          weekly: {
            window: 'weekly',
            remaining_credits: 48263,
            usage_percentage: 0,
            reset_at: '2026-09-28T19:47:08-03:00',
          },
        },
      }),
    };

    useCase = new GetSelectableModelsUseCase(
      aiProviderServiceMock as AiProviderService,
      geminiServiceMock as GeminiService,
    );
  });

  it('returns all providers and their selectable models with remaining tokens and plan info', async () => {
    const results = await useCase.execute({});

    expect(results).toHaveLength(2);

    // Check Gemini Web Session (token plan)
    const geminiWeb = results.find(
      (r) => r.provider === 'gemini' && r.mode === AiConnectionMode.WEB_SESSION,
    );
    expect(geminiWeb).toBeDefined();
    expect(geminiWeb?.planType).toBe('token_plan');
    expect(geminiWeb?.tokenPlan?.tier).toBe('PRO');
    expect(geminiWeb?.tokenPlan?.authenticated).toBe(true);
    expect(geminiWeb?.tokenPlan?.remainingCredits).toBe(48263);
    expect(geminiWeb?.models).toHaveLength(2);
    expect(geminiWeb?.models[0].id).toBe('gemini-flash');
    expect(geminiWeb?.models[0].remainingTokens).toBe('48263 créditos');

    // Check Mistral API Key (cooldown test)
    const mistralApi = results.find((r) => r.provider === 'mistral');
    expect(mistralApi).toBeDefined();
    expect(mistralApi?.planType).toBe('api_key');
    expect(mistralApi?.apiKeyPlan?.selectedKey?.healthState).toBe(AiKeyHealthState.COOLDOWN);
    expect(mistralApi?.models[0].remainingTokens).toContain('En enfriamiento');
  });

  it('filters by provider correctly', async () => {
    const results = await useCase.execute({ provider: 'mistral' });

    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe('mistral');
  });

  it('filters by mode correctly', async () => {
    const results = await useCase.execute({ mode: AiConnectionMode.WEB_SESSION });

    expect(results).toHaveLength(1);
    expect(results[0].mode).toBe(AiConnectionMode.WEB_SESSION);
    expect(results[0].planType).toBe('token_plan');
  });

  it('returns empty array when no providers are configured in the database', async () => {
    (aiProviderServiceMock.findAllProviders as any).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    const results = await useCase.execute({});

    expect(results).toHaveLength(0);
  });
});
