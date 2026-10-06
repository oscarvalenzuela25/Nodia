import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import SameDayReview from "../../../../../modules/rentals/components/SameDayReview";
it("allows explicit consent for a prospective invalid persisted neighbor plan", async () => {
  const change = vi.fn();
  const open = vi.fn();
  render(
    <SameDayReview
      requirements={[
        {
          incoming_reservation_id: "11",
          turnover_id: "22",
          needs_approval: true,
          plan_valid: false,
        },
      ]}
      selected={[]}
      onChange={change}
      onOpenTurnover={open}
    />,
  );
  await userEvent.setup().click(screen.getByRole("checkbox"));
  expect(change).toHaveBeenCalledWith(["22"]);
  await userEvent.setup().click(screen.getByRole("button"));
  expect(open).toHaveBeenCalledWith("22");
});
it("cannot consent to a nonexistent turnover ID", () => {
  render(
    <SameDayReview
      requirements={[
        {
          incoming_reservation_id: null,
          turnover_id: null,
          needs_approval: true,
          plan_valid: false,
        },
      ]}
      selected={[]}
      onChange={vi.fn()}
      onOpenTurnover={vi.fn()}
    />,
  );
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
