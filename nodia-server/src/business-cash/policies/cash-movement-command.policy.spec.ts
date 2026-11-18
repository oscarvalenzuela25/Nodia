import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  normalizeCashMovementCreate,
  normalizeCashMovementUpdate,
} from './cash-movement-command.policy.js';

const create = {
  request_key: 'A1000000-0000-4000-8000-000000000001',
  business_id: 'A1000000-0000-4000-8000-000000000002',
  type: 'expense',
  category_id: '9223372036854775807',
  amount: '9999999999999',
  occurred_on: '0001-01-01',
  description: '\u0085\uFEFF Costo del día \u00a0',
};
const update = { request_key: create.request_key, expected_version: 2 };

describe('Cash movement commands', () => {
  it('normalizes retryable intent without changing exact amounts, dates or bigint IDs', () => {
    expect(normalizeCashMovementCreate(create)).toEqual({
      ...create,
      request_key: create.request_key.toLowerCase(),
      business_id: create.business_id.toLowerCase(),
      description: 'Costo del día',
      is_active: true,
    });
  });

  it('retains explicit false and leaves omitted fields out of a partial command', () => {
    expect(
      normalizeCashMovementUpdate({ ...update, is_active: false }),
    ).toEqual({
      ...update,
      request_key: update.request_key.toLowerCase(),
      is_active: false,
    });
  });

  it('uses an empty description when absent on create or blank on update', () => {
    expect(
      normalizeCashMovementCreate({ ...create, description: undefined })
        .description,
    ).toBe('');
    expect(
      normalizeCashMovementUpdate({ ...update, description: '\u0085' }),
    ).toEqual({
      ...update,
      request_key: create.request_key.toLowerCase(),
      description: '',
    });
  });

  it.each(['0', '01', '1.0', '+1', '1e2', '1\n', '10000000000000', 1, null])(
    'rejects amount %j outside the canonical decimal domain',
    (amount) => {
      expect(() => normalizeCashMovementCreate({ ...create, amount })).toThrow(
        BadRequestException,
      );
    },
  );

  it.each([
    {},
    { type: 'income', amount: '1' },
    { source: 'invoice', is_active: false },
    { category_id: '9223372036854775808' },
    { description: null },
    { description: '💰'.repeat(501) },
    { is_active: null },
    { expected_version: '2', amount: '1' },
  ])('rejects empty, immutable or invalid update fields %j', (fields) => {
    expect(() => normalizeCashMovementUpdate({ ...update, ...fields })).toThrow(
      BadRequestException,
    );
  });
});
