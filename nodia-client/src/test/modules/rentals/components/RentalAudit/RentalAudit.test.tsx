import { ui, property, resetUI } from "../fixtures";
import { beforeEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RentalAudit from "../../../../../modules/rentals/components/RentalAudit";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("uses paginated property audit records without per-row fetches or editing commands", () => {
  render(<RentalAudit property={property} />);
  expect(ui.list).toHaveBeenCalledWith("audit-events", property.id, {
    page: 1,
    limit: 10,
  });
  expect(ui.record).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: i18n.t("rental:create") }),
  ).not.toBeInTheDocument();
});
