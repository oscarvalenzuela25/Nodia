import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSalesReports } from "../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/useSalesReports";
import { getSalesSummary, getTopProducts } from "../../../../../../../modules/business/infrastructure/salesServices";
import type { SalesSummary, TopProducts } from "../../../../../../../modules/business/infrastructure/salesTypes";
import useAuthStore from "../../../../../../../store/authStore";
vi.mock("../../../../../../../modules/business/infrastructure/salesServices", () => ({ getSalesSummary: vi.fn(), getTopProducts: vi.fn() }));
const summary = vi.mocked(getSalesSummary), top = vi.mocked(getTopProducts);
const zero: SalesSummary = { currency: "CLP", timezone: "America/Santiago", sales_count: "0", total_amount: "0", units_sold: "0", average_ticket: null };
const ranking: TopProducts = { currency: "CLP", timezone: "America/Santiago", metric: "units", data: [] };
const period = { from: "2026-04-01T03:00:00Z", to_exclusive: "2026-05-01T04:00:00Z" };
const clients = new Set<QueryClient>();
function wrapper() { const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.add(client); return { client, Wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }; }
beforeEach(() => { vi.resetAllMocks(); useAuthStore.setState({ user: { id: "report-actor", name: "Synthetic Report Actor" }, token: "synthetic-report-session", sessionStatus: "authenticated", expiresAt: Date.now() + 60000 }); summary.mockResolvedValue(zero); top.mockResolvedValue(ranking); });
afterEach(() => { for (const client of clients) client.clear(); clients.clear(); });
describe("report reads", () => {
  it("requests an exact period and bounded top10; metric changes preserve the complete summary query", async () => {
    const { client, Wrapper } = wrapper();
    const hook = renderHook(({ metric }) => useSalesReports("business-a", period, metric), { wrapper: Wrapper, initialProps: { metric: "units" as "units" | "amount" } });
    await waitFor(() => expect(hook.result.current.busy).toBe(false)); expect(summary).toHaveBeenCalledExactlyOnceWith("business-a", period);
    expect(top).toHaveBeenCalledExactlyOnceWith("business-a", { ...period, metric: "units", limit: 10 });
    hook.rerender({ metric: "amount" }); await waitFor(() => expect(top).toHaveBeenCalledTimes(2)); expect(summary).toHaveBeenCalledTimes(1);
    expect(top).toHaveBeenLastCalledWith("business-a", { ...period, metric: "amount", limit: 10 });
    await act(async () => { await client.invalidateQueries({ queryKey: ["business-sales", "business-a"] }); });
    expect(summary).toHaveBeenCalledTimes(2); expect(top).toHaveBeenCalledTimes(3);
  });
  it("preserves cached figures on read failure and recovers a real zero without manufacturing a summary", async () => {
    const existing: SalesSummary = { ...zero, sales_count: "1", total_amount: "7", average_ticket: { numerator: "7", denominator: "1" } };
    summary.mockResolvedValueOnce(existing); const { Wrapper } = wrapper();
    const hook = renderHook(() => useSalesReports("business-a", period, "units"), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.summary.data).toEqual(existing)); summary.mockRejectedValueOnce(new Error("synthetic read unavailable"));
    await act(async () => { await hook.result.current.summary.refetch(); });
    await waitFor(() => expect(hook.result.current.summary.isError).toBe(true)); expect(hook.result.current.summary.data).toEqual(existing); expect(hook.result.current.busy).toBe(false);
    await act(async () => { await hook.result.current.summary.refetch(); });
    await waitFor(() => expect(hook.result.current.summary.data).toEqual(zero)); expect(hook.result.current.summary.isError).toBe(false);
  });
  it("isolates late results by business and stops report requests after logout", async () => {
    let finish!: (value: SalesSummary) => void; summary.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { Wrapper } = wrapper(); const hook = renderHook(({ business }) => useSalesReports(business, period, "units"), { wrapper: Wrapper, initialProps: { business: "business-a" } });
    await waitFor(() => expect(summary).toHaveBeenCalledTimes(1)); hook.rerender({ business: "business-b" });
    await waitFor(() => expect(hook.result.current.summary.data).toEqual(zero));
    await act(async () => { finish({ ...zero, total_amount: "999" }); }); expect(hook.result.current.summary.data).toEqual(zero);
    await act(async () => { useAuthStore.setState({ user: null, token: null, sessionStatus: "anonymous" }); });
    expect(hook.result.current.summary.data).toBeUndefined(); expect(summary).toHaveBeenCalledTimes(2); expect(top).toHaveBeenCalledTimes(2);
  });
});
