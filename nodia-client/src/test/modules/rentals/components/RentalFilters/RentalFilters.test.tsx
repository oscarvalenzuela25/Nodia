import { ui, property, resetUI } from "../fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalFilters from "../../../../../modules/rentals/components/RentalFilters";
import i18n from "../../../../../translate";
describe("RentalFilters", () => {
  beforeEach(resetUI);
  it("keeps a draft separate and rejects half a period before apply", async () => {
    const apply = vi.fn(),
      user = userEvent.setup();
    render(
      <RentalFilters
        resource="reservations"
        property={property}
        query={{ active: "active", page: 3 }}
        onApply={apply}
      />,
    );
    await user.click(screen.getByRole("button", { name: /filtrar|filtros/i }));
    await user.type(
      screen.getByLabelText(i18n.t("rental:from_on")),
      "2026-10-01",
    );
    expect(apply).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: i18n.t("core:filter_action") }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText(i18n.t("rental:to_on")),
      "2026-10-05",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("core:filter_action") }),
    );
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        from_on: "2026-10-01",
        to_on: "2026-10-05",
        page: 1,
      }),
    );
    expect(ui.execute).not.toHaveBeenCalled();
  });
  it("never offers active for monetary history", async () => {
    render(
      <RentalFilters
        resource="payments"
        property={property}
        query={{}}
        onApply={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /filtrar|filtros/i }),
    );
    expect(
      screen.queryByLabelText(i18n.t("rental:active")),
    ).not.toBeInTheDocument();
  });
});
