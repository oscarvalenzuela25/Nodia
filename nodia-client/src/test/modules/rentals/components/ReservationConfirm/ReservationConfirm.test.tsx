import { ui, property, reservation, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReservationConfirm from "../../../../../modules/rentals/components/ReservationConfirm";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("does not permit a direct confirmation without the agreed deposit being received", () => {
  render(
    <ReservationConfirm
      open
      property={property}
      reservation={{
        ...reservation,
        channel: "whatsapp",
        received_amount: "0",
        deposit_amount: "20000",
      }}
      onClose={vi.fn()}
      onOpenTurnover={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: i18n.t("rental:confirm_reservation") }),
  ).toBeDisabled();
  expect(ui.execute).not.toHaveBeenCalled();
  expect(
    screen.getByText(i18n.t("rental:direct_deposit_required")),
  ).toBeInTheDocument();
});

it("explains the Airbnb reservation reference required before confirmation", () => {
  render(
    <ReservationConfirm
      open
      property={property}
      reservation={{
        ...reservation,
        channel: "airbnb",
        external_reference: null,
      }}
      onClose={vi.fn()}
      onOpenTurnover={vi.fn()}
    />,
  );
  expect(
    screen.getByText(i18n.t("rental:airbnb_reference_required")),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: i18n.t("rental:confirm_reservation") }),
  ).toBeDisabled();
});
