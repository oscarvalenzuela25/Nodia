export interface ExtractedInvoiceItem {
  code?: string | null;
  name: string;
  quantity: number;
  cost_price?: number | null;
  cost_price_tax?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  packages?: number | null;
  units_per_package?: number | null;
  [key: string]: any;
}

export interface ExtractedInvoiceData {
  code: string;
  total_amount: number;
  issue_date?: string;
  items: ExtractedInvoiceItem[];
  raw_data?: Record<string, any>;
}

export type AiProvider = 'gemini' | 'mistral';

export interface ProviderFieldConfig {
  value: string;
  instructions: string;
}

export function parseFieldConfig(raw: unknown): ProviderFieldConfig | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? { value: trimmed, instructions: '' } : null;
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const value = typeof obj.value === 'string' ? obj.value.trim() : '';
    const instructions =
      typeof obj.instructions === 'string' ? obj.instructions.trim() : '';
    if (value.length > 0 || instructions.length > 0) {
      return { value, instructions };
    }
  }
  return null;
}

export interface ProviderParsedConfig {
  codeConfig: ProviderFieldConfig | null;
  costPriceConfig: ProviderFieldConfig | null;
  costPriceTaxConfig: ProviderFieldConfig | null;
  packagesConfig: ProviderFieldConfig | null;
  unitsPerPackageConfig: ProviderFieldConfig | null;
  hasCodeConfig: boolean;
  hasCostPriceConfig: boolean;
  hasCostPriceTaxConfig: boolean;
  hasPackagesConfig: boolean;
  hasUnitsPerPackageConfig: boolean;
  hasAnyConfig: boolean;
}

export function extractProviderConfig(
  providerFields?: Record<string, any>,
): ProviderParsedConfig {
  const codeConfig = parseFieldConfig(providerFields?.code);
  const costPriceConfig = parseFieldConfig(providerFields?.cost_price);
  const costPriceTaxConfig = parseFieldConfig(providerFields?.cost_price_tax);
  const packagesConfig = parseFieldConfig(providerFields?.packages);
  const unitsPerPackageConfig = parseFieldConfig(
    providerFields?.units_per_package,
  );

  const hasCodeConfig = Boolean(codeConfig && codeConfig.value.length > 0);
  const hasCostPriceConfig = Boolean(
    costPriceConfig && costPriceConfig.value.length > 0,
  );
  const hasCostPriceTaxConfig = Boolean(
    costPriceTaxConfig && costPriceTaxConfig.value.length > 0,
  );
  const hasPackagesConfig = Boolean(
    packagesConfig && packagesConfig.value.length > 0,
  );
  const hasUnitsPerPackageConfig = Boolean(
    unitsPerPackageConfig && unitsPerPackageConfig.value.length > 0,
  );

  const hasAnyConfig =
    hasCodeConfig ||
    hasCostPriceConfig ||
    hasCostPriceTaxConfig ||
    hasPackagesConfig ||
    hasUnitsPerPackageConfig;

  return {
    codeConfig,
    costPriceConfig,
    costPriceTaxConfig,
    packagesConfig,
    unitsPerPackageConfig,
    hasCodeConfig,
    hasCostPriceConfig,
    hasCostPriceTaxConfig,
    hasPackagesConfig,
    hasUnitsPerPackageConfig,
    hasAnyConfig,
  };
}
