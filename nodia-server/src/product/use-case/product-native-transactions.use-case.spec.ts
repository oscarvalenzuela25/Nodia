import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { ProductService } from '../product.service.js';
import { Product } from '../entities/product.entity.js';
import { ProductLog } from '../entities/product-log.entity.js';
import { CreateProductUseCase } from './create-product.use-case.js';
import { UpdateProductUseCase } from './update-product.use-case.js';
import { CreateProductLogUseCase } from './create-product-log.use-case.js';
import { UpdateProductLogUseCase } from './update-product-log.use-case.js';
import type { CreateProductDto } from '../dto/create-product.dto.js';
const business = '11111111-1111-4111-8111-111111111111';
const actor = {
  userId: '12',
  sessionId: '11111111-1111-4111-8111-111111111112',
};
const dto = {
  business_id: business,
  code: 'P',
  name: 'Product',
  cost_price: 1,
  cost_price_tax: 2,
  sale_price: 4,
  stock: 5,
  has_stock: true,
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
    query: vi.fn(async (sql: string, parameters?: unknown[]) => {
      if (sql.includes('AS authority_locks')) return [{ authority_locks: 9 }];
      if (sql.includes('AS "actorId"'))
        return [
          {
            actorId: actor.userId,
            sessionId: actor.sessionId,
            isSuperAdmin: true,
          },
        ];
      if (sql.includes('FROM products'))
        return ((parameters?.[0] ?? []) as string[]).map((id) => ({
          id,
          business_id: business,
        }));
      return [{ id: business }];
    }),
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
  const modules = { execute: vi.fn(async () => undefined) };
  const service = new ProductService(
    globalProducts as unknown as ConstructorParameters<
      typeof ProductService
    >[0],
    globalLogs as unknown as ConstructorParameters<typeof ProductService>[1],
    modules as unknown as ConstructorParameters<typeof ProductService>[2],
  );
  return {
    service,
    modules,
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
  it('creates without supplier code using unit and includes both fields in the derived log', async () => {
    const f = fixture();
    const { code: _code, ...input } = dto;
    const result = await f.service.createProduct(input, f.manager, actor);
    expect(result).toMatchObject({ code: null, measurement_unit: 'unit' });
    expect(f.logs.save).toHaveBeenCalledWith(expect.objectContaining({
      product_id: result.id, code: null, measurement_unit: 'unit',
    }));
  });
  it('retains an omitted code/unit and normalizes an explicit blank code without inventing an identifier', async () => {
    const f = fixture();
    Object.assign(f.product, { version: 3, measurement_unit: 'kg' });
    await f.service.updateProduct('3', { name: 'Renamed', code: undefined, measurement_unit: undefined }, f.manager, actor);
    expect(f.product).toMatchObject({ code: 'P', measurement_unit: 'kg' });
    await f.service.updateProduct('3', { code: '  ' }, f.manager, actor);
    expect(f.product).toMatchObject({ code: null, measurement_unit: 'kg' });
    expect(f.logs.save).toHaveBeenLastCalledWith(expect.objectContaining({ code: null, measurement_unit: 'kg' }));
  });
  it('requires a current revision for changing measurement interpretation and snapshots the new unit', async () => {
    const f = fixture();
    Object.assign(f.product, { version: 3, measurement_unit: 'unit' });
    await expect(f.service.updateProduct('3', { measurement_unit: 'kg' }, f.manager, actor))
      .rejects.toThrow('product:version_required');
    expect(f.products.save).not.toHaveBeenCalled();
    await expect(f.service.updateProduct('3', { measurement_unit: 'kg', expected_version: 2 }, f.manager, actor))
      .rejects.toThrow('product:version_conflict');
    await f.service.updateProduct('3', { measurement_unit: 'kg', expected_version: 3 }, f.manager, actor);
    expect(f.product).toMatchObject({ measurement_unit: 'kg', version: 4 });
    expect(f.logs.save).toHaveBeenLastCalledWith(expect.objectContaining({ measurement_unit: 'kg', product_version: 4 }));
  });
  it('rejects an invalid explicit unit at the direct writer boundary before any persistence', async () => {
    const f = fixture();
    await expect(f.service.createProduct({ ...dto, measurement_unit: 'mg' } as unknown as CreateProductDto, f.manager, actor))
      .rejects.toThrow('product:invalid_measurement_unit');
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('rechecks a revoked destination module inside the authority transaction before any catalog write', async () => {
    const f = fixture();
    f.modules.execute.mockRejectedValueOnce(new Error('core:module_access_required'));
    await expect(new CreateProductUseCase(f.service).execute(dto, f.manager, actor)).rejects.toThrow('core:module_access_required');
    const query = vi.mocked(f.manager.query);
    const identityIndex = query.mock.calls.findIndex(([sql]) => String(sql).includes('AS "actorId"'));
    expect(identityIndex).toBeGreaterThanOrEqual(0);
    expect(query.mock.invocationCallOrder[identityIndex]).toBeLessThan(f.modules.execute.mock.invocationCallOrder[0]);
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('rejects a retired field from internal product and log writers without persisting anything', async () => {
    const f = fixture();
    const stale = { ...dto, profit_percentage: 30 };
    await expect(new CreateProductUseCase(f.service).execute(stale, f.manager, actor)).rejects.toThrow('product:profit_percentage_retired');
    const { business_id: _business, is_active: _active, ...log } = stale;
    await expect(new CreateProductLogUseCase(f.service).execute({ ...log, product_id: '3' }, f.manager, actor)).rejects.toThrow('product:profit_percentage_retired');
    expect(f.products.save).not.toHaveBeenCalled(); expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('native creation writes product and its exact derived log through one transactional manager', async () => {
    const f = fixture();
    const result = await new CreateProductUseCase(f.service).execute(
      dto,
      undefined,
      actor,
    );
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
    await new CreateProductUseCase(f.service).execute(dto, f.manager, actor);
    expect(f.transaction).not.toHaveBeenCalled();
    expect(f.products.save).toHaveBeenCalledTimes(1);
    expect(f.logs.save).toHaveBeenCalledTimes(1);
  });
  it('propagates a derived-log error to the transaction instead of claiming a completed product', async () => {
    const f = fixture();
    f.logs.save.mockRejectedValue(new Error('log persistence failed'));
    await expect(
      new CreateProductUseCase(f.service).execute(dto, undefined, actor),
    ).rejects.toThrow('log persistence failed');
  });
  it('locks existing product and preserves omitted values in the derived updated snapshot', async () => {
    const f = fixture();
    await new UpdateProductUseCase(f.service).execute(
      '3',
      { name: 'Renamed', is_active: false },
      f.manager,
      actor,
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
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('rejects a provider/business mismatch before writing product or automatic log', async () => {
    const f = fixture();
    const query = vi.mocked(f.manager.query);
    const originalQuery = query.getMockImplementation()!;
    query.mockImplementation(async (sql: string, parameters?: unknown[]) =>
      sql.includes('FROM providers') ? [] : originalQuery(sql, parameters),
    );
    await expect(
      new CreateProductUseCase(f.service).execute(
        { ...dto, provider_id: '4' },
        f.manager,
        actor,
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
      actor,
    );
    await new UpdateProductLogUseCase(f.service).execute(
      business,
      { stock: 0 },
      f.manager,
      actor,
    );
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).toHaveBeenCalledTimes(2);
    expect(f.log.stock).toBe(0);
    expect(f.transaction).not.toHaveBeenCalled();
    // ORDER BY must name the bigint source, not the projected id::text alias.
    // Parent locks stay shared because these paths never upgrade/write Product.
    expect(vi.mocked(f.manager.query).mock.calls.some(([sql]) =>
      /FROM products p[\s\S]*ORDER BY p\.id FOR SHARE OF p/.test(String(sql)),
    )).toBe(true);
  });
});
