import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CashRecords,
  CashTotals,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/CashRecords";
import { cashMovementName } from "../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/cashLabels";
import type { CashMovement } from "../../../../../../../modules/business/infrastructure/cashTypes";
import i18n from "../../../../../../../translate";

const invoiceMovement: CashMovement = {
  id: "ab000000-0000-4000-8000-000000000001",
  business_id: "ab000000-0000-4000-8000-000000000002",
  source: "invoice",
  invoice: { id: "42", code: null },
  description: null,
  type: "expense",
  category_id: "31",
  category: { id: "31", name: "Mercadería", is_active: false },
  occurred_on: "2024-02-29",
  amount: "9999999999999",
  version: 5,
  is_active: true,
};

describe("Cash records row/card actions", () => {
  it.each([false, true])("offers invoice editing and the same activity callback (mobile=%s)", async (mobile) => {
    const onEdit = vi.fn();
    const onToggle = vi.fn();
    const name = cashMovementName(invoiceMovement, i18n.t);
    const props = { rows: [invoiceMovement], hasSnapshot: true, mobile, loading: false, formatDate: (date: string) => date, onEdit, onToggle };
    const { rerender } = render(<CashRecords {...props} disabled={false} />);
    const access = screen.getByRole("button", { name: i18n.t(mobile ? "layout:mobile_cards.actions" : "business:cash.movement_actions", { name }) });
    const user = userEvent.setup();
    await user.click(access);
    await user.click(screen.getByRole("menuitem", { name: i18n.t("business:cash.edit_invoice") }));
    expect(onEdit).toHaveBeenCalledWith(invoiceMovement);
    expect(onToggle).not.toHaveBeenCalled();
    await user.click(access);
    expect(screen.getByRole("menuitem", { name: i18n.t("business:action_deactivate") })).not.toHaveAttribute("aria-disabled", "true");

    rerender(<CashRecords {...props} disabled />);
    expect(within(screen.getByRole("menu")).getByRole("menuitem", { name: i18n.t("business:action_deactivate") })).toHaveAttribute("aria-disabled", "true");
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("Cash totals", () => {
  it("presents the supplied aggregate at full CLP precision, including an explicit zero", () => {
    render(<CashTotals loading={false} period="2024-02-29" summary={{
      currency: "CLP",
      income: { count: 24, total_amount: "9007199254740993" },
      expense: { count: 0, total_amount: "0" },
    }} />);
    const summary = screen.getByRole("status");
    expect(summary).toHaveTextContent(/9[.,]007[.,]199[.,]254[.,]740[.,]993/);
    expect(summary).toHaveTextContent(/CLP\s+0|0\s+CLP/);
  });
});
