import { ui, property, reservation, resetUI, result } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReservationPreview from "../../../../../modules/rentals/components/ReservationPreview";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("reads only the selected reservation and delegates full detail without writing", async () => {
  const open = vi.fn();
  render(<ReservationPreview property={property} id={reservation.id} onClose={vi.fn()} onOpen={open} onTurnover={vi.fn()} />);
  expect(ui.record).toHaveBeenCalledWith("reservations", property.id, reservation.id);
  expect(screen.getByText(reservation.guest_name)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: i18n.t("rental:calendar_full_detail") }));
  expect(open).toHaveBeenCalledWith(reservation.id);
  expect(ui.execute).not.toHaveBeenCalled();
});
it("keeps the detail readable during a rejected revalidation and blocks dependent actions", () => {
  ui.record.mockReturnValue({ ...result(reservation), isError: true });
  render(<ReservationPreview property={property} id={reservation.id} onClose={vi.fn()} onOpen={vi.fn()} onPayment={vi.fn()} onTurnover={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("rental:load_error"));
  expect(screen.getByText(reservation.guest_name)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: i18n.t("rental:calendar_full_detail") })).toBeDisabled();
});
