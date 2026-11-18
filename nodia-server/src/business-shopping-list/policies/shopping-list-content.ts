import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type {
  ShoppingListContent,
  ShoppingListItemCommand,
  ShoppingListItemIdentity,
} from '../types/shopping-list.types.js';

export const SHOPPING_LIST_MAX_ITEMS = 500;
export const SHOPPING_LIST_MAX_NAME_LENGTH = 150;
export const SHOPPING_LIST_PRODUCT_ID_PATTERN = /^[1-9][0-9]{0,18}$/;
export const SHOPPING_LIST_QUANTITY_PATTERN =
  /^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,3})?$/;

const itemIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxProductId = 9223372036854775807n;
// Share the combining-mark ranges with PostgreSQL. NFD splits the Latin
// letters used in business names without an extension or locale dependency.
export const SHOPPING_LIST_ACCENT_PATTERN =
  '[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]';
const accentPattern = new RegExp(SHOPPING_LIST_ACCENT_PATTERN, 'gu');

export function shoppingListSearchPattern(search: string): string {
  const term = search.trim().normalize('NFD').replace(accentPattern, '');
  return term ? `%${term.replace(/[!%_]/g, '!$&')}%` : '';
}

function invalidContent(): never {
  throw new BadRequestException('business:shopping_list_invalid_content');
}

function normalizeQuantity(quantity: string): string {
  if (
    typeof quantity !== 'string' ||
    !SHOPPING_LIST_QUANTITY_PATTERN.test(quantity)
  )
    invalidContent();
  const [whole, fractional] = quantity.split('.');
  const remainder = fractional?.replace(/0+$/, '');
  if (whole === '0' && !remainder) invalidContent();
  return remainder ? `${whole}.${remainder}` : whole;
}

export function normalizeShoppingListContent(
  input: { name: string; items: readonly ShoppingListItemCommand[] },
  allowExistingItems: boolean,
): ShoppingListContent {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (
    !name ||
    name.includes('\0') ||
    [...name].length > SHOPPING_LIST_MAX_NAME_LENGTH ||
    !Array.isArray(input.items) ||
    input.items.length > SHOPPING_LIST_MAX_ITEMS
  )
    invalidContent();

  const products = new Set<string>();
  const items = input.items.map((item: ShoppingListItemCommand) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      invalidContent();
    const { product_id, quantity, item_id } = item;
    if (
      typeof product_id !== 'string' ||
      !SHOPPING_LIST_PRODUCT_ID_PATTERN.test(product_id) ||
      BigInt(product_id) > maxProductId
    )
      invalidContent();
    if (products.has(product_id))
      throw new BadRequestException('business:shopping_list_duplicate_product');
    products.add(product_id);
    const normalized = { product_id, quantity: normalizeQuantity(quantity) };
    if (item_id === undefined) return normalized;
    if (
      !allowExistingItems ||
      typeof item_id !== 'string' ||
      !itemIdPattern.test(item_id)
    )
      invalidContent();
    return { ...normalized, item_id: item_id.toLowerCase() };
  });
  return { name, items };
}

export function shoppingListCreateHash(content: ShoppingListContent): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

export function assertShoppingListItemIdentities(
  items: readonly ShoppingListItemCommand[],
  existing: readonly ShoppingListItemIdentity[],
): void {
  const retainedProducts = new Map(
    existing.map(({ id, product_id }) => [id, product_id]),
  );
  for (const item of items) {
    if (
      item.item_id !== undefined &&
      retainedProducts.get(item.item_id) !== item.product_id
    )
      throw new ConflictException('business:shopping_list_item_mismatch');
  }
}
