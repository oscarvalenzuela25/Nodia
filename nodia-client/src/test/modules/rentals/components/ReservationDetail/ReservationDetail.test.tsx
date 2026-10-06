import { ui, property, reservation, resetUI, result } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReservationDetail from "../../../../../modules/rentals/components/ReservationDetail";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("shows authoritative amounts and restricts actions by reservation state", () => {
  ui.record.mockReturnValue(
    result({
      ...reservation,
      status: "completed",
      balance_due_amount: "9007199254740993",
    }),
  );
  render(
    <ReservationDetail
      property={property}
      id="1"
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      onStay={vi.fn()}
      onOpenPayments={vi.fn()}
      onOpenTurnover={vi.fn()}
    />,
  );
  expect(screen.getByText(/9\.007\.199\.254\.740\.993/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: i18n.t("rental:cancel_reservation") }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: i18n.t("rental:payments_and_refunds") }),
  ).toBeEnabled();
});
