import { ui, property, turnover, resetUI, result } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TurnoverModal from "../../../../../modules/rentals/components/TurnoverModal";
import i18n from "../../../../../translate";

beforeEach(resetUI);
it("keeps edited inputs open when the write is rejected", async () => {
  const row = turnover as typeof turnover;
  ui.execute.mockRejectedValueOnce(new Error("known rejection"));

  ui.record.mockReturnValue(result(row));
  const close = vi.fn();
  render(
    <TurnoverModal property={property} open id={row.id} onClose={close} />,
  );
  const input = screen.getByLabelText(i18n.t("rental:notes"));
  fireEvent.change(input, { target: { value: "Edited after initial data" } });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "turnover.update",
        data: expect.objectContaining({ notes: "Edited after initial data" }),
      }),
    ),
  );
  expect(close).not.toHaveBeenCalled();
  expect(input).toHaveValue("Edited after initial data");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("requires saving form edits before approval and sends approval only for the saved plan", async () => {
  const row = {
    ...turnover,
    same_day_required: true,
    needs_approval: true,
    plan_valid: true,
  };
  ui.record.mockReturnValue(result(row));
  render(
    <TurnoverModal property={property} open id={row.id} onClose={vi.fn()} />,
  );
  const approve = screen.getByRole("button", {
    name: i18n.t("rental:approve_saved_plan"),
  });
  expect(approve).toBeEnabled();
  const notes = screen.getByLabelText(i18n.t("rental:notes"));
  fireEvent.change(notes, { target: { value: "Pendiente de guardar" } });
  await waitFor(() => expect(approve).toBeDisabled());
  expect(ui.execute).not.toHaveBeenCalled();
  fireEvent.change(notes, { target: { value: row.notes ?? "" } });
  await waitFor(() => expect(approve).toBeEnabled());
  await userEvent.click(approve);
  expect(ui.execute).toHaveBeenCalledWith({
    operation: "turnover.approve_same_day",
    id: row.id,
    data: {},
  });
});
