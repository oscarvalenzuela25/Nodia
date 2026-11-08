import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import SalesRecords from "../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesRecords";
import { getSales } from "../../../../../../../modules/business/infrastructure/salesServices";
import type { Sale, SalesResponse } from "../../../../../../../modules/business/infrastructure/salesTypes";
import useAuthStore from "../../../../../../../store/authStore";
import i18n from "../../../../../../../translate";
import { mobileViewport } from "./mobileViewport";

vi.mock("../../../../../../../modules/business/infrastructure/salesServices", () => ({ getSales: vi.fn() }));

const sale: Sale = { id: "synthetic-sale-a", business_id: "business-a", status: "draft", currency: "CLP", payment_method: "other", payment_method_description: "Historical method", total_amount: "0", version: 1, created_at: "2026-10-01T15:00:00Z", updated_at: "2026-10-01T15:00:00Z", completed_at: null, cancelled_at: null, cancellation_reason: null, items: [] };
const response = (value = sale, total = 51, page = 1): SalesResponse => ({ data: [value], meta: { total, page, limit: 25, total_pages: Math.ceil(total / 25) } });
const t = (key: string) => i18n.t(key);
function setup(businessId = "business-a") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}><LocalizationProvider dateAdapter={AdapterDayjs}>{children}</LocalizationProvider></QueryClientProvider>;
  const onOpen = vi.fn();
  return { ...render(<SalesRecords businessId={businessId} onOpen={onOpen} />, { wrapper }), onOpen };
}
const openFilter = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: t("core:open_filters") })); return screen.findByRole("dialog");
};
const filterAction = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, key: string) => {
  await user.click(within(dialog).getByRole("button", { name: t(key) }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
};
const chooseStatus = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, status: "completed" | "discarded") => {
  await user.click(within(dialog).getByRole("button", { name: t("business:pos.sale_status") }));
  await user.click(screen.getByRole("option", { name: t(`business:pos.status_${status}`) }));
};

describe("SalesRecords applied filters and scoped reads", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic actor" }, token: "synthetic-session", expiresAt: Date.now() + 60000, sessionStatus: "authenticated" });
    vi.mocked(getSales).mockImplementation(async (_businessId, params) => response(sale, 51, params.page));
  });
  it("preserves mobile filters, the server page and the exact detail identity while resizing across599/600", async () => {
    const viewport = mobileViewport(390), view = setup(), user = userEvent.setup();
    await screen.findByRole("article", { name: sale.id });
    const dialog = await openFilter(user); await chooseStatus(user, dialog, "completed");
    await filterAction(user, dialog, "core:filter_action");
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1].status).toBe("completed"));
    await user.click(screen.getByRole("button", { name: t("core:pagination.page_next") }));
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1].page).toBe(2));
    await waitFor(() => expect(screen.getByRole("button", { name: t("business:pos.open_sale") })).toBeEnabled());
    const reads = vi.mocked(getSales).mock.calls.length;
    for (const width of [320, 430, 599, 600, 390]) {
      act(() => viewport.resize(width));
      expect(Boolean(screen.queryByRole("table"))).toBe(width >= 600);
      expect(screen.getByText(i18n.t("business:filter_chips_status", { value: t("business:pos.status_completed") }))).toBeInTheDocument();
    }
    expect(getSales).toHaveBeenCalledTimes(reads);
    await user.click(screen.getByRole("button", { name: t("business:pos.open_sale") })); expect(view.onOpen).toHaveBeenCalledExactlyOnceWith(sale);
    const reopened = await openFilter(user);
    expect(within(reopened).getByRole("button", { name: t("business:pos.sale_status") })).toHaveTextContent(t("business:pos.status_completed"));
    expect(vi.mocked(getSales).mock.lastCall?.[1]).toMatchObject({ page: 2, limit: 25, status: "completed" });
  });
  it("keeps modal edits local, applies state and dates together, and restores applied values after cancelling", async () => {
    setup(); const user = userEvent.setup(); await screen.findByText(sale.id);
    expect(screen.queryByRole("heading", { name: t("business:pos.sales") })).not.toBeInTheDocument();
    let dialog = await openFilter(user); await chooseStatus(user, dialog, "completed");
    fireEvent.change(within(dialog).getByRole("textbox", { name: t("business:pos.from") }), { target: { value: "2026-10-01" } });
    expect(within(dialog).getByRole("button", { name: t("core:filter_action") })).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: t("business:pos.through") }), { target: { value: "2026-10-31" } });
    expect(getSales).toHaveBeenCalledTimes(1);
    await filterAction(user, dialog, "core:filter_action");
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1]).toMatchObject({ page: 1, status: "completed", from: "2026-10-01T03:00:00Z", to_exclusive: "2026-11-01T03:00:00Z" }));
    dialog = await openFilter(user); await chooseStatus(user, dialog, "discarded");
    fireEvent.change(within(dialog).getByRole("textbox", { name: t("business:pos.from") }), { target: { value: "2026-11-01" } });
    await filterAction(user, dialog, "core:cancel");
    expect(getSales).toHaveBeenCalledTimes(2);
    dialog = await openFilter(user);
    expect(within(dialog).getByRole("button", { name: t("business:pos.sale_status") })).toHaveTextContent(t("business:pos.status_completed"));
    expect(within(dialog).getByRole("textbox", { name: t("business:pos.from") })).toHaveValue("2026-10-01");
  });
  it("keeps search on the server and resets pagination when applying or clearing filters", async () => {
    setup(); const user = userEvent.setup(); await screen.findByText(sale.id);
    await user.click(screen.getByRole("button", { name: t("core:pagination.page_next") }));
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1].page).toBe(2));
    await user.type(screen.getByRole("textbox", { name: t("business:pos.sales_search_label") }), "  00123  ");
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1]).toMatchObject({ page: 1, search: "00123", limit: 25 }));
    let dialog = await openFilter(user); await chooseStatus(user, dialog, "discarded");
    await filterAction(user, dialog, "core:filter_action");
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1].status).toBe("discarded"));
    await user.click(screen.getByRole("button", { name: t("core:pagination.page_next") }));
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1].page).toBe(2));
    dialog = await openFilter(user); await filterAction(user, dialog, "core:clear_filters");
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1]).toEqual({ page: 1, limit: 25, search: "00123" }));
  });
  it("removes only the selected predicate chip and preserves the other applied predicate", async () => {
    setup(); const user = userEvent.setup(); await screen.findByText(sale.id);
    const dialog = await openFilter(user); await chooseStatus(user, dialog, "completed");
    fireEvent.change(within(dialog).getByRole("textbox", { name: t("business:pos.from") }), { target: { value: "2026-10-01" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: t("business:pos.through") }), { target: { value: "2026-10-01" } });
    await filterAction(user, dialog, "core:filter_action");
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1].status).toBe("completed"));
    await user.click(screen.getAllByTestId("filter-chip-action")[0]);
    await waitFor(() => expect(vi.mocked(getSales).mock.lastCall?.[1]).toEqual({ page: 1, limit: 25, search: undefined, from: "2026-10-01T03:00:00Z", to_exclusive: "2026-10-02T03:00:00Z" }));
  });
  it("never exposes a late previous-business result as the new business's rows", async () => {
    let resolveA!: (value: SalesResponse) => void;
    const b = { ...sale, id: "synthetic-sale-b", business_id: "business-b" };
    vi.mocked(getSales).mockImplementationOnce(() => new Promise((done) => { resolveA = done; })).mockResolvedValueOnce(response(b));
    const view = setup();
    view.rerender(<SalesRecords businessId="business-b" onOpen={view.onOpen} />);
    await screen.findByText(b.id);
    await act(async () => { resolveA(response()); });
    expect(screen.queryByText(sale.id)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: t("business:pos.open_sale") }));
    expect(view.onOpen).toHaveBeenCalledWith(b);
  });
  it("does not reuse the previous actor's rows or filters across a session change", async () => {
    setup(); await screen.findByText(sale.id);
    let resolveB!: (value: SalesResponse) => void;
    vi.mocked(getSales).mockImplementationOnce(() => new Promise((done) => { resolveB = done; }));
    act(() => { useAuthStore.setState((state) => ({ user: { id: "actor-b", name: "Other synthetic actor" }, sessionVersion: state.sessionVersion + 1 })); });
    expect(screen.queryByText(sale.id)).not.toBeInTheDocument();
    const other = { ...sale, id: "other-actor-authorized-sale" };
    await act(async () => { resolveB(response(other)); });
    expect(await screen.findByText(other.id)).toBeInTheDocument();
  });
  it("keeps historical detail actions and can retry a failed list read without changing its parameters", async () => {
    vi.mocked(getSales).mockRejectedValueOnce(new Error("Synthetic failure")).mockResolvedValueOnce(response());
    const view = setup(); expect(await screen.findByText(t("core:server_error_alert"))).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: t("core:retry") }));
    await screen.findByText(sale.id);
    expect(vi.mocked(getSales).mock.calls[1]).toEqual(vi.mocked(getSales).mock.calls[0]);
    expect(screen.getByText(t("business:pos.payment_other"))).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: t("business:pos.open_sale") }));
    expect(view.onOpen).toHaveBeenCalledWith(sale);
  });
  it("does not request a list without both actor and business identity", () => {
    const view = setup("");
    expect(getSales).not.toHaveBeenCalled();
    act(() => { useAuthStore.setState({ user: { id: "", name: "Unresolved synthetic actor" } }); });
    view.rerender(<SalesRecords businessId="business-a" onOpen={view.onOpen} />);
    expect(getSales).not.toHaveBeenCalled();
  });
  it("returns to an existing server page when the current page disappears after a refresh", async () => {
    let requests = 0;
    vi.mocked(getSales).mockImplementation(async (_businessId, params) => {
      requests++;
      return requests === 1 ? response() : { data: [], meta: { total: 0, page: params.page ?? 1, limit: 25, total_pages: 0 } };
    });
    setup(); await screen.findByText(sale.id);
    await userEvent.setup().click(screen.getByRole("button", { name: t("core:pagination.page_next") }));
    await screen.findByText(t("business:pos.sales_empty"));
    await waitFor(() => expect(vi.mocked(getSales).mock.calls.map(([, params]) => params.page)).toEqual([1, 2, 1]));
    expect(screen.getByRole("button", { name: t("core:pagination.page_previous") })).toBeDisabled();
  });
});
