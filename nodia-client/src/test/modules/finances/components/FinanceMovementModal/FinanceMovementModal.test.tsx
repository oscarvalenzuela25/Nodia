import {
  financeMock,
  resetFinanceMocks,
  movement,
  obligation,
  category,
} from "../FinanceCatalogModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceMovementModal from "../../../../../modules/finances/components/FinanceMovementModal";
import { movementSchema } from "../../../../../modules/finances/components/FinanceMovementModal/schema";
import i18n from "../../../../../translate";

describe("FinanceMovementModal", () => {
  beforeEach(resetFinanceMocks);
  it.each(["0", "-1", "1.5", "1e3", " 100", "9223372036854775808"])(
    "rejects noninteger or out-of-range amount %s",
    (amount) => {
      expect(
        movementSchema.safeParse({
          name: "Test",
          amount,
          type: "income",
          status: "received",
          category_id: "10",
          obligation_id: null,
          is_active: true,
        }).success,
      ).toBe(false);
    },
  );
  it("keeps linked direction and obligation immutable and preserves changed amount on failure", async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    financeMock.save.mockRejectedValue(new Error("overpayment"));
    render(
      <FinanceMovementModal open onClose={closed} initialData={movement} />,
    );
    expect(
      screen.getByRole("button", { name: i18n.t("finance:type") }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: i18n.t("finance:obligation") }),
    ).toHaveAttribute("aria-disabled", "true");
    const amount = screen.getByLabelText(new RegExp(i18n.t("finance:amount")));
    await user.clear(amount);
    await user.type(amount, "70000");
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() =>
      expect(financeMock.save).toHaveBeenCalledWith({
        id: movement.id,
        data: {
          name: "Pago",
          amount: "70000",
          category_id: category.id,
          is_active: true,
          status: "received",
        },
      }),
    );
    expect(amount).toHaveValue("70000");
    expect(closed).not.toHaveBeenCalled();
  });
  it("initial amount is protected and omitted from movement updates", async () => {
    const initial = {
      ...movement,
      id: obligation.initial_movement.id,
      type: "expense" as const,
      status: "paid" as const,
      amount: "100000",
    };
    render(
      <FinanceMovementModal open onClose={vi.fn()} initialData={initial} />,
    );
    expect(
      screen.getByLabelText(new RegExp(i18n.t("finance:amount"))),
    ).toBeDisabled();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: i18n.t("finance:save") }),
      ).toBeEnabled(),
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: i18n.t("finance:save") }));
    await waitFor(() =>
      expect(financeMock.save).toHaveBeenCalledWith({
        id: initial.id,
        data: {
          name: "Pago",
          category_id: category.id,
          is_active: true,
          status: "paid",
        },
      }),
    );
  });
  it("a cancelled movement offers no reopening status", async () => {
    render(
      <FinanceMovementModal
        open
        onClose={vi.fn()}
        initialData={{ ...movement, status: "cancelled" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: i18n.t("finance:status") }),
    ).toHaveAttribute("aria-disabled", "true");
  });
  it("a repayment creation is a single income request for a loan", async () => {
    const user = userEvent.setup();
    render(
      <FinanceMovementModal open onClose={vi.fn()} obligation={obligation} />,
    );
    const paymentLabel = i18n.t("finance:register_payment");
    expect(
      screen.getByRole("dialog", { name: paymentLabel }),
    ).toHaveAccessibleDescription(
      i18n.t("finance:payment_for", { name: obligation.name }),
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:name"))),
      "Abono",
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:amount"))),
      "20000",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:category") }),
    );
    await user.click(screen.getByText("Comida"));
    await user.click(screen.getByRole("button", { name: paymentLabel }));
    await waitFor(() =>
      expect(financeMock.save).toHaveBeenCalledWith({
        data: {
          name: "Abono",
          amount: "20000",
          type: "income",
          status: "received",
          category_id: "10",
          obligation_id: "30",
          is_active: true,
        },
      }),
    );
    expect(financeMock.save).toHaveBeenCalledTimes(1);
  });
  it("keeps the draft and blocks writes until the linked obligation loads on retry", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    financeMock.record.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      refetch: retry,
    });
    const close = vi.fn();
    const { rerender } = render(
      <FinanceMovementModal open onClose={close} initialData={movement} />,
    );
    const amount = screen.getByLabelText(new RegExp(i18n.t("finance:amount")));
    await user.clear(amount);
    await user.type(amount, "30000");
    expect(screen.getByRole("alert")).toHaveTextContent(
      i18n.t("finance:obligation_detail_error"),
    );
    const save = screen.getByRole("button", { name: i18n.t("finance:save") });
    expect(save).toBeDisabled();
    expect(financeMock.save).not.toHaveBeenCalled();
    retry.mockImplementation(() => {
      financeMock.record.mockReturnValue({
        data: obligation,
        isError: false,
        isFetching: false,
        refetch: retry,
      });
    });
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:retry") }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(
      <FinanceMovementModal open onClose={close} initialData={movement} />,
    );
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(amount).toHaveValue("30000");
  });
});
