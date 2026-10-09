import { ui, property, reservation, page, resetUI } from "../fixtures";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReservationTable from "../../../../../modules/rentals/components/ReservationTable";
import i18n from "../../../../../translate";
import { formatRentalAmount } from "../../../../../modules/rentals/utils/money";
beforeEach(resetUI);
afterEach(() => vi.restoreAllMocks());
const mobile = () => vi.spyOn(window, "matchMedia").mockImplementation(query => ({
  matches: query.includes("max-width:599.95px"), media: query, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
}));
const props = () => ({ property, onOpenReservation: vi.fn(), onEditReservation: vi.fn(), onCreateReservation: vi.fn() });
it("uses mobile cards with the same records and detail/edit handlers", async () => {
  mobile(); const callbacks = props();
  ui.list.mockReturnValue(page([reservation]));
  render(<ReservationTable {...callbacks} />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: reservation.guest_name })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: i18n.t("rental:open_detail") }));
  expect(callbacks.onOpenReservation).toHaveBeenCalledWith(reservation.id);
  await userEvent.click(screen.getByRole("button", { name: i18n.t("layout:mobile_cards.actions", { name: reservation.guest_name }) }));
  await userEvent.click(screen.getByRole("menuitem", { name: i18n.t("rental:edit") }));
  expect(callbacks.onEditReservation).toHaveBeenCalledWith(reservation);
  expect(ui.record).not.toHaveBeenCalled();
});
it("retains cards and disables actions during refetch, preserving server pagination", async () => {
  mobile(); const callbacks = props();
  ui.list.mockReturnValue({ ...page([reservation], 25), isFetching: true });
  const view = render(<ReservationTable {...callbacks} />);
  expect(screen.getByRole("article", { name: reservation.guest_name })).toBeVisible();
  expect(screen.getByRole("button", { name: i18n.t("rental:open_detail") })).toBeDisabled();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
  ui.list.mockReturnValue(page([reservation], 25));
  view.rerender(<ReservationTable {...callbacks} />);
  await userEvent.click(screen.getByRole("button", { name: i18n.t("rental:next_page") }));
  expect(ui.list).toHaveBeenLastCalledWith("reservations", property.id, { page: 2, limit: 10, active: "active" });
});
it("distinguishes a mobile empty list from failure and retries without per-row requests", async () => {
  mobile(); const callbacks = props(); const query = page([]);
  ui.list.mockReturnValue(query);
  const view = render(<ReservationTable {...callbacks} />);
  expect(screen.getByText(i18n.t("rental:empty"))).toBeInTheDocument();
  ui.list.mockReturnValue({ ...query, isError: true });
  view.rerender(<ReservationTable {...callbacks} />);
  expect(screen.queryByText(i18n.t("rental:empty"))).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("rental:load_error"));
  await userEvent.click(screen.getByRole("button", { name: i18n.t("rental:retry") }));
  expect(query.refetch).toHaveBeenCalledTimes(1);
});
it("keeps cached mobile records visible after a refetch error and preserves a real zero balance", () => {
  mobile(); ui.list.mockReturnValue({ ...page([{ ...reservation, balance_due_amount: "0", is_active: false }]), isError: true });
  render(<ReservationTable {...props()} />);
  expect(screen.getByRole("article", { name: reservation.guest_name })).toBeVisible();
  expect(screen.getByText(i18n.t("rental:inactive"))).toBeInTheDocument();
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByText(formatRentalAmount("0", "es"))).toBeInTheDocument();
});
it("shows Boneyard only on the initial mobile fetch and keeps controls disabled", () => {
  mobile(); const callbacks = props();
  ui.list.mockReturnValue({ ...page([]), data: undefined, isLoading: true, isFetching: true });
  const view = render(<ReservationTable {...callbacks} />);
  expect(view.container.querySelector("[data-boneyard-overlay]")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: i18n.t("rental:create") })).toBeDisabled();
  expect(screen.queryByText(i18n.t("rental:empty"))).not.toBeInTheDocument();
  ui.list.mockReturnValue({ ...page([reservation]), isFetching: true });
  view.rerender(<ReservationTable {...callbacks} />);
  expect(view.container.querySelector("[data-boneyard-overlay]")).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: reservation.guest_name })).toBeVisible();
});
it("requests active reservations by house and opens a stable record without per-row reads", async () => {
  const open = vi.fn();
  render(
    <ReservationTable
      property={property}
      onOpenReservation={open}
      onEditReservation={vi.fn()}
      onCreateReservation={vi.fn()}
    />,
  );
  expect(ui.list).toHaveBeenCalledWith("reservations", property.id, {
    page: 1,
    limit: 10,
    active: "active",
  });
  expect(ui.record).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getAllByRole("button", {
      name: /acciones.*#|acciones.*registro|actions.*#/i,
    })[0],
  );
  await userEvent.click(
    screen.getByRole("menuitem", { name: i18n.t("rental:open_detail") }),
  );
  expect(open).toHaveBeenCalledWith(expect.any(String));
});
