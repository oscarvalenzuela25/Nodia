/** Display-only labels for retired sales proposals. Never registers runtime authority. */
const effects: Readonly<Record<string, string>> = Object.freeze({
  nodia_sales_prepare_create: "nodiaAi:proposal.historical_sales.operations.create",
  nodia_sales_prepare_update: "nodiaAi:proposal.historical_sales.operations.update",
  nodia_sales_prepare_complete: "nodiaAi:proposal.historical_sales.operations.complete",
  nodia_sales_prepare_cancel: "nodiaAi:proposal.historical_sales.operations.cancel",
  nodia_sales_prepare_discard: "nodiaAi:proposal.historical_sales.operations.discard",
});

// These fields belong to the frozen public sale_pricing_snapshot/items projection.
// Unknown historical fields remain untouched by the generic review renderer.
const fields = new Set([
  "id", "business_id", "sale_id", "product_id", "items", "quantity", "payment_method",
  "payment_method_description", "cancellation_reason", "sale_pricing_snapshot", "currency",
  "version_before", "state_before", "lines", "total_amount", "state_after",
  "expected_product_version", "expected_unit_price", "code", "barcode", "name",
  "regular_unit_price", "offer_price", "is_offer_enabled", "price_source", "line_total",
  "product_version", "product_code_snapshot", "product_barcode_snapshot", "product_name_snapshot",
  "offer_price_snapshot", "is_offer_enabled_snapshot", "unit_price",
]);
const paymentMethods = new Set(["cash", "bank_transfer", "debit_card", "credit_card", "other"]);
const states = new Set(["draft", "completed", "cancelled", "discarded"]);
const priceSources = new Set(["regular", "offer", "manual"]);

export function historicalSalesEffectKey(tool: string): string | undefined {
  return Object.hasOwn(effects, tool) ? effects[tool] : undefined;
}

export function historicalSalesFieldKey(field: string): string | undefined {
  return fields.has(field) ? `nodiaAi:proposal.historical_sales.fields.${field}` : undefined;
}

export function historicalSalesValueKey(field: string | undefined, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (field === "payment_method" && paymentMethods.has(value)) return `business:pos.payment_${value}`;
  if ((field === "state_before" || field === "state_after") && states.has(value)) return `business:pos.status_${value}`;
  if (field === "price_source" && priceSources.has(value)) return `nodiaAi:proposal.historical_sales.price_sources.${value}`;
  return undefined;
}
