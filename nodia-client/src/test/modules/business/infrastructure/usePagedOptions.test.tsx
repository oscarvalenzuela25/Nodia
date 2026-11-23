import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { usePagedProductCodeOptions, usePagedProviderOptions, usePagedInvoiceCodeOptions } from "../../../../modules/business/infrastructure/usePagedOptions";
import type { GetProductsResponse, ProductEntity } from "../../../../modules/business/infrastructure/types";
import { getProducts, getProviders, getInvoices } from "../../../../modules/business/infrastructure/services";

vi.mock("../../../../hooks/useAuth", () => ({ default: () => ({ isSessionActive: true }) }));
vi.mock("../../../../modules/business/infrastructure/services", () => ({ getProducts: vi.fn(), getInvoices: vi.fn(), getProviders: vi.fn() }));

const product = (id: string, code: string | null): ProductEntity => ({ id, business_id: "synthetic-business", code, measurement_unit: "unit", name: id,
  cost_price: 10, cost_price_tax: 12, sale_price: 15, stock: 0, is_active: true });

describe("paged product code options", () => {
  const createWrapper = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

  it("queries only after nonblank input, preserves exact values and keeps pagination server-driven", async () => {
    const request = vi.mocked(getProducts);
    request.mockReset().mockImplementation(async (params) => ({
      data: params?.page === 2
        ? [product("4", " SUP-1 "), product("5", "SUP-2"), product("6", "  ")]
        : [product("1", null), product("2", " SUP-1 "), product("3", null)],
      meta: { page: params?.page ?? 1, limit: 50, total_items: 6, total_pages: 2 },
    }));
    const { result } = renderHook(() => usePagedProductCodeOptions("synthetic-business", "code"), {
      wrapper: createWrapper(),
    });
    expect(result.current.options).toEqual([]);
    expect(result.current.hasSearch).toBe(false);
    expect(request).not.toHaveBeenCalled();

    act(() => result.current.setSearch("  SUP  "));
    expect(result.current.hasSearch).toBe(true);
    expect(result.current.isSearching).toBe(true);
    expect(request).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.options).toEqual([" SUP-1 "]));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.options).toEqual([" SUP-1 ", "SUP-2"]));
    expect(request).toHaveBeenLastCalledWith({
      page: 2,
      limit: 50,
      includes: false,
      q: { business_id_eq: "synthetic-business", code_cont: "SUP", code_presence: "present", s: "code asc" },
    }, expect.any(AbortSignal));

    act(() => result.current.setSearch("  "));
    expect(result.current.options).toEqual([]);
    expect(result.current.hasSearch).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("isolates identifier types and aborts old searches before a replacement is sent", async () => {
    const request = vi.mocked(getProducts);
    const resultPage: GetProductsResponse = {
      data: [{ ...product("1", "001"), barcode: "0001" }],
      meta: { page: 1, limit: 50, total_items: 1, total_pages: 1 },
    };
    let oldSearchSignal: AbortSignal | undefined;
    let resolveOldSearch: ((page: GetProductsResponse) => void) | undefined;
    request.mockReset().mockImplementation((params, signal) => {
      if (params?.q?.barcode_cont === "001") {
        oldSearchSignal = signal;
        return new Promise((resolve) => { resolveOldSearch = resolve; });
      }
      return Promise.resolve(resultPage);
    });
    const wrapper = createWrapper();
    const code = renderHook(() => usePagedProductCodeOptions("synthetic-business", "code"), { wrapper });
    const barcode = renderHook(() => usePagedProductCodeOptions("synthetic-business", "barcode"), { wrapper });
    act(() => {
      code.result.current.setSearch("001");
      barcode.result.current.setSearch("001");
    });
    await waitFor(() => expect(code.result.current.options).toEqual(["001"]));
    await waitFor(() => expect(oldSearchSignal).toBeDefined());
    expect(barcode.result.current.options).toEqual([]);

    act(() => barcode.result.current.setSearch("000"));
    expect(oldSearchSignal?.aborted).toBe(true);
    expect(barcode.result.current.isSearching).toBe(true);
    expect(barcode.result.current.options).toEqual([]);
    expect(barcode.result.current.hasNextPage).toBe(false);
    await act(async () => { resolveOldSearch?.({ ...resultPage, data: [{ ...product("2", null), barcode: "001-old" }] }); });

    await waitFor(() => expect(barcode.result.current.options).toEqual(["0001"]));
    expect(code.result.current.options).toEqual(["001"]);
    expect(request).toHaveBeenLastCalledWith({
      page: 1,
      limit: 50,
      includes: false,
      q: { business_id_eq: "synthetic-business", barcode_cont: "000", barcode_presence: "present", s: "barcode asc" },
    }, expect.any(AbortSignal));
  });
});


describe("provider OCR options and optional invoice folios", () => {
  it("filters only OCR options and isolates their cache from normal supplier selectors", async () => {
    const providers = [true, false].map((use_ocr, index) => ({ id: String(index + 1), business_id: "business", name: `Supplier ${index}`, tax: 19, use_ocr, is_active: true, created_at: "2026-11-17" }));
    vi.mocked(getProviders).mockResolvedValue({ data: providers, meta: { page: 1, limit: 50, total_items: 2, total_pages: 1 } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const normal = renderHook(() => usePagedProviderOptions("business"), { wrapper });
    await waitFor(() => expect(normal.result.current.options).toHaveLength(2));
    expect(getProviders).toHaveBeenCalledWith(expect.objectContaining({ q: expect.not.objectContaining({ use_ocr_eq: true }) }));
    const ocr = renderHook(() => usePagedProviderOptions("business", true, { useOcrOnly: true }), { wrapper });
    await waitFor(() => expect(ocr.result.current.options).toEqual([{ value: "1", label: "Supplier 0" }]));
    expect(getProviders).toHaveBeenLastCalledWith({ page: 1, limit: 50, q: { business_id_eq: "business", name_cont: undefined, use_ocr_eq: true, s: "name asc" } });
    expect(normal.result.current.options).toHaveLength(2);
  });
  it("keeps null and empty invoice folios out of the code filter", async () => {
    const invoice = { id: "1", business_id: "business", total_amount: 0, path_storage: "", is_active: true, created_at: "2026-11-17" };
    vi.mocked(getInvoices).mockResolvedValue({ data: [null, "", "   ", "F-1", "F-1"].map(code => ({ ...invoice, code })), meta: { page: 1, limit: 50, total_items: 5, total_pages: 1 } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => usePagedInvoiceCodeOptions("business"), { wrapper });
    await waitFor(() => expect(result.current.options).toEqual(["F-1"]));
  });
});
