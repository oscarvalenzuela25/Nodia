import { ui, property, reservation, resetUI, result } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("keeps the stay visible after a failed refresh and retries before the next action", async () => {
  const row = { ...reservation, status: "confirmed" as const };
  const refetch = vi.fn();
  ui.record.mockReturnValue({ ...result(row), isError: true, refetch });
  const props = {
    property,
    id: row.id,
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onStay: vi.fn(),
    onOpenPayments: vi.fn(),
    onOpenTurnover: vi.fn(),
  };
  const view = render(<ReservationDetail {...props} />);
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription(row.guest_name);
  const next = screen.getByRole("button", { name: i18n.t("rental:start_stay") });
  expect(next).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: i18n.t("rental:retry") }));
  expect(refetch).toHaveBeenCalledOnce();
  ui.record.mockReturnValue(result(row));
  view.rerender(<ReservationDetail {...props} />);
  await userEvent.click(next);
  expect(props.onStay).toHaveBeenCalledWith(row, "start");
});
