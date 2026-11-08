import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTeacherCommand } from "../../../../modules/teacher/infrastructure/useServices";

const stub = vi.hoisted(() => ({
  actor: { user: { id: "1" }, sessionVersion: 1, active: true }, send: vi.fn(), refresh: vi.fn(),
}));
vi.mock("../../../../store/authStore", () => ({ default: Object.assign(<T,>(selector: (state: typeof stub.actor) => T) => selector(stub.actor), { getState: () => stub.actor }), hasActiveSession: (state: typeof stub.actor) => state.active }));
vi.mock("../../../../modules/teacher/infrastructure/services", () => ({ sendTeacher: stub.send, readTeacher: vi.fn(), readTeacherData: vi.fn(), readTeacherReceipt: vi.fn() }));
vi.mock("../../../../modules/teacher/infrastructure/refresh", () => ({ refreshTeacherQueries: stub.refresh }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn() } }));
vi.mock("../../../../config/httpFeedback", () => ({ notifyHttpError: vi.fn() }));

beforeEach(() => { stub.actor.active = true; stub.send.mockReset(); stub.refresh.mockReset(); window.sessionStorage.clear(); });
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("Teacher mutation lifecycle", () => {
  it("admits no new command during renewal, while letting the original same-actor acknowledgement finish", async () => {
    let complete: (value: { session_id: string; revision: number }) => void = () => {};
    stub.send.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const { result, rerender } = renderHook(() => useTeacherCommand(), { wrapper });
    let sending: ReturnType<typeof result.current.execute>;
    act(() => { sending = result.current.execute("sessions/fixture-session/setup-draft", { text: "synthetic draft" }, "PATCH"); });
    await waitFor(() => expect(stub.send).toHaveBeenCalledOnce());
    stub.actor.active = false; rerender();
    expect(result.current.blocked).toBe(true);
    await act(async () => { expect(await result.current.execute("sessions/fixture-session/pause", {})).toBeNull(); });
    await act(async () => { complete({ session_id: "fixture-session", revision: 2 }); await sending; });
    expect(result.current.uncertain).toBeNull(); expect(result.current.blocked).toBe(true);
    await act(async () => { expect(await result.current.execute("sessions/fixture-session/pause", {})).toBeNull(); });
    expect(stub.send).toHaveBeenCalledOnce();
    stub.actor.active = true; rerender();
    expect(result.current.blocked).toBe(false);
  });
  it("keeps controls blocked after the HTTP acknowledgement until authority revalidation finishes", async () => {
    let complete: () => void = () => {};
    stub.send.mockResolvedValue({ session_id: "fixture-session", revision: 2 });
    stub.refresh.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    const { result } = renderHook(() => useTeacherCommand(), { wrapper });
    let sending: ReturnType<typeof result.current.execute>;
    act(() => { sending = result.current.execute("sessions/fixture-session/resume", {}); });
    await waitFor(() => expect(stub.refresh).toHaveBeenCalledOnce());
    expect(result.current.isPending).toBe(true); expect(result.current.blocked).toBe(true);
    await act(async () => { expect(await result.current.execute("sessions/fixture-session/setup-draft", {})).toBeNull(); });
    expect(stub.send).toHaveBeenCalledOnce();
    await act(async () => { complete(); await sending; });
    expect(result.current.isPending).toBe(false); expect(result.current.blocked).toBe(false);
  });
  it("finishes the active lifecycle after a transport failure while retaining receipt recovery instead of replaying", async () => {
    stub.send.mockRejectedValue(new Error("Synthetic connection failure"));
    const { result } = renderHook(() => useTeacherCommand(), { wrapper });
    await act(async () => { await result.current.execute("sessions/fixture-session/setup-draft", { text: "synthetic draft" }); });
    expect(result.current.isPending).toBe(false); expect(result.current.blocked).toBe(true);
    expect(result.current.uncertain?.path).toBe("sessions/fixture-session/setup-draft");
    expect(stub.send).toHaveBeenCalledOnce(); expect(stub.refresh).not.toHaveBeenCalled();
  });
});
