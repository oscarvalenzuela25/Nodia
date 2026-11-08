import i18n from "../../../../../../../../translate";
import { isMeasurementUnit } from "../../../../../../infrastructure/measurementUnits";
import { productCodeFits } from "../../../../../../infrastructure/productCodes";
import type { CreateProductPayload, BulkUpdateProductItemPayload } from "../../../../../../infrastructure/types";
export interface ProvisionalRow {
  id?: string;
  code?: string | null;
  measurement_unit?: string;
  name: string;
  cost_price: number;
  cost_price_tax: number;
  sale_price: number;
  stock: number; // Historical CSV only; never sent as operational availability.
  barcode?: string | null;
  offer_price?: number | null;
  is_offer_enabled?: boolean;
  has_stock?: boolean;
  version?: number;
  is_active: boolean;
  invalid_fields?: string[];
  errors: string[];
  isValid: boolean;
}

export const FIELD_ALIASES: Record<string, string[]> = {
  measurement_unit: ["measurement_unit", "unidad de medida", "unidad", "unit of measure", "measurement unit"],
  barcode: ["barcode", "codigo de barras", "código de barras", "bar code"],
  offer_price: ["offer_price", "precio alternativo", "alternative price"],
  is_offer_enabled: ["is_offer_enabled", "alternativo habilitado", "alternative enabled"],
  has_stock: ["has_stock", "disponible", "available"],
  version: ["version", "versión"],
  code: ["code", "codigo", "código", "sku", "código / sku", "code / sku"],
  name: ["name", "nombre", "descripcion", "descripción", "description", "nombre del producto", "product name"],
  cost_price: ["cost_price", "costo", "cost", "precio_costo", "precio costo", "costo base", "costo_base", "base cost", "precio de costo", "cost price"],
  cost_price_tax: ["cost_price_tax", "impuesto", "tax", "iva", "impuesto_costo", "impuesto costo", "cost tax"],
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
  if (val === undefined || val === null || val.trim() === "") return Number.NaN;
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

  if (row.code !== undefined && row.code !== null && !productCodeFits(row.code)) errors.push(i18n.t("business:pos.invalid_field"));
  if (row.measurement_unit !== undefined && !isMeasurementUnit(row.measurement_unit)) errors.push(i18n.t("product:invalid_measurement_unit"));
  if (!row.name || !row.name.trim()) {
    errors.push(i18n.t("business:invoice_validation_name"));
  }
  if (row.cost_price === undefined || !Number.isInteger(row.cost_price) || row.cost_price < 0 || row.cost_price > 2147483647) {
    errors.push(i18n.t("business:invoice_validation_cost"));
  }
  if (row.cost_price_tax === undefined || !Number.isInteger(row.cost_price_tax) || row.cost_price_tax < 0 || row.cost_price_tax > 2147483647) {
    errors.push(i18n.t("business:invoice_validation_tax"));
  }
  if (row.sale_price === undefined || !Number.isInteger(row.sale_price) || row.sale_price < 0 || row.sale_price > 2147483647) {
    errors.push(i18n.t("business:invoice_validation_sale"));
  }
  if (row.id && (!/^[1-9][0-9]{0,18}$/.test(row.id) || BigInt(row.id) > 9223372036854775807n)) errors.push(i18n.t("business:pos.invalid_field"));
  if (!row.id && typeof row.has_stock !== "boolean") errors.push(i18n.t("business:pos.choose_availability"));
  if (row.barcode !== undefined && row.barcode !== null && (!row.barcode || row.barcode.length > 255 || row.barcode.trim() !== row.barcode || /\p{Cc}/u.test(row.barcode))) errors.push(i18n.t("business:pos.invalid_barcode"));
  if (row.offer_price !== undefined && row.offer_price !== null && (!Number.isInteger(row.offer_price) || row.offer_price < 0 || row.offer_price > 2147483647)) errors.push(i18n.t("business:pos.invalid_price"));
  if (row.is_offer_enabled === true && row.offer_price === null) errors.push(i18n.t("business:pos.invalid_price"));
  if (row.id && [row.barcode,row.offer_price,row.is_offer_enabled,row.has_stock,row.measurement_unit].some(value => value !== undefined) && (!Number.isInteger(row.version) || (row.version ?? 0) < 1)) errors.push(i18n.t("business:pos.invalid_field"));

  if (row.invalid_fields?.some(field => field === "has_stock" ? typeof row.has_stock !== "boolean" : typeof row.is_offer_enabled !== "boolean")) errors.push(i18n.t("business:pos.invalid_field"));
  return { errors, isValid: errors.length === 0 };
};

/** Quoted cells, embedded separators/newlines and double quotes are data. */
export function parseCsvRecords(text: string, separator: string): string[][] {
  const records: string[][] = []; let record: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && character === separator) { record.push(cell); cell = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      record.push(cell); if (record.some(value => value.trim())) records.push(record); record = []; cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error(i18n.t("business:pos.invalid_field"));
  record.push(cell); if (record.some(value => value.trim())) records.push(record);
  return records;
}

const strictBoolean = (value: string | undefined): boolean | undefined => value === "true" ? true : value === "false" ? false : undefined;
export const parseCSV = (csvText: string): ProvisionalRow[] => {
  const separator = csvText.split(/\r?\n/)[0]?.includes(";") ? ";" : ",";
  const records = parseCsvRecords(csvText.replace(/^\uFEFF/, ""), separator);
  if (records.length < 2) return [];
  const recognized = records[0].some(header => Object.hasOwn(FIELD_ALIASES, normalizeHeader(header)));
  const headers = records[0].map((header, index) => normalizeHeader(header, recognized ? undefined : index));
  return records.slice(1).map(values => {
    const raw = Object.fromEntries(headers.map((header,index) => [header,values[index] ?? ""]));
    const has = (key: string) => Object.hasOwn(raw,key) && raw[key] !== "";
    const row: ProvisionalRow = {
      id: raw.id || undefined, ...(Object.hasOwn(raw, "code") ? { code: raw.code.trim() || null } : {}), name: raw.name?.trim() ?? "",
      cost_price: parseNumber(raw.cost_price), cost_price_tax: parseNumber(raw.cost_price_tax),
      sale_price: parseNumber(raw.sale_price),
      stock: parseNumber(raw.stock), is_active: has("is_active") ? parseBoolean(raw.is_active) : true,
      ...(has("measurement_unit") ? { measurement_unit: raw.measurement_unit.trim() } : {}),
      ...(has("barcode") ? { barcode: raw.barcode === "null" ? null : raw.barcode } : {}),
      ...(has("offer_price") ? { offer_price: raw.offer_price === "null" ? null : parseNumber(raw.offer_price) } : {}),
      ...(has("is_offer_enabled") ? { is_offer_enabled: strictBoolean(raw.is_offer_enabled) } : {}),
      ...(has("has_stock") ? { has_stock: strictBoolean(raw.has_stock) } : {}),
      ...(has("version") ? { version: parseNumber(raw.version) } : {}), invalid_fields: ["has_stock","is_offer_enabled"].filter(key => has(key) && strictBoolean(raw[key]) === undefined), errors: [], isValid: false,
    };
    const { errors } = validateRow(row);
    return { ...row, errors, isValid: errors.length === 0 };
  }).sort((a,b) => a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1);
};

export function productImportPayload(row: ProvisionalRow, businessId: string): CreateProductPayload | BulkUpdateProductItemPayload {
  const check = validateRow(row); if (!check.isValid) throw new Error(check.errors.join(", "));
  const common = { ...(row.code !== undefined ? { code: row.code?.trim() || null } : {}),
    ...(isMeasurementUnit(row.measurement_unit) ? { measurement_unit: row.measurement_unit } : {}), name: row.name, cost_price: row.cost_price, cost_price_tax: row.cost_price_tax,
    sale_price: row.sale_price, is_active: row.is_active,
    ...(row.barcode !== undefined ? { barcode: row.barcode } : {}),
    ...(row.offer_price !== undefined ? { offer_price: row.offer_price } : {}),
    ...(row.is_offer_enabled !== undefined ? { is_offer_enabled: row.is_offer_enabled } : {}),
    ...(row.has_stock !== undefined ? { has_stock: row.has_stock } : {}),
  };
  return row.id ? { ...common, id: row.id, ...(row.version !== undefined ? { expected_version: row.version } : {}) }
    : { ...common, code: row.code?.trim() || null, measurement_unit: isMeasurementUnit(row.measurement_unit) ? row.measurement_unit : "unit", business_id: businessId, has_stock: row.has_stock! };
}

export const generateTemplateCSV = (lang: string = "es"): string => {
  const isEn = lang.startsWith("en");

  if (isEn) {
    return (
      "Code (code),Name (name),Base cost (cost_price),Tax-inclusive cost (cost_price_tax),Sale price (sale_price),Available (has_stock),Active (is_active),ID (id),Barcode (barcode),Alternative price (offer_price),Alternative enabled (is_offer_enabled),Version (version),Measurement unit (measurement_unit)\n" +
      "PROD-001,Cola Soda 500ml,600,714,1200,true,true,\n" +
      "PROD-002,Potato Chips 100g,450,536,900,false,true,\n" +
      "PROD-003,Chocolate Cookie 80g,300,357,700,true,true,\n"
    );
  }

  return (
    "Código (code),Nombre (name),Costo base (cost_price),Costo con IVA (cost_price_tax),Precio de venta (sale_price),Disponible (has_stock),Activo (is_active),ID (id),Código de barras (barcode),Precio alternativo (offer_price),Alternativo habilitado (is_offer_enabled),Versión (version),Unidad de medida (measurement_unit)\n" +
    "PROD-001,Bebida Cola 500ml,600,714,1200,true,true,\n" +
    "PROD-002,Snack Papas Fritas 100g,450,536,900,false,true,\n" +
    "PROD-003,Galleta Chocolate 80g,300,357,700,true,true,\n"
  );
};

export const escapeCsvValue = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const raw = String(val);
  const str = /^(?:[=+\-@\t\r']|\s+[=+\-@])/.test(raw) ? `'${raw}` : raw;
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportProductsToCSV = (
  products: import("../../../../../../infrastructure/types").ProductEntity[],
  lang: string = "es"
): string => {
  const isEn = lang.startsWith("en");
  const header = isEn
    ? "Code (code),Name (name),Base cost (cost_price),Tax-inclusive cost (cost_price_tax),Sale price (sale_price),Available (has_stock),Active (is_active),ID (id),Barcode (barcode),Alternative price (offer_price),Alternative enabled (is_offer_enabled),Version (version),Measurement unit (measurement_unit)"
    : "Código (code),Nombre (name),Costo base (cost_price),Costo con IVA (cost_price_tax),Precio de venta (sale_price),Disponible (has_stock),Activo (is_active),ID (id),Código de barras (barcode),Precio alternativo (offer_price),Alternativo habilitado (is_offer_enabled),Versión (version),Unidad de medida (measurement_unit)";

  const lines = [header];
  for (const p of products) {
    const row = [
      escapeCsvValue(p.code),
      escapeCsvValue(p.name),
      escapeCsvValue(p.cost_price),
      escapeCsvValue(p.cost_price_tax),
      escapeCsvValue(p.sale_price),
      escapeCsvValue(p.has_stock),
      escapeCsvValue(p.is_active),
      escapeCsvValue(p.id),
      escapeCsvValue(p.barcode),
      escapeCsvValue(p.offer_price),
      escapeCsvValue(p.is_offer_enabled),
      escapeCsvValue(p.version),
      escapeCsvValue(p.measurement_unit ?? "unit"),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
};

export const downloadCSVFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
