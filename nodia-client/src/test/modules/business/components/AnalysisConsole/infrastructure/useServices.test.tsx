import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { useAnalysisObservation } from '../../../../../../modules/business/components/AnalysisConsole/infrastructure/useServices';
import * as services from '../../../../../../modules/business/components/AnalysisConsole/infrastructure/services';
import { queryClient as configuredClient } from '../../../../../../config/reactQuery';
import { sileo } from 'sileo';
const auth = vi.hoisted(() => ({ user: { id: '42' }, token: 'synthetic-token', sessionVersion: 1, isSessionActive: true, isAuthenticated: true }));
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
  vi.clearAllMocks(); auth.isSessionActive = true; auth.isAuthenticated = true; auth.token = 'synthetic-token'; auth.sessionVersion = 1;
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
    act(() => transport.finish(new AxiosError('Response lost')));
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
    auth.isSessionActive = false; auth.isAuthenticated = false; auth.token = '';
    rerender({ business: id });
    expect(result.current.view.phase).toBe('idle');
  });
  it('keeps final extraction events while preparing a local draft', async () => {
    const { result } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    let transport!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { transport = await result.current.start(context); });
    await waitFor(() => expect(services.readObservation).toHaveBeenCalled());
    vi.mocked(services.readObservation).mockResolvedValue({ version: 1, id, state: 'succeeded', identity: null,
      events: [{ version: 1, sequence: 1, occurredAt: new Date().toISOString(), stage: 'extraction_validated', severity: 'info' }], lastSequence: 1, gap: false });
    act(() => { transport.preparing(); transport.emit('draft_ready'); transport.finish(); });
    await waitFor(() => expect(result.current.view.events.some(event => event.stage === 'extraction_validated')).toBe(true));
    expect(result.current.view.phase).toBe('ready');
  });
  it('pauses tracking during token renewal without aborting the principal', async () => {
    const { result, rerender } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    let transport!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { transport = await result.current.start(context); });
    auth.isSessionActive = false; auth.isAuthenticated = false;
    rerender();
    expect(transport.signal.aborted).toBe(false);
    expect(transport.isCurrent()).toBe(true);
    expect(result.current.view.phase).toBe('analyzing');
    expect(result.current.isBusy).toBe(true);
    auth.isSessionActive = true; auth.isAuthenticated = true;
    rerender();
    await waitFor(() => expect(services.readObservation).toHaveBeenCalled());
  });
  it('invalidates a replaced session for the same actor without resurrecting the old phase', async () => {
    const { result, rerender } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    let transport!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { transport = await result.current.start(context); });
    auth.sessionVersion++;
    rerender();
    expect(transport.signal.aborted).toBe(true);
    expect(transport.isCurrent()).toBe(false);
    act(() => { transport.preparing(); transport.finish(); });
    expect(result.current.view.phase).toBe('idle');
    expect(result.current.isBusy).toBe(false);
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
  it('cancels a pending reservation without dispatching analysis or reviving its late response', async () => {
    let resolve!: (value: { version: 1; id: string }) => void;
    vi.mocked(services.reserveObservation).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { result } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.start(context).catch(error => error); });
    expect(result.current.view.phase).toBe('reserving');
    expect(result.current.isBusy).toBe(true);
    await waitFor(() => expect(services.reserveObservation).toHaveBeenCalledOnce());
    const signal = vi.mocked(services.reserveObservation).mock.calls[0][1];
    act(() => { expect(result.current.cancel()).toBe(true); });
    expect(signal.aborted).toBe(true);
    expect(result.current.isBusy).toBe(false);
    expect(result.current.view.phase).toBe('cancelled');
    await act(async () => { resolve({ version: 1, id }); await pending; });
    expect(result.current.view.phase).toBe('cancelled');
    expect(services.readObservation).not.toHaveBeenCalled();
    expect(sileo.success).not.toHaveBeenCalled();
  });
  it('invalidates old callbacks after cancellation without releasing a newly started execution', async () => {
    const { result } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    let first!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { first = await result.current.start(context); });
    act(() => { expect(result.current.cancel()).toBe(true); expect(result.current.cancel()).toBe(false); });
    expect(first.signal.aborted).toBe(true);
    let second!: Awaited<ReturnType<typeof result.current.start>>;
    vi.mocked(services.reserveObservation).mockResolvedValueOnce({ version: 1, id: '584130cd-e5f8-4474-9311-6e4fc41ce625' });
    vi.mocked(services.readObservation).mockImplementation(async requestedId => ({ version: 1, id: requestedId, state: 'running', identity: null, events: [], lastSequence: 0, gap: false }));
    await act(async () => { second = await result.current.start(context); });
    act(() => { first.emit('draft_ready'); first.preparing(); first.finish(); first.onUploadProgress({ loaded: 100, total: 100 } as Parameters<typeof first.onUploadProgress>[0]); });
    expect(result.current.view.phase).toBe('analyzing');
    expect(result.current.isBusy).toBe(true);
    expect(result.current.view.events.some(event => event.stage === 'draft_ready')).toBe(false);
    expect(result.current.view.uploadPercent).toBeNull();
    expect(second.isCurrent()).toBe(true);
    expect(services.reserveObservation).toHaveBeenCalledTimes(2);
    await expect(result.current.start(context)).rejects.toThrow('Analysis unavailable');
    expect(services.reserveObservation).toHaveBeenCalledTimes(2);
  });
  it('keeps preparation busy and cancelable after the principal HTTP request has finished', async () => {
    const { result } = renderHook(() => useAnalysisObservation(context.business_id), { wrapper: wrapper() });
    let transport!: Awaited<ReturnType<typeof result.current.start>>;
    await act(async () => { transport = await result.current.start(context); });
    act(() => { transport.preparing(); transport.emit('history_loading'); });
    expect(result.current.isBusy).toBe(true);
    expect(result.current.view.phase).toBe('preparing');
    act(() => { result.current.cancel(); });
    expect(result.current.isBusy).toBe(false);
    expect(result.current.view.events.some(event => event.stage === 'history_loading')).toBe(true);
    act(() => { transport.finish(); });
    expect(result.current.view.phase).toBe('cancelled');
  });
});
