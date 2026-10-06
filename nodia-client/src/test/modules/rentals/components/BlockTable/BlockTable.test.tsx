import { ui, property, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BlockTable from "../../../../../modules/rentals/components/BlockTable";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("includes active blocks by default and prevents new blocking for an archived house", () => {
  render(
    <BlockTable
      property={{ ...property, is_active: false }}
      onCreate={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
  expect(ui.list).toHaveBeenCalledWith("blocks", property.id, {
    page: 1,
    limit: 10,
    active: "active",
  });
  expect(
    screen.queryByRole("button", { name: i18n.t("rental:create") }),
  ).not.toBeInTheDocument();
});
