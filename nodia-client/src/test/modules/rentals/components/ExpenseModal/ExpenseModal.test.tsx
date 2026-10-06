import {
  moneyMock,
  resetMoneyMocks,
  property,
  expense,
} from "../PaymentModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExpenseModal from "../../../../../modules/rentals/components/ExpenseModal";
import i18n from "../../../../../translate";
describe("ExpenseModal", () => {
  beforeEach(resetMoneyMocks);
  it("preserves changed input after a rejected edit", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    moneyMock.execute.mockResolvedValue(undefined);
    render(
      <ExpenseModal
        open
        property={property}
        initialData={expense}
        onClose={close}
      />,
    );
    const name = screen.getByLabelText(new RegExp(i18n.t("rental:name")));
    await user.clear(name);
    await user.type(name, "Changed cleaning expense");
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() => expect(moneyMock.execute).toHaveBeenCalled());
    expect(name).toHaveValue("Changed cleaning expense");
    expect(close).not.toHaveBeenCalled();
  });
  it("edits metadata of a paid expense without resending frozen commercial fields", async () => {
    const user = userEvent.setup();
    render(
      <ExpenseModal
        open
        property={property}
        initialData={{ ...expense, status: "paid", paid_on: "2026-10-02" }}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText(new RegExp(i18n.t("rental:amount"))),
    ).toBeDisabled();
    expect(
      screen.getByLabelText(new RegExp(i18n.t("rental:incurred_on"))),
    ).toBeDisabled();
    expect(
      screen.getByLabelText(new RegExp(i18n.t("rental:paid_on"))),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(moneyMock.execute).toHaveBeenCalledWith({
        operation: "expense.update",
        id: expense.id,
        data: {
          name: expense.name,
          category: expense.category,
          notes: expense.notes,
          reservation_id: null,
        },
      }),
    );
  });
  it("clears an optional association using null, never selects another reservation", async () => {
    const user = userEvent.setup();
    render(
      <ExpenseModal
        open
        property={property}
        initialData={{ ...expense, reservation_id: "1" }}
        onClose={vi.fn()}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t("rental:reservation")),
      "",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    );
    await waitFor(() =>
      expect(moneyMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reservation_id: null }),
        }),
      ),
    );
  });
  it("prevents editing an already voided expense", () => {
    render(
      <ExpenseModal
        open
        property={property}
        initialData={{ ...expense, status: "voided" }}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: i18n.t("rental:save") }),
    ).toBeDisabled();
  });
});
