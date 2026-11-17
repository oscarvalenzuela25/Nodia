import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../../../../translate";
import { CashExpenseCategoryPicker } from "../../../../../modules/business/components/CashExpenseCategoryPicker";

vi.mock("../../../../../modules/business/infrastructure/useCashServices", () => ({
  useCashCategoryOptions: () => ({
    data: { pages: [{ data: [{ id: "2", name: "Compras", is_active: true }] }] },
    isFetching: false,
    isError: false,
  }),
}));

describe("Invoice expense category selector", () => {
  it("shows the historical inactive choice, discloses the effect and sends explicit clearing", async () => {
    await i18n.changeLanguage("es");
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onQuickCreate = vi.fn();
    render(
      <CashExpenseCategoryPicker
        scope={{ businessId: "business-a", actorId: "1", sessionVersion: 9 }}
        selected={{ id: "7", name: "Histórica", is_active: false }}
        onChange={onChange}
        onQuickCreate={onQuickCreate}
      />,
    );
    expect(screen.getByText("Histórica (inactiva)")).toBeVisible();
    const help = screen.getByRole("button", { name: i18n.t("business:cash.expense_category_help_label") });
    await user.click(help);
    expect(help).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(i18n.t("business:cash.expense_category_help"))).toBeVisible();
    const clear = screen.getByRole("button", { name: i18n.t("core:clear_selection") });
    clear.focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(null);
    const trigger = screen.getByRole("button", { name: i18n.t("business:cash.expense_category") });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: i18n.t("business:cash.category_add") }));
    expect(onQuickCreate).toHaveBeenCalledOnce();
  });
});
