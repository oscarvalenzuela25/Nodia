import type {
  ExtractedInvoiceItem,
  ProductEntity,
  ProductLogEntity,
} from "../../../../../../infrastructure/types";

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
    errors.push("Código es requerido");
  }
  if (!row.name || !row.name.trim()) {
    errors.push("Nombre es requerido");
  }
  if (row.cost_price === undefined || isNaN(row.cost_price) || row.cost_price < 0) {
    errors.push("Costo debe ser >= 0");
  }
  if (row.cost_price_tax === undefined || isNaN(row.cost_price_tax) || row.cost_price_tax < 0) {
    errors.push("Impuesto debe ser >= 0");
  }
  if (
    row.profit_percentage === undefined ||
    isNaN(row.profit_percentage) ||
    row.profit_percentage < 0
  ) {
    errors.push("Margen debe ser >= 0");
  }
  if (row.sale_price === undefined || isNaN(row.sale_price) || row.sale_price < 0) {
    errors.push("Precio venta debe ser >= 0");
  }
  if (row.stock === undefined || isNaN(row.stock) || row.stock < 0) {
    errors.push("Stock debe ser >= 0");
  }

  return { errors, isValid: errors.length === 0 };
};

export const mapExtractedItemsToRows = (
  items: ExtractedInvoiceItem[],
  existingProducts: ProductEntity[],
  historicalLogs?: ProductLogEntity[]
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

    const hasCostPrice =
      item.cost_price !== null &&
      item.cost_price !== undefined &&
      !isNaN(Number(item.cost_price));
    const hasCostPriceTax =
      item.cost_price_tax !== null &&
      item.cost_price_tax !== undefined &&
      !isNaN(Number(item.cost_price_tax));

    let cost_price = 0;
    let cost_price_tax = 0;

    if (hasCostPrice && hasCostPriceTax) {
      cost_price = Number(item.cost_price);
      cost_price_tax = Number(item.cost_price_tax);
    } else if (hasCostPriceTax) {
      cost_price_tax = Number(item.cost_price_tax);
      cost_price = 0;
    } else if (hasCostPrice) {
      cost_price = Number(item.cost_price);
      cost_price_tax = 0;
    } else if (item.unit_price !== null && item.unit_price !== undefined) {
      cost_price = Number(item.unit_price) || 0;
      cost_price_tax = Math.round(cost_price * 1.19);
    }

    const baseCost =
      cost_price_tax > 0
        ? cost_price_tax
        : cost_price > 0
        ? Math.round(cost_price * 1.19)
        : 0;
    const sale_price =
      baseCost > 0 ? Math.round(baseCost * (1 + profit_percentage / 100)) : 0;
    const stock = Number(item.quantity) || 1;

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
      stock: rowData.stock ?? 1,
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
  return rows.sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
};

