import { ui, property, turnover, resetUI, page } from "../fixtures";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TurnoverTable from "../../../../../modules/rentals/components/TurnoverTable";
import i18n from "../../../../../translate";
beforeEach(resetUI);
it("distinguishes unknown linen from false and true without requesting detail for each row", () => {
  ui.list.mockReturnValue(
    page([
      { ...turnover, id: "31", linen_ready: null },
      { ...turnover, id: "32", linen_ready: false },
      { ...turnover, id: "33", linen_ready: true },
    ]),
  );
  render(
    <TurnoverTable
      property={property}
      onOpenReservation={vi.fn()}
      onOpenTurnover={vi.fn()}
    />,
  );
  for (const key of ["unknown", "no", "yes"])
    expect(screen.getByText(i18n.t(`rental:${key}`))).toBeInTheDocument();
  expect(ui.record).not.toHaveBeenCalled();
});
