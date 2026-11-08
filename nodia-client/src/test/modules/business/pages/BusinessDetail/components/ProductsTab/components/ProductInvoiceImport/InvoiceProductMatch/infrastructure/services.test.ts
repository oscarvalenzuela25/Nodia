import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProducts } from "../../../../../../../../../../../modules/business/infrastructure/services";
import { findMatchProducts, readMatchProduct } from "../../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/InvoiceProductMatch/infrastructure/services";
import { page, product } from "../fixtures";

vi.mock("../../../../../../../../../../../modules/business/infrastructure/services", () => ({ getProducts: vi.fn() }));
const read = vi.mocked(getProducts);
beforeEach(() => vi.resetAllMocks());

describe("invoice product matching readers", () => {
  it("searches by name with a bounded twenty-five-item page and the explicit business", async () => {
    const response = page([product()], 2, 2);
    read.mockResolvedValue(response);
    expect(await findMatchProducts("business-a", "Synthetic", 2)).toBe(response);
    expect(read).toHaveBeenCalledExactlyOnceWith({ page: 2, limit: 25, q: { business_id_eq: "business-a", name_cont: "Synthetic", s: "name asc" } });
    await findMatchProducts("business-b", "", 1);
    expect(read).toHaveBeenLastCalledWith({ page: 1, limit: 25, q: { business_id_eq: "business-b", name_cont: undefined, s: "name asc" } });
  });

  it("reads a fresh immutable ID snapshot instead of trusting a previously listed revision", async () => {
    const fresh = product("17", "business-a", 12);
    read.mockResolvedValue(page([fresh]));
    expect(await readMatchProduct("business-a", "17")).toBe(fresh);
    expect(read).toHaveBeenCalledExactlyOnceWith({ page: 1, limit: 1, q: { business_id_eq: "business-a", id_in: ["17"] } });
  });

  it.each([
    ["different ID", [product("18")], "17"],
    ["different business", [product("17", "business-b")], "17"],
    ["missing version", [{ ...product(), version: undefined }], "17"],
    ["zero version", [product("17", "business-a", 0)], "17"],
    ["missing result", [], "17"],
    ["client-generated UUID", [product("00000000-0000-4000-8000-000000000001")], "00000000-0000-4000-8000-000000000001"],
  ] as const)("rejects a %s snapshot at the reader boundary", async (_description, rows, id) => {
    read.mockResolvedValue(page([...rows]));
    await expect(readMatchProduct("business-a", id)).rejects.toThrow("invoice_match_product_unavailable");
    expect(read).toHaveBeenCalledTimes(1);
  });
});
