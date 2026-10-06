import { ui, resetUI, renderRoute } from "../../components/fixtures";
import { beforeEach, expect, it } from "vitest";
import { screen, act } from "@testing-library/react";
import RentalReservations from "../../../../../modules/rentals/pages/RentalReservations";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("rejects invalid property IDs before enabling dependent views", () => {
  renderRoute(
    <RentalReservations />,
    "/tools/reservations?property=1e2&tab=payments",
  );
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t("rental:invalid_input"))).toBeInTheDocument();
});
it("protects navigation while an operation is unresolved", async () => {
  ui.uncertain = true;
  const { router } = renderRoute(<RentalReservations />);
  await act(async () => {
    await router.navigate("/elsewhere");
  });
  expect(screen.queryByText("Elsewhere")).not.toBeInTheDocument();
  expect(
    screen.getAllByText(i18n.t("rental:pending_navigation")).length,
  ).toBeGreaterThan(0);
});
