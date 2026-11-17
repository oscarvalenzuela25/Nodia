import { BadRequestException } from '@nestjs/common';
import qs from 'qs';
import { describe, expect, it } from 'vitest';
import { RentalValidationPipe } from '../../rental-common/rental-validation.pipe.js';
import {
  QueryCashMonthlySummaryDto,
  QueryCashMovementsDto,
} from '../dto/query-cash-movements.dto.js';
import { normalizeCashMovementQuery } from './cash-movement-query.policy.js';

const business = 'a0000000-0000-4000-8000-000000000001';
const pipe = new RentalValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const parse = (value: string) =>
  qs.parse(value, { allowDots: true, comma: true });
const list = async (suffix = '') =>
  normalizeCashMovementQuery(
    await pipe.transform(
      parse(`q[business_id_eq]=${business.toUpperCase()}&${suffix}`),
      { metatype: QueryCashMovementsDto, type: 'query' },
    ),
  );

describe('Cash movement read boundary', () => {
  it('defaults to all activity and dates in descending civil date order', async () => {
    expect(await list()).toEqual({
      filters: {
        business_id_eq: business,
        category_id_eq: undefined,
        occurred_on_gteq: undefined,
        occurred_on_lteq: undefined,
        is_active_eq: undefined,
      },
      page: 1,
      limit: 10,
      order: 'occurred_on',
      direction: 'DESC',
      search: undefined,
    });
  });

  it('preserves a one-sided civil range, explicit false, exact bigint and encoded literal', async () => {
    expect(
      await list(
        'page=100000&limit=100&q[s]=amount%20asc&q[is_active_eq]=false&' +
          'q[category_id_eq]=9223372036854775807&q[occurred_on_lteq]=0001-01-01&' +
          'q[search]=%20Caf%C3%A9%2C%25_!%20',
      ),
    ).toEqual({
      filters: {
        business_id_eq: business,
        category_id_eq: '9223372036854775807',
        occurred_on_gteq: undefined,
        occurred_on_lteq: '0001-01-01',
        is_active_eq: false,
      },
      page: 100000,
      limit: 100,
      order: 'amount',
      direction: 'ASC',
      search: 'Café,%_!',
    });
  });

  it('omits a blank trimmed search and accepts equal dates', async () => {
    await expect(
      list(
        'q[search]=%20%09&q[occurred_on_gteq]=2024-02-29&q[occurred_on_lteq]=2024-02-29',
      ),
    ).resolves.toMatchObject({
      search: undefined,
      filters: {
        occurred_on_gteq: '2024-02-29',
        occurred_on_lteq: '2024-02-29',
      },
    });
  });

  it.each([
    'includes=category',
    'size=10',
    'q[s]=amount%20ASC',
    'q[search]=apple,pear',
    'q[occurred_on_gteq]=2024-02-29&q[occurred_on_lteq]=2024-02-28',
    'q[occurred_on_gteq]=2026-02-29',
    'q[occurred_on_lteq]=',
    'q[category_id_eq]=9223372036854775808',
    'q[category_id_eq]=01',
    'q[description_cont]=foo',
    'q[search]=foo&q[search]=bar',
  ])('rejects unsupported or invalid query fields in %s', async (suffix) => {
    await expect(list(suffix)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { category_id_eq: null },
    { occurred_on_gteq: null },
    { search: '🧾'.repeat(256) },
  ])('rejects invalid internal query input %j', (fields) =>
    expect(() =>
      normalizeCashMovementQuery({
        q: { business_id_eq: business, ...fields },
      }),
    ).toThrow(BadRequestException),
  );

  it('validates the monthly endpoint business as its only query field', async () => {
    const metadata = {
      metatype: QueryCashMonthlySummaryDto,
      type: 'query' as const,
    };
    await expect(
      pipe.transform(parse(`business_id=${business}`), metadata),
    ).resolves.toMatchObject({ business_id: business });
    for (const query of [
      '',
      `business_id=${business}&q[is_active_eq]=true`,
      `business_id=${business}&business_id=${business}`,
    ])
      await expect(
        pipe.transform(parse(query), metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
  });
});
