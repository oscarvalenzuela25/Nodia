import {
  financeMock,
  resetFinanceMocks,
  group,
} from "../FinanceCatalogModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceGroupModal from "../../../../../modules/finances/components/FinanceGroupModal";
import i18n from "../../../../../translate";

describe("FinanceGroupModal", () => {
  beforeEach(resetFinanceMocks);
  it("hydrates selected categories in one detail request and preserves historical selection on save", async () => {
    const withoutDetail = { ...group, categories: undefined };
    render(
      <FinanceGroupModal open onClose={vi.fn()} initialData={withoutDetail} />,
    );
    expect(screen.getByText("Histórica")).toBeInTheDocument();
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
        id: group.id,
        data: {
          name: group.name,
          key: group.key,
          is_active: true,
          category_ids: ["99"],
        },
      }),
    );
    expect(financeMock.record).toHaveBeenCalledWith(
      "category-groups",
      group.id,
      true,
    );
    expect(
      financeMock.record.mock.calls.some(
        ([resource]) => resource === "categories",
      ),
    ).toBe(false);
  });
  it("keeps the selected categories and changed fields after server rejection", async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    financeMock.save.mockRejectedValue(new Error("conflict"));
    render(<FinanceGroupModal open onClose={closed} initialData={group} />);
    const key = screen.getByLabelText(new RegExp(i18n.t("finance:key")));
    await user.clear(key);
    await user.type(key, "new-key");
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() => expect(financeMock.save).toHaveBeenCalledTimes(1));
    expect(key).toHaveValue("new-key");
    expect(screen.getByText("Histórica")).toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();
  });
  it("can create a group with no categories", async () => {
    const user = userEvent.setup();
    render(<FinanceGroupModal open onClose={vi.fn()} />);
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:name"))),
      "Vacío",
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:key"))),
      "empty",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() =>
      expect(financeMock.save).toHaveBeenCalledWith({
        data: {
          name: "Vacío",
          key: "empty",
          is_active: true,
          category_ids: [],
        },
      }),
    );
  });
});
