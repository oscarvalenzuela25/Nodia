import {
  ui,
  property,
  reservation,
  turnover,
  resetUI,
  result,
} from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReservationStayActions from "../../../../../modules/rentals/components/ReservationStayActions";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("a planned readiness never authorizes entry, and an inapplicable command remains dismissible", async () => {
  ui.record.mockReturnValue(
    result({
      ...turnover,
      linen_ready: true,
      cleaning_status: "pending",
      planned_ready_at: "2099-01-01T18:00:00Z",
      ready_at: null,
    }),
  );
  const close = vi.fn();
  render(
    <ReservationStayActions
      open
      property={property}
      reservation={{
        ...reservation,
        status: "confirmed",
        check_out_at: "2099-01-01T18:00:00Z",
      }}
      command="start"
      onClose={close}
    />,
  );
  expect(
    screen.getByRole("button", { name: i18n.t("core:confirm") }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("core:cancel") }),
  );
  expect(close).toHaveBeenCalledOnce();
  expect(ui.execute).not.toHaveBeenCalled();
});
