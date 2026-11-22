import {
  moneyMock,
  overview,
  property,
  resetMoneyMocks,
  result,
} from "../PaymentModal/fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalOverview from "../../../../../modules/rentals/components/RentalOverview";
import i18n from "../../../../../translate";
beforeEach(resetMoneyMocks);
it("shows the server's net cash and routes to the associated financial history", async () => {
  const payments = vi.fn();
  render(<RentalOverview property={property} onViewPayments={payments} />);
  expect(screen.getByText(i18n.t("rental:cash_net"))).toBeInTheDocument();
  expect(overview.scope.includes_archived_history).toBe(true);
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:view_payments") }),
  );
  expect(payments).toHaveBeenCalledOnce();
});

it("applies a complete period and labels placeholder amounts with their response dates", async () => {
  const originalPeriod = { from_on: "2026-10-10", to_on: "2026-10-20" };
  const nextPeriod = { from_on: "2026-09-01", to_on: "2026-09-12" };
  const onPeriodChange = vi.fn();
  const view = render(
    <RentalOverview
      property={property}
      period={originalPeriod}
      onPeriodChange={onPeriodChange}
    />,
  );
  const apply = screen.getByRole("button", {
    name: i18n.t("rental:cash_apply_period"),
  });
  expect(apply).toBeDisabled();
  fireEvent.change(screen.getByLabelText(i18n.t("rental:from_on")), {
    target: { value: nextPeriod.from_on },
  });
  fireEvent.change(screen.getByLabelText(i18n.t("rental:to_on")), {
    target: { value: "" },
  });
  expect(apply).toBeDisabled();
  expect(moneyMock.overview.mock.lastCall?.[1]).toEqual(originalPeriod);
  fireEvent.change(screen.getByLabelText(i18n.t("rental:to_on")), {
    target: { value: nextPeriod.to_on },
  });
  await userEvent.click(apply);
  expect(onPeriodChange).toHaveBeenCalledWith(nextPeriod);

  moneyMock.overview.mockReturnValue({ ...result(overview), isFetching: true });
  view.rerender(
    <RentalOverview
      property={property}
      period={nextPeriod}
      onPeriodChange={onPeriodChange}
    />,
  );
  expect(moneyMock.overview.mock.lastCall?.[1]).toEqual(nextPeriod);
  const cash = screen.getByRole("region", { name: i18n.t("rental:overview_cash") });
  const format = new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    dateStyle: "medium",
  });
  expect(within(cash).getByText(i18n.t("rental:cash_displayed_period", {
    from: format.format(new Date("2026-10-10T00:00:00Z")),
    to: format.format(new Date("2026-10-19T00:00:00Z")),
  }))).toBeInTheDocument();
  expect(apply).toBeDisabled();
});

it("keeps an unverified refund amount distinct from a real zero and rejects a mismatched scope", async () => {
  moneyMock.overview.mockReturnValue(
    result({
      ...overview,
      pending: { ...overview.pending, refund_amount: null, expense_amount: "0" },
    }),
  );
  const view = render(<RentalOverview property={property} cashOnly />);
  const pending = screen.getByRole("region", {
    name: i18n.t("rental:overview_pending"),
  });
  expect(within(pending).getByText(i18n.t("rental:unknown"))).toBeInTheDocument();
  expect(
    within(pending).getByText(i18n.t("rental:pending_expenses")).nextElementSibling,
  ).toHaveTextContent("0");

  const mismatched = result({
    ...overview,
    scope: { ...overview.scope, property_id: "999" },
  });
  moneyMock.overview.mockReturnValue(mismatched);
  view.rerender(<RentalOverview property={property} cashOnly />);
  expect(screen.queryByText(i18n.t("rental:cash_net"))).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:retry") }),
  );
  expect(mismatched.refetch).toHaveBeenCalledOnce();
});
