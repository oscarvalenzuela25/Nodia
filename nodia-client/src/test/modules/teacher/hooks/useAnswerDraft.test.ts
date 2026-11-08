import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEACHER_ANSWER_IDLE_MS, useAnswerDraft } from "../../../../modules/teacher/hooks/useAnswerDraft";
import type { Answer } from "../../../../modules/teacher/infrastructure/schemas";

type Props = { answer: Answer | null; revision: number; busy: boolean; editable: boolean };
const initial: Props = { answer: null, revision: 1, busy: false, editable: true };
const answer = (text: string): Answer => ({ kind: "short_text", text });
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Teacher answer autosave", () => {
  it("keeps an oversized local answer for correction without sending invalid draft commands", async () => {
    const onSave = vi.fn(async () => 2);
    const { result } = renderHook(() => useAnswerDraft({ ...initial, onSave, onDraft: vi.fn() }));
    act(() => result.current.change(answer("x".repeat(2001))));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.valid).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    act(() => result.current.change(answer("reviewed")));
    await act(async () => { await vi.advanceTimersByTimeAsync(TEACHER_ANSWER_IDLE_MS); });
    expect(onSave).toHaveBeenCalledOnce();
  });
  it("debounces one CAS draft command and preserves a newer local edit across its late ACK", async () => {
    const completions: ((value: number | null) => void)[] = [];
    const onSave = vi.fn(() => new Promise<number | null>(resolve => completions.push(resolve)));
    const onDraft = vi.fn();
    const { result, rerender } = renderHook((props: Props) => useAnswerDraft({ ...props, onSave, onDraft }), { initialProps: initial });
    act(() => result.current.change(answer("first")));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => result.current.change(answer("second")));
    await act(async () => { await vi.advanceTimersByTimeAsync(TEACHER_ANSWER_IDLE_MS); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith(answer("second"), 1);
    rerender({ ...initial, busy: true });
    act(() => result.current.change(answer("newer queued edit")));
    rerender({ ...initial, answer: answer("second"), revision: 2, busy: true });
    await act(async () => { completions[0](2); });
    expect(result.current.answer).toEqual(answer("newer queued edit"));
    expect(result.current.status).toBe("unsaved");
    expect(result.current.revision).toBe(2);
    rerender({ ...initial, answer: answer("second"), revision: 2 });
    await act(async () => { await vi.advanceTimersByTimeAsync(TEACHER_ANSWER_IDLE_MS); });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(answer("newer queued edit"), 2);
    await act(async () => { completions[1](3); });
  });

  it("stops automatic retries after an error or uncertain command and keeps the draft", async () => {
    const onSave = vi.fn(async () => null);
    const { result, rerender } = renderHook((props: Props) => useAnswerDraft({ ...props, onSave, onDraft: vi.fn() }), { initialProps: initial });
    act(() => result.current.change(answer("keep me")));
    await act(async () => { await vi.advanceTimersByTimeAsync(TEACHER_ANSWER_IDLE_MS); });
    expect(result.current.status).toBe("save_failed");
    expect(result.current.answer).toEqual(answer("keep me"));
    rerender({ ...initial, busy: true });
    rerender(initial);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(onSave).toHaveBeenCalledTimes(1);
    rerender({ ...initial, answer: answer("keep me"), revision: 2 });
    expect(result.current.status).toBe("saved");
    act(() => result.current.change(answer("a reviewed correction")));
    await act(async () => { await vi.advanceTimersByTimeAsync(TEACHER_ANSWER_IDLE_MS); });
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending timer during pause and accepts the atomically stored pause draft", async () => {
    const onSave = vi.fn(async () => 2);
    const { result, rerender } = renderHook((props: Props) => useAnswerDraft({ ...props, onSave, onDraft: vi.fn() }), { initialProps: initial });
    act(() => result.current.change(answer("pause draft")));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    rerender({ ...initial, busy: true, editable: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(onSave).not.toHaveBeenCalled();
    rerender({ ...initial, answer: answer("pause draft"), revision: 2, busy: false, editable: false });
    expect(result.current.status).toBe("saved");
    rerender({ ...initial, answer: answer("pause draft"), revision: 2 });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects stale acknowledgements and blocks automatic rebasing over another tab", async () => {
    const onSave = vi.fn(async () => 3);
    const { result, rerender } = renderHook((props: Props) => useAnswerDraft({ ...props, onSave, onDraft: vi.fn() }), { initialProps: { ...initial, answer: answer("old"), revision: 2 } });
    act(() => result.current.change(answer("local")));
    rerender({ ...initial, answer: answer("stale"), revision: 1 });
    expect(result.current.answer).toEqual(answer("local"));
    expect(result.current.revision).toBe(2);
    rerender({ ...initial, answer: answer("other tab"), revision: 3 });
    expect(result.current.status).toBe("conflict");
    expect(result.current.answer).toEqual(answer("local"));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(onSave).not.toHaveBeenCalled();
  });
});
