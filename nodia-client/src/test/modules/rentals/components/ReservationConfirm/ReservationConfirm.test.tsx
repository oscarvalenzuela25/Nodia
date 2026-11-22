import { ui, property, reservation, resetUI, result } from "../fixtures";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as services from "../../../../../modules/rentals/infrastructure/useServices";
import ReservationConfirm from "../../../../../modules/rentals/components/ReservationConfirm";
import i18n from "../../../../../translate";
beforeEach(resetUI);
afterEach(() => vi.restoreAllMocks());
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

it("retries a failed availability read without asserting that no turnovers apply", async () => {
  const refetch = vi.fn();
  vi.spyOn(services, "useRentalAvailability").mockReturnValue({
    ...result(),
    isError: true,
    refetch,
  } as unknown as ReturnType<typeof services.useRentalAvailability>);
  render(
    <ReservationConfirm
      open
      property={property}
      reservation={reservation}
      onClose={vi.fn()}
      onOpenTurnover={vi.fn()}
    />,
  );
  expect(screen.getByText(i18n.t("rental:load_error"))).toBeInTheDocument();
  expect(screen.queryByText(i18n.t("rental:no_same_day_requirements"))).not.toBeInTheDocument();
  expect(screen.queryByText(i18n.t("rental:availability_no_conflicts"))).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: i18n.t("rental:confirm_reservation") })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: i18n.t("rental:retry") }));
  expect(refetch).toHaveBeenCalledOnce();
  expect(ui.execute).not.toHaveBeenCalled();
});
