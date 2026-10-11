import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FinanceRecordCard from "../../../../../modules/finances/components/FinanceRecordCard";

describe("FinanceRecordCard", () => {
  it("keeps exact values and dispatches deletion from its translated mobile menu", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <FinanceRecordCard
        record={{ name: "Movimiento", is_active: true }}
        fields={[
          { key: "amount", label: "Monto", value: "$9.007.199.254.740.993" },
          { key: "id", label: "ID", value: "9007199254740993" },
        ]}
        actions={{
          onEdit: vi.fn(),
          onToggle: vi.fn(),
          onDelete,
          disabled: false,
          paymentDisabled: false,
        }}
      />,
    );
    expect(screen.getByText("9007199254740993")).toBeVisible();
    expect(screen.getByText("$9.007.199.254.740.993")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Acciones de Movimiento" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
  it("blocks payment for closed obligations and blocks every action during refetch", async () => {
    const user = userEvent.setup();
    const actions = {
      onEdit: vi.fn(),
      onToggle: vi.fn(),
      onPayment: vi.fn(),
      onDelete: vi.fn(),
      disabled: false,
      paymentDisabled: true,
    };
    const view = render(
      <FinanceRecordCard
        record={{ name: "Préstamo", is_active: false }}
        fields={[]}
        actions={actions}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Acciones de Préstamo" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Registrar pago" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Activar" })).toBeVisible();
    view.rerender(
      <FinanceRecordCard
        record={{ name: "Préstamo", is_active: false }}
        fields={[]}
        actions={{ ...actions, disabled: true }}
      />,
    );
    for (const item of screen.getAllByRole("menuitem"))
      expect(item).toHaveAttribute("aria-disabled", "true");
  });
});
