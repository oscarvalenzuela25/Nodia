import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ProviderCard from '../../../../../../../modules/generalSettings/pages/AiProviders/components/ProviderCard/ProviderCard';
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
});
