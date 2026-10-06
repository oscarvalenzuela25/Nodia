import { financeMock, resetFinanceMocks, category } from "./fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceCatalogModal from "../../../../../modules/finances/components/FinanceCatalogModal";
import i18n from "../../../../../translate";

describe("FinanceCatalogModal", () => {
  beforeEach(resetFinanceMocks);
  it("trims fields, sends a single create and closes only after confirmed success", async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    render(<FinanceCatalogModal open onClose={closed} />);
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:name"))),
      "  Casa  ",
    );
    await user.type(
      screen.getByLabelText(new RegExp(i18n.t("finance:key"))),
      " home ",
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() =>
      expect(financeMock.save).toHaveBeenCalledWith({
        data: { name: "Casa", key: "home", is_active: true },
      }),
    );
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it("preserves changed values and the modal after a rejected update, then permits correction", async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    financeMock.save.mockRejectedValueOnce(new Error("duplicated key"));
    render(
      <FinanceCatalogModal open onClose={closed} initialData={category} />,
    );
    const name = screen.getByLabelText(new RegExp(i18n.t("finance:name")));
    await user.clear(name);
    await user.type(name, "Compras revisadas");
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() => expect(financeMock.save).toHaveBeenCalledTimes(1));
    expect(closed).not.toHaveBeenCalled();
    expect(name).toHaveValue("Compras revisadas");
    await user.click(
      screen.getByRole("button", { name: i18n.t("finance:save") }),
    );
    await waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
  });
  it("guards two form submissions before the first write resolves", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    financeMock.save.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(
      <FinanceCatalogModal open onClose={vi.fn()} initialData={category} />,
    );
    const form = screen
      .getByLabelText(new RegExp(i18n.t("finance:name")))
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(financeMock.save).toHaveBeenCalledTimes(1));
    resolve(category);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: i18n.t("finance:save") }),
      ).toBeEnabled(),
    );
  });
  it("blocks another write while an uncertain result must be reviewed", async () => {
    financeMock.uncertain = true;
    render(
      <FinanceCatalogModal open onClose={vi.fn()} initialData={category} />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: i18n.t("finance:save") }),
      ).toBeDisabled(),
    );
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: i18n.t("finance:review_result") }),
      );
    expect(financeMock.review).toHaveBeenCalledTimes(1);
    expect(financeMock.save).not.toHaveBeenCalled();
  });
});
