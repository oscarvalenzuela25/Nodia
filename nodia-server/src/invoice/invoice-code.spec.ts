import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { normalizeInvoiceCode } from './invoice-code.js';

const business_id = '11111111-1111-4111-8111-111111111111';
describe('optional invoice folio', () => {
  it.each([undefined, null, '', '  \t '])('accepts an absent folio without manufacturing a code: %j', async code => {
    expect(normalizeInvoiceCode(code)).toBeNull();
    expect(await validate(plainToInstance(CreateInvoiceDto, { business_id, code }))).toEqual([]);
    expect(await validate(plainToInstance(UpdateInvoiceDto, { code }))).toEqual([]);
  });
  it('preserves leading zeroes and distinguishes an omitted PATCH from explicit clearing', () => {
    expect(normalizeInvoiceCode('  0001445  ')).toBe('0001445');
    expect(plainToInstance(UpdateInvoiceDto, {}).code).toBeUndefined();
    expect(plainToInstance(UpdateInvoiceDto, { code: '  ' }).code).toBeNull();
  });
  it.each([12, false, [], {}, 'a'.repeat(256)])('rejects invalid or oversized code %j', async code => {
    expect(() => normalizeInvoiceCode(code)).toThrow('business:invoice_code_invalid');
    expect((await validate(plainToInstance(CreateInvoiceDto, { business_id, code }))).some(error => error.property === 'code')).toBe(true);
  });
});
