import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { sileo } from "sileo";
import useAuthStore from "../../../../store/authStore";
import { useRunCancellation } from "../../../../modules/nodiaAi/infrastructure/useRunCancellation";
import { cancelNodiaAiRun } from "../../../../modules/nodiaAi/infrastructure/runControlServices";
import { getNodiaAiRun } from "../../../../modules/nodiaAi/infrastructure/services";
import { nodiaAiKeys } from "../../../../modules/nodiaAi/infrastructure/useServices";
import type { NodiaAiRun } from "../../../../modules/nodiaAi/infrastructure/types";
import { chatId, detail, run } from "./fixtures";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../modules/nodiaAi/infrastructure/runControlServices", () => ({ cancelNodiaAiRun: vi.fn() }));
vi.mock("../../../../modules/nodiaAi/infrastructure/services", async original => ({ ...await original<object>(), getNodiaAiRun: vi.fn() }));
const running: NodiaAiRun = { ...run, state: "running", revision: 5 };
const accepted = { status: "accepted" as const, run: { ...running, state: "cancel_requested" as const, revision: 6 } };
let client: QueryClient;
const scope = ["9", 1] as const;
const detailKey = nodiaAiKeys.detail(scope, chatId);
function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  vi.clearAllMocks();
  onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ user: { id: "9", name: "Synthetic owner" }, token: "synthetic", sessionVersion: 1, sessionStatus: "authenticated", isRefreshing: false, expiresAt: Date.now() + 600000 });
  client.setQueryData(detailKey, { ...detail, current_run: running });
  vi.mocked(cancelNodiaAiRun).mockResolvedValue(accepted);
  vi.mocked(getNodiaAiRun).mockResolvedValue(running);
});
afterEach(() => { onlineManager.setOnline(true); client.clear(); useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" }); });
function open(authorized = true, readOnly = false) { return renderHook(() => useRunCancellation(chatId, running, authorized, readOnly), { wrapper: Wrapper }); }
function rejection(status: number) { return new AxiosError("Synthetic rejection", "ERR_BAD_REQUEST", undefined, undefined, { data: { message: "Synthetic permission denial" }, status, statusText: "Rejected", headers: new AxiosHeaders(), config: { headers: new AxiosHeaders() } }); }
describe("run cancellation intent and recovery", () => {
  it("has no effect on mount, blocks duplicates and accepts only a stop request without touching financial caches", async () => {
    let resolve!: (value: typeof accepted) => void;
    vi.mocked(cancelNodiaAiRun).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const view = open();
    expect(cancelNodiaAiRun).not.toHaveBeenCalled();
    let first!: Promise<void>;
    act(() => { first = view.result.current.request(); void view.result.current.request(); });
    await act(async () => { await Promise.resolve(); });
    expect(cancelNodiaAiRun).toHaveBeenCalledOnce();
    await act(async () => { resolve(accepted); await first; });
    expect(view.result.current.phase).toBe("accepted");
    expect(sileo.success).toHaveBeenCalledWith({ title: "Solicitud de detención enviada" });
    expect(client.getQueryData(detailKey)).toMatchObject({ current_run: { state: "cancel_requested", revision: 6 } });
    expect(invalidate.mock.calls.every(([options]) => options?.queryKey?.[0] === "nodia-ai")).toBe(true);
  });
  it.each([new Error("Synthetic network failure"), rejection(503), new Error("nodia_ai:invalid_response")])("requires an authorized GET before a deliberate retry with the same request UUID", async failure => {
    vi.mocked(cancelNodiaAiRun).mockRejectedValueOnce(failure);
    const view = open();
    await act(async () => { await view.result.current.request(); });
    const original = vi.mocked(cancelNodiaAiRun).mock.calls[0][2].client_request_id;
    expect(view.result.current.phase).toBe("uncertain");
    expect(sileo.success).not.toHaveBeenCalled();
    await act(async () => { await view.result.current.request(); await view.result.current.retry(); });
    expect(cancelNodiaAiRun).toHaveBeenCalledOnce();
    await act(async () => { await view.result.current.recover(); });
    expect(getNodiaAiRun).toHaveBeenCalledWith(running.run_id, chatId, expect.any(AbortSignal));
    expect(view.result.current.phase).toBe("retry_ready");
    expect(cancelNodiaAiRun).toHaveBeenCalledOnce();
    await act(async () => { await view.result.current.retry(); });
    expect(vi.mocked(cancelNodiaAiRun).mock.calls[1][2].client_request_id).toBe(original);
  });
  it("never queues a paused mutation to replay on network reconnection", async () => {
    onlineManager.setOnline(false);
    vi.mocked(cancelNodiaAiRun).mockRejectedValueOnce(new Error("Synthetic offline request"));
    const view = open();
    await act(async () => { await view.result.current.request(); });
    expect(cancelNodiaAiRun).toHaveBeenCalledOnce();
    act(() => onlineManager.setOnline(true));
    expect(view.result.current.phase).toBe("uncertain");
    expect(cancelNodiaAiRun).toHaveBeenCalledOnce();
  });
  it.each(["cancel_requested", "completed", "unknown"] as const)("does not resend after recovery observes %s", async state => {
    vi.mocked(cancelNodiaAiRun).mockRejectedValueOnce(new Error("Synthetic uncertainty"));
    vi.mocked(getNodiaAiRun).mockResolvedValueOnce({ ...running, state, revision: 6 });
    const view = open();
    await act(async () => { await view.result.current.request(); });
    await act(async () => { await view.result.current.recover(); });
    await act(async () => { await view.result.current.retry(); });
    expect(view.result.current.phase).toBe(state === "cancel_requested" ? "accepted" : "finished");
    expect(cancelNodiaAiRun).toHaveBeenCalledOnce();
    expect(sileo.success).not.toHaveBeenCalled();
  });
  it("does not make a stale GET an authorization to retry", async () => {
    vi.mocked(cancelNodiaAiRun).mockRejectedValueOnce(new Error("Synthetic uncertainty"));
    vi.mocked(getNodiaAiRun).mockResolvedValueOnce({ ...running, revision: 4 });
    const view = open();
    await act(async () => { await view.result.current.request(); });
    await act(async () => { await view.result.current.recover(); });
    expect(view.result.current.phase).toBe("uncertain");
    await act(async () => { await view.result.current.retry(); });
    expect(cancelNodiaAiRun).toHaveBeenCalledOnce();
  });
  it("clears a known rejected request and uses a new UUID only on a new explicit request", async () => {
    vi.mocked(cancelNodiaAiRun).mockRejectedValueOnce(rejection(403));
    const view = open();
    await act(async () => { await view.result.current.request(); });
    expect(view.result.current.phase).toBe("rejected");
    expect(sileo.success).not.toHaveBeenCalled();
    await act(async () => { await view.result.current.request(); });
    const calls = vi.mocked(cancelNodiaAiRun).mock.calls;
    expect(calls[1][2].client_request_id).not.toBe(calls[0][2].client_request_id);
  });
  it.each(["completed", "unknown"] as const)("preserves an already-terminal %s race without claiming cancellation or physical closure", async state => {
    vi.mocked(cancelNodiaAiRun).mockResolvedValueOnce({ status: "already_terminal", run: { ...running, state, revision: 7 } });
    const view = open();
    await act(async () => { await view.result.current.request(); });
    expect(view.result.current.phase).toBe("finished");
    expect(sileo.success).toHaveBeenCalledWith({ title: "Se consultó el estado actual del turno" });
    expect(client.getQueryData(detailKey)).toMatchObject({ current_run: { state, revision: 7 } });
  });
  it.each(["owner", "session", "chat", "run", "unmount"] as const)("ignores a late response after %s changes", async change => {
    let resolve!: (value: typeof accepted) => void;
    vi.mocked(cancelNodiaAiRun).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const view = renderHook(({ conversationId, currentRun }) => useRunCancellation(conversationId, currentRun, true, false), { initialProps: { conversationId: chatId, currentRun: running }, wrapper: Wrapper });
    let request!: Promise<void>;
    act(() => { request = view.result.current.request(); });
    await act(async () => { await Promise.resolve(); });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    if (change === "owner") act(() => useAuthStore.setState({ user: { id: "10", name: "Other synthetic owner" } }));
    if (change === "session") act(() => useAuthStore.setState({ sessionVersion: 2 }));
    if (change === "chat") view.rerender({ conversationId: "77777777-7777-4777-8777-777777777777", currentRun: running });
    if (change === "run") view.rerender({ conversationId: chatId, currentRun: { ...running, run_id: "77777777-7777-4777-8777-777777777777" } });
    if (change === "unmount") view.unmount();
    expect(vi.mocked(cancelNodiaAiRun).mock.calls[0][3].aborted).toBe(true);
    await act(async () => { resolve(accepted); await request; });
    expect(sileo.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(client.getQueryData(detailKey)).toMatchObject({ current_run: running });
  });
  it("does not manufacture a detail grant or replace a newer or different run", async () => {
    for (const cached of [undefined, { ...detail, current_run: { ...running, revision: 9 } }, { ...detail, current_run: { ...running, run_id: "77777777-7777-4777-8777-777777777777" } }]) {
      client.removeQueries({ queryKey: detailKey });
      if (cached) client.setQueryData(detailKey, cached);
      const view = open();
      await act(async () => { await view.result.current.request(); });
      expect(client.getQueryData(detailKey)).toEqual(cached);
      view.unmount();
    }
    const cachedOnly = open(false);
    await act(async () => { await cachedOnly.result.current.request(); });
    expect(cancelNodiaAiRun).toHaveBeenCalledTimes(3);
  });
  it("does not send without fresh detail authority or for a read-only conversation", async () => {
    const unauthorized = open(false);
    await act(async () => { await unauthorized.result.current.request(); });
    unauthorized.unmount();
    const readonly = open(true, true);
    await act(async () => { await readonly.result.current.request(); });
    expect(cancelNodiaAiRun).not.toHaveBeenCalled();
  });
});
