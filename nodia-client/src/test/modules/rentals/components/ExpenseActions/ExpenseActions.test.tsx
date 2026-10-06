import { ui, property, expense, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExpenseActions from "../../../../../modules/rentals/components/ExpenseActions";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("uses a dedicated void command and preserves changed input when rejected", async () => {
  const close = vi.fn();
  render(
    <ExpenseActions
      open
      property={property}
      expense={{ ...expense, status: "paid" }}
      action="void"
      onClose={close}
    />,
  );
  const reason = screen.getByRole("textbox", {
    name: new RegExp(i18n.t("rental:void_reason")),
  });
  await userEvent.type(reason, "Wrong test expense");
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("core:confirm") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith({
      operation: "expense.void",
      id: expense.id,
      data: { reason: "Wrong test expense" },
    }),
  );
  expect(close).not.toHaveBeenCalled();
  expect(reason).toHaveValue("Wrong test expense");
});
