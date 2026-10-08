import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ProviderCard from '../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderCard/ProviderCard';
import i18n from '../../../../../../../translate';
import { AiConnectionMode, type AiProviderHealthItem, type GeminiDualEngineStatus } from '../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types';

const { useEngines } = vi.hoisted(() => ({ useEngines: vi.fn() }));
vi.mock('../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useServices', () => ({
  useGeminiEngines: useEngines,
  useUpdateAiProvider: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
const provider: AiProviderHealthItem = { id: '1', key: 'gemini', name: 'Gemini Web', isActive: true,
  use_token_plan_web: true, mode: AiConnectionMode.WEB_SESSION, status: 'healthy', statusBadge: 'Autenticada',
  serviceState: 'Sesión Web', lastCheck: null, latencyMs: null, hasConnection: true };
const status: GeminiDualEngineStatus = { active_engine: 'web', web: { engine: 'web', available: true, authenticated: true },
  agentic: { engine: 'agentic', available: false, authenticated: false } };

describe('ProviderCard observed status', () => {
  beforeEach(() => useEngines.mockReturnValue({ data: status }));
  it('does not show a fake relative check time or unknown quota percentage', () => {
    render(<ProviderCard provider={{ ...provider, lastCheck: 'Hace 1 min' }} />);
    expect(screen.getByText('Sin comprobación verificada')).toBeInTheDocument();
    expect(screen.queryByText('Hace 1 min')).not.toBeInTheDocument();
    expect(screen.queryByText('Extracción & Multi-modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('shows genuine Web usage without a fixed Flash/Pro model label', () => {
    useEngines.mockReturnValue({ data: { ...status, web: { ...status.web, quota_source: 'web', quota_observed_at: Date.now() / 1000,
      quota: { 'real-bucket': { usage_percentage: 0, remaining: 0, total: 0 } } } } });
    render(<ProviderCard provider={provider} />);
    expect(screen.getByText(/Uso Web reportado \(real-bucket\): 0%/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByText('Flash:')).not.toBeInTheDocument();
  });
  it('does not trust a quota without source and observation time', () => {
    useEngines.mockReturnValue({ data: { ...status, web: { ...status.web, quota: { flash: { usage_percentage: 70 } } } } });
    render(<ProviderCard provider={provider} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('70%')).not.toBeInTheDocument();
  });
  it.each([
    ['es', 'Uso Web reportado', ['Gemini Flash', 'Gemini Pro', 'Quota 5h', 'Quota semanal']],
    ['en', 'Reported Web usage', ['Gemini Flash', 'Gemini Pro', '5h quota', 'Weekly quota']],
  ] as const)('translates known quota IDs in the %s summary and preserves unknown IDs and real zeros', async (language, prefix, labels) => {
    await i18n.changeLanguage(language);
    useEngines.mockReturnValue({ data: { ...status, web: { ...status.web, quota_source: 'web', quota_observed_at: Date.now() / 1000,
      quota: Object.fromEntries(['None-11', 'None-4', 'current_5h', 'weekly', 'future-bucket'].map(id => [id, { usage_percentage: 0, remaining: null, total: null }])) } } });
    render(<ProviderCard provider={provider} />);
    for (const label of [...labels, 'future-bucket']) {
      expect(screen.getByText(`${prefix} (${label}): 0%`)).toBeInTheDocument();
    }
    for (const id of ['None-11', 'None-4', 'current_5h', 'weekly']) {
      expect(screen.queryByText(`${prefix} (${id}): 0%`)).not.toBeInTheDocument();
    }
    for (const bar of screen.getAllByRole('progressbar')) expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  describe('API connection summary card (OpenAI / Gemini API)', () => {
    const apiProvider: AiProviderHealthItem = {
      id: '2',
      key: 'openai',
      name: 'ChatGPT / OpenAI',
      isActive: true,
      is_default: true,
      use_api_key: true,
      mode: AiConnectionMode.API_KEY,
      default_mode: 'api_key',
      auto_rotate_api_keys: true,
      status: 'unverified',
      statusBadge: 'SIN VERIFICAR',
      serviceState: 'API configurada; inferencia sin verificar',
      lastCheck: null,
      latencyMs: null,
      hasConnection: true,
      selectedModel: 'gpt-4o',
      assignedModels: { ocr: 'gpt-4o-mini', infer: 'gpt-4o' },
      apiKeysCount: 2,
      validKeysCount: 2,
      selectedApiKey: {
        id: 'k1',
        label: 'Production Key',
        display_hint: 'sk-...4321',
        is_active: true,
      },
      fields: {
        api_key: {
          selected_model: 'gpt-4o',
          ocr_model: 'gpt-4o-mini',
          thinking_level: 'high',
        },
      },
    };

    it('renders API connection header, unverified check and structured API panel', async () => {
      await i18n.changeLanguage('es');
      render(<ProviderCard provider={apiProvider} totalProviders={2} />);

      // Header
      expect(screen.getByText('ChatGPT / OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Canal configurado: API Key')).toBeInTheDocument();
      expect(screen.getByText('Predeterminado')).toBeInTheDocument();
      expect(screen.getByText('SIN VERIFICAR')).toBeInTheDocument();

      // Service State & Last Check
      expect(screen.getByText('API configurada; inferencia sin verificar')).toBeInTheDocument();
      expect(screen.getByText('Sin comprobación verificada')).toBeInTheDocument();

      // API Panel
      expect(screen.getByText('Conexión API (API Key)')).toBeInTheDocument();
      expect(screen.getByText('Configurada')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('Production Key')).toBeInTheDocument();
      expect(screen.getByText('sk-...4321')).toBeInTheDocument();
      expect(screen.getByText('2 claves')).toBeInTheDocument();
      expect(screen.getByText('Habilitada')).toBeInTheDocument();

      // Actions
      expect(screen.getByRole('button', { name: /Ir al detalle/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Configurar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Modelos/i })).toBeInTheDocument();
    });

    it('distinguishes missing key and model without falling into the empty unconfigured card', async () => {
      await i18n.changeLanguage('es');
      const incompleteProvider: AiProviderHealthItem = {
        ...apiProvider,
        status: 'degraded',
        serviceState: 'Falta configurar clave API y modelo',
        selectedModel: '',
        selectedApiKey: null,
        apiKeysCount: 0,
        fields: { api_key: {} },
      };

      render(<ProviderCard provider={incompleteProvider} totalProviders={2} />);

      // Does not show empty unconfigured card text
      expect(screen.queryByText(/Configure una sesión Web o Agentic/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Configura un modo disponible/i)).not.toBeInTheDocument();

      // Renders API panel with incomplete badge and warning CTAs
      expect(screen.getByText('Incompleta')).toBeInTheDocument();
      expect(screen.getByText('Sin asignar')).toBeInTheDocument();
      expect(screen.getByText('Configurar modelo')).toBeInTheDocument();
      expect(screen.getByText('Sin clave seleccionada')).toBeInTheDocument();
      expect(screen.getByText('Configurar clave')).toBeInTheDocument();
      expect(screen.getByText('0 claves')).toBeInTheDocument();
    });

    it('displays deactivated status when provider isActive is false', async () => {
      await i18n.changeLanguage('es');
      const deactivatedProvider: AiProviderHealthItem = {
        ...apiProvider,
        isActive: false,
        statusBadge: 'DESACTIVADO',
        serviceState: 'Proveedor desactivado',
      };

      render(<ProviderCard provider={deactivatedProvider} totalProviders={2} />);
      expect(screen.getByText('DESACTIVADO')).toBeInTheDocument();
      expect(screen.getByText('Proveedor desactivado')).toBeInTheDocument();
    });

    it('falls into empty card only when provider has no connection channels configured', async () => {
      await i18n.changeLanguage('es');
      const unconfiguredProvider: AiProviderHealthItem = {
        id: '3',
        key: 'custom-ai',
        name: 'Custom AI',
        isActive: true,
        use_api_key: false,
        use_token_plan_web: false,
        use_token_plan_agentic: false,
        status: 'unconfigured',
        statusBadge: 'SIN CONFIGURAR',
        serviceState: 'Sin integración de sesión verificada',
        lastCheck: null,
        latencyMs: null,
        hasConnection: false,
        mode: null,
      };

      render(<ProviderCard provider={unconfiguredProvider} />);
      expect(screen.getByText('SIN CONFIGURAR')).toBeInTheDocument();
      expect(screen.getByText(/Configura un modo disponible/i)).toBeInTheDocument();
    });
  });
});
