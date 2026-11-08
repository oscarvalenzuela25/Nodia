import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETUP_DRAFT_IDLE_MS, useSetupDraft, type SetupDraftReceipt } from "../../../../modules/teacher/hooks/useSetupDraft";

type Props = { text: string; revision: number; busy: boolean; editable: boolean };
const initial: Props = { text: "", revision: 0, busy: false, editable: true };
const ack = (text: string, revision: number): SetupDraftReceipt => ({ setup_draft_text: text, setup_draft_revision: revision });
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Teacher server setup draft", () => {
  it("defers writes across dictated segments and resumes one autosave with the final text after capture stops", async () => {
    const onSave = vi.fn(async (text: string, revision: number) => ack(text, revision + 1));
    const { result, rerender } = renderHook((props: Props) => useSetupDraft({ ...props, onSave }), { initialProps: initial });
    act(() => result.current.change("Typed introduction"));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    // Capture holds the draft command gate without disabling the composer or its Stop control.
    rerender({ ...initial, busy: true });
    for (const segment of ["Typed introduction with dictated words", "Typed introduction with the complete dictation"]) {
      act(() => result.current.change(segment));
      await act(async () => vi.advanceTimersByTimeAsync(5000));
      expect(result.current.saving).toBe(false); expect(onSave).not.toHaveBeenCalled();
    }
    expect(result.current.pending).toEqual({ expected_draft_revision: 0, text: "Typed introduction with the complete dictation" });
    rerender(initial);
    await act(async () => vi.advanceTimersByTimeAsync(SETUP_DRAFT_IDLE_MS - 1));
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(onSave).toHaveBeenCalledExactlyOnceWith("Typed introduction with the complete dictation", 0);
    expect(result.current.status).toBe("saved");
  });
  it("retains an unsent edit and defers its first autosave while session renewal blocks commands", async () => {
    const onSave = vi.fn(async (text: string, revision: number) => ack(text, revision + 1));
    const { result, rerender } = renderHook((props: Props) => useSetupDraft({ ...props, onSave }), { initialProps: initial });
    act(() => result.current.change("Keep through renewal"));
    rerender({ ...initial, busy: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.text).toBe("Keep through renewal"); expect(onSave).not.toHaveBeenCalled();
    rerender(initial);
    await act(async () => { await vi.advanceTimersByTimeAsync(SETUP_DRAFT_IDLE_MS); });
    expect(onSave).toHaveBeenCalledExactlyOnceWith("Keep through renewal", 0);
    expect(result.current.status).toBe("saved");
  });
  it("debounces one CAS write and restores confirmed text after a fresh mount", async () => {
    const onSave = vi.fn(async (text: string, revision: number) => ack(text, revision + 1));
    const first = renderHook(() => useSetupDraft({ ...initial, onSave }));
    act(() => first.result.current.change("English writing"));
    await act(async () => { await vi.advanceTimersByTimeAsync(SETUP_DRAFT_IDLE_MS - 1); });
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(onSave).toHaveBeenCalledExactlyOnceWith("English writing", 0);
    expect(first.result.current.status).toBe("saved"); first.unmount();
    const fresh = renderHook(() => useSetupDraft({ ...initial, text: "English writing", revision: 1, onSave }));
    expect(fresh.result.current.text).toBe("English writing");
    expect(fresh.result.current.status).toBe("saved"); expect(onSave).toHaveBeenCalledTimes(1);
  });
  it("exposes the pending text for atomic pause before debounce, then accepts the paused server snapshot", async () => {
    const onSave = vi.fn(async () => null);
    const { result, rerender } = renderHook((props: Props) => useSetupDraft({ ...props, onSave }), { initialProps: initial });
    act(() => result.current.change("Pause with this text"));
    expect(result.current.pending).toEqual({ expected_draft_revision: 0, text: "Pause with this text" });
    rerender({ ...initial, busy: true, editable: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(onSave).not.toHaveBeenCalled();
    rerender({ ...initial, text: "Pause with this text", revision: 1, editable: false });
    expect(result.current.status).toBe("saved"); expect(result.current.text).toBe("Pause with this text");
    expect(result.current.pending).toBeUndefined();
  });
  it("does not retry a failed or uncertain version and retains it for manual reconciliation", async () => {
    const onSave = vi.fn(async () => null);
    const { result, rerender } = renderHook((props: Props) => useSetupDraft({ ...props, onSave }), { initialProps: initial });
    act(() => result.current.change("Keep this draft"));
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(onSave).toHaveBeenCalledTimes(1); expect(result.current.status).toBe("failed");
    rerender({ ...initial, busy: true }); rerender(initial);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); }); expect(onSave).toHaveBeenCalledTimes(1);
    rerender({ ...initial, text: "Keep this draft", revision: 1 }); expect(result.current.status).toBe("saved");
  });
  it("preserves a newer edit across a late acknowledgement and does not accept an older revision", async () => {
    let finish: (value: SetupDraftReceipt) => void = () => {};
    const onSave = vi.fn(() => new Promise<SetupDraftReceipt>(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook((props: Props) => useSetupDraft({ ...props, onSave }), { initialProps: initial });
    act(() => result.current.change("first"));
    await act(async () => { await vi.advanceTimersByTimeAsync(SETUP_DRAFT_IDLE_MS); });
    act(() => result.current.change("newer"));
    rerender({ ...initial, text: "first", revision: 1, busy: true });
    await act(async () => { finish(ack("first", 1)); });
    expect(result.current.text).toBe("newer"); expect(result.current.revision).toBe(1); expect(result.current.conflict).toBe(false);
    rerender({ ...initial, text: "stale", revision: 0, busy: true });
    expect(result.current.text).toBe("newer"); expect(result.current.revision).toBe(1);
  });
  it("blocks automatic overwrite after another tab changes the server draft, while allowing reviewed manual save", async () => {
    const onSave = vi.fn(async (text: string, revision: number) => ack(text, revision + 1));
    const { result, rerender } = renderHook((props: Props) => useSetupDraft({ ...props, onSave }), { initialProps: initial });
    act(() => result.current.change("local"));
    rerender({ ...initial, text: "other tab", revision: 1 });
    expect(result.current.status).toBe("conflict"); expect(result.current.remoteText).toBe("other tab"); expect(result.current.text).toBe("local");
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(onSave).not.toHaveBeenCalled();
    await act(async () => { await result.current.save(); });
    expect(onSave).toHaveBeenCalledExactlyOnceWith("local", 1); expect(result.current.status).toBe("saved");
  });
  it("clears only a confirmed sent snapshot, retaining edits made while that send was pending", () => {
    const { result } = renderHook(() => useSetupDraft({ ...initial, text: "sent", revision: 1, onSave: vi.fn(async () => null) }));
    act(() => result.current.change("new local edit"));
    act(() => result.current.sent("sent", ack("", 2)));
    expect(result.current.text).toBe("new local edit"); expect(result.current.conflict).toBe(true);
    act(() => result.current.sent("new local edit", null)); expect(result.current.text).toBe("new local edit");
  });
  it("clears the sent text on acknowledgement and restores a concurrent remote draft without sending it", () => {
    const { result } = renderHook(() => useSetupDraft({ ...initial, text: "sent", revision: 1, onSave: vi.fn(async () => null) }));
    act(() => result.current.sent("sent", ack("other tab draft", 2)));
    expect(result.current.text).toBe("other tab draft"); expect(result.current.status).toBe("saved");
    act(() => result.current.sent("other tab draft", ack("", 3)));
    expect(result.current.text).toBe(""); expect(result.current.status).toBe("saved");
  });
  it("protects reload while unsaved and removes the guard after confirmed save; stores no browser payload", async () => {
    const stored = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useSetupDraft({ ...initial, onSave: async (text, revision) => ack(text, revision + 1) }));
    act(() => result.current.change("not sent"));
    const pending = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(pending); expect(pending.defaultPrevented).toBe(true);
    await act(async () => { await result.current.save(); });
    const saved = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(saved); expect(saved.defaultPrevented).toBe(false);
    expect(stored).not.toHaveBeenCalled(); stored.mockRestore();
  });
  it("keeps invalid text editable but sends no oversized draft; empty text is a valid clear", async () => {
    const onSave = vi.fn(async (text: string, revision: number) => ack(text, revision + 1));
    const { result } = renderHook(() => useSetupDraft({ ...initial, text: "old", onSave }));
    act(() => result.current.change("x".repeat(4001)));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.valid).toBe(false); expect(onSave).not.toHaveBeenCalled();
    act(() => result.current.change("")); await act(async () => { await result.current.save(); });
    expect(onSave).toHaveBeenCalledExactlyOnceWith("", 0); expect(result.current.status).toBe("saved");
  });
});
