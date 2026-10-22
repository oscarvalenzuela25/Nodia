import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { ProductService } from '../product.service.js';
import { Product } from '../entities/product.entity.js';
import { ProductLog } from '../entities/product-log.entity.js';
import { CreateProductUseCase } from './create-product.use-case.js';
import { UpdateProductUseCase } from './update-product.use-case.js';
import { CreateProductLogUseCase } from './create-product-log.use-case.js';
import { UpdateProductLogUseCase } from './update-product-log.use-case.js';
const business = '11111111-1111-4111-8111-111111111111';
const dto = {
  business_id: business,
  code: 'P',
  name: 'Product',
  cost_price: 1,
  cost_price_tax: 2,
  profit_percentage: 3,
  sale_price: 4,
  stock: 5,
  is_active: true,
};
function fixture() {
  const product = Object.assign(new Product(), {
    id: '3',
    provider_id: null,
    ...dto,
  });
  const log = Object.assign(new ProductLog(), {
    ...dto,
    id: business,
    product_id: '3',
  });
  const products = {
    create: vi.fn((value: object) =>
      Object.assign(new Product(), { id: '3', ...value }),
    ),
    save: vi.fn(async (value: Product) => value),
    findOne: vi.fn(async () => product),
  };
  const logs = {
    create: vi.fn((value: object) =>
      Object.assign(new ProductLog(), { id: business, ...value }),
    ),
    save: vi.fn(async (value: ProductLog) => value),
    findOne: vi.fn(async () => log),
  };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async () => [{ id: business }]),
    getRepository: vi.fn((entity: unknown) =>
      entity === Product ? products : logs,
    ),
  } as unknown as EntityManager;
  const transaction = vi.fn(
    async (work: (tx: EntityManager) => Promise<unknown>) => work(manager),
  );
  const globalProducts = {
    manager: { transaction },
    save: vi.fn(() => {
      throw new Error('global save forbidden');
    }),
  };
  const globalLogs = {
    manager: { transaction },
    save: vi.fn(() => {
      throw new Error('global save forbidden');
    }),
  };
  const service = new ProductService(
    globalProducts as unknown as ConstructorParameters<
      typeof ProductService
    >[0],
    globalLogs as unknown as ConstructorParameters<typeof ProductService>[1],
  );
  return {
    service,
    product,
    log,
    products,
    logs,
    manager,
    transaction,
    globalProducts,
    globalLogs,
  };
}
describe('Native product writers through their use cases', () => {
  it('native creation writes product and its exact derived log through one transactional manager', async () => {
    const f = fixture();
    const result = await new CreateProductUseCase(f.service).execute(dto);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.products.save).toHaveBeenCalledTimes(1);
    expect(f.logs.save).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: result.id,
        code: 'P',
        stock: 5,
        sale_price: 4,
      }),
    );
    expect(f.globalProducts.save).not.toHaveBeenCalled();
    expect(f.globalLogs.save).not.toHaveBeenCalled();
  });
  it('an explicit confirmed manager never opens an independent transaction', async () => {
    const f = fixture();
    await new CreateProductUseCase(f.service).execute(dto, f.manager);
    expect(f.transaction).not.toHaveBeenCalled();
    expect(f.products.save).toHaveBeenCalledTimes(1);
    expect(f.logs.save).toHaveBeenCalledTimes(1);
  });
  it('propagates a derived-log error to the transaction instead of claiming a completed product', async () => {
    const f = fixture();
    f.logs.save.mockRejectedValue(new Error('log persistence failed'));
    await expect(
      new CreateProductUseCase(f.service).execute(dto),
    ).rejects.toThrow('log persistence failed');
  });
  it('locks existing product and preserves omitted values in the derived updated snapshot', async () => {
    const f = fixture();
    await new UpdateProductUseCase(f.service).execute(
      '3',
      { name: 'Renamed', is_active: false },
      f.manager,
    );
    expect(f.products.findOne).toHaveBeenCalledWith({
      where: { id: '3' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(f.logs.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed', stock: 5, sale_price: 4 }),
    );
    expect(f.product.is_active).toBe(false);
  });
  it('rejects updates to missing targets instead of inserting a new record', async () => {
    const f = fixture();
    f.products.findOne.mockResolvedValue(null as unknown as Product);
    await expect(
      new UpdateProductUseCase(f.service).execute(
        '3',
        { name: 'Renamed' },
        f.manager,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('rejects a provider/business mismatch before writing product or automatic log', async () => {
    const f = fixture();
    const query = vi.mocked(f.manager.query);
    query.mockImplementation(async (sql: string) =>
      sql.includes('FROM providers') ? [] : [{ id: business }],
    );
    await expect(
      new CreateProductUseCase(f.service).execute(
        { ...dto, provider_id: '4' },
        f.manager,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('creating/editing a log changes only its historical row and reuses the supplied manager', async () => {
    const f = fixture();
    const { business_id: _business, is_active: _active, ...fields } = dto;
    await new CreateProductLogUseCase(f.service).execute(
      { ...fields, product_id: '3' },
      f.manager,
    );
    await new UpdateProductLogUseCase(f.service).execute(
      business,
      { stock: 0 },
      f.manager,
    );
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).toHaveBeenCalledTimes(2);
    expect(f.log.stock).toBe(0);
    expect(f.transaction).not.toHaveBeenCalled();
  });
});
