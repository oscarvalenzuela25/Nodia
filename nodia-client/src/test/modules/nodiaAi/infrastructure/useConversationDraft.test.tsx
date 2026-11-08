import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../store/authStore";
import { useConversationDraft } from "../../../../modules/nodiaAi/infrastructure/useConversationDraft";
import { conversation } from "./fixtures";
import type { NodiaAiConversation } from "../../../../modules/nodiaAi/infrastructure/types";

const chat = (): NodiaAiConversation => ({ ...conversation, read_only: false, expires_at: new Date(Date.now() + 60000).toISOString() });
const login = (id = "synthetic-owner") => useAuthStore.setState({ user: { id, name: "Synthetic owner" }, sessionStatus: "authenticated" });
beforeEach(() => { window.sessionStorage.clear(); login(); });
afterEach(() => { act(() => useAuthStore.setState({ user: null, sessionStatus: "anonymous" })); vi.useRealTimers(); });

describe("conversation draft continuity", () => {
  it("restores only after authorized detail is available after a remount", () => {
    const detail = chat();
    const first = renderHook(() => useConversationDraft(detail, null, true));
    act(() => first.result.current.setText("Synthetic draft preserved"));
    first.unmount();
    const second = renderHook(({ value }: { value: NodiaAiConversation | undefined }) => useConversationDraft(value, null, true), { initialProps: { value: undefined as NodiaAiConversation | undefined } });
    expect(second.result.current.text).toBe("");
    second.rerender({ value: detail });
    expect(second.result.current.text).toBe("Synthetic draft preserved");
  });
  it("retains separate chat drafts across explicit selections and session version renewal", () => {
    const a = chat(), b = { ...a, conversation_id: "synthetic-second-chat" };
    const view = renderHook(({ value }) => useConversationDraft(value, null, true), { initialProps: { value: a } });
    act(() => view.result.current.setText("First draft"));
    view.rerender({ value: b });
    expect(view.result.current.text).toBe("");
    act(() => view.result.current.setText("Second draft"));
    act(() => useAuthStore.setState(state => ({ sessionVersion: state.sessionVersion + 1 })));
    view.rerender({ value: a });
    expect(view.result.current.text).toBe("First draft");
    view.rerender({ value: b });
    expect(view.result.current.text).toBe("Second draft");
  });
  it("purges on logout while the page is absent, without restoring on a later login", () => {
    const detail = chat();
    const first = renderHook(() => useConversationDraft(detail, null, true));
    act(() => first.result.current.setText("Synthetic private draft"));
    first.unmount();
    act(() => useAuthStore.setState({ user: null, sessionStatus: "anonymous" }));
    login();
    expect(renderHook(() => useConversationDraft(detail, null, true)).result.current.text).toBe("");
    expect(window.sessionStorage.length).toBe(0);
  });
  it("does not expose or resurrect a prior actor's draft", () => {
    const detail = chat();
    const view = renderHook(() => useConversationDraft(detail, null, true));
    act(() => view.result.current.setText("Owner A"));
    act(() => login("synthetic-other"));
    expect(view.result.current.text).toBe("");
    act(() => login());
    expect(view.result.current.text).toBe("");
  });
  it("hides content during session restoration, preserving the same actor's draft", () => {
    const detail = chat();
    const view = renderHook(() => useConversationDraft(detail, null, true));
    act(() => view.result.current.setText("Synthetic draft"));
    act(() => useAuthStore.setState({ sessionStatus: "restoring" }));
    expect(view.result.current.text).toBe("");
    act(() => login());
    expect(view.result.current.text).toBe("Synthetic draft");
  });
  it("hides a retained draft until fresh detail authorizes restoration, without deleting it on a transient outage", () => {
    const detail = chat();
    const view = renderHook(({ authorized }) => useConversationDraft(detail, null, authorized), { initialProps: { authorized: true } });
    act(() => view.result.current.setText("Synthetic retained draft"));
    view.rerender({ authorized: false });
    expect(view.result.current.text).toBe("");
    expect(window.sessionStorage.length).toBe(1);
    act(() => view.result.current.setText("Must not replace the hidden draft"));
    view.rerender({ authorized: true });
    expect(view.result.current.text).toBe("Synthetic retained draft");
  });
  it("purges revoked or read-only conversation drafts", () => {
    const detail = chat();
    const view = renderHook(({ value, denied }: { value: NodiaAiConversation | undefined; denied: string | null }) => useConversationDraft(value, denied, true), { initialProps: { value: detail as NodiaAiConversation | undefined, denied: null as string | null } });
    act(() => view.result.current.setText("Synthetic private draft"));
    view.rerender({ value: undefined, denied: detail.conversation_id });
    view.rerender({ value: detail, denied: null });
    expect(view.result.current.text).toBe("");
    act(() => view.result.current.setText("Synthetic private draft"));
    view.rerender({ value: { ...detail, read_only: true }, denied: null });
    expect(view.result.current.text).toBe("");
    expect(window.sessionStorage.length).toBe(0);
  });
  it("removes expired text while mounted at its backend deadline", () => {
    vi.useFakeTimers();
    const detail = chat();
    const view = renderHook(() => useConversationDraft(detail, null, true));
    act(() => view.result.current.setText("Synthetic draft"));
    act(() => vi.advanceTimersByTime(60000));
    expect(view.result.current.text).toBe("");
    expect(window.sessionStorage.length).toBe(0);
  });
  it("keeps explicit uncertain recovery text only in the current instance, never restorable as a new intention", () => {
    const detail = chat();
    const view = renderHook(() => useConversationDraft(detail, null, true));
    act(() => view.result.current.setText("Synthetic pending request"));
    act(() => view.result.current.beginSubmission());
    act(() => view.result.current.finishSubmission(detail.conversation_id, "uncertain", detail.expires_at));
    expect(view.result.current.text).toBe("Synthetic pending request");
    expect(window.sessionStorage.length).toBe(0);
    view.unmount();
    expect(renderHook(() => useConversationDraft(detail, null, true)).result.current.text).toBe("");
  });
  it("restores text after definitive rejection and clears after accepted admission", () => {
    const detail = chat();
    const view = renderHook(() => useConversationDraft(detail, null, true));
    act(() => view.result.current.setText("Synthetic rejected request"));
    act(() => view.result.current.beginSubmission());
    act(() => view.result.current.finishSubmission(detail.conversation_id, "rejected", detail.expires_at));
    view.unmount();
    const restored = renderHook(() => useConversationDraft(detail, null, true));
    expect(restored.result.current.text).toBe("Synthetic rejected request");
    act(() => restored.result.current.beginSubmission());
    act(() => restored.result.current.finishSubmission(detail.conversation_id, "accepted", detail.expires_at));
    expect(restored.result.current.text).toBe("");
    expect(window.sessionStorage.length).toBe(0);
  });
  it("does not let a late rejection from an unmounted composer replace a newer draft", () => {
    const detail = chat();
    const before = renderHook(() => useConversationDraft(detail, null, true));
    act(() => before.result.current.setText("Synthetic first request"));
    act(() => before.result.current.beginSubmission());
    const finish = before.result.current.finishSubmission;
    before.unmount();
    const after = renderHook(() => useConversationDraft(detail, null, true));
    act(() => after.result.current.setText("New synthetic draft"));
    act(() => finish(detail.conversation_id, "rejected", detail.expires_at));
    expect(after.result.current.text).toBe("New synthetic draft");
  });
});
