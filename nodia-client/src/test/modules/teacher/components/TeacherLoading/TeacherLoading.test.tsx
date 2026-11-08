import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
