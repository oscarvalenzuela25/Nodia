import { useState, type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeacherSessions } from '../../../../modules/teacher/infrastructure/useServices';

const stub = vi.hoisted(() => ({
  actor: { user: { id: 'fixture-actor' }, sessionVersion: 1, sessionStatus: 'authenticated' },
  read: vi.fn(), send: vi.fn(), notify: vi.fn(),
}));
vi.mock('../../../../store/authStore', () => ({ default: <T,>(selector: (state: typeof stub.actor) => T) => selector(stub.actor), hasActiveSession: () => true }));
vi.mock('../../../../modules/teacher/infrastructure/services', () => ({ readTeacherData: stub.read, sendTeacher: stub.send, readTeacher: vi.fn(), readTeacherReceipt: vi.fn() }));
vi.mock('../../../../config/httpFeedback', () => ({ notifyHttpError: stub.notify }));
const clients: QueryClient[] = [];
const page = (state: string) => ({ data: [{ id: 'fixture-session', title: 'Fixture title', topic: 'Fixture topic', objective: 'Fixture objective', state: 'draft', revision: 1, updated_at: '2026-11-06T00:00:00Z', latest_job: { job_id: 'fixture-job', state, purpose: 'plan_outline' } }], meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 } });
function createTestClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false } } });
  clients.push(client);
  return client;
}
function Wrapper({ children }: PropsWithChildren) {
  const [client] = useState(createTestClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const settle = async (ms = 0) => {
  await act(async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(ms); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
};
beforeEach(() => {
  vi.useFakeTimers(); stub.read.mockReset(); stub.send.mockReset(); stub.notify.mockReset(); stub.read.mockResolvedValue(page('queued'));
  stub.actor.sessionStatus = 'authenticated';
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); });

describe('Teacher sessions read-only background polling', () => {
  it('polls one list GET and stops on ready, without reading individual jobs or creating commands', async () => {
    const { result } = renderHook(() => ({ ...useTeacherSessions(1, '', false) }), { wrapper: Wrapper });
    await settle(); expect(result.current.data?.data[0].latest_job?.state).toBe('queued');
    stub.read.mockResolvedValueOnce(page('ready'));
    await settle(5000);
    expect(result.current.data?.data[0].latest_job?.state).toBe('ready');
    await settle(20000);
    expect(stub.read).toHaveBeenCalledTimes(2);
    expect(stub.read.mock.calls.every(call => call[0] === 'sessions')).toBe(true);
    expect(stub.send).not.toHaveBeenCalled();
  });
  it('suspends polling while hidden and resumes the same list observation when visible', async () => {
    const { result } = renderHook(() => ({ ...useTeacherSessions(1, 'fixture', false) }), { wrapper: Wrapper });
    await settle();
    act(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await settle(20000); expect(stub.read).toHaveBeenCalledOnce();
    act(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    stub.read.mockResolvedValueOnce(page('unknown'));
    await settle(5000); expect(result.current.data?.data[0].latest_job?.state).toBe('unknown');
    await settle(20000); expect(stub.read).toHaveBeenCalledTimes(2);
  });
  it('keeps the cached list after a read failure, stops automatic retries, and allows explicit GET recovery', async () => {
    const { result } = renderHook(() => ({ ...useTeacherSessions(1, '', false) }), { wrapper: Wrapper });
    await settle(); const confirmed = result.current.data;
    stub.read.mockRejectedValueOnce(new Error('Fixture read failure'));
    await settle(5000);
    expect(result.current.isError).toBe(true); expect(result.current.data).toBe(confirmed);
    expect(stub.notify).toHaveBeenCalledOnce();
    await settle(20000); expect(stub.read).toHaveBeenCalledTimes(2);
    stub.read.mockResolvedValueOnce(page('ready'));
    await act(async () => { await result.current.refetch(); }); await settle();
    expect(result.current.data?.data[0].latest_job?.state).toBe('ready'); expect(result.current.isError).toBe(false);
    expect(stub.send).not.toHaveBeenCalled();
  });
  it('cleans up observation on unmount by aborting only the pending GET, never the worker job', async () => {
    stub.read.mockImplementation(() => new Promise(() => {}));
    const { unmount } = renderHook(() => ({ ...useTeacherSessions(1, '', false) }), { wrapper: Wrapper });
    await settle(); const signal = stub.read.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false); unmount(); expect(signal.aborted).toBe(true);
    await settle(20000); expect(stub.read).toHaveBeenCalledOnce(); expect(stub.send).not.toHaveBeenCalled();
  });
  it('does not read a list while the authenticated actor is unavailable', async () => {
    stub.actor.sessionStatus = 'renewing';
    renderHook(() => ({ ...useTeacherSessions(1, '', false) }), { wrapper: Wrapper });
    await settle(10000); expect(stub.read).not.toHaveBeenCalled();
  });
});
