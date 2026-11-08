import { useState, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSaleLineImages } from "../../../../modules/business/infrastructure/useSaleLineImages";
import { getProducts } from "../../../../modules/business/infrastructure/services";
import useAuthStore from "../../../../store/authStore";
import type { CartLine } from "../../../../modules/business/infrastructure/salesTypes";
import type { GetProductsResponse, ProductEntity } from "../../../../modules/business/infrastructure/types";

const feedback = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sileo", () => ({ sileo: feedback }));
vi.mock("../../../../modules/business/infrastructure/services", () => ({ getProducts: vi.fn() }));
const fetchProducts = vi.mocked(getProducts), clients = new Set<QueryClient>();
const line = (id: string): CartLine => ({ product_id: id, quantity: 1, expected_product_version: 1, expected_unit_price: "1200", name: `Item ${id}`, code: "invoice-code", barcode: "0001", regular_price: "1200", offer_price: null, price_source: "regular" });
const product = (id: string): ProductEntity => ({ id, business_id: "business-a", name: `Item ${id}`, code: "invoice-code", stock: 0, is_active: true, cost_price: 1000, cost_price_tax: 1190, sale_price: 1200, image: { id: `image-${id}`, url: `https://example.invalid/${id}.png`, width: 100, height: 100, mime_type: "image/png", byte_size: 100 } });
const page = (data: ProductEntity[]): GetProductsResponse => ({ data, meta: { page: 1, total_items: data.length, total_pages: 1, limit: 100 } });
const Wrapper = ({ children }: PropsWithChildren) => { const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })); clients.add(client); return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };
beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: { id: "actor-a", name: "Synthetic" }, token: "synthetic-session", sessionStatus: "authenticated", expiresAt: Date.now() + 60000 }); });
afterEach(() => { cleanup(); for (const client of clients) client.clear(); clients.clear(); });

describe("selected sale image metadata", () => {
  it("does not query an empty cart and reuses the exact product already read by scan/search without another request", async () => {
    const { result, rerender } = renderHook(({ lines }) => useSaleLineImages("business-a", lines), { wrapper: Wrapper, initialProps: { lines: [] as CartLine[] } });
    expect(fetchProducts).not.toHaveBeenCalled();
    act(() => result.current.remember(product("1")));
    rerender({ lines: [line("1")] });
    await waitFor(() => expect(result.current.images["1"]?.id).toBe("image-1"));
    rerender({ lines: [{ ...line("1"), quantity: 5 }] });
    expect(fetchProducts).not.toHaveBeenCalled();
  });
  it("restores only selected images in bounded batches, including unavailable/historical products without changing frozen prices", async () => {
    const lines = Array.from({ length: 101 }, (_, index) => line(String(index + 1)));
    fetchProducts.mockImplementation(async (params) => page(String(params?.q?.id_in).split(",").map((id) => ({ ...product(id), is_active: false, has_stock: false, sale_price: 9999 }))));
    const { result } = renderHook(() => useSaleLineImages("business-a", lines), { wrapper: Wrapper });
    await waitFor(() => expect(Object.keys(result.current.images)).toHaveLength(101));
    expect(fetchProducts).toHaveBeenCalledTimes(2);
    for (const [params] of fetchProducts.mock.calls) { expect(params).toMatchObject({ page: 1, limit: 100, includes: true, q: { business_id_eq: "business-a" } }); expect(String(params?.q?.id_in).split(",").length).toBeLessThanOrEqual(100); }
    expect(lines[0].expected_unit_price).toBe("1200"); expect(lines[0].quantity).toBe(1);
  });
  it("rejects foreign metadata, reports failure and retries without mutating the cart", async () => {
    const lines = [line("1")];
    fetchProducts.mockResolvedValueOnce(page([{ ...product("1"), business_id: "foreign" }])).mockResolvedValueOnce(page([product("1")]));
    const { result } = renderHook(() => useSaleLineImages("business-a", lines), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.images).toEqual({}); expect(feedback.error).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.images["1"]?.id).toBe("image-1"));
    expect(lines).toEqual([line("1")]);
  });
  it("keeps a late image response in its actor/session scope", async () => {
    let resolve!: (value: GetProductsResponse) => void;
    fetchProducts.mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue(page([{ ...product("1"), image: { ...product("1").image!, id: "new-session-image" } }]));
    const { result } = renderHook(() => useSaleLineImages("business-a", [line("1")]), { wrapper: Wrapper });
    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(1));
    act(() => { useAuthStore.setState({ user: { id: "actor-b", name: "Other synthetic" }, sessionVersion: useAuthStore.getState().sessionVersion + 1 }); });
    await waitFor(() => expect(result.current.images["1"]?.id).toBe("new-session-image"));
    await act(async () => { resolve(page([product("1")])); });
    expect(result.current.images["1"]?.id).toBe("new-session-image");
  });
});
