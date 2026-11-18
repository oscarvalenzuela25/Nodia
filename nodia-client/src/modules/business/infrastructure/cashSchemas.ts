import { z } from "zod";
import { CASH_AMOUNT_PATTERN, CASH_TIME_ZONE, isCashCivilDate, isCashCivilMonth } from "./cashValues";

export const cashUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const cashCatalogIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((id) => id.length < 19 || id <= "9223372036854775807");
export const cashVersionSchema = z.int().min(1).max(2147483647);
export const cashDateSchema = z.string().refine(isCashCivilDate);

const typeSchema = z.enum(["income", "expense"]);
const categorySummarySchema = z.strictObject({
  id: cashCatalogIdSchema,
  name: z.string().min(1),
  is_active: z.boolean(),
});
export const cashCategorySchema = categorySummarySchema.extend({
  business_id: cashUuidSchema,
  description: z.string().min(1),
  version: cashVersionSchema,
});

const movementBase = {
  id: cashUuidSchema,
  business_id: cashUuidSchema,
  category_id: cashCatalogIdSchema,
  category: categorySummarySchema,
  amount: z.string().regex(CASH_AMOUNT_PATTERN),
  occurred_on: cashDateSchema,
  is_active: z.boolean(),
  version: cashVersionSchema,
};
export const cashMovementSchema = z
  .discriminatedUnion("source", [
    z.strictObject({
      ...movementBase,
      type: typeSchema,
      source: z.literal("manual"),
      description: z.string().min(1),
      invoice: z.null(),
    }),
    z.strictObject({
      ...movementBase,
      type: z.literal("expense"),
      source: z.literal("invoice"),
      description: z.null(),
      invoice: z.strictObject({ id: cashCatalogIdSchema, code: z.string().nullable() }),
    }),
  ])
  .refine((row) => row.category.id === row.category_id);

const cashMetaSchema = z
  .strictObject({
    page: z.int().min(1).max(100000),
    limit: z.int().min(1).max(100),
    total_items: z.int().nonnegative(),
    total_pages: z.int().nonnegative(),
  })
  .refine((meta) => Math.ceil(meta.total_items / meta.limit) === meta.total_pages);

const cashTotalsSchema = z.strictObject({
  count: z.int().nonnegative(),
  total_amount: z.string().regex(/^(0|[1-9][0-9]*)$/),
});
export const cashSummarySchema = z.strictObject({
  currency: z.literal("CLP"),
  income: cashTotalsSchema,
  expense: cashTotalsSchema,
});
export const cashMonthlySummarySchema = z.strictObject({
  period: z
    .strictObject({
      from: cashDateSchema,
      to: cashDateSchema,
      time_zone: z.literal(CASH_TIME_ZONE),
    })
    .refine(({ from, to }) => isCashCivilMonth(from, to)),
  summary: cashSummarySchema,
});

export const cashCategoryListSchema = z
  .strictObject({
    data: z.array(cashCategorySchema),
    meta: cashMetaSchema,
  })
  .refine(({ data, meta }) => data.length <= meta.limit && data.length <= meta.total_items);
export const cashMovementListSchema = z
  .strictObject({
    data: z.array(cashMovementSchema),
    meta: cashMetaSchema,
    summary: cashSummarySchema,
  })
  .refine(
    ({ data, meta, summary }) =>
      data.length <= meta.limit &&
      data.length <= meta.total_items &&
      summary.income.count + summary.expense.count === meta.total_items,
  );

const operationSchema = z.enum([
  "category_create",
  "category_update",
  "movement_create",
  "movement_update",
  "invoice_create",
  "invoice_update",
  "invoice_ocr_confirm",
]);
const identity = { request_key: cashUuidSchema, operation: operationSchema };
const receiptCategoryFields = {
  request_key: cashUuidSchema,
  status: z.literal("committed"),
  result: z.strictObject({ category: cashCategorySchema }),
};
const receiptMovementFields = {
  request_key: cashUuidSchema,
  status: z.literal("committed"),
  result: z.strictObject({ movement: cashMovementSchema }),
};
export const cashInvoiceResultSchema = z.strictObject({
  invoice_id: cashCatalogIdSchema,
  invoice_version: cashVersionSchema,
  cash_movement_id: cashUuidSchema.nullable(),
});
export const cashInvoiceOcrResultSchema = cashInvoiceResultSchema.extend({
  products: z
    .array(z.strictObject({ id: cashCatalogIdSchema, version: cashVersionSchema }))
    .min(1)
    .max(500)
    .refine((products) => new Set(products.map(({ id }) => id)).size === products.length),
});
const receiptInvoiceFields = {
  request_key: cashUuidSchema,
  status: z.literal("committed"),
  result: cashInvoiceResultSchema,
};
const committedSchema = z.discriminatedUnion("operation", [
  z.strictObject({ ...receiptCategoryFields, operation: z.literal("category_create") }),
  z.strictObject({ ...receiptCategoryFields, operation: z.literal("category_update") }),
  z.strictObject({ ...receiptMovementFields, operation: z.literal("movement_create") }),
  z.strictObject({ ...receiptMovementFields, operation: z.literal("movement_update") }),
  z.strictObject({ ...receiptInvoiceFields, operation: z.literal("invoice_create") }),
  z.strictObject({ ...receiptInvoiceFields, operation: z.literal("invoice_update") }),
  z.strictObject({
    ...receiptInvoiceFields,
    operation: z.literal("invoice_ocr_confirm"),
    result: cashInvoiceOcrResultSchema,
  }),
]);
export const cashWriteResultSchema = z.union([
  committedSchema,
  z.strictObject({ ...identity, status: z.literal("processing") }),
]);
export const cashReceiptSchema = z.union([
  cashWriteResultSchema,
  z.strictObject({ ...identity, status: z.literal("retryable") }),
  z.strictObject({
    ...identity,
    status: z.literal("rejected"),
    error: z.strictObject({ status_code: z.int().min(400).max(499), message: z.string().min(1) }),
  }),
  z.strictObject({ request_key: cashUuidSchema, status: z.literal("unconfirmed") }),
]);
