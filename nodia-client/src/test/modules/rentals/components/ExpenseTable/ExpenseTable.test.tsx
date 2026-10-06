import { ui, property, resetUI } from "../fixtures";
import { beforeEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExpenseTable from "../../../../../modules/rentals/components/ExpenseTable";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("permits real expenses on an archived house without hiding paid or voided history", () => {
  render(<ExpenseTable property={{ ...property, is_active: false }} />);
  expect(ui.list).toHaveBeenCalledWith("expenses", property.id, {
    page: 1,
    limit: 10,
  });
  expect(
    screen.getByRole("button", { name: i18n.t("rental:create") }),
  ).toBeEnabled();
});
