import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  catalogPrice,
  checkProductVersion,
  productSnapshot,
  rejectRetiredProductFields,
  validateBarcode,
  validateCatalogProduct,
} from './product-catalog.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { Product } from './entities/product.entity.js';
import { FilterProductDto } from './dto/filter-product.dto.js';
import { CreateProductLogDto } from './dto/create-product-log.dto.js';
import { UpdateProductLogDto } from './dto/update-product-log.dto.js';

describe('POS catalog invariants', () => {
  it('rejects the retired margin in DTOs and internal writers, including zero and null', async () => {
    for (const value of [0, 30, null]) {
      const dtos: (new () => object)[] = [CreateProductDto, UpdateProductDto, CreateProductLogDto, UpdateProductLogDto];
      for (const Dto of dtos) {
        const errors = await validate(plainToInstance(Dto, { profit_percentage: value }), { whitelist: true, forbidNonWhitelisted: true });
        expect(errors.some(error => error.property === 'profit_percentage' && error.constraints?.whitelistValidation)).toBe(true);
      }
      expect(() => rejectRetiredProductFields({ profit_percentage: value })).toThrow('product:profit_percentage_retired');
    }
    expect(() => validateCatalogProduct({ cost_price: 1, cost_price_tax: 2, sale_price: 17, has_stock: false }, true)).not.toThrow();
    const snapshot = productSnapshot(Object.assign(new Product(), { cost_price: 1, cost_price_tax: 2, sale_price: 17, profit_percentage: 30 }), 'update', '1', ['sale_price']);
    expect(snapshot).toMatchObject({ cost_price: 1, cost_price_tax: 2, sale_price: 17 });
    expect(snapshot).not.toHaveProperty('profit_percentage');
  });
  it('parses bounded ID batches without converting bigint identifiers to Number', async () => {
    const filter = plainToInstance(FilterProductDto, { id_in: '1,9007199254740993,9223372036854775807' });
    expect(await validate(filter)).toEqual([]);
    expect(filter.id_in).toEqual(['1','9007199254740993','9223372036854775807']);
    expect(await validate(plainToInstance(FilterProductDto, { id_in: Array.from({ length: 200 }, (_, index) => String(index + 1)) }))).toEqual([]);
  });
  it.each([[], ['0'], ['01'], ['1e3'], ['-1'], ['1', null], [1], ['9223372036854775808'], '1, 2', Array(201).fill('1')])('rejects malformed or excessive ID batches %#', async (id_in) => {
    expect((await validate(plainToInstance(FilterProductDto, { id_in }))).some(error => error.property === 'id_in')).toBe(true);
  });
  it('preserves independent supplier/barcode identifiers, leading zeroes and unavailable false', () => {
    validateBarcode('0000123ABC');
    expect(() => validateBarcode(123)).toThrow('product:invalid_barcode');
    for (const value of ['', '  ', '123 ', ' 123', '12\n3'])
      expect(() => validateBarcode(value)).toThrow();
    expect(() =>
      validateCatalogProduct(
        { has_stock: false, barcode: null, sale_price: 0 },
        true,
      ),
    ).not.toThrow();
    expect(() =>
      validateCatalogProduct({ stock: 100, sale_price: 1 }, true),
    ).toThrow('product:availability_required');
  });
  it.each([50, 100, 150])(
    'uses configured alternative %i without comparing with the normal price',
    (offer_price) => {
      const product = { sale_price: 100, offer_price, is_offer_enabled: true };
      validateCatalogProduct(product);
      expect(catalogPrice(product)).toEqual({
        effective_price: String(offer_price),
        price_source: 'offer',
      });
      expect(catalogPrice({ ...product, is_offer_enabled: false })).toEqual({
        effective_price: '100',
        price_source: 'regular',
      });
    },
  );
  it('never replaces missing or invalid selected alternative with the normal amount', () => {
    const product = {
      sale_price: 100,
      offer_price: null,
      is_offer_enabled: true,
    };
    expect(catalogPrice(product)).toEqual({
      effective_price: null,
      price_source: null,
    });
    expect(() => validateCatalogProduct(product)).toThrow(
      'product:selected_price_missing',
    );
    expect(() =>
      validateCatalogProduct({ ...product, offer_price: -1 }),
    ).toThrow('product:invalid_price');
    expect(catalogPrice({ ...product, offer_price: 0 })).toEqual({
      effective_price: '0',
      price_source: 'offer',
    });
  });
  it('partial DTOs do not inject defaults and stale POS revisions are rejected', async () => {
    const patch = plainToInstance(UpdateProductDto, { name: 'Renamed' });
    expect(await validate(patch)).toEqual([]);
    expect(patch).not.toHaveProperty('stock', 0);
    expect(patch).not.toHaveProperty('is_active', true);
    expect(patch).not.toHaveProperty('has_stock');
    expect(() => checkProductVersion({ version: 3 }, 2, true)).toThrow(
      'product:version_conflict',
    );
    expect(() => checkProductVersion({ version: 3 }, undefined, true)).toThrow(
      'product:version_required',
    );
    expect(
      await validate(
        plainToInstance(CreateProductDto, {
          business_id: '11111111-1111-4111-8111-111111111111',
          name: 'P',
          code: 'SUP',
          cost_price: 0,
          cost_price_tax: 0,
          sale_price: 1,
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'has_stock' }),
      ]),
    );
  });
  it('writes an exact post-change snapshot without fabricating legacy availability', () => {
    const product = Object.assign(new Product(), {
      id: '1',
      code: 'SUP-01',
      barcode: '0001',
      version: 4,
      has_stock: null,
      stock: 0,
      sale_price: 100,
      offer_price: 150,
      is_offer_enabled: true,
    });
    expect(
      productSnapshot(product, 'update', '9', ['offer_price']),
    ).toMatchObject({
      product_id: '1',
      code: 'SUP-01',
      barcode: '0001',
      product_version: 4,
      has_stock: null,
      stock: 0,
      sale_price: 100,
      offer_price: 150,
      is_offer_enabled: true,
      actor_id: '9',
      changed_fields: ['offer_price'],
    });
  });
});
