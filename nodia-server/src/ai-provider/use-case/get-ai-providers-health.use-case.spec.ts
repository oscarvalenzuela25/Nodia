import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAiProvidersHealthUseCase } from './get-ai-providers-health.use-case.js';
import type { AiProviderService } from '../ai-provider.service.js';
import type { GeminiService } from '../../common/ai/gemini.service.js';
import {
  AiConnectionMode,
  AiKeyHealthState,
} from '../types/ai-provider.types.js';

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
            is_default: true,
            mode: AiConnectionMode.WEB_SESSION,
            use_token_plan_web: true,
            fields: { selected_model: 'gemini-flash' },
            api_keys: [],
          },
          {
            id: '2',
            key: 'mistral',
            is_active: true,
            is_default: false,
            mode: AiConnectionMode.API_KEY,
            use_api_key: true,
            auto_rotate_api_keys: true,
            fields: {
              ocr_model: 'mistral-ocr-v1',
              selected_model: 'mistral-large-latest',
            },
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
    expect(geminiHealth?.is_default).toBe(true);

    const incidentAlert = result.alerts.find((a) => a.provider === 'gemini');
    expect(incidentAlert).toBeDefined();
    expect(incidentAlert?.title).toContain('INCIDENTE ACTIVO');
    expect(incidentAlert?.title).toContain('SESIÓN WEB');
    expect(incidentAlert?.actionType).toBe('renew_session');
  });

  it('does not claim API key availability, failover or latency from saved key health', async () => {
    const result = await useCase.execute();

    const mistralHealth = result.providers.find((p) => p.key === 'mistral');
    expect(mistralHealth?.status).toBe('unconfigured');
    expect(mistralHealth?.latencyMs).toBeNull();
    expect(mistralHealth?.lastCheck).toBeNull();
    expect(mistralHealth?.serviceState).toBe('Sin integración de sesión verificada');

    const failoverAlert = result.alerts.find((a) => a.provider === 'mistral' && a.type === 'failover');
    expect(failoverAlert).toBeUndefined();
  });

  it('reports a real healthy Web session while legacy API integration stays unverified', async () => {
    (geminiServiceMock.getModelsAndQuota as any).mockResolvedValue({
      authenticated: true,
    });
    (aiProviderServiceMock.findAllProviders as any).mockResolvedValue({
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          use_token_plan_web: true,
          mode: AiConnectionMode.WEB_SESSION,
          api_keys: [],
        },
        {
          id: '2',
          key: 'mistral',
          is_active: true,
          use_api_key: true,
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
    expect(result.overallStatus).toBe('degraded');
    expect(result.summary.healthyProviders).toBe(1);
    expect(result.alerts).toHaveLength(1);
  });

  it('detects unavailable agentic session and generates agentic incident alert', async () => {
    (geminiServiceMock.getModelsAndQuota as any).mockResolvedValue({
      authenticated: false,
      available: false,
    });
    (aiProviderServiceMock.findAllProviders as any).mockResolvedValue({
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          use_token_plan_agentic: true,
          use_token_plan_web: false,
          use_api_key: false,
          fields: { selected_model: 'gemini-3.1-pro' },
          api_keys: [],
        },
      ],
    });

    const result = await useCase.execute();
    expect(result.overallStatus).toBe('incident');
    const geminiHealth = result.providers.find((p) => p.key === 'gemini');
    expect(geminiHealth?.status).toBe('expired');

    const agenticAlert = result.alerts.find(
      (a) => a.provider === 'gemini' && a.id.includes('agentic'),
    );
    expect(agenticAlert).toBeDefined();
    expect(agenticAlert?.title).toContain('MODO AGÉNTICO');
    expect(agenticAlert?.message).toContain('Antigravity');
    expect(agenticAlert?.actionType).toBe('configure');
  });

  it('reports degraded when dual mode has one working and one failing engine', async () => {
    (geminiServiceMock.getModelsAndQuota as any).mockImplementation(
      (engine: string) => {
        if (engine === 'agentic') {
          return Promise.resolve({
            authenticated: true,
            available: true,
            has_active_session: true,
          });
        }
        return Promise.resolve({ authenticated: false });
      },
    );

    (aiProviderServiceMock.findAllProviders as any).mockResolvedValue({
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          use_token_plan_agentic: true,
          use_token_plan_web: true,
          use_api_key: false,
          fields: {},
          api_keys: [],
        },
      ],
    });

    const result = await useCase.execute();
    const geminiHealth = result.providers.find((p) => p.key === 'gemini');
    expect(geminiHealth?.status).toBe('degraded');
    expect(geminiHealth?.statusBadge).toBe('DEGRADADO');
    expect(geminiHealth?.serviceState).toContain('Sesión Web inactiva');

    const webAlert = result.alerts.find(
      (a) => a.provider === 'gemini' && a.id.includes('web'),
    );
    expect(webAlert).toBeDefined();
  });

  it('generates warning alert when provider is active but has no connection modes enabled', async () => {
    (aiProviderServiceMock.findAllProviders as any).mockResolvedValue({
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          use_token_plan_agentic: false,
          use_token_plan_web: false,
          use_api_key: false,
          api_keys: [],
        },
      ],
    });

    const result = await useCase.execute();
    const geminiHealth = result.providers.find((p) => p.key === 'gemini');
    expect(geminiHealth?.status).toBe('unconfigured');
    expect(geminiHealth?.statusBadge).toBe('SIN CONFIGURAR');

    const unconfiguredAlert = result.alerts.find(
      (a) => a.provider === 'gemini' && a.id.includes('no-modes'),
    );
    expect(unconfiguredAlert).toBeDefined();
    expect(unconfiguredAlert?.severity).toBe('warning');
  });

  it('detects unauthenticated web session via getDualEngineStatus and generates web incident alert', async () => {
    geminiServiceMock.getDualEngineStatus = vi.fn().mockResolvedValue({
      active_engine: 'agentic',
      agentic: { available: true, authenticated: true },
      web: { authenticated: false },
    });
    (aiProviderServiceMock.findAllProviders as any).mockResolvedValue({
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          use_token_plan_agentic: true,
          use_token_plan_web: true,
          use_api_key: false,
          fields: {},
          api_keys: [],
        },
      ],
    });

    const result = await useCase.execute();
    const geminiHealth = result.providers.find((p) => p.key === 'gemini');
    expect(geminiHealth?.status).toBe('degraded');
    expect(geminiHealth?.statusBadge).toBe('DEGRADADO');
    expect(geminiHealth?.serviceState).toContain('Sesión Web inactiva');

    const webAlert = result.alerts.find(
      (a) => a.provider === 'gemini' && a.id.includes('web-expired'),
    );
    expect(webAlert).toBeDefined();
    expect(webAlert?.actionType).toBe('renew_session');
  });

  it.each([true, false])(
    'does not mark an agentic adapter without a session healthy (dual status=%s)',
    async (dual) => {
      vi.mocked(aiProviderServiceMock.findAllProviders!).mockResolvedValue({
        data: [
          {
            id: '1',
            key: 'gemini',
            is_active: true,
            use_token_plan_agentic: true,
            fields: {},
          },
        ],
        meta: { page: 1, limit: 1, total_items: 1, total_pages: 1 },
      });
      const agentic = {
        available: true,
        authenticated: false,
        has_active_session: false,
      };
      if (dual) {
        geminiServiceMock.getDualEngineStatus = vi
          .fn()
          .mockResolvedValue({ active_engine: 'agentic', agentic, web: {} });
      } else {
        vi.mocked(geminiServiceMock.getModelsAndQuota!).mockResolvedValue(
          agentic,
        );
      }
      const result = await useCase.execute();
      expect(result.providers[0].status).not.toBe('healthy');
      expect(
        result.alerts.some((alert) => alert.id.includes('agentic-unavailable')),
      ).toBe(true);
    },
  );

  it('preserves scoped unknown models without assigning the first model or invented capabilities', async () => {
    vi.mocked(aiProviderServiceMock.findAllProviders!).mockResolvedValue({
      data: [
        {
          id: '1',
          key: 'gemini',
          is_active: true,
          use_token_plan_web: true,
          default_mode: 'token_plan_web',
          fields: {
            selected_model: 'other-mode-model',
            available_models: [{ id: 'other-mode-model' }],
            token_plan_web: { available_models: [{ id: 'discovered-flash' }] },
          },
        },
      ],
      meta: { page: 1, limit: 1, total_items: 1, total_pages: 1 },
    });
    const result = await useCase.execute();
    expect(result.providers[0].selectedModel).toBe('');
    expect(result.providers[0].availableModels?.[0]).toMatchObject({
      id: 'discovered-flash',
      contextWindow: null,
      capabilities: [],
      isRecommended: false,
    });
    expect(result.providers[0].availableModels?.[0]).not.toHaveProperty('role');
  });
});
