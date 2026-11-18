import { InternalServerErrorException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { cashReadCount } from './cash-query.policy.js';

describe('Cash aggregate counts', () => {
  it('converts exact safe non-negative decimal values', () => {
    expect(cashReadCount('0')).toBe(0);
    expect(cashReadCount('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each(['9007199254740993', '', '-1', '1e2', null, 5])(
    'rejects invalid or unsafe count %j',
    (count) =>
      expect(() => cashReadCount(count)).toThrow(InternalServerErrorException),
  );
});
