import { z } from 'zod';
import { contactValuesSchema } from '../ProviderContacts/types';
import { readCsvRecords } from './csvRecords';

const bigintId = z.string().regex(/^[1-9]\d{0,18}$/).refine((value) => BigInt(value) <= 9223372036854775807n);
export const importContactSchema = contactValuesSchema.extend({
  phone: contactValuesSchema.shape.phone.default([]),
  email: contactValuesSchema.shape.email.default(null),
  schedule: contactValuesSchema.shape.schedule.default({}),
  description: contactValuesSchema.shape.description.default(null),
  is_active: contactValuesSchema.shape.is_active.default(true),
  id: bigintId.optional(),
  version: z.number().int().min(1).max(2147483646).optional(),
}).strict().refine((contact) => !contact.id || contact.version !== undefined);
export const importContactsSchema = z.array(importContactSchema).max(100);
export type ImportedContact = z.infer<typeof importContactSchema>;

export interface FieldMappingData {
  value: string;
  instructions: string;
}

export interface ProvisionalProviderRow {
  id?: string;
  name: string;
  tax: number;
  is_active: boolean;
  code: FieldMappingData;
  cost_price: FieldMappingData;
  cost_price_tax: FieldMappingData;
  packages: FieldMappingData;
  units_per_package: FieldMappingData;
  errors: string[];
  isValid: boolean;
  contactsJson?: string;
  extraFields?: Record<string, unknown>;
}

export const FIELD_ALIASES: Record<string, string[]> = {
  name: [
    "name",
    "nombre",
    "proveedor",
    "nombre del proveedor",
    "provider",
    "provider name",
    "empresa",
    "nombre empresa",
  ],
  tax: ["tax", "impuesto", "iva", "porcentaje_impuesto", "tax %", "impuesto %"],
  is_active: ["is_active", "activo", "active", "estado", "status"],
  field_code: [
    "field_code",
    "columna_codigo",
    "columna código",
    "codigo",
    "código",
    "code",
    "sku",
    "columna codigo en factura",
    "code column",
  ],
  instructions_code: [
    "instructions_code",
    "code_instructions",
    "instrucciones_codigo",
    "instrucciones código",
    "code instructions",
    "instrucciones para código",
  ],
  field_cost_price: [
    "field_cost_price",
    "columna_costo_neto",
    "columna costo neto",
    "cost_price",
    "costo_neto",
    "costo neto",
    "net cost",
    "net cost column",
    "precio neto",
    "p. neto",
  ],
  instructions_cost_price: [
    "instructions_cost_price",
    "cost_price_instructions",
    "instrucciones_costo_neto",
    "instrucciones costo neto",
    "net cost instructions",
  ],
  field_cost_price_tax: [
    "field_cost_price_tax",
    "columna_costo_iva",
    "columna costo iva",
    "cost_price_tax",
    "costo_iva",
    "costo con iva",
    "tax cost",
    "tax cost column",
    "precio bruto",
    "p. venta con iva",
  ],
  instructions_cost_price_tax: [
    "instructions_cost_price_tax",
    "cost_price_tax_instructions",
    "instrucciones_costo_iva",
    "instrucciones costo iva",
    "tax cost instructions",
  ],
  field_packages: [
    "field_packages",
    "columna_bultos",
    "columna bultos",
    "bultos",
    "cajas",
    "packages",
    "packages column",
    "empaques",
  ],
  instructions_packages: [
    "instructions_packages",
    "packages_instructions",
    "instrucciones_bultos",
    "instrucciones bultos",
    "packages instructions",
  ],
  field_units_per_package: [
    "field_units_per_package",
    "columna_unidades_por_bulto",
    "columna unidades por bulto",
    "units_per_package",
    "unidades_por_caja",
    "unidades por bulto",
    "factor",
    "units per package column",
  ],
  instructions_units_per_package: [
    "instructions_units_per_package",
    "units_per_package_instructions",
    "instrucciones_unidades_por_bulto",
    "instrucciones unidades por bulto",
    "units per package instructions",
  ],
  id: ["id", "uuid", "provider_id", "id_proveedor"],
  contacts: ['contacts', 'contactos', 'contacts json', 'contactos json'],
  fields_json: ['fields_json'],
  csv_version: ['csv_version'],
};

export const STANDARD_COLUMN_ORDER = [
  "name",
  "tax",
  "is_active",
  "field_code",
  "instructions_code",
  "field_cost_price",
  "instructions_cost_price",
  "field_cost_price_tax",
  "instructions_cost_price_tax",
  "field_packages",
  "instructions_packages",
  "field_units_per_package",
  "instructions_units_per_package",
  "id",
];

export const normalizeHeader = (header: string, columnIndex?: number): string => {
  // 1. Check if header contains DB field in parentheses, e.g. "Nombre (name)"
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
  if (val === undefined || val === null || val.trim() === "") return NaN;
  const cleaned = val.replace(/[$%\s]/g, "").replace(",", ".");
  const num = Number(cleaned);
  return isNaN(num) ? NaN : num;
};

export const parseBoolean = (val: string | undefined): boolean => {
  if (val === undefined || val === null || val === "") return true;
  const v = val.toString().toLowerCase().trim();
  if (["false", "falso", "0", "no", "inactivo"].includes(v)) return false;
  if (['true', 'verdadero', '1', 'si', 'sí', 'yes', 'activo', 'active'].includes(v)) return true;
  throw new Error('business:provider_csv_boolean_error');
};

export const validateRow = (
  row: Partial<ProvisionalProviderRow>
): { errors: string[]; isValid: boolean } => {
  const errors: string[] = [];

  if (!row.name || !row.name.trim()) {
    errors.push('business:provider_csv_name_required');
  } else if (row.name.trim().length < 2) {
    errors.push('business:provider_csv_name_error');
  }

  if (row.tax !== undefined && (!Number.isInteger(row.tax) || row.tax < 0 || row.tax > 100)) {
    errors.push('business:provider_csv_tax_error');
  }

  if (row.name && row.name.length > 255) errors.push('business:provider_csv_name_error');
  if (row.id && !bigintId.safeParse(row.id).success) errors.push('business:provider_csv_id_error');
  if (row.contactsJson?.trim()) {
    try { importContactsSchema.parse(JSON.parse(row.contactsJson)); }
    catch { errors.push('business:provider_csv_contacts_error'); }
  }

  return { errors, isValid: errors.length === 0 };
};

export const parseCSV = (csvText: string): ProvisionalProviderRow[] => {
  const records = readCsvRecords(csvText);
  if (records.length < 2) return [];
  const rawHeaders = records[0];

  // Check how many headers match aliases directly (without positional fallback)
  const mappedByName = rawHeaders.map((h) => {
    const match = h.match(/\(([^)]+)\)/);
    const textToMatch = match
      ? match[1].trim().toLowerCase()
      : h.trim().toLowerCase().replace(/['"]/g, "");
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (field === textToMatch || aliases.includes(textToMatch)) {
        return field;
      }
    }
    return null;
  });

  // Preserve unknown headers without silently mapping them to unrelated columns.
  const headers = rawHeaders.map((h, idx) => {
    if (mappedByName[idx]) return mappedByName[idx]!;
    return normalizeHeader(h);
  });
  if (!headers.includes('name') || new Set(headers).size !== headers.length) throw new Error('business:provider_csv_header_error');

  const rows: ProvisionalProviderRow[] = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    if (values.length > headers.length) throw new Error('business:provider_csv_format_error');

    const rawData: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawData[h] = values[idx] || "";
    });
    if (rawData.csv_version && rawData.csv_version !== '2') throw new Error('business:provider_csv_format_error');
    if (rawData.csv_version === '2') for (const key of headers) if (/^'(?:[=+\-@\t\r']|\s+[=+\-@])/.test(rawData[key])) rawData[key] = rawData[key].slice(1);
    let extraFields: Record<string, unknown> | undefined;
    if (rawData.fields_json) {
      try { extraFields = z.record(z.string(), z.unknown()).parse(JSON.parse(rawData.fields_json)); }
      catch { throw new Error('business:provider_csv_mapping_error'); }
    }

    const parsedTaxNum = rawData["tax"] ? parseNumber(rawData["tax"]) : 19;
    const finalTax = parsedTaxNum;

    const parsed: Partial<ProvisionalProviderRow> = {
      id: rawData["id"] ? rawData["id"] : undefined,
      name: rawData["name"] ?? "",
      tax: finalTax,
      is_active: parseBoolean(rawData["is_active"]),
      contactsJson: rawData.contacts || undefined,
      extraFields,
      code: {
        value: rawData["field_code"] ?? "",
        instructions: rawData["instructions_code"] ?? "",
      },
      cost_price: {
        value: rawData["field_cost_price"] ?? "",
        instructions: rawData["instructions_cost_price"] ?? "",
      },
      cost_price_tax: {
        value: rawData["field_cost_price_tax"] ?? "",
        instructions: rawData["instructions_cost_price_tax"] ?? "",
      },
      packages: {
        value: rawData["field_packages"] ?? "",
        instructions: rawData["instructions_packages"] ?? "",
      },
      units_per_package: {
        value: rawData["field_units_per_package"] ?? "",
        instructions: rawData["instructions_units_per_package"] ?? "",
      },
    };

    const { errors, isValid } = validateRow(parsed);

    rows.push({
      id: parsed.id,
      name: parsed.name ?? "",
      tax: parsed.tax ?? 19,
      is_active: parsed.is_active ?? true,
      code: parsed.code ?? { value: "", instructions: "" },
      cost_price: parsed.cost_price ?? { value: "", instructions: "" },
      cost_price_tax: parsed.cost_price_tax ?? { value: "", instructions: "" },
      packages: parsed.packages ?? { value: "", instructions: "" },
      units_per_package: parsed.units_per_package ?? { value: "", instructions: "" },
      errors,
      isValid,
      contactsJson: parsed.contactsJson,
      extraFields,
    });
  }

  // Sort rows: RED/INVALID ROWS ALWAYS AT THE TOP!
  return rows.sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
};

export function buildImportPayload(rows: ProvisionalProviderRow[], businessId: string): import('../../../../../../infrastructure/types').ImportProviderPayload[] {
  return rows.map((row) => {
    const fields = { ...row.extraFields };
    for (const key of ['code', 'cost_price', 'cost_price_tax', 'packages', 'units_per_package'] as const) {
      const mapping = row[key];
      const previous = fields[key];
      const value = typeof previous === 'string' ? previous : previous && typeof previous === 'object' && 'value' in previous && typeof previous.value === 'string' ? previous.value : '';
      const instructions = previous && typeof previous === 'object' && 'instructions' in previous && typeof previous.instructions === 'string' ? previous.instructions : '';
      if (previous !== undefined && value === mapping.value && instructions === mapping.instructions) continue;
      if (mapping.value || mapping.instructions) fields[key] = { ...mapping };
      else delete fields[key];
    }
    return {
      business_id: businessId, ...(row.id ? { id: row.id } : {}), name: row.name, tax: row.tax, is_active: row.is_active, fields,
      ...(row.contactsJson?.trim() ? { contacts: importContactsSchema.parse(JSON.parse(row.contactsJson)) } : {}),
    };
  });
}

export const generateTemplateCSV = (lang: string = 'es'): string => {
  const suffix = lang.startsWith('en') ? ',Contacts JSON (contacts),Extra Mapping JSON (fields_json),CSV Version (csv_version)' : ',Contactos JSON (contacts),Mapeo adicional JSON (fields_json),Versión CSV (csv_version)';
  return providerCsvHeader(lang) + suffix + '\n';
};

export const escapeCsvValue = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const providerCsvHeader = (lang: string): string => {
  const isEn = lang.startsWith('en');
  return isEn
    ? "Name (name),Tax % (tax),Active (is_active),Code Column (field_code),Code Instructions (instructions_code),Net Cost Column (field_cost_price),Net Cost Instructions (instructions_cost_price),Tax Cost Column (field_cost_price_tax),Tax Cost Instructions (instructions_cost_price_tax),Packages Column (field_packages),Packages Instructions (instructions_packages),Units Per Package Column (field_units_per_package),Units Per Package Instructions (instructions_units_per_package),ID (id)"
    : "Nombre (name),Impuesto % (tax),Activo (is_active),Columna Código (field_code),Instrucciones Código (instructions_code),Columna Costo Neto (field_cost_price),Instrucciones Costo Neto (instructions_cost_price),Columna Costo IVA (field_cost_price_tax),Instrucciones Costo IVA (instructions_cost_price_tax),Columna Bultos (field_packages),Instrucciones Bultos (instructions_packages),Columna Unidades por Bulto (field_units_per_package),Instrucciones Unidades por Bulto (instructions_units_per_package),ID (id)";
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
