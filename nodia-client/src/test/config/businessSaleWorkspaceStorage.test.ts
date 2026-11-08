import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBusinessSaleRecoveryStorage } from "../../config/businessSaleRecoveryStorage";
import {
  loadSaleWorkspace, saleWorkspaceKey, writeSaleWorkspace, type SaleWorkspaceSnapshot,
} from "../../config/businessSaleWorkspaceStorage";

const workspace = (): SaleWorkspaceSnapshot => ({
  version: 2, actorId: "actor-a", businessId: "business-a", activeId: "cart-b", nextNumber: 4,
  sessions: [
    {
      id: "cart-a", number: 1, sale: null,
      lines: [{ product_id: "product-a", quantity: 2, expected_product_version: 7, expected_unit_price: "1200",
        name: "Synthetic product", code: "invoice-01", barcode: "000001", regular_price: "1500", offer_price: "1200", price_source: "offer" }],
      paymentMethod: "other", description: "Original historical method", dirty: true,
      pending: { actorId: "actor-a", businessId: "business-a", mutation: { operation: "checkout", command: {
        request_key: "original-request", items: [{ product_id: "product-a", quantity: 2, expected_product_version: 7, expected_unit_price: "1200" }],
        payment_method: "other", payment_method_description: "Original historical method",
      } } },
      quantityDrafts: { "product-a": "" }, barcode: "000002",
    },
    { id: "cart-b", number: 3, sale: null, lines: [], paymentMethod: "cash", description: "", dirty: false, pending: null, quantityDrafts: {}, barcode: "" },
  ],
});

describe("local sale workspace persistence", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("migrates integer v1 carts once with the same pending identity, then persists zero/fractional v2 rows", () => {
    const old = { ...workspace(), version: 1 };
    const legacyKey = "nodia:sale-recovery:workspace:v1:actor-a:business-a";
    sessionStorage.setItem(legacyKey, JSON.stringify(old));
    const restored = loadSaleWorkspace("actor-a", "business-a")!;
    expect(restored.version).toBe(2);
    expect(restored.sessions[0].pending?.mutation.command.request_key).toBe("original-request");
    restored.sessions[1].lines = [{ ...restored.sessions[0].lines[0], quantity: 0, measurement_unit: "kg" }];
    writeSaleWorkspace(restored);
    expect(sessionStorage.getItem(legacyKey)).toBeNull();
    expect(loadSaleWorkspace("actor-a", "business-a")!.sessions[1].lines[0]).toMatchObject({ quantity: 0, measurement_unit: "kg" });
    restored.sessions[1].lines[0].quantity = 1.125;
    writeSaleWorkspace(restored);
    expect(loadSaleWorkspace("actor-a", "business-a")!.sessions[1].lines[0].quantity).toBe(1.125);
  });

  it("restores isolated carts, numbering, incomplete fields and the exact historical request together", () => {
    const original = workspace();
    writeSaleWorkspace(original);
    const restored = loadSaleWorkspace("actor-a", "business-a");
    expect(restored).toEqual(original);
    expect(restored?.sessions[0].pending?.mutation.command.payment_method).toBe("other");
    expect(loadSaleWorkspace("actor-b", "business-a")).toBeNull();
    expect(loadSaleWorkspace("actor-a", "business-b")).toBeNull();
  });

  it("clears workspace snapshots with the existing logout cleanup and preserves unrelated session data", () => {
    writeSaleWorkspace(workspace());
    sessionStorage.setItem("unrelated", "preserved");
    clearBusinessSaleRecoveryStorage();
    expect(loadSaleWorkspace("actor-a", "business-a")).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("preserved");
  });

  it("rejects invalid scope, selection, numbering and duplicated pending identities without replacing any bytes", () => {
    const badScope = workspace(); badScope.sessions[0].pending!.actorId = "actor-b";
    const badSelection = { ...workspace(), activeId: "missing-cart" };
    const reusedNumber = workspace(); reusedNumber.sessions[1].number = 1;
    const invalidNextNumber = { ...workspace(), nextNumber: 3 };
    const duplicateRequest = workspace(); duplicateRequest.sessions[1].pending = duplicateRequest.sessions[0].pending;
    const foreignSale = workspace(); foreignSale.sessions[1].sale = {
      id: "sale-a", business_id: "business-b", status: "draft", currency: "CLP", payment_method: "cash", payment_method_description: null,
      total_amount: "0", version: 1, created_at: "2026-10-29T12:00:00Z", updated_at: "2026-10-29T12:00:00Z",
      completed_at: null, cancelled_at: null, cancellation_reason: null, items: [],
    };
    for (const invalid of [badScope, badSelection, reusedNumber, invalidNextNumber, duplicateRequest, foreignSale]) {
      const raw = JSON.stringify(invalid);
      sessionStorage.setItem(saleWorkspaceKey("actor-a", "business-a"), raw);
      expect(() => loadSaleWorkspace("actor-a", "business-a")).toThrow("invalid_workspace");
      expect(() => writeSaleWorkspace(workspace())).toThrow("invalid_workspace");
      expect(sessionStorage.getItem(saleWorkspaceKey("actor-a", "business-a"))).toBe(raw);
    }
  });

  it("fails closed on corrupt JSON or an unknown snapshot version instead of silently creating a workspace", () => {
    const key = saleWorkspaceKey("actor-a", "business-a");
    for (const raw of ["", "not-json", JSON.stringify({ ...workspace(), version: 3 })]) {
      sessionStorage.setItem(key, raw);
      expect(() => loadSaleWorkspace("actor-a", "business-a")).toThrow("invalid_workspace");
      expect(() => writeSaleWorkspace(workspace())).toThrow("invalid_workspace");
      expect(sessionStorage.getItem(key)).toBe(raw);
    }
  });

  it("preserves the entire prior snapshot when the atomic storage commit fails", () => {
    const original = workspace();
    writeSaleWorkspace(original);
    const previous = sessionStorage.getItem(saleWorkspaceKey("actor-a", "business-a"));
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
    const changed = workspace(); changed.sessions[1].barcode = "new-code";
    expect(() => writeSaleWorkspace(changed)).toThrow("storage_unavailable");
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(saleWorkspaceKey("actor-a", "business-a"))).toBe(previous);
    expect(loadSaleWorkspace("actor-a", "business-a")).toEqual(original);
  });

  it("reports unavailable reads and prevents the write instead of treating them as an empty browser session", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    expect(() => loadSaleWorkspace("actor-a", "business-a")).toThrow("storage_unavailable");
    expect(() => writeSaleWorkspace(workspace())).toThrow("storage_unavailable");
    expect(setItem).not.toHaveBeenCalled();
  });
});
