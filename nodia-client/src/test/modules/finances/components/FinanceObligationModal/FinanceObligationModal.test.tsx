import {
  financeMock,
  resetFinanceMocks,
  obligation,
} from "../FinanceCatalogModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceObligationModal from "../../../../../modules/finances/components/FinanceObligationModal";
import i18n from "../../../../../translate";

describe("FinanceObligationModal", () => {
  beforeEach(resetFinanceMocks);
  it("creates obligation plus its initial movement with exactly one POST payload", async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    render(<FinanceObligationModal open onClose={closed} />);
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:name"))),
      "Amigo",
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:key"))),
      "friend",
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:amount"))),
      "100000",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:initial_category") }),
    );
    await user.click(screen.getByText("Comida"));
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() =>
      expect(financeMock.save).toHaveBeenCalledWith({
        data: {
          name: "Amigo",
          key: "friend",
          amount: "100000",
          is_active: true,
          type: "loan",
          category_id: "10",
          description: null,
        },
      }),
    );
    expect(financeMock.save).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it("updates principal without sending immutable type or creation-only category", async () => {
    const user = userEvent.setup();
    render(
      <FinanceObligationModal
        open
        onClose={vi.fn()}
        initialData={obligation}
      />,
    );
    const amount = screen.getByLabelText(new RegExp(i18n.t("finance:amount")));
    await user.clear(amount);
    await user.type(amount, "120000");
    expect(
      screen.getByRole("button", { name: i18n.t("finance:type") }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.queryByRole("button", {
        name: i18n.t("finance:initial_category"),
      }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() =>
      expect(financeMock.save).toHaveBeenCalledWith({
        id: obligation.id,
        data: {
          name: obligation.name,
          key: obligation.key,
          amount: "120000",
          is_active: true,
          description: null,
        },
      }),
    );
  });
  it("keeps amount and description drafts when a principal conflict occurs", async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    financeMock.save.mockRejectedValue(
      new Error("principal below confirmed payments"),
    );
    render(
      <FinanceObligationModal open onClose={closed} initialData={obligation} />,
    );
    const amount = screen.getByLabelText(new RegExp(i18n.t("finance:amount")));
    await user.clear(amount);
    await user.type(amount, "20000");
    const description = screen.getByLabelText(
      new RegExp(i18n.t("finance:description")),
    );
    await user.type(description, "Conservar esta nota");
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() => expect(financeMock.save).toHaveBeenCalledTimes(1));
    expect(amount).toHaveValue("20000");
    expect(description).toHaveValue("Conservar esta nota");
    expect(closed).not.toHaveBeenCalled();
  });
});
