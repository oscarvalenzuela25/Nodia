// Synthetic browser QA only. No domain write, provider request, or real payment is performed.
import { MEASUREMENT_UNITS, measurementUnit, type MeasurementUnit } from "../../../modules/business/infrastructure/measurementUnits";
import { lineSubtotal, quantityThousandths } from "../../../modules/business/infrastructure/saleQuantities";
import { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import type { ProductEntity } from "../../../modules/business/infrastructure/types";
import type { Sale, SaleCommand, SaleItem } from "../../../modules/business/infrastructure/salesTypes";
const sales = new Map<string, Sale>();
const receipts = new Map<string, Sale>();
let failedResponse = false;
let barcodeConflictUsed = false;
let productPriceFailureUsed = false;
// Canonical wire decimals for exact aggregated thousandths; never locale-formatted JSON.
const decimalQuantity = (scaled: bigint) => {
  const fraction = (scaled % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return String(scaled / 1000n) + (fraction ? `.${fraction}` : "");
};
export function salesFixture(request: InternalAxiosRequestConfig, products: ProductEntity[], businessId: string) {
  const url = request.url ?? "";
  const response = (data: unknown, status = 200) => ({ config: request, data, status, statusText: "Synthetic POS QA", headers: {} });
  const reject = (status: number, message: string): never => { throw new AxiosError(message, "ERR_BAD_RESPONSE", request, undefined, response({ message }, status)); };
  if (url.endsWith("/products/availability-summary")) return response({ total: 27, available: 25, unavailable: 1, unknown: 1, activity: "active" });
  if (url.endsWith("/products/by-barcode")) {
    const product = products.find((item) => item.barcode === request.params?.barcode);
    return product ? response(product) : reject(404, "Código no vinculado (fixture)");
  }
  if (/\/products\/[^/]+\/image$/.test(url) && request.method === "get") return response(null);
  const productId = /\/products\/([^/]+)$/.exec(url)?.[1];
  if (productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return reject(404, "Producto inexistente (fixture)");
    if (request.method === "put") {
      if (new URLSearchParams(location.search).get("barcodeConflict") === "1" && !barcodeConflictUsed) { barcodeConflictUsed = true; return reject(409, "product:barcode_conflict"); }
      const patch = JSON.parse(String(request.data));
      if (patch.expected_version !== undefined && patch.expected_version !== product.version) return reject(409, "product:version_conflict");
      if (patch.sale_price !== undefined && new URLSearchParams(location.search).get("failProductPrice") === "1" && !productPriceFailureUsed) {
        productPriceFailureUsed = true; return reject(400, "Precio rechazado antes de guardar (fixture)");
      }
      Object.assign(product, patch, { version: (product.version ?? 0) + 1 });
      product.effective_price = String(product.is_offer_enabled ? product.offer_price : product.sale_price);
      product.price_source = product.is_offer_enabled ? "offer" : "regular";
    }
    return response(product);
  }
  const receiptKey = /\/sale-mutation-requests\/([^/]+)$/.exec(url)?.[1];
  if (receiptKey) return response(receipts.has(receiptKey) ? { status: "completed", sale: receipts.get(receiptKey), result_version: receipts.get(receiptKey)!.version } : { status: "unconfirmed" });
  const completed = [...sales.values()].filter((sale) => sale.status === "completed");
  if (url.endsWith("/sales/reports/summary")) {
    const total = completed.reduce((sum, sale) => sum + BigInt(sale.total_amount), 0n);
    const quantities = new Map<MeasurementUnit, bigint>();
    for (const item of completed.flatMap(sale => sale.items)) {
      const unit = measurementUnit(item.measurement_unit_snapshot);
      const scaled = quantityThousandths(item.quantity);
      if (scaled === null) return reject(400, "Cantidad inválida (fixture)");
      quantities.set(unit, (quantities.get(unit) ?? 0n) + scaled);
    }
    return response({ currency: "CLP", timezone: "America/Santiago", sales_count: String(completed.length), total_amount: String(total),
      units_sold: decimalQuantity(quantities.get("unit") ?? 0n),
      quantity_by_unit: MEASUREMENT_UNITS.filter(unit => quantities.has(unit)).map(unit => ({ measurement_unit: unit, quantity: decimalQuantity(quantities.get(unit)!) })),
      average_ticket: completed.length ? { numerator: String(total), denominator: String(completed.length) } : null });
  }
  if (url.endsWith("/sales/reports/top-products")) {
    const groups = new Map<string, { product_id: string; name: string; code: string | null; measurement_unit: MeasurementUnit; quantity: bigint; amount: bigint }>();
    for (const item of completed.flatMap((sale) => sale.items)) {
      const unit = measurementUnit(item.measurement_unit_snapshot);
      const scaled = quantityThousandths(item.quantity);
      if (scaled === null) return reject(400, "Cantidad inválida (fixture)");
      const key = `${item.product_id}:${unit}`, prior = groups.get(key);
      groups.set(key, { product_id: item.product_id, name: item.product_name_snapshot, code: item.product_code_snapshot,
        measurement_unit: unit, quantity: (prior?.quantity ?? 0n) + scaled, amount: (prior?.amount ?? 0n) + BigInt(item.line_total) });
    }
    const metric = request.params?.metric ?? "units", field = metric === "amount" ? "amount" : "quantity";
    const data = [...groups.values()].sort((a, b) => a[field] > b[field] ? -1 : a[field] < b[field] ? 1 : a.product_id.localeCompare(b.product_id) || a.measurement_unit.localeCompare(b.measurement_unit))
      .slice(0, Number(request.params?.limit ?? 10)).map(({ quantity, amount, ...item }) => ({ ...item, units_sold: decimalQuantity(quantity), total_amount: String(amount) }));
    return response({ data, currency: "CLP", timezone: "America/Santiago", metric });
  }
  if (!/\/sales(?:\/[^/]+(?:\/(?:complete|cancel))?)?$/.test(url)) return null;
  if (request.method === "get" && url.endsWith("/sales")) {
    const data = [...sales.values()].filter((sale) => !request.params?.status || sale.status === request.params.status);
    return response({ data, meta: { total: data.length, page: 1, limit: 25, total_pages: data.length ? 1 : 0 } });
  }
  const command = JSON.parse(String(request.data ?? "{}")) as SaleCommand;
  if (receipts.has(command.request_key)) return response(receipts.get(command.request_key));
  const checkout = url.endsWith("/sales/checkout");
  const id = checkout ? undefined : /\/sales\/([^/]+)/.exec(url)?.[1];
  let sale = id ? sales.get(id) : undefined;
  if (request.method === "get") return sale ? response(sale) : reject(404, "Venta inexistente (fixture)");
  const now = new Date().toISOString();
  if (!id && request.method === "post") {
    sale = { id: crypto.randomUUID(), business_id: businessId, status: "draft", currency: "CLP", payment_method: command.payment_method ?? "cash", payment_method_description: command.payment_method_description ?? null,
      total_amount: "0", version: 1, created_at: now, updated_at: now, completed_at: null, cancelled_at: null, cancellation_reason: null, items: [] };
  }
  if (!sale) return reject(404, "Venta inexistente (fixture)");
  if (id && command.expected_version !== sale.version) return reject(409, "La venta cambió (fixture)");
  if (command.items) sale.items = command.items.map((line, index): SaleItem => {
    const product = products.find((item) => item.id === line.product_id);
    const scaled = quantityThousandths(line.quantity);
    if (scaled === null || scaled <= 0n) return reject(400, "Cantidad inválida (fixture)");
    if (!product || product.business_id !== businessId || !product.is_active || product.has_stock !== true || product.version !== line.expected_product_version || product.effective_price !== line.expected_unit_price) return reject(409, "El producto cambió (fixture)");
    return { id: crypto.randomUUID(), product_id: product.id, position: index, quantity: line.quantity, product_version: product.version!, product_code_snapshot: product.code, product_barcode_snapshot: product.barcode ?? null,
      product_name_snapshot: product.name, measurement_unit_snapshot: product.measurement_unit ?? "unit", regular_unit_price: String(product.sale_price), offer_price_snapshot: product.offer_price === null || product.offer_price === undefined ? null : String(product.offer_price), is_offer_enabled_snapshot: product.is_offer_enabled ?? false,
      price_source: line.unit_price_override == null ? (product.is_offer_enabled ? "offer" : "regular") : "manual", unit_price: line.unit_price_override ?? line.expected_unit_price, line_total: lineSubtotal(line.unit_price_override ?? line.expected_unit_price, line.quantity) };
  });
  if (command.payment_method) sale.payment_method = command.payment_method;
  if (command.payment_method_description !== undefined) sale.payment_method_description = command.payment_method_description;
  sale.total_amount = String(sale.items.reduce((sum, item) => sum + BigInt(item.line_total), 0n));
  if (checkout || url.endsWith("/complete")) { if (BigInt(sale.total_amount) === 0n) return reject(400, "Total cero (fixture)"); sale.status = "completed"; sale.completed_at = now; }
  if (url.endsWith("/cancel")) { sale.status = "cancelled"; sale.cancelled_at = now; sale.cancellation_reason = command.cancellation_reason ?? null; }
  if (request.method === "delete") sale.status = "discarded";
  if (id) sale.version++;
  sale.updated_at = now; sales.set(sale.id, sale); receipts.set(command.request_key, structuredClone(sale));
  if (new URLSearchParams(location.search).get("failSale") === "1" && !failedResponse) { failedResponse = true; return reject(503, "Respuesta perdida después de COMMIT (fixture)"); }
  return response(sale);
}
