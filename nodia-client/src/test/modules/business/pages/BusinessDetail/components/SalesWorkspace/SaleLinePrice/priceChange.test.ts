import { describe, expect, it } from "vitest";
import { permanentSalePricePatch } from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SaleLinePrice/priceChange";
import { productToCartLine } from "../../../../../../../../modules/business/infrastructure/salesPolicies";
import type { ProductEntity } from "../../../../../../../../modules/business/infrastructure/types";
const product: ProductEntity = { id: "10", business_id: "business", code: null, name: "Synthetic kilos", measurement_unit: "kg", cost_price: 1000,
  cost_price_tax: 1190, sale_price: 1547, offer_price: 1000, is_offer_enabled: true, effective_price: "1000", price_source: "offer", has_stock: true, stock: 0, is_active: true, version: 7 };
describe("permanent price change", () => {
  it("updates only the normal price, disables the offer and keeps the exact revision", () => {
    expect(permanentSalePricePatch(product, productToCartLine(product), "13000")).toEqual({ sale_price: 13000, is_offer_enabled: false, expected_version: 7 });
    expect(product.is_offer_enabled).toBe(true);
    expect(product.cost_price).toBe(1000);
    expect(product.cost_price_tax).toBe(1190);
    expect(permanentSalePricePatch(product, productToCartLine(product), "0")).toEqual({ sale_price: 0, is_offer_enabled: false, expected_version: 7 });
  });
  it("requires review after a changed revision, price or measurement unit", () => {
    const line = productToCartLine(product);
    for (const changed of [{ ...product, version: 8 }, { ...product, offer_price: 900, effective_price: "900" }, { ...product, measurement_unit: "g" as const }]) expect(() => permanentSalePricePatch(changed, line, "13000")).toThrow("price_changed");
    for (const price of ["", "1.5", "-1", "01", "2147483648"]) expect(() => permanentSalePricePatch(product, line, price)).toThrow("invalid_price");
  });
});
