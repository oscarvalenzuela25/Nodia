import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import OrderControls from "../../../../../../../modules/generalSettings/pages/Modules/components/OrderControls";

const ordering = {
  previous: { id: "9007199254740993", sort_order: 0 },
  next: { id: "9007199254740994", sort_order: 8 },
};

describe("OrderControls", () => {
  it("uses real neighbor boundaries and supports keyboard movement", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<OrderControls label="Reservas" ordering={{ ...ordering, previous: null }} onMove={onMove} />);
    expect(screen.getByRole("button", { name: "Subir Reservas" })).toBeDisabled();
    const down = screen.getByRole("button", { name: "Bajar Reservas" });
    await user.tab();
    expect(down).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onMove).toHaveBeenCalledExactlyOnceWith("down");
  });

  it.each([
    { disabled: true, pending: false, ordering },
    { disabled: false, pending: true, ordering },
    { disabled: false, pending: false, ordering: undefined },
  ])("does not move while unavailable, pending or missing metadata: %j", (props) => {
    const onMove = vi.fn();
    render(<OrderControls label="Grupo" {...props} onMove={onMove} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(true);
    for (const button of buttons) fireEvent.click(button);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("dispatches the clicked direction without changing entity metadata", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<OrderControls label="Usuarios" ordering={ordering} onMove={onMove} />);
    await user.click(screen.getByRole("button", { name: "Subir Usuarios" }));
    expect(onMove).toHaveBeenCalledExactlyOnceWith("up");
    expect(ordering.previous.id).toBe("9007199254740993");
  });
});
