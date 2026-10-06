import { ui, property, resetUI, renderRoute } from "../fixtures";
import { beforeEach, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalWorkspace from "../../../../../modules/rentals/components/RentalWorkspace";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("mounts only the visible tab and ignores an invalid tab query", async () => {
  const { router } = renderRoute(
    <RentalWorkspace property={property} />,
    "/tools/reservations?tab=invalid&property=1",
  );
  expect(
    screen.getByRole("tab", { name: i18n.t("rental:tabs.general") }),
  ).toHaveAttribute("aria-selected", "true");
  expect(ui.list).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("tab", { name: i18n.t("rental:tabs.turnovers") }),
  );
  expect(router.state.location.search).toContain("tab=turnovers");
  expect(ui.list).toHaveBeenCalledWith("turnovers", property.id, {
    page: 1,
    limit: 10,
  });
  expect(ui.list.mock.calls.some(([resource]) => resource === "expenses")).toBe(
    false,
  );
});
