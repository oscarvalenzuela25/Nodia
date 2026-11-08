import { useState, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../../../../../../../../../store/authStore";
import { getProducts } from "../../../../../../../../../../../modules/business/infrastructure/services";
import type { GetProductsResponse } from "../../../../../../../../../../../modules/business/infrastructure/types";
import { useInvoiceMatchProducts } from "../../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/InvoiceProductMatch/infrastructure/useServices";
import { deferred, page, product } from "../fixtures";

vi.mock("../../../../../../../../../../../modules/business/infrastructure/services", () => ({ getProducts: vi.fn() }));
vi.mock("../../../../../../../../../../../config/httpFeedback", () => ({ notifyHttpError: vi.fn() }));
const read = vi.mocked(getProducts);
const clients = new Set<QueryClient>();
const createClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const Wrapper = ({ children }: PropsWithChildren) => {
  const [client] = useState(createClient);
  clients.add(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic actor" }, token: "synthetic-session", sessionStatus: "authenticated", isRefreshing: false, expiresAt: Date.now() + 60000 });
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.clear(); vi.useRealTimers(); });

describe("invoice product matching queries", () => {
  it("loads pages by server metadata, deduplicates IDs and filters foreign businesses", async () => {
    read.mockResolvedValueOnce(page([product("17"), product("18", "business-b")], 1, 2))
      .mockResolvedValueOnce(page([product("17", "business-a", 9), product("19")], 2, 2));
    const { result } = renderHook(() => useInvoiceMatchProducts("business-a", null), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.options.map(item => item.id)).toEqual(["17"]));
    expect(result.current.products.hasNextPage).toBe(true);
    await act(async () => { await result.current.products.fetchNextPage(); });
    await waitFor(() => expect(result.current.options.map(item => item.id)).toEqual(["17", "19"]));
    expect(result.current.options[0].version).toBe(9);
    expect(result.current.products.hasNextPage).toBe(false);
    expect(read.mock.calls.map(([params]) => params?.page)).toEqual([1, 2]);
    expect(read.mock.calls.every(([params]) => params?.limit === 25 && params.q?.business_id_eq === "business-a")).toBe(true);
  });

  it("debounces the complete search text and restarts at the first bounded page", async () => {
    read.mockResolvedValue(page([product()]));
    const { result } = renderHook(() => useInvoiceMatchProducts("business-a", null), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    vi.useFakeTimers();
    act(() => { result.current.setSearch("S"); result.current.setSearch(" Synthetic name "); });
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    vi.useRealTimers();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(read.mock.calls[1][0]).toEqual({ page: 1, limit: 25, q: { business_id_eq: "business-a", name_cont: "Synthetic name", s: "name asc" } });
  });

  it("keeps late ID/business responses out of the current selected snapshot", async () => {
    const late = deferred<GetProductsResponse>();
    read.mockImplementation(params => params?.q?.id_in?.[0] === "17" ? late.promise : Promise.resolve(page([product("19", "business-b")])));
    const { result, rerender } = renderHook(({ business, id }) => useInvoiceMatchProducts(business, id), { initialProps: { business: "business-a", id: "17" }, wrapper: Wrapper });
    await waitFor(() => expect(read.mock.calls.some(([params]) => params?.q?.id_in?.[0] === "17")).toBe(true));
    rerender({ business: "business-b", id: "19" });
    await waitFor(() => expect(result.current.selected.data?.id).toBe("19"));
    await act(async () => { late.resolve(page([product("17")])); });
    expect(result.current.selected.data).toMatchObject({ id: "19", business_id: "business-b" });
    expect(result.current.options.every(item => item.business_id === "business-b")).toBe(true);
  });

  it("reads a new snapshot when the authenticated session changes for the same actor", async () => {
    let revision = 7;
    read.mockImplementation(async params => page([product("17", "business-a", params?.q?.id_in ? ++revision : 1)]));
    const { result } = renderHook(() => useInvoiceMatchProducts("business-a", "17"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.selected.data?.version).toBe(8));
    const previousScope = result.current.scopeKey;
    act(() => useAuthStore.setState({ sessionVersion: useAuthStore.getState().sessionVersion + 1 }));
    await waitFor(() => expect(result.current.selected.data?.version).toBe(9));
    expect(result.current.scopeKey).not.toBe(previousScope);
    expect(read.mock.calls.filter(([params]) => params?.q?.id_in)).toHaveLength(2);
  });
});
