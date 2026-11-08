import { z } from "zod";
import { MEASUREMENT_UNITS } from "./measurementUnits";
import { DECIMAL_QUANTITY_PATTERN, lineSubtotal, quantityThousandths } from "./saleQuantities";
const amount = z.string().regex(/^(0|[1-9]\d*)$/);
const decimal = z.string().regex(DECIMAL_QUANTITY_PATTERN);
export const measurementUnitSchema = z.enum(MEASUREMENT_UNITS);
export const editableQuantitySchema = z.number().refine((value) => quantityThousandths(value) !== null, "Invalid quantity precision or range");
export const positiveQuantitySchema = editableQuantitySchema.refine((value) => value > 0, "Quantity must be positive");
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const paymentMethodSchema = z.enum(["cash", "bank_transfer", "debit_card", "credit_card", "other"]);
const item = z.object({
  id: z.string().min(1), product_id: z.string().min(1), position: z.number().int().nonnegative(), quantity: positiveQuantitySchema,
  product_code_snapshot: z.string().nullable(), product_barcode_snapshot: z.string().nullable(), product_name_snapshot: z.string(), measurement_unit_snapshot: measurementUnitSchema.optional(),
  regular_unit_price: amount, offer_price_snapshot: amount.nullable(), is_offer_enabled_snapshot: z.boolean(),
  price_source: z.enum(["regular", "offer", "manual"]), unit_price: amount, line_total: amount, product_version: version,
});
export const saleSchema = z.object({
  id: z.string().min(1), business_id: z.string().min(1), status: z.enum(["draft", "completed", "cancelled", "discarded"]), currency: z.literal("CLP"),
  payment_method: paymentMethodSchema, payment_method_description: z.string().nullable(), total_amount: amount, version,
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }), completed_at: z.iso.datetime({ offset: true }).nullable(),
  cancelled_at: z.iso.datetime({ offset: true }).nullable(), cancellation_reason: z.string().nullable(), items: z.array(item).max(200),
}).superRefine((sale, context) => {
  const canonical = (value: string) => /^(0|[1-9]\d*)$/.test(value);
  if (!canonical(sale.total_amount) || sale.items.some((line) => !canonical(line.line_total) || !canonical(line.unit_price) || quantityThousandths(line.quantity) === null)) return;
  const calculated = sale.items.reduce((sum, line) => sum + BigInt(line.line_total), 0n);
  if (calculated !== BigInt(sale.total_amount)) context.addIssue({ code: "custom", path: ["total_amount"], message: "Inconsistent sale total" });
  for (const [index, line] of sale.items.entries()) {
    const selected = line.is_offer_enabled_snapshot ? line.offer_price_snapshot : line.regular_unit_price;
    if (selected === null || (line.price_source !== "manual" && (line.price_source !== (line.is_offer_enabled_snapshot ? "offer" : "regular") || line.unit_price !== selected)) || line.line_total !== lineSubtotal(line.unit_price, line.quantity)) context.addIssue({ code: "custom", path: ["items", index], message: "Inconsistent sale item" });
  }
  if ((sale.status === "completed" || sale.status === "cancelled") && (sale.items.length === 0 || BigInt(sale.total_amount) <= 0n)) context.addIssue({ code: "custom", path: ["status"], message: "Invalid completed sale" });
});
export const salesResponseSchema = z.object({ data: z.array(saleSchema), meta: z.object({ total: z.number().int().nonnegative(), page: version, limit: version, total_pages: z.number().int().nonnegative() }) });
export const saleReceiptSchema = z.discriminatedUnion("status", [z.object({ status: z.literal("unconfirmed") }), z.object({ status: z.literal("completed"), sale: saleSchema, result_version: version })]);
export const summarySchema = z.object({ currency: z.literal("CLP"), timezone: z.literal("America/Santiago"), sales_count: amount, total_amount: amount, units_sold: decimal, quantity_by_unit: z.array(z.object({ measurement_unit: measurementUnitSchema, quantity: decimal })).max(MEASUREMENT_UNITS.length).optional(), average_ticket: z.object({ numerator: amount, denominator: amount }).nullable() });
export const topProductsSchema = z.object({ data: z.array(z.object({ product_id: z.string(), code: z.string().nullable(), name: z.string(), units_sold: decimal, total_amount: amount, measurement_unit: measurementUnitSchema.optional() })), currency: z.literal("CLP"), timezone: z.literal("America/Santiago"), metric: z.enum(["units", "amount"]) });
