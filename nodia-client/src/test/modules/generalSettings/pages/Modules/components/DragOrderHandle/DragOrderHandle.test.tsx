import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DragOrderHandle from "../../../../../../../modules/generalSettings/pages/Modules/components/DragOrderHandle";
import type { DragHandleBindings } from "../../../../../../../modules/generalSettings/pages/Modules/components/DragOrderHandle";

describe("DragOrderHandle", () => {
  it("preserves the accessible handle when starting and ending a drag", () => {
    const error = vi.spyOn(console, "error");
    const item = { kind: "group" as const, id: "1", sortOrder: 0, label: "Example group" };
    const bindings: DragHandleBindings = { onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn(), onLostPointerCapture: vi.fn(), onKeyDown: vi.fn() };
    try {
      const view = render(<DragOrderHandle item={item} disabled={false} bindings={bindings} />);
      const button = screen.getByRole("button", { name: "Arrastrar Example group" });
      view.rerender(<DragOrderHandle item={item} disabled={false} dragging bindings={bindings} />);
      view.rerender(<DragOrderHandle item={item} disabled={false} dragging={false} bindings={bindings} />);
      expect(button).toBeEnabled();
      expect(error).not.toHaveBeenCalled();
    } finally { error.mockRestore(); }
  });
});
