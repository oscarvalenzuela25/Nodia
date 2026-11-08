import { describe, expect, it } from "vitest";
import {
  historicalSalesEffectKey,
  historicalSalesFieldKey,
  historicalSalesValueKey,
} from "../../../../modules/nodiaAi/infrastructure/historicalProposalPresentation";
import { nodiaAiBusinessTool } from "../../../../modules/nodiaAi/infrastructure/businessPresentation";
import es from "../../../../translate/es/nodiaAi.json";
import en from "../../../../translate/en/nodiaAi.json";

describe("historical sales proposal presentation", () => {
  it.each(["create", "update", "complete", "cancel", "discard"])("labels only the retired %s operation without registering it as a business operation", operation => {
    const tool = `nodia_sales_prepare_${operation}`;
    const key = historicalSalesEffectKey(tool);
    expect(key).toBe(`nodiaAi:proposal.historical_sales.operations.${operation}`);
    expect(Object.hasOwn(es.proposal.historical_sales.operations, operation)).toBe(true);
    expect(Object.hasOwn(en.proposal.historical_sales.operations, operation)).toBe(true);
    expect(nodiaAiBusinessTool(tool)).toBe(false);
  });

  it("does not classify current readers, other operations or prototype names as retired sale operations", () => {
    for (const tool of ["nodia_sales_get", "nodia_sales_list", "nodia_products_prepare_create", "nodia_sales_prepare_checkout",
      "nodia_sales_prepare_create_extra", "nodia_sales_prepare_CREATE", "sales.create", "__proto__", "constructor", "toString"])
      expect(historicalSalesEffectKey(tool)).toBeUndefined();
  });

  it("labels the frozen nested pricing fields while leaving unknown fields to the exact generic renderer", () => {
    for (const field of ["items", "sale_pricing_snapshot", "lines", "product_id", "product_name_snapshot", "quantity",
      "expected_unit_price", "unit_price", "line_total", "total_amount", "state_after", "payment_method"])
      expect(historicalSalesFieldKey(field)).toBe(`nodiaAi:proposal.historical_sales.fields.${field}`);
    for (const field of ["unknown_value", "sale_price", "items.0.quantity", "__proto__", "constructor"])
      expect(historicalSalesFieldKey(field)).toBeUndefined();
  });

  it("resolves known enums only within their exact historical field", () => {
    expect(historicalSalesValueKey("payment_method", "cash")).toBe("business:pos.payment_cash");
    expect(historicalSalesValueKey("state_before", "draft")).toBe("business:pos.status_draft");
    expect(historicalSalesValueKey("state_after", "cancelled")).toBe("business:pos.status_cancelled");
    expect(historicalSalesValueKey("price_source", "offer")).toBe("nodiaAi:proposal.historical_sales.price_sources.offer");
    expect(historicalSalesValueKey("name", "cash")).toBeUndefined();
    expect(historicalSalesValueKey("payment_method", "draft")).toBeUndefined();
    expect(historicalSalesValueKey("state_after", "ready")).toBeUndefined();
    expect(historicalSalesValueKey(undefined, "offer")).toBeUndefined();
  });

  it("does not coerce zero, false, null, bigint money or identity values into labels", () => {
    for (const value of [0, false, null, undefined, 1200, "1200", "9007199254740993", {}, ["cash"]]) {
      expect(historicalSalesValueKey("payment_method", value)).toBeUndefined();
      expect(historicalSalesValueKey("state_after", value)).toBeUndefined();
      expect(historicalSalesValueKey("price_source", value)).toBeUndefined();
    }
  });
});
