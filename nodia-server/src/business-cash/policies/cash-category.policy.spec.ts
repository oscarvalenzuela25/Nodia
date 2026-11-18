import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  normalizeCashCategoryCreate,
  normalizeCashCategoryUpdate,
  validateCashCategoryId,
} from './cash-category.policy.js';

const creation = {
  business_id: 'A0000000-0000-4000-8000-000000000001',
  request_key: 'A0000000-0000-4000-8000-000000000002',
  name: 'Mercadería',
  description: 'Productos',
};

describe('Cash category commands', () => {
  it('derives the same private key across case, spacing and compatibility variants', () => {
    const first = normalizeCashCategoryCreate(creation);
    const variant = normalizeCashCategoryCreate({
      ...creation,
      name: '\uFEFFＭＥＲ\u00A0ＣＡＤＥＲÍＡ ',
    });
    expect(first.normalized_name).toBe('mercadería');
    expect(variant).toEqual({ ...first, name: 'MER CADERÍA' });
    expect(first.business_id).toBe(creation.business_id.toLowerCase());
    expect(first.request_key).toBe(creation.request_key.toLowerCase());
    expect(first.is_active).toBe(true);
  });

  it('handles contextual lowercase after removing whitespace and retains accents', () => {
    const key = (name: string) =>
      normalizeCashCategoryCreate({ ...creation, name }).normalized_name;
    expect(key('Ο Σ')).toBe(key('ΟΣ'));
    expect(key('Insumós')).not.toBe(key('Insumos'));
  });

  it('counts code points and rejects a name that expands beyond the limit under NFKC', () => {
    const name = '💰'.repeat(120);
    expect(normalizeCashCategoryCreate({ ...creation, name }).name).toBe(name);
    expect(() =>
      normalizeCashCategoryCreate({ ...creation, name: 'ﬀ'.repeat(61) }),
    ).toThrow(BadRequestException);
  });

  it.each([
    { name: '\u0085 \uFEFF' },
    { name: 'nombre\u0000' },
    { name: '\uD800' },
    { description: '\uFEFF\u0085' },
    { description: 'x'.repeat(501) },
    { is_active: 'false' },
    { is_active: null },
    { normalized_name: 'client-controlled' },
  ])('rejects invalid creation payload %j', (overrides) => {
    expect(() =>
      normalizeCashCategoryCreate({ ...creation, ...overrides }),
    ).toThrow(BadRequestException);
  });

  it('preserves omitted fields and keeps explicit false on update', () => {
    expect(
      normalizeCashCategoryUpdate({
        request_key: creation.request_key,
        expected_version: 7,
        is_active: false,
      }),
    ).toEqual({
      request_key: creation.request_key.toLowerCase(),
      expected_version: 7,
      is_active: false,
    });
  });

  it.each([
    {},
    { expected_version: '7', is_active: false },
    { expected_version: 2147483648, is_active: false },
    { name: null },
    { description: null },
    { is_active: null },
    { is_active: false, business_id: creation.business_id },
  ])('rejects empty or malformed update %j', (overrides) => {
    expect(() =>
      normalizeCashCategoryUpdate({
        request_key: creation.request_key,
        expected_version: 7,
        ...overrides,
      }),
    ).toThrow(BadRequestException);
  });

  it('checks catalog bigint IDs without rounding or accepting aliases', () => {
    expect(() => validateCashCategoryId('9223372036854775807')).not.toThrow();
    expect(() => validateCashCategoryId('9223372036854775808')).toThrow(
      BadRequestException,
    );
    expect(() => validateCashCategoryId('01')).toThrow(BadRequestException);
  });
});
