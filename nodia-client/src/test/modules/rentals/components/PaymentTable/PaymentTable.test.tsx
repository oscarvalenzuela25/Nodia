import { ui, property, resetUI } from "../fixtures";
import { beforeEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentTable from "../../../../../modules/rentals/components/PaymentTable";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("keeps financial capture available for an archived house and sends no active filter", () => {
  render(
    <PaymentTable
      property={{ ...property, is_active: false }}
      reservationId="2"
    />,
  );
  expect(ui.list).toHaveBeenCalledWith("payments", property.id, {
    page: 1,
    limit: 10,
    reservation_id: "2",
  });
  expect(
    screen.getByRole("button", { name: i18n.t("rental:create") }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: i18n.t("rental:create_refund") }),
  ).toBeEnabled();
});
