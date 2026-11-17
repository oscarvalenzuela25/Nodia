import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import { ProviderFilterDto } from './dto/filter-provider.dto.js';
import { Provider } from './entities/provider.entity.js';
import { DataSource } from 'typeorm';
import { validateProviderOcrPreference } from './provider-ocr-preference.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
const business_id = '11111111-1111-4111-8111-111111111111';

describe('supplier OCR preference', () => {
  it('does not turn an OCR-only PATCH into creation defaults for tax or mappings', () => {
    const dto = plainToInstance(UpdateProviderDto, { use_ocr: true });
    expect(dto.tax).toBeUndefined(); expect(dto.fields).toBeUndefined(); expect(dto.use_ocr).toBe(true);
  });
  it.each([false, true, undefined])('allows optional boolean opt-in %j without coercing strings', async use_ocr => {
    expect(await validate(plainToInstance(CreateProviderDto, { business_id, name: 'Supplier', use_ocr }))).toEqual([]);
    expect(await validate(plainToInstance(UpdateProviderDto, { use_ocr }))).toEqual([]);
  });
  it.each([null, 'false', 0, [], {}])('rejects non-boolean write %j', async use_ocr => {
    expect(() => validateProviderOcrPreference(use_ocr)).toThrow('business:provider_use_ocr_invalid');
    for (const value of [plainToInstance(CreateProviderDto, { business_id, name: 'Supplier', use_ocr }), plainToInstance(UpdateProviderDto, { use_ocr })])
      expect((await validate(value)).some(error => error.property === 'use_ocr')).toBe(true);
  });
  it.each([['true', true], ['false', false], [true, true], [false, false]])('supports exact query representation %j', async (input, expected) => {
    const dto = plainToInstance(ProviderFilterDto, { use_ocr_eq: input });
    expect(await validate(dto)).toEqual([]); expect(dto.use_ocr_eq).toBe(expected);
  });
  it('binds the OCR filter as a boolean value without changing unfiltered supplier queries', () => {
    const db = new DataSource({ type: 'postgres', entities: [Provider] });
    const filtered = db.createQueryBuilder().select('provider.id').from('providers', 'provider');
    applyRansack(filtered, { use_ocr_eq: true }, 'provider', RANSACK_POLICIES.provider);
    expect(filtered.getQuery()).toContain('provider.use_ocr'); expect(Object.values(filtered.getParameters())).toContain(true);
    const ordinary = db.createQueryBuilder().select('provider.id').from('providers', 'provider');
    applyRansack(ordinary, {}, 'provider', RANSACK_POLICIES.provider);
    expect(ordinary.getQuery()).not.toContain('use_ocr');
  });
});
