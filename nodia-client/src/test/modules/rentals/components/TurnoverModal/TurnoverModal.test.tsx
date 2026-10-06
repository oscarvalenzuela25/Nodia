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
