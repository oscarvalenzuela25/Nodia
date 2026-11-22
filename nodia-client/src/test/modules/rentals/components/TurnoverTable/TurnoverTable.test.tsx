import { ui, property, turnover, resetUI, page } from "../fixtures";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TurnoverTable from "../../../../../modules/rentals/components/TurnoverTable";
import i18n from "../../../../../translate";
import userEvent from "@testing-library/user-event";
beforeEach(resetUI);
afterEach(() => vi.restoreAllMocks());
it("uses the same preparation record and handlers on a mobile card while preserving unknown values", async () => {
  const original = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    ...original(query),
    matches: true,
  }));
  ui.list.mockReturnValue(
    page([{ ...turnover, linen_ready: null, planned_ready_at: null }]),
  );
  const open = vi.fn();
  render(
    <TurnoverTable
      property={property}
      onOpenReservation={vi.fn()}
      onOpenTurnover={open}
    />,
  );
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByRole("listitem")).toHaveTextContent(
    i18n.t("rental:unknown"),
  );
  expect(screen.getByRole("listitem")).toHaveTextContent(
    i18n.t("rental:not_recorded"),
  );
  await userEvent.click(
    screen.getByRole("button", { name: i18n.t("rental:review_preparation") }),
  );
  expect(open).toHaveBeenCalledWith(turnover.id);
  expect(ui.record).not.toHaveBeenCalled();
});
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

it("opens preparation directly from its table row and disables the action while unavailable", async () => {
  const listing = page([turnover]);
  ui.list.mockReturnValue(listing);
  const open = vi.fn();
  const view = render(
    <TurnoverTable
      property={property}
      onOpenReservation={vi.fn()}
      onOpenTurnover={open}
    />,
  );
  const name = i18n.t("rental:review_preparation");
  expect(screen.getByRole("table")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name }));
  expect(open).toHaveBeenCalledWith(turnover.id);

  ui.list.mockReturnValue({ ...listing, isFetching: true });
  view.rerender(
    <TurnoverTable
      property={property}
      onOpenReservation={vi.fn()}
      onOpenTurnover={open}
    />,
  );
  expect(screen.getByRole("button", { name })).toBeDisabled();
});
