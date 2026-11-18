import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CashAppliedFilters } from "../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/CashFiltersBar";
import type { CashFilters } from "../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/cashFilters";
import i18n from "../../../../../../../translate";

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
