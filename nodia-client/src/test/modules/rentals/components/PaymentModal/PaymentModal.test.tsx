import {
  moneyMock,
  resetMoneyMocks,
  property,
  reservation,
  result,
} from "./fixtures";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentModal from "../../../../../modules/rentals/components/PaymentModal";
import i18n from "../../../../../translate";
describe("PaymentModal", () => {
  beforeEach(resetMoneyMocks);
  it("preserves a changed monetary draft when the API rejects it", async () => {
    const user = userEvent.setup();
    moneyMock.execute.mockResolvedValue(undefined);
    render(
      <PaymentModal
        open
        property={property}
        reservationId={reservation.id}
        onClose={() => {
          throw new Error("Must remain open");
        }}
      />,
    );
    const amount = screen.getByLabelText(new RegExp(i18n.t("rental:amount")));
    await user.type(amount, "12345");
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(moneyMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "payment.create",
          data: expect.objectContaining({
            amount: "12345",
            type: "payment",
            reservation_id: reservation.id,
            method: null,
          }),
        }),
      ),
    );
    expect(amount).toHaveValue("12345");
    expect(screen.getByRole("dialog")).toBeVisible();
  });
  it("requires manual Airbnb terms and sends them only with its first draft payment", async () => {
    const user = userEvent.setup();
    moneyMock.record.mockReturnValue(
      result({
        ...reservation,
        channel: "airbnb",
        external_reference: "QA AIRBNB",
        deposit_amount: "0",
        cancellation_policy_id: null,
      }),
    );
    render(
      <PaymentModal
        open
        property={property}
        reservationId={reservation.id}
        onClose={() => undefined}
      />,
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("rental:amount"))),
      "1000",
    );
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("rental:platform_reference"))),
      "Airbnb R42",
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("rental:platform_description"))),
      "Agreed terms",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(moneyMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platform_policy: {
              reference: "Airbnb R42",
              description: "Agreed terms",
            },
          }),
        }),
      ),
    );
  });
  it("does not invent an approved refund for an uncancelled reservation", async () => {
    render(
      <PaymentModal
        open
        property={property}
        reservationId={reservation.id}
        initialType="refund"
        onClose={() => undefined}
      />,
    );
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
    expect(
      screen.getByText(i18n.t("rental:payment_unavailable")),
    ).toBeVisible();
  });
  it("blocks overpayment and a future effective date before HTTP", async () => {
    const user = userEvent.setup();
    render(
      <PaymentModal
        open
        property={property}
        reservationId={reservation.id}
        onClose={() => undefined}
      />,
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("rental:amount"))),
      "100001",
    );
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
    const date = screen.getByLabelText(
      new RegExp(i18n.t("rental:occurred_on")),
    );
    await user.clear(date);
    await user.type(date, "2099-01-01");
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
    expect(moneyMock.execute).not.toHaveBeenCalled();
  });
  it("blocks altered input and submission while the original intent is uncertain", () => {
    moneyMock.uncertain = true;
    render(
      <PaymentModal
        open
        property={property}
        reservationId={reservation.id}
        onClose={() => undefined}
      />,
    );
    expect(
      screen.getByLabelText(new RegExp(i18n.t("rental:amount"))),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
  });
});

it("blocks a first Airbnb capture without its reservation reference", () => {
  moneyMock.record.mockReturnValue(
    result({ ...reservation, channel: "airbnb", external_reference: null }),
  );
  render(
    <PaymentModal
      open
      property={property}
      reservationId={reservation.id}
      onClose={() => {
        throw new Error("Remain open");
      }}
    />,
  );
  expect(
    screen.getByText(i18n.t("rental:airbnb_reference_required")),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  ).toBeDisabled();
  expect(moneyMock.execute).not.toHaveBeenCalled();
});
