import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAiProvidersHealthUseCase } from './get-ai-providers-health.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import { AiConnectionMode, AiKeyHealthState } from '../types/ai-provider.types.js';

describe('GetAiProvidersHealthUseCase', () => {
  let useCase: GetAiProvidersHealthUseCase;
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
            fields: { selected_model: 'gemini-flash' },
            api_keys: [],
          },
          {
            id: '2',
            key: 'mistral',
            is_active: true,
            mode: AiConnectionMode.API_KEY,
            auto_rotate_api_keys: true,
            fields: { ocr_model: 'mistral-ocr-v1', selected_model: 'mistral-large-latest' },
            api_keys: [
              {
                id: 'k1',
                label: 'mistral-prod-primary',
                health_state: AiKeyHealthState.COOLDOWN,
                is_active: true,
              },
              {
                id: 'k2',
                label: 'mistral-prod-sec',
                health_state: AiKeyHealthState.VALID,
                is_active: true,
              },
            ],
          },
        ],
      }),
    };

    geminiServiceMock = {
      getModelsAndQuota: vi.fn().mockResolvedValue({
        authenticated: false,
      }),
    };

    useCase = new GetAiProvidersHealthUseCase(
      aiProviderServiceMock as AiProviderService,
      geminiServiceMock as GeminiService,
    );
  });

  it('detects unauthenticated web session and generates incident alert', async () => {
    const result = await useCase.execute();

    expect(result.overallStatus).toBe('incident');
    expect(result.providers).toHaveLength(2);

    const geminiHealth = result.providers.find((p) => p.key === 'gemini');
    expect(geminiHealth?.status).toBe('expired');
    expect(geminiHealth?.statusBadge).toBe('REQUIERE INICIAR SESIÓN');

    const incidentAlert = result.alerts.find((a) => a.provider === 'gemini');
    expect(incidentAlert).toBeDefined();
    expect(incidentAlert?.title).toContain('INCIDENTE ACTIVO');
    expect(incidentAlert?.actionType).toBe('renew_session');
  });

  it('detects API key cooldown failover and generates failover alert', async () => {
    const result = await useCase.execute();

    const mistralHealth = result.providers.find((p) => p.key === 'mistral');
    expect(mistralHealth?.status).toBe('healthy');
    expect(mistralHealth?.serviceState).toBe('1/2 Keys Válidas');

    const failoverAlert = result.alerts.find((a) => a.provider === 'mistral');
    expect(failoverAlert).toBeDefined();
    expect(failoverAlert?.title).toContain('FAILOVER OPERATIVO');
    expect(failoverAlert?.actionType).toBe('manage_quotas');
  });

  it('reports healthy when web session is authenticated and api keys are valid', async () => {
    (geminiServiceMock.getModelsAndQuota as any).mockResolvedValue({
      authenticated: true,
    });
    (aiProviderServiceMock.findAllProviders as any).mockResolvedValue({
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          mode: AiConnectionMode.WEB_SESSION,
          api_keys: [],
        },
        {
          id: '2',
          key: 'mistral',
          is_active: true,
          mode: AiConnectionMode.API_KEY,
          fields: {},
          api_keys: [
            {
              id: 'k1',
              label: 'mistral-primary',
              health_state: AiKeyHealthState.VALID,
              is_active: true,
            },
          ],
        },
      ],
    });

    const result = await useCase.execute();
    expect(result.overallStatus).toBe('healthy');
    expect(result.alerts).toHaveLength(0);
  });
});
