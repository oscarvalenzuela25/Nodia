import i18n from "../../../../../../../../translate";
import type {
  ExtractedInvoiceItem,
  ProductEntity,
  ProductLogEntity,
  VerifyIaProviderItem,
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
  code: string;
  name: string;
  cost_price: number;
  cost_price_tax: number;
  profit_percentage: number;
  sale_price: number;
  stock: number;
  created_at?: string;
}

export interface PriceDiffData {
  diff: number;
  percent: number;
  isIncrease: boolean;
}

export interface InvoiceProvisionalRow {
  id?: string;
  code: string;
  name: string;
  cost_price: number;
  cost_price_tax: number;
  profit_percentage: number;
  sale_price: number;
  stock: number;
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

export const validateInvoiceRow = (
  row: Partial<InvoiceProvisionalRow>
): { errors: string[]; isValid: boolean } => {
  const errors: string[] = [];

  if (!row.code || !row.code.trim()) {
    errors.push(i18n.t("business:invoice_validation_code"));
  }
  if (!row.name || !row.name.trim()) {
    errors.push(i18n.t("business:invoice_validation_name"));
  }
  if (row.cost_price === undefined || !Number.isFinite(row.cost_price) || row.cost_price < 0) {
    errors.push(i18n.t("business:invoice_validation_cost"));
  }
  if (row.cost_price_tax === undefined || !Number.isFinite(row.cost_price_tax) || row.cost_price_tax < 0) {
    errors.push(i18n.t("business:invoice_validation_tax"));
  }
  if (
    row.profit_percentage === undefined ||
    !Number.isFinite(row.profit_percentage) ||
    row.profit_percentage < 0
  ) {
    errors.push(i18n.t("business:invoice_validation_margin"));
  }
  if (row.sale_price === undefined || !Number.isFinite(row.sale_price) || row.sale_price < 0) {
    errors.push(i18n.t("business:invoice_validation_sale"));
  }
  if (row.stock === undefined || !Number.isFinite(row.stock) || row.stock < 0) {
    errors.push(i18n.t("business:invoice_validation_stock"));
  }

  return { errors, isValid: errors.length === 0 };
};

export const validateInvoiceRows = (rows: InvoiceProvisionalRow[]): InvoiceProvisionalRow[] => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const code = row.code.trim().toLowerCase();
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  });
  return rows.map((row) => {
    const { errors } = validateInvoiceRow(row);
    if ((counts.get(row.code.trim().toLowerCase()) ?? 0) > 1) {
      errors.push(i18n.t("business:invoice_validation_duplicate_code"));
    }
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
        cost_price: Number(logMatch.cost_price ?? 0),
        cost_price_tax: Number(logMatch.cost_price_tax ?? 0),
        profit_percentage: Number(logMatch.profit_percentage ?? 30),
        sale_price: Number(logMatch.sale_price ?? 0),
        stock: Number(logMatch.stock ?? 0),
        created_at: logMatch.created_at,
      };
    } else if (existing) {
      historicalProduct = {
        id: existing.id,
        code: existing.code,
        name: existing.name,
        cost_price: Number(existing.cost_price ?? 0),
        cost_price_tax: Number(existing.cost_price_tax ?? 0),
        profit_percentage: Number(existing.profit_percentage ?? 30),
        sale_price: Number(existing.sale_price ?? 0),
        stock: Number(existing.stock ?? 0),
        created_at: existing.created_at,
      };
    }

    // When historical product is found, synchronize profit percentage to match historical margin!
    const profit_percentage = historicalProduct
      ? historicalProduct.profit_percentage
      : existing
      ? existing.profit_percentage
      : 30;

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
    const sale_price = Number.isFinite(cost_price_tax)
      ? Math.round(cost_price_tax * (1 + profit_percentage / 100)) : Number.NaN;
    const stock = item.quantity === null || item.quantity === undefined ? Number.NaN : Number(item.quantity);

    const priceDiff = calculatePriceDiff(sale_price, historicalProduct?.sale_price);

    const rowData: Partial<InvoiceProvisionalRow> = {
      id: existing?.id,
      code,
      name: (item.name || "").trim(),
      cost_price,
      cost_price_tax,
      profit_percentage,
      sale_price,
      stock,
      is_active: true,
      isUpdate: Boolean(existing?.id),
      isLocked: false,
      historicalProduct,
      priceDiff,
    };

    const { errors, isValid } = validateInvoiceRow(rowData);

    return {
      id: rowData.id,
      code: rowData.code ?? "",
      name: rowData.name ?? "",
      cost_price: rowData.cost_price ?? 0,
      cost_price_tax: rowData.cost_price_tax ?? 0,
      profit_percentage: rowData.profit_percentage ?? 30,
      sale_price: rowData.sale_price ?? 0,
      stock: rowData.stock ?? Number.NaN,
      is_active: true,
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

