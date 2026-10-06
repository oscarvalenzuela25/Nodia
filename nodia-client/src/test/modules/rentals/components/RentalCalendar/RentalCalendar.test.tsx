import { property, resetUI, calendar } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalCalendar from "../../../../../modules/rentals/components/RentalCalendar";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("provides the agenda as a keyboard-accessible alternative with stable reservation links", async () => {
  const open = vi.fn();
  render(
    <RentalCalendar
      property={property}
      onOpenReservation={open}
      onOpenTurnover={vi.fn()}
      onManageBlocks={vi.fn()}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:show_agenda") }),
  );
  if (calendar.reservations.length) {
    await userEvent.click(
      screen.getAllByRole("button", {
        name: new RegExp(calendar.reservations[0].guest_name),
      })[0],
    );
    expect(open).toHaveBeenCalledWith(calendar.reservations[0].id);
  } else
    expect(
      screen.getByText(i18n.t("rental:empty_calendar")),
    ).toBeInTheDocument();
});
