import { describe, expect, it } from 'vitest';
import {
  assertShoppingListItemIdentities,
  normalizeShoppingListContent,
  shoppingListCreateHash,
  shoppingListSearchPattern,
} from './shopping-list-content.js';

const first = '1978bb3a-4b9d-45ea-b86b-fa8ef1c1ddeb';
const second = '4904df48-429d-490c-8afc-6d493867f3ec';

describe('shopping list content', () => {
  it('retains exact decimals and canonical bigint product IDs', () => {
    expect(
      normalizeShoppingListContent(
        {
          name: '  Cafetería  ',
          items: [
            { product_id: '9223372036854775807', quantity: '0.001' },
            {
              product_id: '2',
              quantity: '999999999.999',
              item_id: first.toUpperCase(),
            },
            { product_id: '3', quantity: '42.300' },
          ],
        },
        true,
      ),
    ).toEqual({
      name: 'Cafetería',
      items: [
        { product_id: '9223372036854775807', quantity: '0.001' },
        { product_id: '2', quantity: '999999999.999', item_id: first },
        { product_id: '3', quantity: '42.3' },
      ],
    });
  });

  it.each(['0', '0.000', '1.0001', '-1', '+1', '1e2', '01', '1000000000'])(
    'rejects %s instead of rounding or coercing it',
    (quantity) => {
      expect(() =>
        normalizeShoppingListContent(
          {
            name: 'Reposición',
            items: [{ product_id: '1', quantity }],
          },
          false,
        ),
      ).toThrow('business:shopping_list_invalid_content');
    },
  );

  it('rejects values beyond the bigint range and duplicate products across identities', () => {
    expect(() =>
      normalizeShoppingListContent(
        {
          name: 'Reposición',
          items: [{ product_id: '9223372036854775808', quantity: '1' }],
        },
        false,
      ),
    ).toThrow('business:shopping_list_invalid_content');
    expect(() =>
      normalizeShoppingListContent(
        {
          name: 'Reposición',
          items: [
            { product_id: '1', quantity: '1', item_id: first },
            { product_id: '1', quantity: '2' },
          ],
        },
        true,
      ),
    ).toThrow('business:shopping_list_duplicate_product');
  });

  it('binds the receipt to normalized name, quantity, and item order', () => {
    const firstItem = { product_id: '1', quantity: '1' };
    const secondItem = { product_id: '2', quantity: '3' };
    const hash = (name: string, items: (typeof firstItem)[]) =>
      shoppingListCreateHash(
        normalizeShoppingListContent({ name, items }, false),
      );
    const original = hash('Market', [firstItem, secondItem]);
    expect(
      hash(' Market ', [{ ...firstItem, quantity: '1.000' }, secondItem]),
    ).toBe(original);
    expect(hash('Market', [secondItem, firstItem])).not.toBe(original);
    expect(
      hash('Market', [firstItem, { ...secondItem, quantity: '2' }]),
    ).not.toBe(original);
  });

  it('retains only an explicit identity with the same product', () => {
    const existing = [{ id: first, product_id: '1' }];
    expect(() =>
      assertShoppingListItemIdentities(
        [{ product_id: '1', quantity: '2', item_id: first }],
        existing,
      ),
    ).not.toThrow();
    expect(() =>
      assertShoppingListItemIdentities(
        [{ product_id: '1', quantity: '2' }],
        existing,
      ),
    ).not.toThrow();
    for (const item of [
      { product_id: '2', item_id: first },
      { product_id: '1', item_id: second },
    ]) {
      expect(() =>
        assertShoppingListItemIdentities(
          [{ ...item, quantity: '2' }],
          existing,
        ),
      ).toThrow('business:shopping_list_item_mismatch');
    }
  });

  it('normalizes accents and escapes LIKE metacharacters', () => {
    expect(shoppingListSearchPattern('  Cafetería %_!  ')).toBe(
      '%Cafeteria !%!_!!%',
    );
    expect(shoppingListSearchPattern('')).toBe('');
  });
});
