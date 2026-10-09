import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnalysisConsole from '../../../../../modules/business/components/AnalysisConsole';
import type { ConsoleView } from '../../../../../modules/business/components/AnalysisConsole/types';
const idle: ConsoleView = { phase: 'idle', startedAt: null, events: [], identity: null, observationError: false, gap: false,
  uploadPercent: null, correlation: null, isFetching: false, resume: vi.fn() };
describe('analysis console', () => {
  it('keeps an accessible empty region before the first analysis', () => {
    render(<AnalysisConsole view={idle} />);
    expect(screen.getByRole('region', { name: 'Actividad del análisis' })).toBeVisible();
    expect(screen.getByRole('log')).toHaveAttribute('aria-relevant', 'additions');
    expect(screen.getByText(/Carga una factura/)).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('retains events on observer failure and only resumes tracking', () => {
    const resume = vi.fn();
    render(<AnalysisConsole view={{ ...idle, phase: 'analyzing', observationError: true, resume,
      identity: { providerId: '42', provider: 'gemini', mode: 'token_plan_web', model: null },
      events: [{ key: '1', occurredAt: new Date().toISOString(), stage: 'provider_request_started', severity: 'info' }] }} />);
    expect(screen.getByText('Solicitud al proveedor iniciada')).toBeVisible();
    expect(screen.getByText(/Sin modelo asignado/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar seguimiento' }));
    expect(resume).toHaveBeenCalledOnce();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });
  it('reports uncertain result and event gaps without claiming that an invoice was saved', () => {
    render(<AnalysisConsole view={{ ...idle, phase: 'uncertain', gap: true }} />);
    expect(screen.getByText(/No se recibió el resultado/)).toBeVisible();
    expect(screen.getByText(/eventos anteriores/)).toBeVisible();
    expect(screen.queryByText(/guardada/)).not.toBeInTheDocument();
  });
  it('pauses autoscroll when inspecting earlier events and offers recent events', () => {
    render(<AnalysisConsole view={{ ...idle, phase: 'ready', events: [{ key: '1', occurredAt: new Date().toISOString(), stage: 'draft_ready', severity: 'info' }] }} />);
    const log = screen.getByRole('log');
    Object.defineProperties(log, { scrollHeight: { value: 1000 }, clientHeight: { value: 100 } });
    log.scrollTop = 10;
    fireEvent.scroll(log);
    fireEvent.click(screen.getByRole('button', { name: 'Ver eventos recientes' }));
    expect(log.scrollTop).toBe(1000);
    expect(screen.queryByRole('button', { name: 'Ver eventos recientes' })).not.toBeInTheDocument();
  });
});
