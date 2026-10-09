import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { useAnalysisObservation } from '../../../../../../modules/business/components/AnalysisConsole/infrastructure/useServices';
import * as services from '../../../../../../modules/business/components/AnalysisConsole/infrastructure/services';
import { queryClient as configuredClient } from '../../../../../../config/reactQuery';
import { sileo } from 'sileo';
const auth = vi.hoisted(() => ({ user: { id: '42' }, isSessionActive: true, isAuthenticated: true }));
vi.mock('../../../../../../hooks/useAuth', () => ({ default: () => auth }));
vi.mock('sileo', () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../../../../modules/business/components/AnalysisConsole/infrastructure/services', () => ({ reserveObservation: vi.fn(), readObservation: vi.fn() }));
const id = '9601aa95-dd70-4af3-a5cf-50dd553a4ae9';
const context = { business_id: id, ai_provider_id: '42', mode: 'api_key' as const };
const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
beforeEach(() => {
  vi.clearAllMocks(); auth.isSessionActive = true; auth.isAuthenticated = true;
  vi.mocked(services.reserveObservation).mockResolvedValue({ version: 1, id });
  vi.mocked(services.readObservation).mockResolvedValue({ version: 1, id, state: 'running', identity: null, events: [], lastSequence: 0, gap: false });
});
describe('analysis observation lifecycle', () => {
  it('does not fetch before reservation and aborts the principal on unmount', async () => {
    const { result, unmount } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    expect(services.readObservation).not.toHaveBeenCalled();
    let transport!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { transport = await result.current.start(context); });
    await waitFor(() => expect(services.readObservation).toHaveBeenCalled());
    expect(transport.isCurrent()).toBe(true);
    unmount();
    expect(transport.signal.aborted).toBe(true);
    expect(transport.isCurrent()).toBe(false);
  });
  it('keeps observer failure separate from the principal and never reserves/replays on resume', async () => {
    vi.mocked(services.readObservation).mockRejectedValue(new AxiosError('Unavailable'));
    const { result } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    let transport!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { transport = await result.current.start(context); });
    await waitFor(() => expect(result.current.view.observationError).toBe(true));
    expect(transport.signal.aborted).toBe(false);
    act(() => result.current.view.resume());
    await waitFor(() => expect(services.readObservation).toHaveBeenCalledTimes(2));
    expect(services.reserveObservation).toHaveBeenCalledOnce();
    act(() => result.current.finish(new AxiosError('Response lost')));
    expect(result.current.view.phase).toBe('uncertain');
  });
  it('invalidates late responses when context or session changes', async () => {
    const { result, rerender } = renderHook(({ business }) => useAnalysisObservation(business), { initialProps: { business: id }, wrapper: wrapper() });
    let transport!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { transport = await result.current.start(context); });
    rerender({ business: 'other-business' });
    expect(transport.signal.aborted).toBe(true);
    expect(transport.isCurrent()).toBe(false);
    expect(result.current.view.events).toEqual([]);
    auth.isSessionActive = false; auth.isAuthenticated = false;
    rerender({ business: id });
    expect(result.current.view.phase).toBe('idle');
  });
  it('keeps final extraction events while preparing a local draft', async () => {
    const { result } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    await act(async () => { await result.current.start(context); });
    await waitFor(() => expect(services.readObservation).toHaveBeenCalled());
    vi.mocked(services.readObservation).mockResolvedValue({ version: 1, id, state: 'succeeded', identity: null,
      events: [{ version: 1, sequence: 1, occurredAt: new Date().toISOString(), stage: 'extraction_validated', severity: 'info' }], lastSequence: 1, gap: false });
    act(() => { result.current.preparing(); result.current.emit('draft_ready'); result.current.finish(); });
    await waitFor(() => expect(result.current.view.events.some(event => event.stage === 'extraction_validated')).toBe(true));
    expect(result.current.view.phase).toBe('ready');
  });
  it('pauses tracking during token renewal without aborting the principal', async () => {
    const { result, rerender } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    let transport!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { transport = await result.current.start(context); });
    auth.isSessionActive = false;
    rerender();
    expect(transport.signal.aborted).toBe(false);
    expect(transport.isCurrent()).toBe(true);
    expect(result.current.view.phase).toBe('analyzing');
    auth.isSessionActive = true;
    rerender();
    await waitFor(() => expect(services.readObservation).toHaveBeenCalled());
  });
  it('emits one outage toast with the actual global cache, even after observer refetch fails again', async () => {
    configuredClient.clear();
    vi.mocked(services.readObservation).mockImplementation(async () => { throw new AxiosError('Observer unavailable'); });
    const { result, unmount } = renderHook(() => useAnalysisObservation(context.business_id), {
      wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={configuredClient}>{children}</QueryClientProvider>,
    });
    await act(async () => { await result.current.start(context); });
    await waitFor(() => expect(sileo.error).toHaveBeenCalledOnce());
    act(() => result.current.view.resume());
    await waitFor(() => expect(services.readObservation).toHaveBeenCalledTimes(2));
    expect(sileo.error).toHaveBeenCalledOnce();
    unmount(); configuredClient.clear();
  });
});
