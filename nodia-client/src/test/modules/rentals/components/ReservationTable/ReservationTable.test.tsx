import { ui, property, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReservationTable from "../../../../../modules/rentals/components/ReservationTable";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("requests active reservations by house and opens a stable record without per-row reads", async () => {
  const open = vi.fn();
  render(
    <ReservationTable
      property={property}
      onOpenReservation={open}
      onEditReservation={vi.fn()}
      onCreateReservation={vi.fn()}
    />,
  );
  expect(ui.list).toHaveBeenCalledWith("reservations", property.id, {
    page: 1,
    limit: 10,
    active: "active",
  });
  expect(ui.record).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getAllByRole("button", {
      name: /acciones.*#|acciones.*registro|actions.*#/i,
    })[0],
  );
  await userEvent.click(
    screen.getByRole("menuitem", { name: i18n.t("rental:open_detail") }),
  );
  expect(open).toHaveBeenCalledWith(expect.any(String));
});
