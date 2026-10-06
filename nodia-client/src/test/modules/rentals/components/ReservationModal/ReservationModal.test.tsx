import { ui, property, reservation, resetUI } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReservationModal from "../../../../../modules/rentals/components/ReservationModal";
import i18n from "../../../../../translate";

beforeEach(resetUI);
it("keeps edited inputs open when the write is rejected", async () => {
  const row = { ...reservation, status: "confirmed" } as typeof reservation;
  ui.execute.mockRejectedValueOnce(new Error("known rejection"));
  const close = vi.fn();
  render(
    <ReservationModal
      property={property}
      open
      initialData={row}
      onClose={close}
    />,
  );
  const input = screen.getByLabelText(i18n.t("rental:notes"));
  fireEvent.change(input, { target: { value: "Edited after initial data" } });
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:save") }),
  );
  await waitFor(() =>
    expect(ui.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "reservation.update",
        data: expect.objectContaining({ notes: "Edited after initial data" }),
      }),
    ),
  );
  expect(close).not.toHaveBeenCalled();
  expect(input).toHaveValue("Edited after initial data");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
