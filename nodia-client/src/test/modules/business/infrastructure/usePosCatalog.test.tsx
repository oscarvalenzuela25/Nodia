import { useState, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePosCatalog } from "../../../../modules/business/infrastructure/usePosCatalog";
import { getProducts } from "../../../../modules/business/infrastructure/services";
import useAuthStore from "../../../../store/authStore";
import type { GetProductsResponse, ProductEntity } from "../../../../modules/business/infrastructure/types";

const feedback = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("../../../../modules/business/infrastructure/services", () => ({ getProducts: vi.fn() }));
vi.mock("sileo", () => ({ sileo: feedback }));
const products = vi.mocked(getProducts);
const clients = new Set<QueryClient>();
const item = (id: string, business = "business-a", version = 1): ProductEntity => ({ id, business_id: business, version, name: `Synthetic ${id}`, code: `SUP-${id}`, barcode: null,
  cost_price: 100, cost_price_tax: 119, sale_price: 149, offer_price: null, is_offer_enabled: false, effective_price: "149", price_source: "regular", has_stock: true, stock: 0, is_active: true });
const page = (data: ProductEntity[], current = 1, total = 1): GetProductsResponse => ({ data, meta: { page: current, limit: 24, total_items: total * 24, total_pages: total } });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const Wrapper = ({ children }: PropsWithChildren) => {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })); clients.add(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic actor" }, token: "synthetic-session", sessionStatus: "authenticated", expiresAt: Date.now() + 60000 });
});
afterEach(() => { cleanup(); for (const client of clients) client.clear(); clients.clear(); vi.useRealTimers(); });

describe("POS catalogue shared infinite reader", () => {
  it("requests one bounded page, loads by server metadata and deduplicates identities while locking concurrent requests", async () => {
    const next = deferred<GetProductsResponse>();
    products.mockResolvedValueOnce(page([item("1"), item("2")], 1, 2)).mockReturnValueOnce(next.promise);
    const { result } = renderHook(() => usePosCatalog("business-a"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(products).toHaveBeenCalledExactlyOnceWith({ page: 1, limit: 24, includes: true, q: { business_id_eq: "business-a", is_active_eq: true, has_stock_eq: true, name_cont: undefined, s: "name asc" } });
    expect(result.current.hasNextPage).toBe(true); // Two returned rows are not the global total.
    let loading!: Promise<void>;
    act(() => { loading = result.current.loadMore(); void result.current.loadMore(); });
    await waitFor(() => expect(products).toHaveBeenCalledTimes(2));
    expect(products.mock.calls[1][0]?.page).toBe(2);
    await act(async () => { next.resolve(page([item("2", "business-a", 2), item("3")], 2, 2)); await loading; });
    await waitFor(() => expect(result.current.products.map((product) => product.id)).toEqual(["1", "2", "3"]));
    expect(result.current.products[1].version).toBe(2); expect(result.current.hasNextPage).toBe(false);
    await act(async () => { await result.current.loadMore(); });
    expect(products).toHaveBeenCalledTimes(2);
  });

  it("debounces complete search text for 300 ms and rejects selection from earlier search closures", async () => {
    products.mockResolvedValueOnce(page([item("1")])).mockResolvedValueOnce(page([{ ...item("2"), name: "Coffee" }]));
    const { result } = renderHook(() => usePosCatalog("business-a"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    const selectBeforeSearch = result.current.resolveSelection;
    vi.useFakeTimers();
    act(() => { result.current.setSearch("C"); });
    act(() => { result.current.setSearch("Coffee"); });
    expect(result.current.search).toBe("Coffee"); expect(result.current.fetching).toBe(true); expect(result.current.networkFetching).toBe(false);
    expect(result.current.resolveSelection("1")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(products).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    vi.useRealTimers();
    await waitFor(() => expect(result.current.products[0]?.name).toBe("Coffee"));
    expect(products.mock.calls[1][0]?.q?.name_cont).toBe("Coffee"); expect(products.mock.calls[1][0]?.page).toBe(1);
    expect(selectBeforeSearch("1")).toBeNull(); expect(result.current.resolveSelection("2")?.id).toBe("2");
  });

  it("isolates businesses and late responses, resets search and discards callbacks captured for an old business", async () => {
    const old = deferred<GetProductsResponse>();
    products.mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([item("9", "business-b")], 1, 2));
    const { result, rerender } = renderHook(({ business }) => usePosCatalog(business), { initialProps: { business: "business-a" }, wrapper: Wrapper });
    await waitFor(() => expect(products).toHaveBeenCalledTimes(1));
    const previousMore = result.current.loadMore;
    const previousSelection = result.current.resolveSelection;
    act(() => result.current.setSearch("Previous business search"));
    rerender({ business: "business-b" });
    await waitFor(() => expect(result.current.products[0]?.business_id).toBe("business-b"));
    expect(result.current.search).toBe("");
    await act(async () => { old.resolve(page([item("1")], 1, 2)); await previousMore(); });
    expect(result.current.products.map((product) => product.id)).toEqual(["9"]); expect(products).toHaveBeenCalledTimes(2);
    expect(previousSelection("1")).toBeNull(); expect(result.current.resolveSelection("9")?.id).toBe("9");
    expect(products.mock.calls[1][0]?.q?.business_id_eq).toBe("business-b");
  });

  it("discards a late search response after a newer query already completed", async () => {
    const old = deferred<GetProductsResponse>();
    products.mockResolvedValueOnce(page([item("1")])).mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([{ ...item("3"), name: "Newest" }]));
    const { result } = renderHook(() => usePosCatalog("business-a"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    vi.useFakeTimers();
    act(() => result.current.setSearch("Older"));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(products).toHaveBeenCalledTimes(2);
    act(() => result.current.setSearch("Newest"));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    vi.useRealTimers();
    await waitFor(() => expect(result.current.products[0]?.name).toBe("Newest"));
    await act(async () => { old.resolve(page([{ ...item("2"), name: "Older" }])); });
    expect(result.current.products[0]?.name).toBe("Newest"); expect(result.current.resolveSelection("2")).toBeNull();
  });

  it("reports initial errors and retries without an automatic fetch loop", async () => {
    products.mockRejectedValueOnce(new AxiosError("Synthetic catalogue unavailable")).mockResolvedValueOnce(page([item("1")]));
    const { result } = renderHook(() => usePosCatalog("business-a"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.products).toEqual([]); expect(feedback.error).toHaveBeenCalledTimes(1); expect(products).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.isError).toBe(false); expect(products).toHaveBeenCalledTimes(2);
  });

  it("keeps previous pages after a next-page failure and retries just the failed page", async () => {
    products.mockResolvedValueOnce(page([item("1")], 1, 2)).mockRejectedValueOnce(new AxiosError("Synthetic next page unavailable"))
      .mockResolvedValueOnce(page([item("2")], 2, 2));
    const { result } = renderHook(() => usePosCatalog("business-a"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    await act(async () => { await result.current.loadMore(); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.products[0].id).toBe("1"); expect(result.current.isLoading).toBe(false); expect(result.current.resolveSelection("1")).toBeNull();
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.products.map((product) => product.id)).toEqual(["1", "2"]));
    expect(products.mock.calls.map(([params]) => params?.page)).toEqual([1, 2, 2]);
  });

  it("includes unavailable active products only in explicit assignment mode and prevents selection across sessions", async () => {
    products.mockResolvedValueOnce(page([item("1")])).mockResolvedValueOnce(page([{ ...item("2"), has_stock: false }])).mockResolvedValueOnce(page([item("3")]));
    const { result, rerender } = renderHook(({ assignment }) => usePosCatalog("business-a", assignment), { initialProps: { assignment: false }, wrapper: Wrapper });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    rerender({ assignment: true });
    await waitFor(() => expect(result.current.products[0]?.id).toBe("2"));
    expect(products.mock.calls[1][0]?.q).toEqual({ business_id_eq: "business-a", is_active_eq: true, name_cont: undefined, s: "name asc" });
    const previousSelect = result.current.resolveSelection;
    act(() => useAuthStore.setState({ sessionVersion: useAuthStore.getState().sessionVersion + 1 }));
    await waitFor(() => expect(result.current.products[0]?.id).toBe("3"));
    expect(previousSelect("2")).toBeNull();
  });

  it("rejects foreign-business payloads and never exposes them as selectable catalogue entries", async () => {
    products.mockResolvedValueOnce(page([item("1", "business-b")]));
    const { result } = renderHook(() => usePosCatalog("business-a"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.products).toEqual([]); expect(result.current.resolveSelection("1")).toBeNull(); expect(feedback.error).toHaveBeenCalledTimes(1);
  });
});
