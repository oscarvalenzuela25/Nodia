import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCodexSessionObservation } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/useCodexSessionObservation";
import type { CodexSession } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSession";
import { codexModelObservationEnabled } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSessionState";

const service = vi.hoisted(() => ({ observe: vi.fn() }));
vi.mock("../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSession", () => ({ getCodexSession: service.observe }));
const connected: CodexSession = { available: true, authenticated: true, checkedAt: "2026-11-01T18:00:00Z",
  planType: null, reason: null, quotas: null, usageAllowed: null, lastInferenceAt: null };
function fixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => { vi.resetAllMocks(); service.observe.mockResolvedValue(connected); });
afterEach(() => { vi.useRealTimers(); });

describe("visible Codex session read intent", () => {
  it("does not wake a hidden/API detail and reads once when Agentic becomes visible", async () => {
    const { wrapper } = fixture();
    const { result, rerender } = renderHook(({ visible }) => useCodexSessionObservation("42", visible), { wrapper, initialProps: { visible: false } });
    expect(service.observe).not.toHaveBeenCalled();
    rerender({ visible: true });
    await waitFor(() => expect(result.current.data?.authenticated).toBe(true));
    expect(service.observe).toHaveBeenCalledOnce();
    expect(service.observe).toHaveBeenCalledWith("42", expect.objectContaining({ aborted: false }));
  });
  it("shares the header/panel read and never polls, reconnects or wakes on window focus", async () => {
    const { wrapper } = fixture();
    const { result } = renderHook(() => [useCodexSessionObservation("42"), useCodexSessionObservation("42")], { wrapper });
    await waitFor(() => expect(result.current.every(query => query.isSuccess)).toBe(true));
    expect(service.observe).toHaveBeenCalledOnce();
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });
    expect(service.observe).toHaveBeenCalledOnce();
  });
  it("aborts an old instance read and ignores its late result after switching providers", async () => {
    let finishOld!: (session: CodexSession) => void;
    let oldSignal: AbortSignal | undefined;
    service.observe.mockImplementation((id: string, signal: AbortSignal) => {
      if (id !== "41") return Promise.resolve(connected);
      oldSignal = signal;
      return new Promise<CodexSession>(resolve => { finishOld = resolve; });
    });
    const { wrapper } = fixture();
    const { result, rerender } = renderHook(({ id }) => useCodexSessionObservation(id), { wrapper, initialProps: { id: "41" } });
    await waitFor(() => expect(service.observe).toHaveBeenCalledOnce());
    rerender({ id: "42" });
    await waitFor(() => expect(result.current.data?.authenticated).toBe(true));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finishOld({ ...connected, authenticated: false }); });
    expect(result.current.data).toEqual(connected);
  });
  it("does not retry a failed observation and permits only an explicit new check", async () => {
    service.observe.mockRejectedValueOnce(new Error("Synthetic unavailable metadata"));
    const { wrapper } = fixture();
    const { result } = renderHook(() => useCodexSessionObservation("42"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(service.observe).toHaveBeenCalledOnce();
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.data?.authenticated).toBe(true));
    expect(service.observe).toHaveBeenCalledTimes(2);
  });
  it("serializes account and model metadata instead of competing for one Native profile", async () => {
    let finishAuth!: (value: CodexSession) => void;
    let accountReading = false;
    service.observe.mockImplementation(() => {
      accountReading = true;
      return new Promise<CodexSession>(resolve => { finishAuth = value => { accountReading = false; resolve(value); }; });
    });
    const modelRead = vi.fn(async () => {
      if (accountReading) throw new Error("Synthetic physical profile is already leased");
      return [];
    });
    const { wrapper } = fixture();
    const { result } = renderHook(() => {
      const auth = useCodexSessionObservation("42");
      const models = useQuery({ queryKey: ["synthetic-model-metadata", "42"], queryFn: modelRead,
        enabled: codexModelObservationEnabled(auth.data, auth), retry: false });
      return { auth, models };
    }, { wrapper });
    await waitFor(() => expect(service.observe).toHaveBeenCalledOnce());
    expect(modelRead).not.toHaveBeenCalled();
    await act(async () => { finishAuth(connected); });
    await waitFor(() => expect(result.current.models.isSuccess).toBe(true));
    expect(modelRead).toHaveBeenCalledOnce();
  });
});
