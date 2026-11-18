import { roundSalePrice } from "../../../../../../../../utils/salePrice";
import { cashCatalogIdSchema, cashVersionSchema } from "../../../../../../infrastructure/cashSchemas";
import type { OcrConfirmationFields, OcrConfirmationItem } from "../../../../../../infrastructure/cashTypes";
import { isCashCivilDate } from "../../../../../../infrastructure/cashValues";
import { PRODUCT_PRICE_MAX } from "../ProductModal/productPricing";
import { INVOICE_UPDATE_FIELDS, invoiceAliasNeedsReview, type InvoiceProvisionalRow } from "./helpers";

export const MAX_OCR_CONFIRMATION_ROWS = 500;
const MAX_INVOICE_CODE_LENGTH = 255;
const INVOICE_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_INVOICE_BYTES = 10 * 1024 ** 2;

export const canConfirmInvoiceFile = (file: File) =>
  INVOICE_FILE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_INVOICE_BYTES;

export const isInvoiceTotal = (amount: number) =>
  Number.isInteger(amount) && amount >= 0 && amount <= PRODUCT_PRICE_MAX;

const isInvoiceText = (value: string) => !value.includes("\u0000") && !/[\uD800-\uDFFF]/u.test(value);
export const isInvoiceFolio = (code: string) =>
  isInvoiceText(code) && code.trim().length <= MAX_INVOICE_CODE_LENGTH;

export class InvoiceConfirmationError extends Error {
  readonly messageKey: string;

  constructor(messageKey: string) {
    super(messageKey);
    this.messageKey = messageKey;
  }
}

function invalid(messageKey: string): never {
  throw new InvoiceConfirmationError(messageKey);
}

function productText(text: string, messageKey: string): string {
  const trimmed = text.trim();
  if (!isInvoiceText(text) || [...trimmed].length > 255) invalid(messageKey);
  return trimmed;
}

export function invoiceConfirmationItem(row: InvoiceProvisionalRow, businessId: string): OcrConfirmationItem {
  const name = productText(row.name, "business:invoice_validation_name");
  if (!name) invalid("business:invoice_validation_name");
  if (invoiceAliasNeedsReview(row)) invalid("business:invoice_alias_required");
  const alias = productText(row.alias ?? "", "business:invoice_alias_required");
  if (!isInvoiceTotal(row.cost_price)) invalid("business:invoice_validation_cost");
  if (!Number.isFinite(row.quantity) || row.quantity < 0) invalid("business:invoice_validation_quantity");
  const line = {
    invoice_code: productText(row.invoice_code ?? row.code, "business:invoice_validation_code") || null,
    name,
    alias,
    alias_reviewed: true as const,
    cost_price: row.cost_price,
    quantity: row.quantity,
  };
  const match = row.manual_match;
  const submitted = (field: (typeof INVOICE_UPDATE_FIELDS)[number]) => !match || match.fields.includes(field);
  const code = submitted("code") ? productText(row.code, "business:invoice_validation_code") || null : null;
  if (submitted("cost_price_tax") && !isInvoiceTotal(row.cost_price_tax)) invalid("business:invoice_validation_tax");
  const salePrice = submitted("sale_price") && Number.isInteger(row.sale_price) ? roundSalePrice(row.sale_price) : null;
  if (submitted("sale_price") && salePrice === null) invalid("business:invoice_validation_sale");
  const changedSale = salePrice ?? row.sale_price;

  if (row.id === undefined) {
    if (match || row.isUpdate) invalid("business:invoice_match_invalid_product");
    if (code === null) invalid("business:invoice_validation_code");
    return { kind: "create", line, product: { code, name, alias, cost_price: row.cost_price,
      cost_price_tax: row.cost_price_tax, sale_price: changedSale, is_active: row.is_active } };
  }

  const revision = cashVersionSchema.safeParse(row.version);
  if (!cashCatalogIdSchema.safeParse(row.id).success || !revision.success) {
    invalid("business:invoice_match_invalid_product");
  }
  const target = { product_id: row.id, expected_version: revision.data };
  if (!match) {
    return { kind: "update", line, ...target, product: { code, name, alias, cost_price: row.cost_price,
      cost_price_tax: row.cost_price_tax, sale_price: changedSale, is_active: row.is_active } };
  }
  if (row.id !== match.product_id || businessId !== match.business_id || revision.data !== match.expected_version ||
    !match.fields.length || match.fields.some((field) => !INVOICE_UPDATE_FIELDS.includes(field))) {
    invalid("business:invoice_match_invalid_product");
  }
  const changes = {
    ...(submitted("code") ? { code } : {}),
    ...(submitted("name") ? { name } : {}),
    ...(submitted("alias") ? { alias } : {}),
    ...(submitted("cost_price") ? { cost_price: row.cost_price } : {}),
    ...(submitted("cost_price_tax") ? { cost_price_tax: row.cost_price_tax } : {}),
    ...(submitted("sale_price") ? { sale_price: changedSale } : {}),
  };
  return { kind: "manual_match", line, ...target, changes };
}

export function prepareInvoiceConfirmation(
  rows: InvoiceProvisionalRow[],
  businessId: string,
  draft: { providerId: string; code: string; total: number; issueDate: string; categoryId?: string },
): OcrConfirmationFields {
  if (rows.length < 1 || rows.length > MAX_OCR_CONFIRMATION_ROWS) invalid("business:cash.ocr_max_items");
  if (!isInvoiceTotal(draft.total)) invalid("business:cash.ocr_total_range");
  if (!isInvoiceFolio(draft.code)) invalid("business:invoice_code_invalid");
  if (draft.categoryId && draft.total === 0) invalid("business:cash_invoice_invalid_amount");
  const issueDate = draft.issueDate.trim();
  if ((draft.categoryId || issueDate) && !isCashCivilDate(issueDate)) {
    invalid(draft.categoryId ? "business:cash_invoice_invalid_date" : "business:cash.ocr_invalid_date");
  }
  if (!cashCatalogIdSchema.safeParse(draft.providerId).success ||
    (draft.categoryId && !cashCatalogIdSchema.safeParse(draft.categoryId).success)) {
    invalid("business:cash_invalid_command");
  }

  const targetIds = new Set<string>();
  const submittedCodes = new Set<string>();
  const items = rows.map((row) => {
    const item = invoiceConfirmationItem(row, businessId);
    if (item.kind !== "create") {
      if (targetIds.has(item.product_id)) invalid("business:invoice_match_duplicate_target");
      targetIds.add(item.product_id);
    }
    const code = (item.kind === "manual_match" ? item.changes.code : item.product.code)?.toLowerCase();
    if (code) {
      if (submittedCodes.has(code)) invalid("business:invoice_validation_duplicate_code");
      submittedCodes.add(code);
    }
    return item;
  });

  return {
    invoice: {
      provider_id: draft.providerId,
      code: draft.code.trim() || null,
      total_amount: draft.total,
      ...(issueDate ? { issue_date: issueDate } : {}),
      ...(draft.categoryId ? { cash_category_id: draft.categoryId } : {}),
    },
    items,
  };
}
