import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashAppliedFilters, CashFiltersButton } from "../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/CashFiltersBar";
import type { CashFilters } from "../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/cashFilters";
import i18n from "../../../../../../../translate";

vi.mock("../../../../../../../modules/business/infrastructure/useCashServices", () => ({
  useCashCategoryOptions: () => ({ isFetching: false, isError: false }),
}));

describe("Cash filter dialog", () => {
  it("displays an applied custom range and resets to the current inclusive month", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-01T03:59:59Z"));
    try {
      const applied: CashFilters = {
        from: "2025-02-10", to: "2025-03-03", activity: "inactive", category: { id: "3", name: "Compras" },
      };
      const onApply = vi.fn();
      const user = userEvent.setup();
      render(<CashFiltersButton scope={{ businessId: "business-a", actorId: "1", sessionVersion: 1 }}
        applied={applied} onApply={onApply} disabled={false} />);
      await user.click(screen.getByRole("button", { name: i18n.t("core:open_filters") }));
      const dialog = within(await screen.findByRole("dialog"));
      expect(dialog.getByRole("textbox", { name: i18n.t("business:cash.from") })).toHaveValue(applied.from);
      expect(dialog.getByRole("textbox", { name: i18n.t("business:cash.to") })).toHaveValue(applied.to);
      expect(onApply).not.toHaveBeenCalled();
      await user.click(dialog.getByRole("button", { name: i18n.t("core:clear_filters") }));
      expect(onApply).toHaveBeenCalledExactlyOnceWith({
        from: "2026-06-01", to: "2026-06-30", activity: "active", category: null,
      });
    } finally {
      clock.mockRestore();
    }
  });
});

describe("Cash applied filters", () => {
  it("names the active status and omits implicit filters", async () => {
    const applied: CashFilters = { from: "", to: "", activity: "active", category: null };
    const onApply = vi.fn();
    const status = i18n.t("business:cash.filter_activity", { status: i18n.t("core:active_filter.active") });
    const user = userEvent.setup();
    const { rerender } = render(
      <CashAppliedFilters applied={applied} period={i18n.t("business:cash.all_dates")} onApply={onApply} disabled={false} />,
    );

    expect(screen.getByText(status)).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("business:cash.all_categories"))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t("business:cash.all_dates"))).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: i18n.t("core:remove_filter", { label: status }) }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith({ ...applied, activity: "all" });

    rerender(<CashAppliedFilters applied={{ ...applied, activity: "all" }} period="" onApply={onApply} disabled={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
