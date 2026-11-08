import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InvoiceRowActions from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/InvoiceRowActions";

describe("InvoiceRowActions", () => {
  const setup = () => ({ index: 0, disabled: false, onMatch: vi.fn(), onEdit: vi.fn(), onRemove: vi.fn() });

  it.each([
    ["Vincular con un producto existente", "onMatch"],
    ["Editar fila", "onEdit"],
    ["Quitar fila de la lista", "onRemove"],
  ] as const)("runs only %s and closes the menu", async (label, callback) => {
    const user = userEvent.setup();
    const props = setup();
    render(<InvoiceRowActions {...props} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Acciones del producto 1" }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    await user.click(screen.getByRole("menuitem", { name: label }));
    expect(props[callback]).toHaveBeenCalledOnce();
    for (const name of ["onMatch", "onEdit", "onRemove"] as const) {
      if (name !== callback) expect(props[name]).not.toHaveBeenCalled();
    }
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("supports keyboard opening, escape and focus return", async () => {
    const user = userEvent.setup();
    render(<InvoiceRowActions {...setup()} />);
    const trigger = screen.getByRole("button", { name: "Acciones del producto 1" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("blocks the trigger and already-open actions while the parent is busy", async () => {
    const user = userEvent.setup();
    const props = setup();
    const view = render(<InvoiceRowActions {...props} />);
    await user.click(screen.getByRole("button", { name: "Acciones del producto 1" }));
    view.rerender(<InvoiceRowActions {...props} disabled />);
    for (const action of screen.getAllByRole("menuitem")) {
      expect(action).toHaveAttribute("aria-disabled", "true");
    }
    await user.keyboard("{Enter}");
    expect(props.onMatch).not.toHaveBeenCalled();
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(props.onRemove).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Acciones del producto 1" })).toBeDisabled();
  });
});
