import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../../../store/authStore";
import {
  useAiProvidersHealth, useCurrentGeminiAgenticLogin, useGeminiAgenticLoginStatus, useGeminiEngines,
} from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useServices";

const service = vi.hoisted(() => ({ health: vi.fn(), current: vi.fn(), status: vi.fn() }));
vi.mock("../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services", async original => ({
  ...(await original<typeof import("../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/services")>()),
  getAiProvidersHealth: service.health,
  getCurrentGeminiAgenticLogin: service.current,
  getGeminiAgenticLoginStatus: service.status,
}));
const health = { engines: null, providers: [], alerts: [], overallStatus: "healthy", summary: {
  totalProviders: 0, activeProviders: 0, healthyProviders: 0, incidentsCount: 0,
} };
const pendingJob = { id: "1".repeat(32), state: "running", authorization_url: null, reason: null };
const clients: QueryClient[] = [];
function fixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => {
  vi.resetAllMocks();
  service.health.mockResolvedValue(health);
  service.current.mockResolvedValue(null);
  service.status.mockResolvedValue(pendingJob);
  useAuthStore.setState({ token: "synthetic-test-token", user: { id: "42", name: "Fixture" },
    expiresAt: Date.now() + 3_600_000, sessionStatus: "authenticated", isRefreshing: false });
});
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); });

describe("provider reads and Nodia authentication", () => {
  it.each(["anonymous", "restoring", "unavailable"] as const)("does not observe health or login while the session is %s", async sessionStatus => {
    useAuthStore.setState({ sessionStatus });
    const { wrapper } = fixture();
    const { result } = renderHook(() => ({ health: useAiProvidersHealth(), engines: useGeminiEngines(),
      current: useCurrentGeminiAgenticLogin(true), status: useGeminiAgenticLoginStatus(pendingJob.id) }), { wrapper });
    expect(service.health).not.toHaveBeenCalled();
    expect(service.current).not.toHaveBeenCalled();
    expect(service.status).not.toHaveBeenCalled();
    act(() => { useAuthStore.setState({ sessionStatus: "authenticated" }); });
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true));
    expect(service.health).toHaveBeenCalledOnce();
    expect(service.current).toHaveBeenCalledOnce();
    expect(service.status).toHaveBeenCalledOnce();
  });

  it("does not observe with an expired token even if the stored status says authenticated", () => {
    useAuthStore.setState({ expiresAt: Date.now() - 1 });
    const { wrapper } = fixture();
    renderHook(() => useAiProvidersHealth(), { wrapper });
    expect(service.health).not.toHaveBeenCalled();
  });

  it.each([401, 403])("stops health polling after HTTP%s and permits an explicit successful recheck", async status => {
    service.health.mockRejectedValueOnce({ isAxiosError: true, response: { status } });
    const { wrapper } = fixture();
    const { result } = renderHook(() => useAiProvidersHealth(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(360_000); });
    expect(service.health).toHaveBeenCalledOnce();
    await act(async () => { await result.current.refetch(); await vi.advanceTimersByTimeAsync(10); });
    expect(result.current.data).toEqual(health);
    expect(service.health).toHaveBeenCalledTimes(2);
  });

  it("preserves HTTP503 as an error and recovers on the established 120-second health cadence", async () => {
    vi.useFakeTimers();
    const unavailable = { isAxiosError: true, response: { status: 503 } };
    service.health.mockRejectedValueOnce(unavailable);
    const { wrapper } = fixture();
    const { result } = renderHook(() => useAiProvidersHealth(), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(result.current.error).toBe(unavailable);
    await act(async () => { await vi.advanceTimersByTimeAsync(119_000); });
    expect(service.health).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100); });
    expect(service.health).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(health);
  });

  it("stops login-status polling after logout without treating its prior job as completed", async () => {
    const { wrapper } = fixture();
    const { result } = renderHook(() => useGeminiAgenticLoginStatus(pendingJob.id), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(pendingJob));
    act(() => { useAuthStore.setState({ sessionStatus: "anonymous", token: null }); });
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(service.status).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual(pendingJob);
  });

  it("keeps a failed Gemini current read visible and does not silently retry on reconnect", async () => {
    const unavailable = { isAxiosError: true, response: { status: 503 } };
    service.current.mockRejectedValueOnce(unavailable);
    const { wrapper } = fixture();
    const { result } = renderHook(() => useCurrentGeminiAgenticLogin(true), { wrapper });
    await waitFor(() => expect(result.current.error).toBe(unavailable));
    window.dispatchEvent(new Event("online"));
    expect(service.current).toHaveBeenCalledOnce();
    expect(result.current.data).toBeUndefined();
  });
});
