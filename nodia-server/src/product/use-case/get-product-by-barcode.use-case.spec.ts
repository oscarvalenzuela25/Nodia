import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { CheckModuleAccessUseCase } from '../../authorization/use-case/check-module-access.use-case.js';
import { ProductService } from '../product.service.js';
import { Product } from '../entities/product.entity.js';
import type { ProductLog } from '../entities/product-log.entity.js';

vi.mock('../../business-access/business-access.js', () => ({
  assertBusinessesAccess: vi.fn(async () => ({})),
}));

describe('Exact barcode lookup boundary', () => {
  function fixture() {
    const product = Object.assign(new Product(), { id: '1', business_id: 'business', code: 'SUPPLIER',
      barcode: '000123', sale_price: 0, offer_price: 150, is_offer_enabled: true, has_stock: false });
    const repository = { manager: { query: vi.fn(async () => []) }, findOneBy: vi.fn(async () => product) };
    const modules = { execute: vi.fn(async () => undefined) };
    return { repository, service: new ProductService(repository as unknown as Repository<Product>,
      {} as Repository<ProductLog>, modules as unknown as CheckModuleAccessUseCase) };
  }
  const actor = { userId: '1', sessionId: 'session' };
  it('rejects absent barcode instead of allowing TypeORM to omit its null predicate and select a first row', async () => {
    const f = fixture();
    await expect(f.service.findByBarcode('business', null as unknown as string, actor)).rejects.toThrow('product:invalid_barcode');
    expect(f.repository.findOneBy).not.toHaveBeenCalled();
  });
  it('returns the exact barcode product with its selected amount and actual availability', async () => {
    const f = fixture();
    expect(await f.service.findByBarcode('business', '000123', actor)).toMatchObject({ barcode: '000123', code: 'SUPPLIER',
      effective_price: '150', price_source: 'offer', has_stock: false });
    expect(f.repository.findOneBy).toHaveBeenCalledWith({ business_id: 'business', barcode: '000123' });
  });
});
