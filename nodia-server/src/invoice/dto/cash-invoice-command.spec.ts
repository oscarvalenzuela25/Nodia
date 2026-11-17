import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  hasIdentifiedInvoiceFields,
  MAX_OCR_COMMAND_BYTES,
  normalizeCashInvoiceCreate,
  normalizeCashInvoiceUpdate,
  normalizeOcrInvoiceConfirmation,
} from './cash-invoice-command.js';

const request_key = 'B1000000-0000-4000-8000-000000000001';
const business_id = 'B1000000-0000-4000-8000-000000000002';

describe('identified invoice commands', () => {
  it('uses the same normalized command for JSON and multipart', () => {
    const fields = { request_key, business_id, code: ' 0042 ' };
    expect(
      normalizeCashInvoiceCreate(
        {
          ...fields,
          cash_category_id: 'null',
          total_amount: '37',
          data: '{"issue_date":"2024-02-29"}',
          is_active: 'false',
        },
        true,
      ),
    ).toEqual(
      normalizeCashInvoiceCreate(
        {
          ...fields,
          cash_category_id: null,
          total_amount: 37,
          data: { issue_date: '2024-02-29' },
          is_active: false,
        },
        false,
      ),
    );
  });

  it('keeps omitted fields distinct from explicit removal and zero', () => {
    const omitted = normalizeCashInvoiceUpdate({
      request_key,
      expected_version: 1,
    });
    expect(omitted.patch).toEqual({});
    expect(omitted.cash_category_id).toBeUndefined();
    const cleared = normalizeCashInvoiceUpdate({
      request_key,
      expected_version: 1,
      cash_category_id: null,
      code: null,
      total_amount: 0,
      is_active: false,
    });
    expect(cleared.cash_category_id).toBeNull();
    expect(cleared.patch).toEqual({
      code: null,
      total_amount: 0,
      is_active: false,
    });
  });

  it('routes all attempts at identified fields through the strict contract', () => {
    expect(hasIdentifiedInvoiceFields({ code: 'legacy' })).toBe(false);
    expect(hasIdentifiedInvoiceFields({ cash_category_id: null })).toBe(true);
    expect(hasIdentifiedInvoiceFields({ expected_version: 1 })).toBe(true);
    expect(() => normalizeCashInvoiceUpdate({ request_key })).toThrow(
      BadRequestException,
    );
    expect(() => normalizeCashInvoiceUpdate({ expected_version: 1 })).toThrow(
      BadRequestException,
    );
  });

  it.each([
    { expected_version: 1 },
    { cash_category_id: '' },
    { cash_category_id: 'null' },
    { provider_id: 1 },
    { total_amount: '10' },
    { total_amount: 10.5 },
    { total_amount: 2147483648 },
    { data: [] },
    { data: { note: '\u0000' } },
    { data: { nested: [Infinity] } },
    { is_active: null },
    { version: 1 },
  ])('rejects an invalid invoice body %j', (fields) => {
    expect(() =>
      normalizeCashInvoiceCreate(
        { request_key, business_id, ...fields },
        false,
      ),
    ).toThrow(BadRequestException);
  });

  it('checks the OCR command byte budget and strict envelope', () => {
    expect(() =>
      normalizeOcrInvoiceConfirmation(
        'ñ'.repeat(MAX_OCR_COMMAND_BYTES / 2 + 1),
      ),
    ).toThrow(PayloadTooLargeException);
    expect(() =>
      normalizeOcrInvoiceConfirmation('{"invoice":{"path_storage":"other"}}'),
    ).toThrow(BadRequestException);
    expect(() => normalizeOcrInvoiceConfirmation('{"invoice":\uFFFD}')).toThrow(
      BadRequestException,
    );
  });
});
