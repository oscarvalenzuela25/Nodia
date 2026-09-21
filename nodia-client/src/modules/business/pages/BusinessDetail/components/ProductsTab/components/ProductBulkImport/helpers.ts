export interface ProvisionalRow {
  id?: string;
  code: string;
  name: string;
  cost_price: number;
  cost_price_tax: number;
  profit_percentage: number;
  sale_price: number;
  stock: number;
  is_active: boolean;
  errors: string[];
  isValid: boolean;
}

export const FIELD_ALIASES: Record<string, string[]> = {
  code: ["code", "codigo", "código", "sku", "código / sku", "code / sku"],
  name: ["name", "nombre", "descripcion", "descripción", "description", "nombre del producto", "product name"],
  cost_price: ["cost_price", "costo", "cost", "precio_costo", "precio costo", "costo base", "costo_base", "base cost", "precio de costo", "cost price"],
  cost_price_tax: ["cost_price_tax", "impuesto", "tax", "iva", "impuesto_costo", "impuesto costo", "cost tax"],
  profit_percentage: ["profit_percentage", "margen", "margin", "profit", "utilidad", "margen %", "profit margin %", "margin %"],
  sale_price: ["sale_price", "precio", "price", "precio_venta", "precio venta", "pvp", "precio de venta", "sale price"],
  stock: ["stock", "inventario", "cantidad", "qty", "inventory"],
  is_active: ["is_active", "activo", "active", "estado", "status"],
  id: ["id", "uuid", "product_id", "id_producto"],
};

export const STANDARD_COLUMN_ORDER = [
  "code",
  "name",
  "cost_price",
  "cost_price_tax",
  "profit_percentage",
  "sale_price",
  "stock",
  "is_active",
  "id",
];

export const normalizeHeader = (header: string, columnIndex?: number): string => {
  // 1. Check if header contains DB field in parentheses, e.g. "Nombre (name)" or "Código (code)"
  const match = header.match(/\(([^)]+)\)/);
  if (match) {
    const parenthesized = match[1].trim().toLowerCase();
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (field === parenthesized || aliases.includes(parenthesized)) {
        return field;
      }
    }
  }

  // 2. Check direct clean text matching known aliases
  const clean = header.trim().toLowerCase().replace(/['"]/g, "");
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (field === clean || aliases.includes(clean)) {
      return field;
    }
  }

  // 3. Positional fallback if columnIndex is provided and within standard order range
  if (columnIndex !== undefined && columnIndex < STANDARD_COLUMN_ORDER.length) {
    return STANDARD_COLUMN_ORDER[columnIndex];
  }

  return clean;
};

export const parseNumber = (val: string | undefined): number => {
  if (val === undefined || val === null || val.trim() === "") return 0;
  const cleaned = val.replace(/[$%\s]/g, "").replace(",", ".");
  const num = Number(cleaned);
  return isNaN(num) ? NaN : num;
};

export const parseBoolean = (val: string | undefined): boolean => {
  if (val === undefined || val === null || val === "") return true;
  const v = val.toString().toLowerCase().trim();
  if (["false", "falso", "0", "no", "inactivo"].includes(v)) return false;
  return true;
};

export const validateRow = (
  row: Partial<ProvisionalRow>
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
  if (row.profit_percentage === undefined || isNaN(row.profit_percentage) || row.profit_percentage < 0) {
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

export const parseCSV = (csvText: string): ProvisionalRow[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const rawHeaders = headerLine
    .split(separator)
    .map((h) => h.trim());

  // Check how many headers match aliases directly (without positional fallback)
  const mappedByName = rawHeaders.map((h) => {
    const match = h.match(/\(([^)]+)\)/);
    const textToMatch = match ? match[1].trim().toLowerCase() : h.trim().toLowerCase().replace(/['"]/g, "");
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (field === textToMatch || aliases.includes(textToMatch)) {
        return field;
      }
    }
    return null;
  });

  // If a header didn't match by name, fallback to positional order if available
  const headers = rawHeaders.map((h, idx) => {
    if (mappedByName[idx]) return mappedByName[idx]!;
    return normalizeHeader(h, idx);
  });

  const rows: ProvisionalRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(separator).map((v) => v.trim().replace(/^["']|["']$/g, ""));

    const rawData: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawData[h] = values[idx] || "";
    });

    const parsed: Partial<ProvisionalRow> = {
      id: rawData["id"] ? rawData["id"] : undefined,
      code: rawData["code"] ?? "",
      name: rawData["name"] ?? "",
      cost_price: parseNumber(rawData["cost_price"]),
      cost_price_tax: parseNumber(rawData["cost_price_tax"]),
      profit_percentage: parseNumber(rawData["profit_percentage"]),
      sale_price: parseNumber(rawData["sale_price"]),
      stock: parseNumber(rawData["stock"]),
      is_active: parseBoolean(rawData["is_active"]),
    };

    const { errors, isValid } = validateRow(parsed);

    rows.push({
      id: parsed.id,
      code: parsed.code ?? "",
      name: parsed.name ?? "",
      cost_price: isNaN(parsed.cost_price ?? 0) ? 0 : parsed.cost_price ?? 0,
      cost_price_tax: isNaN(parsed.cost_price_tax ?? 0) ? 0 : parsed.cost_price_tax ?? 0,
      profit_percentage: isNaN(parsed.profit_percentage ?? 0) ? 0 : parsed.profit_percentage ?? 0,
      sale_price: isNaN(parsed.sale_price ?? 0) ? 0 : parsed.sale_price ?? 0,
      stock: isNaN(parsed.stock ?? 0) ? 0 : parsed.stock ?? 0,
      is_active: parsed.is_active ?? true,
      errors,
      isValid,
    });
  }

  // Sort rows: RED/INVALID ROWS ALWAYS AT THE TOP!
  return rows.sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
};

export const generateTemplateCSV = (lang: string = "es"): string => {
  const isEn = lang.startsWith("en");

  if (isEn) {
    return (
      "Code (code),Name (name),Base cost (cost_price),Tax (cost_price_tax),Margin % (profit_percentage),Sale price (sale_price),Stock (stock),Active (is_active),ID (id)\n" +
      "PROD-001,Cola Soda 500ml,600,114,30,1200,50,true,\n" +
      "PROD-002,Potato Chips 100g,450,85,35,900,30,true,\n" +
      "PROD-003,Chocolate Cookie 80g,300,57,40,700,20,true,uuid-existente-si-actualiza\n"
    );
  }

  return (
    "Código (code),Nombre (name),Costo base (cost_price),Impuesto (cost_price_tax),Margen % (profit_percentage),Precio de venta (sale_price),Stock (stock),Activo (is_active),ID (id)\n" +
    "PROD-001,Bebida Cola 500ml,600,114,30,1200,50,true,\n" +
    "PROD-002,Snack Papas Fritas 100g,450,85,35,900,30,true,\n" +
    "PROD-003,Galleta Chocolate 80g,300,57,40,700,20,true,uuid-existente-si-actualiza\n"
  );
};
