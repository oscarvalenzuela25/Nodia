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
  return true;
};

export const validateRow = (
  row: Partial<ProvisionalProviderRow>
): { errors: string[]; isValid: boolean } => {
  const errors: string[] = [];

  if (!row.name || !row.name.trim()) {
    errors.push("Nombre es requerido");
  } else if (row.name.trim().length < 2) {
    errors.push("Nombre debe tener al menos 2 caracteres");
  }

  if (row.tax !== undefined && (isNaN(row.tax) || row.tax < 0 || row.tax > 100)) {
    errors.push("Impuesto debe estar entre 0 y 100");
  }

  return { errors, isValid: errors.length === 0 };
};

export const parseCSV = (csvText: string): ProvisionalProviderRow[] => {
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

  // If a header didn't match by name, fallback to positional order if available
  const headers = rawHeaders.map((h, idx) => {
    if (mappedByName[idx]) return mappedByName[idx]!;
    return normalizeHeader(h, idx);
  });

  const rows: ProvisionalProviderRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(separator).map((v) => v.trim().replace(/^["']|["']$/g, ""));

    const rawData: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawData[h] = values[idx] || "";
    });

    const parsedTaxNum = rawData["tax"] ? parseNumber(rawData["tax"]) : 19;
    const finalTax = isNaN(parsedTaxNum) ? 19 : parsedTaxNum;

    const parsed: Partial<ProvisionalProviderRow> = {
      id: rawData["id"] ? rawData["id"] : undefined,
      name: rawData["name"] ?? "",
      tax: finalTax,
      is_active: parseBoolean(rawData["is_active"]),
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
    });
  }

  // Sort rows: RED/INVALID ROWS ALWAYS AT THE TOP!
  return rows.sort((a, b) => (a.isValid === b.isValid ? 0 : a.isValid ? 1 : -1));
};

export const generateTemplateCSV = (lang: string = "es"): string => {
  const isEn = lang.startsWith("en");

  if (isEn) {
    return (
      "Name (name),Tax % (tax),Active (is_active),Code Column (field_code),Code Instructions (instructions_code),Net Cost Column (field_cost_price),Net Cost Instructions (instructions_cost_price),Tax Cost Column (field_cost_price_tax),Tax Cost Instructions (instructions_cost_price_tax),Packages Column (field_packages),Packages Instructions (instructions_packages),Units Per Package Column (field_units_per_package),Units Per Package Instructions (instructions_units_per_package),ID (id)\n" +
      "Coca Cola Embonor,19,true,COD_ARTICULO,,PRECIO_NETO,,PRECIO_BRUTO,,BULTOS,,UNID_EMPAQUE,\n" +
      "Nestle Chile,19,true,SKU,In column description,VALOR_NETO,,TOTAL_UNITARIO,,CAJAS,,FACTOR,12345\n"
    );
  }

  return (
    "Nombre (name),Impuesto % (tax),Activo (is_active),Columna Código (field_code),Instrucciones Código (instructions_code),Columna Costo Neto (field_cost_price),Instrucciones Costo Neto (instructions_cost_price),Columna Costo IVA (field_cost_price_tax),Instrucciones Costo IVA (instructions_cost_price_tax),Columna Bultos (field_packages),Instrucciones Bultos (instructions_packages),Columna Unidades por Bulto (field_units_per_package),Instrucciones Unidades por Bulto (instructions_units_per_package),ID (id)\n" +
    "Coca Cola Embonor,19,true,COD_ARTICULO,,PRECIO_NETO,,PRECIO_BRUTO,,BULTOS,,UNID_EMPAQUE,\n" +
    "Nestle Chile,19,true,SKU,En columna descripcion,VALOR_NETO,,TOTAL_UNITARIO,,CAJAS,,FACTOR,12345\n"
  );
};
