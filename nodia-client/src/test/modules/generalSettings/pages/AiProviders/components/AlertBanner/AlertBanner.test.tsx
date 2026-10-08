import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../../../../../translate';
import AlertBanner from '../../../../../../../modules/generalSettings/pages/AiProviders/components/AlertBanner';
import type { AiProviderAlert } from '../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types';

const alert: AiProviderAlert = {
  id: 'synthetic', provider: 'gemini', providerName: 'Mi Gemini',
  reason: 'agentic_session_required', type: 'warning', severity: 'warning',
  title: 'Server fallback title', message: 'Server fallback message',
  actionType: 'authenticate_agentic', actionLabel: 'Server fallback action',
};

afterEach(async () => { await i18n.changeLanguage('es'); });

describe('AlertBanner recovery actions', () => {
  it('routes missing Agentic sessions to authentication only', async () => {
    const authenticate = vi.fn(), configure = vi.fn(), web = vi.fn();
    render(<AlertBanner alerts={[alert]} onAuthenticateAgentic={authenticate} onConfigure={configure} onRenewSession={web} />);
    await userEvent.click(screen.getByRole('button', { name: 'Autenticar sesión Agentic' }));
    expect(authenticate).toHaveBeenCalledOnce();
    expect(configure).not.toHaveBeenCalled();
    expect(web).not.toHaveBeenCalled();
    expect(screen.getByText('Sesión Agentic de Mi Gemini pendiente')).toBeInTheDocument();
  });

  it('rechecks adapter failures without editing a provider', async () => {
    const check = vi.fn(), configure = vi.fn();
    render(<AlertBanner alerts={[{ ...alert, reason: 'agentic_adapter_unavailable',
      type: 'incident', severity: 'error', actionType: 'check_status' }]} onCheckStatus={check} onConfigure={configure} />);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a comprobar' }));
    expect(check).toHaveBeenCalledOnce();
    expect(configure).not.toHaveBeenCalled();
    expect(screen.getByText('Agentic de Mi Gemini no disponible')).toBeInTheDocument();
  });

  it('does not show a button without an implemented recovery handler', () => {
    render(<AlertBanner alerts={[alert]} onConfigure={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables the recovery action during a request', () => {
    const authenticate = vi.fn();
    render(<AlertBanner alerts={[alert]} onAuthenticateAgentic={authenticate} disabled />);
    const button = screen.getByRole('button', { name: 'Autenticar sesión Agentic' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('translates the observed state and action into English', async () => {
    await i18n.changeLanguage('en');
    render(<AlertBanner alerts={[alert]} onAuthenticateAgentic={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Authenticate Agentic session' })).toBeInTheDocument();
    expect(screen.getByText('Agentic session for Mi Gemini pending')).toBeInTheDocument();
    expect(screen.queryByText('Server fallback message')).not.toBeInTheDocument();
  });
});
