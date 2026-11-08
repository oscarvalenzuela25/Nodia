import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ProviderCard from '../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderCard/ProviderCard';
import i18n from '../../../../../../../translate';
import { AiConnectionMode, type AiProviderHealthItem, type GeminiAgenticStatus } from '../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types';

const { useEngines } = vi.hoisted(() => ({ useEngines: vi.fn() }));
vi.mock('../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useServices', () => ({
  useGeminiEngines: useEngines,
  useUpdateAiProvider: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
const provider: AiProviderHealthItem = { id: '1', key: 'gemini', name: 'Gemini Agentic', isActive: true,
  use_agentic: true, mode: AiConnectionMode.AGENTIC, status: 'healthy', statusBadge: 'Autenticada',
  serviceState: 'Sesión Agentic', lastCheck: null, latencyMs: null, hasConnection: true };
const status: GeminiAgenticStatus = { active_engine: "agentic", agentic: { engine: "agentic", available: true, authenticated: true }, };

describe('ProviderCard observed status', () => {
  beforeEach(() => useEngines.mockReturnValue({ data: status }));
  it('does not show a fake relative check time or unknown quota percentage', () => {
    render(<ProviderCard provider={{ ...provider, lastCheck: 'Hace 1 min' }} />);
    expect(screen.getByText('Sin comprobación verificada')).toBeInTheDocument();
    expect(screen.queryByText('Hace 1 min')).not.toBeInTheDocument();
    expect(screen.queryByText('Extracción & Multi-modal')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
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
      expect(screen.queryByText('SIN VERIFICAR')).not.toBeInTheDocument();

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
      expect(screen.queryByText('DESACTIVADO')).not.toBeInTheDocument();
      expect(screen.getByText('Proveedor desactivado')).toBeInTheDocument();
    });
    it('keeps the status chip when a token plan is enabled alongside API', async () => {
      await i18n.changeLanguage('es');
      render(<ProviderCard provider={{...apiProvider, use_agentic:true,
        codexSession:{available:true,authenticated:true,planType:null,checkedAt:null,reason:null,quotas:null,lastInferenceAt:null,usageAllowed:null}}} />);
      expect(screen.getByText('Disponible')).toBeInTheDocument();
      expect(screen.queryByText('SIN VERIFICAR')).not.toBeInTheDocument();
    });
    it('does not borrow API health when a subscription observation is absent', async () => {
      await i18n.changeLanguage('es');
      render(<ProviderCard provider={{...apiProvider, use_agentic:true, status:'healthy',statusBadge:'API HEALTH'}} />);
      expect(screen.getByText('Sin verificar')).toBeInTheDocument();
      expect(screen.queryByText('API HEALTH')).not.toBeInTheDocument();
    });

    it('falls into empty card only when provider has no connection channels configured', async () => {
      await i18n.changeLanguage('es');
      const unconfiguredProvider: AiProviderHealthItem = {
        id: '3',
        key: 'custom-ai',
        name: 'Custom AI',
        isActive: true,
        use_api_key: false,
        use_agentic: false,
        status: 'unconfigured',
        statusBadge: 'SIN CONFIGURAR',
        serviceState: 'Sin integración de sesión verificada',
        lastCheck: null,
        latencyMs: null,
        hasConnection: false,
        mode: null,
      };

      render(<ProviderCard provider={unconfiguredProvider} />);
      expect(screen.queryByText('SIN CONFIGURAR')).not.toBeInTheDocument();
      expect(screen.getByText(/Configura un modo disponible/i)).toBeInTheDocument();
    });
  });
});
