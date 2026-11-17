import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { usePagedProductCodeOptions, usePagedProviderOptions, usePagedInvoiceCodeOptions } from "../../../../modules/business/infrastructure/usePagedOptions";
import type { ProductEntity } from "../../../../modules/business/infrastructure/types";
import { getProducts, getProviders, getInvoices } from "../../../../modules/business/infrastructure/services";

vi.mock("../../../../hooks/useAuth", () => ({ default: () => ({ isSessionActive: true }) }));
vi.mock("../../../../modules/business/infrastructure/services", () => ({ getProducts: vi.fn(), getInvoices: vi.fn(), getProviders: vi.fn() }));

const product = (id: string, code: string | null): ProductEntity => ({ id, business_id: "synthetic-business", code, measurement_unit: "unit", name: id,
  cost_price: 10, cost_price_tax: 12, sale_price: 15, stock: 0, is_active: true });

describe("paged product code options", () => {
  it("keeps absent supplier codes out of selection while preserving server pagination and distinct codes", async () => {
    vi.mocked(getProducts).mockImplementation(async (params) => ({ data: params?.page === 2
      ? [product("4", "SUP-1"), product("5", "SUP-2"), product("6", "  ")]
      : [product("1", null), product("2", "SUP-1"), product("3", null)],
    meta: { page: params?.page ?? 1, limit: 50, total_items: 6, total_pages: 2 } }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => usePagedProductCodeOptions("synthetic-business"), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.options).toEqual(["SUP-1"]);
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => { await result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.options).toEqual(["SUP-1", "SUP-2"]));
    expect(getProducts).toHaveBeenLastCalledWith({ page: 2, limit: 50, q: { business_id_eq: "synthetic-business", code_cont: undefined, s: "code asc" } });
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
