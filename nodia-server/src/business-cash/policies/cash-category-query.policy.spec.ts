import { BadRequestException } from '@nestjs/common';
import qs from 'qs';
import { describe, expect, it } from 'vitest';
import { RentalValidationPipe } from '../../rental-common/rental-validation.pipe.js';
import { CreateCashCategoryDto } from '../dto/create-cash-category.dto.js';
import { QueryCashCategoriesDto } from '../dto/query-cash-categories.dto.js';
import { UpdateCashCategoryDto } from '../dto/update-cash-category.dto.js';
import { normalizeCashCategoryQuery } from './cash-category-query.policy.js';

const id = 'a0000000-0000-4000-8000-000000000001';
const pipe = new RentalValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const parse = (value: string) =>
  qs.parse(value, { allowDots: true, comma: true });
const query = (suffix: string) =>
  pipe.transform(parse('q[business_id_eq]=' + id + '&' + suffix), {
    metatype: QueryCashCategoriesDto,
    type: 'query',
  });

describe('Cash category list boundary', () => {
  it('defaults to page 1, limit 10 and canonical name order with all activity', async () => {
    expect(normalizeCashCategoryQuery(await query(''))).toEqual({
      filters: {
        business_id_eq: id,
        is_active_eq: undefined,
        name_cont: undefined,
      },
      page: 1,
      limit: 10,
      direction: 'ASC',
    });
  });

  it('uses the real query parser without losing encoded commas or explicit false', async () => {
    expect(
      normalizeCashCategoryQuery(
        await query(
          'q[name_cont]=%20ventas%2C%25_%20&q[is_active_eq]=false&q[s]=name%20desc&page=3&limit=100',
        ),
      ),
    ).toEqual({
      filters: {
        business_id_eq: id,
        is_active_eq: false,
        name_cont: 'ventas,%_',
      },
      page: 3,
      limit: 100,
      direction: 'DESC',
    });
  });

  it.each([
    'all=true',
    'limit=101',
    'limit=1e2',
    'page=100001',
    'page=1&page=2',
    'q[s]=',
    'q[s]=name',
    'q[s]=id%20asc',
    'q[is_active_eq]=0',
    'q[is_active_eq]=true&q[is_active_eq]=false',
    'q[name_cont]=foo,bar',
    'q[normalized_name_cont]=secret',
    'q[name_not_cont]=foo',
    'q[business_id_eq]=' + id,
  ])(
    'rejects unsupported or repeated HTTP query fields in %s',
    async (suffix) => {
      await expect(query(suffix)).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each([
    null,
    [],
    [{ business_id_eq: id }],
    {},
    { business_id_eq: id, is_active_eq: null },
  ])('rejects invalid envelopes even when called internally: %j', (q) => {
    expect(() => normalizeCashCategoryQuery({ q })).toThrow(
      BadRequestException,
    );
  });

  it('rejects malformed search text before opening a filter transaction', () => {
    for (const name_cont of ['x'.repeat(256), '\u0000', '\uDFFF'])
      expect(() =>
        normalizeCashCategoryQuery({ q: { business_id_eq: id, name_cont } }),
      ).toThrow(BadRequestException);
  });

  it('uses strict DTOs for JSON booleans, explicit nulls and immutable fields', async () => {
    await expect(
      pipe.transform(
        {
          request_key: id,
          business_id: id,
          name: 'A',
          description: 'B',
          is_active: 'false',
        },
        { metatype: CreateCashCategoryDto, type: 'body' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        {
          request_key: id,
          expected_version: 1,
          is_active: null,
        },
        { metatype: UpdateCashCategoryDto, type: 'body' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        {
          request_key: id,
          expected_version: 1,
          is_active: false,
          business_id: id,
        },
        { metatype: UpdateCashCategoryDto, type: 'body' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
