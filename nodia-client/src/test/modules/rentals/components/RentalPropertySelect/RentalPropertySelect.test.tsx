import { ui, resetUI, page } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalPropertySelect from "../../../../../modules/rentals/components/RentalPropertySelect";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("distinguishes an empty house catalogue and provides a working creation action", async () => {
  ui.list.mockReturnValue(page([]));
  const create = vi.fn();
  render(
    <RentalPropertySelect value={null} onChange={vi.fn()} onCreate={create} />,
  );
  expect(screen.getByText(i18n.t("rental:property_empty"))).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:create_property") }),
  );
  expect(create).toHaveBeenCalledOnce();
  expect(ui.list).toHaveBeenCalledWith("properties", undefined, {
    active: "all",
    page: 1,
    limit: 1,
  });
});
