import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { useNodiaAiStatusRefresh } from "../../../../modules/nodiaAi/infrastructure/useNodiaAiStatusRefresh";
import { useNodiaAiEligibility } from "../../../../modules/nodiaAi/infrastructure/useServices";
import type { NodiaAiDetail, NodiaAiRunState } from "../../../../modules/nodiaAi/infrastructure/types";
import { chatId, detail, run, selection } from "./fixtures";

const mocks = vi.hoisted(() => ({ getNodiaAiEligibility: vi.fn(), notifyHttpError: vi.fn() }));
vi.mock("../../../../modules/nodiaAi/infrastructure/services", () => ({ getNodiaAiEligibility: mocks.getNodiaAiEligibility }));
vi.mock("../../../../config/httpFeedback", () => ({ notifyHttpError: mocks.notifyHttpError }));

const snapshot = (state: NodiaAiRunState): NodiaAiDetail => ({ ...detail, current_run: { ...run, state, revision: 3 } });
const auth = (id = "9", version = 1) => useAuthStore.setState({ user: { id, name: "Synthetic reader" }, token: "synthetic-only", expiresAt: Date.now() + 600000, sessionStatus: "authenticated", sessionVersion: version, isRefreshing: false });
const readers = (state: NodiaAiRunState = "failed") => ({ conversationId: chatId, runId: run.run_id,
  detail: vi.fn().mockResolvedValue({ isSuccess: true, data: snapshot(state) }), history: vi.fn().mockResolvedValue(undefined), eligibility: vi.fn().mockResolvedValue(undefined) });
let client: QueryClient;
const Wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

describe("explicit reconciliation status refresh", () => {
  beforeEach(() => { vi.clearAllMocks(); auth(); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
  afterEach(() => { cleanup(); client.clear(); useAuthStore.setState({ token: null, user: null, sessionStatus: "anonymous" }); });

  it.each(["runtime_busy", "read_error"])("recovers residual %s by explicit terminal GET then the existing availability/history readers", async residual => {
    const unavailable = { selection, available: false, reason: "nodia_ai:runtime_busy", observed_at: null, supports_mcp: false, routing_target: null };
    if (residual === "read_error") mocks.getNodiaAiEligibility.mockRejectedValueOnce(new Error("Synthetic read outage"));
    else mocks.getNodiaAiEligibility.mockResolvedValueOnce(unavailable);
    mocks.getNodiaAiEligibility.mockResolvedValue({ ...unavailable, available: true, reason: null });
    const source = readers();
    const view = renderHook(() => {
      // Idle observer models the retained observation after its bounded window.
      const eligibility = useNodiaAiEligibility(selection, { conversationId: chatId, active: false });
      const recovery = useNodiaAiStatusRefresh({ ...source, eligibility: eligibility.refetch });
      return { eligibility, ...recovery };
    }, { wrapper: Wrapper });
    await waitFor(() => expect(view.result.current.eligibility.isFetching).toBe(false));
    expect(view.result.current.eligibility.data?.available === true).toBe(false);
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(1);
    await act(() => view.result.current.refresh());
    await waitFor(() => expect(view.result.current.eligibility.data?.available).toBe(true));
    expect(view.result.current.eligibility.isError).toBe(false);
    expect(view.result.current.isRefreshing).toBe(false);
    expect(source.detail).toHaveBeenCalledTimes(1);
    expect(source.history).toHaveBeenCalledTimes(1);
    expect(mocks.getNodiaAiEligibility).toHaveBeenCalledTimes(2);
  });

  it.each(["queued", "running", "cancel_requested", "unknown", "waiting_for_user"] as const)("only reads current status while %s still retains work or needs input", async state => {
    const source = readers(state);
    const { result } = renderHook(() => useNodiaAiStatusRefresh(source));
    await act(() => result.current.refresh());
    expect(source.detail).toHaveBeenCalledTimes(1);
    expect(source.history).not.toHaveBeenCalled();
    expect(source.eligibility).not.toHaveBeenCalled();
    expect(result.current.isRefreshing).toBe(false);
  });

  it.each(["completed", "failed", "cancelled"] as const)("waits for the current %s status before secondary reads and ignores duplicate clicks", async state => {
    const source = readers(state);
    let finish: (value: { isSuccess: boolean; data: NodiaAiDetail }) => void = () => {};
    source.detail.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useNodiaAiStatusRefresh(source));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.refresh(); });
    expect(result.current.isRefreshing).toBe(true);
    await act(() => result.current.refresh());
    expect(source.detail).toHaveBeenCalledTimes(1);
    expect(source.eligibility).not.toHaveBeenCalled();
    await act(async () => { finish({ isSuccess: true, data: snapshot(state) }); await pending; });
    expect(source.history).toHaveBeenCalledTimes(1);
    expect(source.eligibility).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(false);
  });

  it.each(["actor", "session", "chat", "run", "unmount"] as const)("does not apply late recovery after %s changes", async change => {
    const source = readers();
    let finish: (value: { isSuccess: boolean; data: NodiaAiDetail }) => void = () => {};
    source.detail.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = renderHook(props => useNodiaAiStatusRefresh(props), { initialProps: source });
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = view.result.current.refresh(); });
    act(() => {
      if (change === "actor") auth("10", 2);
      else if (change === "session") auth("9", 2);
      else if (change === "unmount") view.unmount();
      else view.rerender({ ...source, ...(change === "chat" ? { conversationId: "44444444-4444-4444-8444-444444444444" } : { runId: "55555555-5555-4555-8555-555555555555" }) });
    });
    await act(async () => { finish({ isSuccess: true, data: snapshot("failed") }); await pending; });
    expect(source.history).not.toHaveBeenCalled();
    expect(source.eligibility).not.toHaveBeenCalled();
  });

  it.each(["error", "read_only", "other_run", "other_chat", "pending_execution"] as const)("keeps dependent reads blocked for %s detail", async invalid => {
    const source = readers();
    const data = snapshot("failed");
    if (invalid === "read_only") data.conversation = { ...data.conversation, read_only: true };
    if (invalid === "other_run") data.current_run = { ...run, run_id: "55555555-5555-4555-8555-555555555555", state: "failed" };
    if (invalid === "other_chat") data.conversation = { ...data.conversation, conversation_id: "44444444-4444-4444-8444-444444444444" };
    if (invalid === "pending_execution") data.active_execution = { execution_id: run.run_id, revision: 1, state: "unknown", steps: [], can_resume: false, observed_at: "2026-10-24T00:00:00.000Z" };
    source.detail.mockResolvedValue({ isSuccess: invalid !== "error", data });
    const { result } = renderHook(() => useNodiaAiStatusRefresh(source));
    await act(() => result.current.refresh());
    expect(source.history).not.toHaveBeenCalled();
    expect(source.eligibility).not.toHaveBeenCalled();
  });
});
