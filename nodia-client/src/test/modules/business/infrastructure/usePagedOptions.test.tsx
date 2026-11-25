import type { PropsWithChildren } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { usePagedProviderOptions, usePagedInvoiceCodeOptions } from "../../../../modules/business/infrastructure/usePagedOptions";
import { getProviders, getInvoices } from "../../../../modules/business/infrastructure/services";

vi.mock("../../../../hooks/useAuth", () => ({ default: () => ({ isSessionActive: true }) }));
vi.mock("../../../../modules/business/infrastructure/services", () => ({ getInvoices: vi.fn(), getProviders: vi.fn() }));

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
