import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SplitPaymentModal from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SplitPaymentModal";

describe("split payment dialog", () => {
  it("requires an exact positive allocation and preserves inputs to recover the same request", async () => {
    const user = userEvent.setup();
    const props = {
      open: true,
      total: "1200",
      methods: ["cash", "card", "bank_transfer"] as const,
      busy: false,
      pending: false,
      onClose: vi.fn(),
      onConfirm: vi.fn().mockResolvedValue(undefined),
      onReconcile: vi.fn().mockResolvedValue(undefined),
      onRetry: vi.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(<SplitPaymentModal {...props} />);
    const dialog = within(screen.getByRole("dialog", { name: "Distribuir pago" }));
    const cash = dialog.getByRole("textbox", { name: "Efectivo" });
    const card = dialog.getByRole("textbox", { name: "Tarjeta" });
    const transfer = dialog.getByRole("textbox", { name: "Transferencia" });
    const confirm = dialog.getByRole("button", { name: "Confirmar venta" });
    expect(confirm).toBeDisabled();

    await user.type(cash, "500");
    await user.type(card, "700");
    expect(confirm).toBeDisabled();
    await user.type(transfer, "1");
    expect(confirm).toBeDisabled();
    expect(dialog.getByRole("status")).toHaveTextContent("Exceso de pago");

    await user.clear(card);
    await user.type(card, "699");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(props.onConfirm).toHaveBeenCalledExactlyOnceWith([
      { payment_method: "cash", amount: "500" },
      { payment_method: "card", amount: "699" },
      { payment_method: "bank_transfer", amount: "1" },
    ]);

    rerender(<SplitPaymentModal {...props} pending />);
    expect(cash).toHaveValue("500");
    expect(cash).toBeDisabled();
    expect(card).toHaveValue("699");
    expect(transfer).toHaveValue("1");
    await user.click(dialog.getByRole("button", { name: "Reenviar misma solicitud" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });
});
