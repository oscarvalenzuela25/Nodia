import { ui, property, payment, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentVoid from "../../../../../modules/rentals/components/PaymentVoid";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("retains the reason and modal when voiding is rejected, including on an archived house", async () => {
  const close = vi.fn();
  render(
    <PaymentVoid
      open
      property={{ ...property, is_active: false }}
      payment={{ ...payment, status: "confirmed" }}
      onClose={close}
    />,
  );
  const reason = screen.getByRole("textbox", {
    name: new RegExp(i18n.t("rental:void_reason")),
  });
  await userEvent.type(reason, "Duplicate test receipt");
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("core:confirm") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith({
      operation: "payment.void",
      id: payment.id,
      data: { reason: "Duplicate test receipt" },
    }),
  );
  expect(close).not.toHaveBeenCalled();
  expect(reason).toHaveValue("Duplicate test receipt");
});
