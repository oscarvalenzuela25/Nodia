import { useEffect } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherLoading from "../../../../../modules/teacher/components/TeacherLoading";

describe("Teacher initial content loading", () => {
  it("renders visible Boneyard geometry without data or fabricated course content", () => {
    const { container, rerender } = render(<TeacherLoading loading />);
    expect(screen.getByRole("status", { name: "Cargando página..." })).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-boneyard-overlay="true"]')?.childElementCount).toBeGreaterThan(0);
    expect(container.querySelector("input,button,textarea")).not.toBeInTheDocument();
    rerender(<TeacherLoading loading compact />);
    expect(container.querySelector('[data-boneyard-overlay="true"]')?.childElementCount).toBeGreaterThan(0);
  });
  it("releases initial skeleton measurement before the live form mounts and retains its draft and caret", () => {
    const observers: TrackingResizeObserver[] = [];
    class TrackingResizeObserver implements ResizeObserver {
      observe = vi.fn<(target: Element, options?: ResizeObserverOptions) => void>();
      unobserve = vi.fn<(target: Element) => void>();
      disconnect = vi.fn<() => void>();
      constructor() { observers.push(this); }
    }
    const mounted = vi.fn();
    function Form() {
      useEffect(() => { mounted(); }, []);
      return <textarea aria-label="Retained multiline draft" />;
    }
    function View({ loading = false, compact = false, fetching = false, error = false }: {
      loading?: boolean; compact?: boolean; fetching?: boolean; error?: boolean;
    }) {
      return <>
        <TeacherLoading loading={loading} compact={compact}><Form /></TeacherLoading>
        <button disabled={fetching}>Read again</button>
        {error && <p role="alert">Synthetic read error</p>}
      </>;
    }
    vi.stubGlobal("ResizeObserver", TrackingResizeObserver);
    try {
      const { rerender } = render(<View loading />);
      expect(observers).toHaveLength(1);
      expect(observers[0].observe).toHaveBeenCalledOnce();
      expect(mounted).not.toHaveBeenCalled();
      rerender(<View />);
      expect(observers[0].disconnect).toHaveBeenCalledOnce();
      const editor = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Retained multiline draft" });
      fireEvent.change(editor, { target: { value: "Unsaved multiline\nanswer" } });
      editor.focus();
      editor.setSelectionRange(2, 9);
      rerender(<View compact fetching />);
      expect(screen.getByRole("textbox")).toBe(editor);
      expect(editor).toHaveValue("Unsaved multiline\nanswer");
      expect(editor).toHaveFocus();
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 9]);
      rerender(<View error />);
      expect(screen.getByRole("textbox")).toBe(editor);
      expect(editor).toHaveValue("Unsaved multiline\nanswer");
      expect(editor).toHaveFocus();
      expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 9]);
      expect(mounted).toHaveBeenCalledOnce();
      expect(observers).toHaveLength(1);
      expect(observers[0].disconnect).toHaveBeenCalledOnce();
      expect(screen.getByRole("alert")).toBeVisible();
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });
  it("keeps loaded content, unsaved edits and focus mounted through background fetching and read failure", () => {
    const mount = vi.fn();
    function Content() {
      useEffect(() => { mount(); }, []);
      return <><p>Previously loaded synthetic lesson</p><input aria-label="Synthetic draft" /></>;
    }
    function View({ fetching = false, error = false }: { fetching?: boolean; error?: boolean }) {
      // Query isLoading remains false when cached data exists, including a failed refetch.
      return <><TeacherLoading loading={false}><Content /></TeacherLoading><button disabled={fetching}>Read again</button>{error && <p role="alert">Synthetic read error</p>}</>;
    }
    const { container, rerender } = render(<View />);
    const input = screen.getByRole("textbox"); input.focus(); fireEvent.change(input, { target: { value: "Unsaved synthetic answer" } });
    rerender(<View fetching />);
    expect(screen.getByRole("textbox")).toBe(input); expect(input).toHaveFocus(); expect(input).toHaveValue("Unsaved synthetic answer");
    expect(screen.getByText("Previously loaded synthetic lesson")).toBeVisible();
    expect(container.querySelector('[data-boneyard-overlay="true"]')).not.toBeInTheDocument();
    rerender(<View error />);
    expect(input).toHaveValue("Unsaved synthetic answer"); expect(input).toHaveFocus(); expect(mount).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toBeVisible();
  });
});
