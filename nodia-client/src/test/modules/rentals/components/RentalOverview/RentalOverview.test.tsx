import { property, resetUI, overview } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalOverview from "../../../../../modules/rentals/components/RentalOverview";
import i18n from "../../../../../translate";
beforeEach(resetUI);
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
