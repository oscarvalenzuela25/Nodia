import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinanceDeleteDialog from "../../../../../modules/finances/components/FinanceDeleteDialog";
const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  review: vi.fn(),
  busy: false,
  uncertain: false,
}));
vi.mock("../../../../../modules/finances/infrastructure/useServices", () => ({
  useFinanceBusy: () => mocks.busy,
  useFinanceDelete: () => ({
    mutateAsync: mocks.remove,
    reviewResult: mocks.review,
    isPending: false,
    isReviewing: false,
    isUncertain: mocks.uncertain,
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.busy = false;
  mocks.uncertain = false;
});
const record = { id: "9007199254740993", name: "Préstamo personal" };
describe("FinanceDeleteDialog", () => {
  it("requires confirmation, preserves target on conflict and closes only after a successful retry", async () => {
    const user = userEvent.setup(),
      onDeleted = vi.fn(),
      onClose = vi.fn();
    mocks.remove
      .mockRejectedValueOnce(new Error("finance:obligation_has_payments"))
      .mockResolvedValueOnce(undefined);
    render(
      <FinanceDeleteDialog
        resource="obligations"
        record={record}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Solo se puede eliminar si no tiene pagos",
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(record.id));
    expect(screen.getByRole("dialog")).toHaveTextContent(record.name);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });
  it.each([true, false])(
    "reviews uncertain writes instead of replaying deletion; absent=%s",
    async (absent) => {
      const user = userEvent.setup(),
        onDeleted = vi.fn();
      mocks.uncertain = true;
      mocks.review.mockResolvedValue(absent);
      render(
        <FinanceDeleteDialog
          resource="categories"
          record={record}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />,
      );
      await user.click(
        screen.getByRole("button", { name: "Revisar resultado" }),
      );
      await waitFor(() => expect(mocks.review).toHaveBeenCalledWith(record.id));
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(onDeleted).toHaveBeenCalledTimes(absent ? 1 : 0);
    },
  );
  it("blocks confirmation and cancellation while another finance write is running", () => {
    mocks.busy = true;
    render(
      <FinanceDeleteDialog
        resource="movements"
        record={record}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
