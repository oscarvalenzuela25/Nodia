import { beforeEach, describe, expect, it, vi } from "vitest";
import { mainInstance } from "../../../../config/api";
import { mutateSale } from "../../../../modules/business/infrastructure/salesServices";

vi.mock("../../../../config/api", () => ({ mainInstance: { post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
const draft = { id: "sale-a", business_id: "business-a", status: "draft", currency: "CLP", payment_method: "cash", payment_method_description: null,
  total_amount: "0", version: 1, created_at: "2026-10-29T12:00:00Z", updated_at: "2026-10-29T12:00:00Z", completed_at: null, cancelled_at: null, cancellation_reason: null, items: [] };
const item = { id: "item-a", product_id: "7", position: 0, quantity: 2, product_code_snapshot: "invoice-code", product_barcode_snapshot: "000123", product_name_snapshot: "Synthetic product", regular_unit_price: "1200", offer_price_snapshot: null, is_offer_enabled_snapshot: false, price_source: "regular", unit_price: "1200", line_total: "2400", product_version: 3 };
const completed = { ...draft, status: "completed", completed_at: "2026-10-29T12:00:01Z", total_amount: "2400", items: [item] };
describe("sales transport boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses one direct checkout endpoint with the exact command and validates its completed sale", async () => {
    vi.mocked(mainInstance.post).mockResolvedValue({ data: completed });
    const command = { request_key: "request-a", items: [{ product_id: "7", quantity: 2, expected_product_version: 3, expected_unit_price: "1200" }] };
    expect((await mutateSale("business-a", { operation: "checkout", command })).status).toBe("completed");
    expect(mainInstance.post).toHaveBeenCalledOnce();
    expect(mainInstance.post).toHaveBeenCalledWith(expect.stringMatching(/\/businesses\/business-a\/sales\/checkout$/), command);
    expect(mainInstance.put).not.toHaveBeenCalled(); expect(mainInstance.delete).not.toHaveBeenCalled();
  });
  it("rejects inconsistent returned totals rather than accepting a fabricated success", async () => {
    vi.mocked(mainInstance.post).mockResolvedValue({ data: { ...completed, total_amount: "1" } });
    await expect(mutateSale("business-a", { operation: "checkout", command: { request_key: "request-a" } })).rejects.toThrow();
  });
  it("retains the legacy create route and its valid empty draft response", async () => {
    vi.mocked(mainInstance.post).mockResolvedValue({ data: draft });
    expect((await mutateSale("business-a", { operation: "create", command: { request_key: "legacy-request" } })).status).toBe("draft");
    expect(mainInstance.post).toHaveBeenCalledWith(expect.stringMatching(/\/businesses\/business-a\/sales$/), { request_key: "legacy-request" });
  });
});
