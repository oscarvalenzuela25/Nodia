import { roundSalePrice } from "../../../../../../../../utils/salePrice";
import i18n from "../../../../../../../../translate";
import { normalizeProductAlias, productAliasFits } from "../../../../../../infrastructure/productAliases";
import { PRODUCT_PRICE_MAX, suggestedProductPrice } from "../ProductModal/productPricing";
import type {
  ExtractedInvoiceItem,
  ProductEntity,
  ProductLogEntity,
  VerifyIaProviderItem,
  CreateProductPayload,
  BulkUpdateProductItemPayload,
} from "../../../../../../infrastructure/types";

export const normalizeVerifyProviders = (data: unknown): VerifyIaProviderItem[] => {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is VerifyIaProviderItem =>
    item !== null && typeof item === "object" &&
    typeof item.id === "string" && item.id.length > 0 &&
    typeof item.key === "string" && typeof item.name === "string" &&
    typeof item.is_active === "boolean" && typeof item.can_use_model === "boolean",
  );
};

export interface HistoricalProductData {
  id?: string;
  code: string | null;
  name: string;
  alias?: string | null;
  cost_price: number;
  cost_price_tax: number;
  sale_price: number;
  stock: number;
  created_at?: string;
}

export interface PriceDiffData {
  diff: number;
  percent: number;
  isIncrease: boolean;
}

export const INVOICE_UPDATE_FIELDS = ["code", "name", "alias", "cost_price", "cost_price_tax", "sale_price"] as const;
export type InvoiceUpdateField = typeof INVOICE_UPDATE_FIELDS[number];
export interface ManualInvoiceMatch {
  product_id: string;
  business_id: string;
  expected_version: number;
  fields: InvoiceUpdateField[];
}

export interface InvoiceProvisionalRow {
  id?: string;
  code: string;
  invoice_code?: string;
  manual_match?: ManualInvoiceMatch;
  name: string;
  alias?: string | null;
  alias_reviewed?: boolean;
  cost_price: number;
  cost_price_tax: number;
  sale_price: number;
  quantity: number;
  has_stock?: boolean;
  version?: number;
  stock?: number; // Legacy type compatibility only, never assigned from invoice quantity.
  is_active: boolean;
  isUpdate: boolean;
  isLocked?: boolean;
  historicalProduct?: HistoricalProductData;
  priceDiff?: PriceDiffData | null;
  errors: string[];
  isValid: boolean;
}

export const calculatePriceDiff = (
  currentSale: number,
  historicalSale?: number
): PriceDiffData | null => {
  if (
    historicalSale === undefined ||
    historicalSale === null ||
    !Number.isFinite(historicalSale) ||
    !Number.isFinite(currentSale) ||
    historicalSale <= 0 ||
    currentSale <= 0
  ) {
    return null;
  }
  const diff = currentSale - historicalSale;
  if (diff === 0) return null;
  const percent = Math.trunc(((currentSale - historicalSale) / historicalSale) * 100);
  return {
    diff,
    percent: Math.abs(percent),
    isIncrease: diff > 0,
  };
};

/** New OCR rows use their name; catalog aliases remain independently editable. */
export function invoiceAliasNeedsReview(row: Partial<InvoiceProvisionalRow>): boolean {
  return row.alias_reviewed !== true || typeof row.alias !== "string" || normalizeProductAlias(row.alias) === null || !productAliasFits(row.alias);
}

export function reviewInvoiceAlias(row: InvoiceProvisionalRow, alias: string): InvoiceProvisionalRow {
  const value = normalizeProductAlias(alias);
  if (!value || !productAliasFits(value)) throw new Error(i18n.t("business:product_alias_invalid"));
  const next: InvoiceProvisionalRow = { ...row, alias: value, alias_reviewed: true,
    manual_match: row.manual_match ? { ...row.manual_match, fields: [...new Set([...row.manual_match.fields, "alias" as const])] } : undefined };
  return { ...next, ...validateInvoiceRow(next) };
}

/** A local price edit joins the reviewed fields when the row was manually bound. */
export function reviewInvoiceSalePrice(row: InvoiceProvisionalRow, salePrice: number): InvoiceProvisionalRow {
  const rounded = roundSalePrice(salePrice);
  if (!Number.isInteger(salePrice) || rounded === null) {
    throw new Error(i18n.t("business:invoice_validation_sale"));
  }
  const next: InvoiceProvisionalRow = { ...row, sale_price: rounded,
    priceDiff: calculatePriceDiff(rounded, row.historicalProduct?.sale_price),
    manual_match: row.manual_match ? { ...row.manual_match, fields: [...new Set([...row.manual_match.fields, "sale_price" as const])] } : undefined };
  return { ...next, ...validateInvoiceRow(next) };
}

/** Keep unselected catalog prices intact; only selected or explicitly edited sale fields round. */
export function invoiceRowEditPrice(row: InvoiceProvisionalRow, edited: Partial<InvoiceProvisionalRow>): Pick<InvoiceProvisionalRow, "sale_price" | "manual_match"> {
  const match = row.manual_match;
  const fields = match ? [...new Set([...match.fields, ...INVOICE_UPDATE_FIELDS.filter(field =>
    Object.hasOwn(edited, field) && edited[field] !== row[field])])] : [];
  const writesSale = !match || fields.includes("sale_price");
  return {
    sale_price: writesSale ? roundSalePrice(edited.sale_price ?? Number.NaN) ?? Number.NaN : row.sale_price,
    manual_match: match ? { ...match, fields } : undefined,
  };
}

export const validateInvoiceRow = (
  row: Partial<InvoiceProvisionalRow>,
  requireAliasReview = true,
): { errors: string[]; isValid: boolean } => {
  const errors: string[] = [];

  if (!row.id && (!row.code || !row.code.trim())) {
    errors.push(i18n.t("business:invoice_validation_code"));
  }
  if (!row.name || !row.name.trim()) {
    errors.push(i18n.t("business:invoice_validation_name"));
  }
  if (requireAliasReview && invoiceAliasNeedsReview(row)) {
    errors.push(i18n.t("business:invoice_alias_required"));
  }
  if (row.cost_price === undefined || !Number.isInteger(row.cost_price) || row.cost_price < 0 || row.cost_price > PRODUCT_PRICE_MAX) {
    errors.push(i18n.t("business:invoice_validation_cost"));
  }
  if (row.cost_price_tax === undefined || !Number.isInteger(row.cost_price_tax) || row.cost_price_tax < 0 || row.cost_price_tax > PRODUCT_PRICE_MAX) {
    errors.push(i18n.t("business:invoice_validation_tax"));
  }
  if (row.sale_price === undefined || !Number.isInteger(row.sale_price) || row.sale_price < 0 || row.sale_price > PRODUCT_PRICE_MAX ||
    ((!row.manual_match || row.manual_match.fields.includes("sale_price")) && roundSalePrice(row.sale_price) === null)) {
    errors.push(i18n.t("business:invoice_validation_sale"));
  }
  if (row.quantity === undefined || !Number.isFinite(row.quantity) || row.quantity < 0) {
    errors.push(i18n.t("business:invoice_validation_quantity"));
  }

  return { errors, isValid: errors.length === 0 };
};

export const validateInvoiceRows = (rows: InvoiceProvisionalRow[]): InvoiceProvisionalRow[] => {
  const counts = new Map<string, number>();
  const targets = new Map<string, number>();
  rows.forEach((row) => {
    const code = row.code.trim().toLowerCase();
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
    if (row.id) targets.set(row.id, (targets.get(row.id) ?? 0) + 1);
  });
  return rows.map((row) => {
    const { errors } = validateInvoiceRow(row);
    if ((counts.get(row.code.trim().toLowerCase()) ?? 0) > 1) {
      errors.push(i18n.t("business:invoice_validation_duplicate_code"));
    }
    if (row.id && (targets.get(row.id) ?? 0) > 1) errors.push(i18n.t("business:invoice_match_duplicate_target"));
    return { ...row, errors, isValid: errors.length === 0 };
  });
};

export const mapExtractedItemsToRows = (
  items: ExtractedInvoiceItem[],
  existingProducts: ProductEntity[],
  historicalLogs?: ProductLogEntity[],
  providerTax = 19
): InvoiceProvisionalRow[] => {
  const existingMap = new Map<string, ProductEntity>();
  existingProducts.forEach((p) => {
    if (p.code) {
      existingMap.set(p.code.trim().toLowerCase(), p);
    }
  });

  const logsMap = new Map<string, ProductLogEntity>();
  if (historicalLogs && historicalLogs.length > 0) {
    // Collect the latest log per product code or product id
    historicalLogs.forEach((log) => {
      const codeKey = (log.code || "").trim().toLowerCase();
      if (codeKey && !logsMap.has(codeKey)) {
        logsMap.set(codeKey, log);
      }
      if (log.product_id && !logsMap.has(`pid_${log.product_id}`)) {
        logsMap.set(`pid_${log.product_id}`, log);
      }
    });
  }

  const rows: InvoiceProvisionalRow[] = items.map((item) => {
    const code = (item.code || "").trim();
    const existing = code ? existingMap.get(code.toLowerCase()) : undefined;

    // Resolve historical record (from product_logs or existing product catalog snapshot)
    let historicalProduct: HistoricalProductData | undefined;
    const logMatch = code
      ? logsMap.get(code.toLowerCase()) || (existing?.id ? logsMap.get(`pid_${existing.id}`) : undefined)
      : undefined;

    if (logMatch) {
      historicalProduct = {
        id: logMatch.id,
        code: logMatch.code,
        name: logMatch.name,
        alias: logMatch.alias ?? null,
        cost_price: Number(logMatch.cost_price ?? 0),
        cost_price_tax: Number(logMatch.cost_price_tax ?? 0),
        sale_price: Number(logMatch.sale_price ?? 0),
        stock: Number(logMatch.stock ?? 0),
        created_at: logMatch.created_at,
      };
    } else if (existing) {
      historicalProduct = {
        id: existing.id,
        code: existing.code,
        name: existing.name,
        alias: existing.alias ?? null,
        cost_price: Number(existing.cost_price ?? 0),
        cost_price_tax: Number(existing.cost_price_tax ?? 0),
        sale_price: Number(existing.sale_price ?? 0),
        stock: Number(existing.stock ?? 0),
        created_at: existing.created_at,
      };
    }

    const missingNet = item.cost_price === null || item.cost_price === undefined;
    const missingGross = item.cost_price_tax === null || item.cost_price_tax === undefined;
    let cost_price = missingNet ? Number.NaN : Number(item.cost_price);
    let cost_price_tax = missingGross ? Number.NaN : Number(item.cost_price_tax);
    const taxFactor = 1 + providerTax / 100;
    if (missingNet && missingGross && item.unit_price !== null && item.unit_price !== undefined) {
      cost_price = Number(item.unit_price);
      cost_price_tax = Math.round(cost_price * taxFactor);
    } else if (missingNet && Number.isFinite(cost_price_tax)) {
      cost_price = Math.round(cost_price_tax / taxFactor);
    } else if (missingGross && Number.isFinite(cost_price)) {
      cost_price_tax = Math.round(cost_price * taxFactor);
    }
    // Initial OCR proposal only. Later edits remain independent of costs.
    const sale_price = suggestedProductPrice(cost_price_tax, 30) ?? Number.NaN;
    const name = (item.name || "").trim();
    const alias = normalizeProductAlias(existing ? existing.alias : name);
    const quantity = item.quantity === null || item.quantity === undefined ? Number.NaN : Number(item.quantity);

    const priceDiff = calculatePriceDiff(sale_price, historicalProduct?.sale_price);

    const rowData: Partial<InvoiceProvisionalRow> = {
      id: existing?.id,
      code,
      invoice_code: code,
      name,
      alias,
      alias_reviewed: alias !== null && productAliasFits(alias),
      cost_price,
      cost_price_tax,
      sale_price,
      quantity,
      has_stock: existing ? existing.has_stock ?? undefined : true,
      version: existing?.version,
      is_active: existing?.is_active ?? true,
      isUpdate: Boolean(existing?.id),
      isLocked: false,
      historicalProduct,
      priceDiff,
    };

    const { errors, isValid } = validateInvoiceRow(rowData);

    return {
      id: rowData.id,
      code: rowData.code ?? "",
      invoice_code: code,
      name: rowData.name ?? "",
      alias: rowData.alias ?? null,
      alias_reviewed: rowData.alias_reviewed,
      cost_price: rowData.cost_price ?? 0,
      cost_price_tax: rowData.cost_price_tax ?? 0,
      sale_price: rowData.sale_price ?? 0,
      quantity: rowData.quantity ?? Number.NaN,
      has_stock: rowData.has_stock,
      version: rowData.version,
      is_active: rowData.is_active ?? true,
      isUpdate: Boolean(rowData.isUpdate),
      isLocked: false,
      historicalProduct,
      priceDiff,
      errors,
      isValid,
    };
  });

  // Strict sorting: Red/invalid rows ALWAYS at the top!
  return validateInvoiceRows(rows).sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
};

/** Purchase quantity is retained in the invoice, never copied into catalog state. */
export function invoiceProductPayload(row: InvoiceProvisionalRow, businessId: string, providerId: string | null): CreateProductPayload | BulkUpdateProductItemPayload {
  const validation = validateInvoiceRow(row);
  if (!validation.isValid) throw new Error(validation.errors.join(', '));
  if (row.manual_match) {
    const match = row.manual_match;
    if (row.id !== match.product_id || match.business_id !== businessId || row.version !== match.expected_version ||
      !Number.isSafeInteger(match.expected_version) || match.expected_version < 1 || !match.fields.length ||
      match.fields.some(field => !INVOICE_UPDATE_FIELDS.includes(field))) throw new Error(i18n.t('business:invoice_match_invalid_product'));
    const payload: BulkUpdateProductItemPayload = { id: match.product_id, expected_version: match.expected_version };
    for (const field of match.fields) {
      if (field === 'code') payload.code = row.code.trim() || null;
      else if (field === 'name') payload.name = row.name;
      else if (field === 'alias') payload.alias = row.alias?.trim() ?? null;
      else payload[field] = field === 'sale_price' ? roundSalePrice(row.sale_price)! : row[field];
    }
    return payload;
  }
  const common = { provider_id: providerId, code: row.code, name: row.name, alias: row.alias?.trim() ?? null,
    cost_price: row.cost_price, cost_price_tax: row.cost_price_tax,
    sale_price: roundSalePrice(row.sale_price)!, is_active: row.is_active };
  if (row.id) {
    if (!Number.isSafeInteger(row.version) || Number(row.version) < 1) throw new Error(i18n.t('business:invoice_match_invalid_product'));
    return { ...common, id: row.id, expected_version: row.version };
  }
  return { ...common, business_id: businessId, has_stock: true };
}

export function prepareInvoiceProductPayloads(rows: InvoiceProvisionalRow[], businessId: string, providerId: string | null) {
  const reviewed = validateInvoiceRows(rows);
  if (!reviewed.length || reviewed.some(row => !row.isValid)) throw new Error(reviewed.flatMap(row => row.errors).join(", "));
  const newItems: CreateProductPayload[] = [];
  const updateItems: BulkUpdateProductItemPayload[] = [];
  for (const row of reviewed) {
    const payload = invoiceProductPayload(row, businessId, providerId);
    if ("id" in payload) updateItems.push(payload);
    else newItems.push(payload);
  }
  return { newItems, updateItems };
}

/** Bind by immutable product identity; only checked catalog fields join the later save. */
export function canBindInvoiceProduct(product: ProductEntity, businessId: string): boolean {
  const money = (value: unknown) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= PRODUCT_PRICE_MAX;
  return product.business_id === businessId && /^[1-9][0-9]*$/.test(product.id) &&
    Number.isSafeInteger(product.version) && Number(product.version) >= 1 &&
    typeof product.name === 'string' && !!product.name.trim() && (product.code === null || typeof product.code === 'string') &&
    typeof product.is_active === 'boolean' && [product.cost_price, product.cost_price_tax, product.sale_price].every(money);
}

export function bindInvoiceRow(row: InvoiceProvisionalRow, product: ProductEntity, fields: readonly InvoiceUpdateField[], businessId: string): InvoiceProvisionalRow {
  if (!canBindInvoiceProduct(product, businessId) || !fields.length || fields.some(field => !INVOICE_UPDATE_FIELDS.includes(field)) ||
    fields.includes('code') && !row.code.trim()) {
    throw new Error(i18n.t('business:invoice_match_invalid_product'));
  }
  const selected = [...new Set(fields)];
  const next: InvoiceProvisionalRow = {
    ...row, id: product.id, code: product.code ?? '', name: product.name,
    alias: typeof product.alias === 'string' && product.alias.trim() ? product.alias.trim() : null,
    alias_reviewed: typeof product.alias === 'string' && !!product.alias.trim() && productAliasFits(product.alias),
    cost_price: Number(product.cost_price), cost_price_tax: Number(product.cost_price_tax), sale_price: Number(product.sale_price),
    version: product.version, has_stock: product.has_stock ?? undefined, is_active: product.is_active, isUpdate: true,
    manual_match: { product_id: product.id, business_id: businessId, expected_version: Number(product.version), fields: selected },
    historicalProduct: { id: product.id, code: product.code, name: product.name, alias: product.alias ?? null, cost_price: Number(product.cost_price), cost_price_tax: Number(product.cost_price_tax), sale_price: Number(product.sale_price), stock: Number(product.stock), created_at: product.updated_at },
  };
  for (const field of selected) {
    if (field === 'alias') { next.alias = row.alias; next.alias_reviewed = row.alias_reviewed; }
    else if (field === 'code' || field === 'name') next[field] = row[field];
    else next[field] = row[field];
  }
  const fieldValidation = validateInvoiceRow(next, false);
  if (!fieldValidation.isValid) throw new Error(fieldValidation.errors.join(', '));
  return { ...next, ...validateInvoiceRow(next), priceDiff: calculatePriceDiff(next.sale_price, Number(product.sale_price)) };
}

