import { ui, property, reservation, resetUI, result } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReservationCancel from "../../../../../modules/rentals/components/ReservationCancel";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("requires a new review after the ledger changes, retaining edited cancellation inputs", async () => {
  const current = { ...reservation, status: "confirmed" as const };
  ui.record.mockReturnValue(result(current));
  const props = {
    property,
    reservation: current,
    open: true,
    onClose: vi.fn(),
  };
  const { rerender } = render(<ReservationCancel {...props} />);
  const date = screen.getByLabelText(i18n.t("rental:cancelled_at"));
  fireEvent.change(date, { target: { value: "2026-10-04T18:00:00Z" } });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:preview_cancellation") }),
  );
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeInTheDocument());
  await userEvent.click(screen.getByRole("checkbox"));
  const submit = within(screen.getByRole("dialog")).getByRole("button", {
    name: i18n.t("rental:cancel_reservation"),
  });
  expect(submit).toBeEnabled();
  ui.record.mockReturnValue(result({ ...current, received_amount: "99999" }));
  rerender(<ReservationCancel {...props} />);
  expect(submit).toBeDisabled();
  expect(date).toHaveValue("2026-10-04T18:00:00Z");
  expect(ui.execute).not.toHaveBeenCalled();
});
