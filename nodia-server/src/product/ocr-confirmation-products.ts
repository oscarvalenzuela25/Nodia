import { BadRequestException } from '@nestjs/common';
import { validateCatalogId } from '../common/dto/catalog-id.dto.js';
import { stockQuantityMillis } from '../common/utils/stock-quantity.js';
import { normalizeProductAlias } from './product-alias.js';
import { normalizeProductCode } from './product-measurement-unit.js';
import { roundProductSalePrice } from './product-sale-price.js';
import type { ProductStockAction } from './product-stock.js';

const maxInteger = 2147483647;
const maxItems = 500;
const catalogFields = [
  'code',
  'name',
  'alias',
  'cost_price',
  'cost_price_tax',
  'sale_price',
] as const;

type OcrLine = {
  invoice_code: string | null;
  name: string;
  alias: string;
  alias_reviewed: true;
  cost_price: number;
  quantity: number;
};

type CatalogChanges = {
  code?: string | null;
  name?: string;
  alias?: string;
  cost_price?: number;
  cost_price_tax?: number;
  sale_price?: number;
};

type OcrProductFields = Required<CatalogChanges> & { is_active: boolean };
type OcrProductTarget = { product_id: string; expected_version: number };

type OcrStockIntent = {
  track_stock?: boolean;
  stock_action?: ProductStockAction;
};

export type OcrProductItem = { line: OcrLine } & OcrStockIntent & (
  | { kind: 'create'; product: OcrProductFields & { code: string } }
  | ({ kind: 'update'; product: OcrProductFields } & OcrProductTarget)
  | ({ kind: 'manual_match'; changes: CatalogChanges } & OcrProductTarget)
);

export type OcrSavedProduct = { id: string; version: number };

const invalid = () => new BadRequestException('business:cash_invalid_command');

function fields(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.includes('\u0000') ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    throw invalid();
  return value;
}

function name(value: unknown): string {
  const result = text(value).trim();
  if (!result || Array.from(result).length > 255) throw invalid();
  return result;
}

function alias(value: unknown): string {
  const result = normalizeProductAlias(text(value));
  if (!result) throw invalid();
  return result;
}

function code(value: unknown): string | null {
  return value === null ? null : normalizeProductCode(text(value));
}

function integer(value: unknown, minimum = 0): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maxInteger
  )
    throw invalid();
  return value === 0 ? 0 : value;
}

function normalizeLine(value: unknown): OcrLine {
  const row = fields(value, [
    'invoice_code',
    'name',
    'alias',
    'alias_reviewed',
    'cost_price',
    'quantity',
  ]);
  const quantity = row.quantity;
  if (
    row.alias_reviewed !== true ||
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    quantity < 0
  )
    throw invalid();
  return {
    invoice_code: code(row.invoice_code),
    name: name(row.name),
    alias: alias(row.alias),
    alias_reviewed: true,
    cost_price: integer(row.cost_price),
    quantity: quantity === 0 ? 0 : quantity,
  };
}

function normalizeProductFields(value: unknown): OcrProductFields {
  const product = fields(value, [...catalogFields, 'is_active']);
  if (typeof product.is_active !== 'boolean') throw invalid();
  return {
    code: code(product.code),
    name: name(product.name),
    alias: alias(product.alias),
    cost_price: integer(product.cost_price),
    cost_price_tax: integer(product.cost_price_tax),
    sale_price: roundProductSalePrice(product.sale_price),
    is_active: product.is_active,
  };
}

function normalizeChanges(value: unknown, hasStockIntent: boolean): CatalogChanges {
  const changes = fields(value, catalogFields);
  if (!hasStockIntent && !Object.keys(changes).length) throw invalid();
  return {
    ...(Object.hasOwn(changes, 'code') ? { code: code(changes.code) } : {}),
    ...(Object.hasOwn(changes, 'name') ? { name: name(changes.name) } : {}),
    ...(Object.hasOwn(changes, 'alias') ? { alias: alias(changes.alias) } : {}),
    ...(Object.hasOwn(changes, 'cost_price')
      ? { cost_price: integer(changes.cost_price) }
      : {}),
    ...(Object.hasOwn(changes, 'cost_price_tax')
      ? { cost_price_tax: integer(changes.cost_price_tax) }
      : {}),
    ...(Object.hasOwn(changes, 'sale_price')
      ? { sale_price: roundProductSalePrice(changes.sale_price) }
      : {}),
  };
}

function assertMatchesLine(product: CatalogChanges, line: OcrLine): void {
  for (const field of ['name', 'alias', 'cost_price'] as const)
    if (product[field] !== undefined && product[field] !== line[field])
      throw invalid();
}

const stockIntentFields = ['track_stock', 'stock_action'] as const;

function normalizeStockIntent(row: Record<string, unknown>): OcrStockIntent {
  const intent: OcrStockIntent = {};
  if (Object.hasOwn(row, 'track_stock')) {
    if (typeof row.track_stock !== 'boolean') throw invalid();
    intent.track_stock = row.track_stock;
  }
  if (Object.hasOwn(row, 'stock_action')) {
    const { mode, quantity } = fields(row.stock_action, ['mode', 'quantity']);
    if ((mode !== 'add' && mode !== 'replace') || typeof quantity !== 'number')
      throw invalid();
    if (intent.track_stock === false) throw invalid();
    intent.stock_action = { mode, quantity: stockQuantityMillis(quantity) / 1000 };
  }
  return intent;
}

function normalizeItem(value: unknown): OcrProductItem {
  const row = fields(value, [
    'kind',
    'line',
    'product',
    'product_id',
    'expected_version',
    'changes',
    ...stockIntentFields,
  ]);
  const line = normalizeLine(row.line);
  const stockIntent = normalizeStockIntent(row);
  if (row.kind === 'create') {
    fields(row, ['kind', 'line', 'product', ...stockIntentFields]);
    if (stockIntent.stock_action && stockIntent.track_stock !== true) throw invalid();
    const product = normalizeProductFields(row.product);
    if (product.code === null) throw invalid();
    assertMatchesLine(product, line);
    return {
      kind: row.kind,
      line,
      product: { ...product, code: product.code },
      ...stockIntent,
    };
  }
  if (row.kind !== 'update' && row.kind !== 'manual_match') throw invalid();
  const product_id = text(row.product_id);
  validateCatalogId(product_id, 'business:cash_invalid_command');
  const target = {
    product_id,
    expected_version: integer(row.expected_version, 1),
  };
  const common = ['kind', 'line', 'product_id', 'expected_version', ...stockIntentFields];
  if (row.kind === 'manual_match') {
    fields(row, [...common, 'changes']);
    const changes = normalizeChanges(
      row.changes,
      stockIntent.track_stock !== undefined || stockIntent.stock_action !== undefined,
    );
    assertMatchesLine(changes, line);
    return { kind: row.kind, line, ...target, changes, ...stockIntent };
  }
  fields(row, [...common, 'product']);
  const product = normalizeProductFields(row.product);
  assertMatchesLine(product, line);
  return { kind: row.kind, line, ...target, product, ...stockIntent };
}

export function normalizeOcrProducts(value: unknown): OcrProductItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems)
    throw invalid();
  const targets = new Set<string>();
  const submittedCodes = new Set<string>();
  return Array.from(value, (row: unknown) => {
    const item = normalizeItem(row);
    if (item.kind !== 'create') {
      if (targets.has(item.product_id)) throw invalid();
      targets.add(item.product_id);
    }
    const suppliedCode = (
      item.kind === 'manual_match' ? item.changes : item.product
    ).code;
    if (suppliedCode) {
      const key = suppliedCode.toLowerCase();
      if (submittedCodes.has(key)) throw invalid();
      submittedCodes.add(key);
    }
    return item;
  });
}

export function buildOcrInvoiceData(
  items: readonly OcrProductItem[],
  products: readonly OcrSavedProduct[],
  issueDate?: string | null,
) {
  return {
    ...(issueDate === undefined ? {} : { issue_date: issueDate }),
    items_count: items.length,
    extracted_items: items.map((item, index) => {
      const { invoice_code, ...reviewed } = item.line;
      return {
        code: invoice_code,
        ...reviewed,
        is_update: item.kind !== 'create',
        ...(item.kind === 'create'
          ? {}
          : { matched_product_id: products[index].id }),
        ...(item.kind === 'manual_match'
          ? {
              selected_update_fields: catalogFields.filter((field) =>
                Object.hasOwn(item.changes, field),
              ),
            }
          : {}),
      };
    }),
  };
}
