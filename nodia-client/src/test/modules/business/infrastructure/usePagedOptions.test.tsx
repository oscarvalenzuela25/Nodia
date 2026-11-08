import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { usePagedProductCodeOptions } from "../../../../modules/business/infrastructure/usePagedOptions";
import type { ProductEntity } from "../../../../modules/business/infrastructure/types";
import { getProducts } from "../../../../modules/business/infrastructure/services";

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
