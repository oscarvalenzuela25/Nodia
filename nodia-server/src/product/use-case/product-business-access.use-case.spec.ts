import { describe, expect, it, vi } from 'vitest';
import type { EntityManager, Repository } from 'typeorm';
import { ProductService } from '../product.service.js';
import { Product } from '../entities/product.entity.js';
import { ProductLog } from '../entities/product-log.entity.js';
import { CreateProductUseCase } from './create-product.use-case.js';
import { UpdateProductUseCase } from './update-product.use-case.js';
import { CreateBulkProductsUseCase } from './create-bulk-products.use-case.js';
import { CreateBulkProductLogsUseCase } from './create-bulk-product-logs.use-case.js';
import { UpdateProductLogUseCase } from './update-product-log.use-case.js';
import { UpdateBulkProductLogsUseCase } from './update-bulk-product-logs.use-case.js';

const own = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const logId = '33333333-3333-4333-8333-333333333333';
const actor = {
  userId: '12',
  sessionId: '44444444-4444-4444-8444-444444444444',
};
const dto = {
  business_id: own,
  has_stock: true,
  code: 'P',
  name: 'Synthetic',
  cost_price: 1,
  cost_price_tax: 0,
  sale_price: 1,
};
const fields = {
  product_id: '1',
  code: 'P',
  name: 'Synthetic',
  cost_price: 1,
  cost_price_tax: 0,
  sale_price: 1,
};

function fixture(isSuperAdmin = false) {
  const memberships = new Set([own]);
  const product = Object.assign(new Product(), {
    id: '1',
    provider_id: null,
    ...dto,
  });
  const other = Object.assign(new Product(), {
    ...product,
    id: '2',
    business_id: foreign,
  });
  const log = Object.assign(new ProductLog(), {
    ...fields,
    id: logId,
    product_id: '2',
  });
  const products = {
    findOne: vi.fn(async () => product),
    create: vi.fn((value: object | object[]) =>
      Array.isArray(value)
        ? value.map((item) =>
            Object.assign(new Product(), { id: '3', ...item }),
          )
        : Object.assign(new Product(), { id: '3', ...value }),
    ),
    save: vi.fn(async (value: unknown) => value),
  };
  const selection = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    setLock: vi.fn().mockReturnThis(),
    getMany: vi.fn(async () => [log]),
  };
  const logs = {
    findOne: vi.fn(async () => log),
    create: vi.fn((value: object | object[]) =>
      Array.isArray(value)
        ? value.map((item) => Object.assign(new ProductLog(), item))
        : Object.assign(new ProductLog(), value),
    ),
    save: vi.fn(async (value: unknown) => value),
    createQueryBuilder: vi.fn(() => selection),
  };
  const query = vi.fn(async (sql: string, parameters: unknown[] = []) => {
    if (sql.includes('AS authority_locks')) return [{ authority_locks: 9 }];
    if (sql.includes('AS "actorId"'))
      return [
        { actorId: actor.userId, sessionId: actor.sessionId, isSuperAdmin },
      ];
    if (sql.includes('FROM businesses business'))
      return (parameters[0] as string[])
        .filter((id) => isSuperAdmin || memberships.has(id))
        .map((id) => ({ id }));
    if (sql.includes('FROM businesses WHERE'))
      return (parameters[0] as string[]).map((id) => ({ id }));
    if (sql.includes('FROM products'))
      return [product, other].filter((row) =>
        (parameters[0] as string[]).includes(row.id),
      );
    throw new Error('Unexpected synthetic database boundary');
  });
  const manager = {
    queryRunner: { isTransactionActive: true },
    query,
    getRepository: vi.fn((entity: unknown) =>
      entity === Product ? products : logs,
    ),
  } as unknown as EntityManager;
  const transaction = vi.fn(
    async (work: (tx: EntityManager) => Promise<unknown>) => work(manager),
  );
  const service = new ProductService(
    { manager: { transaction } } as unknown as Repository<Product>,
    { manager: { transaction } } as unknown as Repository<ProductLog>,
    { execute: vi.fn(async () => undefined) } as unknown as ConstructorParameters<typeof ProductService>[2],
  );
  return {
    service,
    manager,
    products,
    logs,
    product,
    other,
    log,
    query,
    memberships,
    transaction,
  };
}

describe('Native product business ownership', () => {
  it('rejects an unbound actor even when a transaction manager is supplied', async () => {
    const f = fixture();
    await expect(
      new CreateProductUseCase(f.service).execute(dto, f.manager),
    ).rejects.toMatchObject({ status: 401 });
    expect(f.query).not.toHaveBeenCalled();
    expect(f.products.save).not.toHaveBeenCalled();
  });

  it('allows an owned business and an explicitly granted collaboration without requiring a role', async () => {
    const f = fixture();
    await new CreateProductUseCase(f.service).execute(dto, f.manager, actor);
    f.memberships.add(foreign);
    await new CreateProductUseCase(f.service).execute(
      { ...dto, business_id: foreign },
      f.manager,
      actor,
    );
    expect(f.products.save).toHaveBeenCalledTimes(2);
    expect(f.logs.save).toHaveBeenCalledTimes(2);
  });

  it('denies foreign creation before any product or automatic log is written', async () => {
    const f = fixture();
    await expect(
      new CreateProductUseCase(f.service).execute(
        { ...dto, business_id: foreign },
        f.manager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });

  it('allows the live superadministrator to create in an otherwise foreign business', async () => {
    const f = fixture(true);
    await new CreateProductUseCase(f.service).execute(
      { ...dto, business_id: foreign },
      f.manager,
      actor,
    );
    expect(f.products.save).toHaveBeenCalledOnce();
  });

  it.each(['source', 'destination'] as const)(
    'checks the %s of an attempted product transfer',
    async (side) => {
      const f = fixture();
      if (side === 'source') f.product.business_id = foreign;
      await expect(
        new UpdateProductUseCase(f.service).execute(
          '1',
          { business_id: side === 'source' ? own : foreign },
          f.manager,
          actor,
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(f.products.save).not.toHaveBeenCalled();
      expect(f.product.business_id).toBe(side === 'source' ? foreign : own);
    },
  );

  it('rejects a mixed bulk before writing its allowed first item or its logs', async () => {
    const f = fixture();
    await expect(
      new CreateBulkProductsUseCase(f.service).execute(
        { items: [dto, { ...dto, code: 'OTHER', business_id: foreign }] },
        f.manager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });

  it('does not authorize hundreds of bulk records through per-item database queries', async () => {
    const f = fixture();
    await new CreateBulkProductsUseCase(f.service).execute(
      {
        items: Array.from({ length: 100 }, (_, index) => ({
          ...dto,
          code: `P${index}`,
        })),
      },
      f.manager,
      actor,
    );
    expect(f.query.mock.calls.length).toBeLessThan(10);
    expect(f.products.save).toHaveBeenCalledOnce();
    expect(f.logs.save).toHaveBeenCalledOnce();
  });

  it('checks both products before reparenting a foreign historical log to an owned product', async () => {
    const f = fixture();
    await expect(
      new UpdateProductLogUseCase(f.service).execute(
        logId,
        { product_id: '1' },
        f.manager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.log.product_id).toBe('2');
    expect(f.logs.save).not.toHaveBeenCalled();
  });

  it('rejects mixed log creation atomically instead of saving its permitted first row', async () => {
    const f = fixture();
    await expect(
      new CreateBulkProductLogsUseCase(f.service).execute(
        { items: [fields, { ...fields, product_id: '2' }] },
        f.manager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.logs.save).not.toHaveBeenCalled();
  });

  it('rejects a bulk log transfer from an unauthorized source without mutating the loaded log', async () => {
    const f = fixture();
    await expect(
      new UpdateBulkProductLogsUseCase(f.service).execute(
        { items: [{ id: logId, product_id: '1' }] },
        f.manager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.log.product_id).toBe('2');
    expect(f.logs.save).not.toHaveBeenCalled();
  });

  it('preserves admin access to foreign log history while keeping the supplied transaction', async () => {
    const f = fixture(true);
    await new UpdateBulkProductLogsUseCase(f.service).execute(
      { items: [{ id: logId, stock: 0 }] },
      f.manager,
      actor,
    );
    expect(f.logs.save).toHaveBeenCalledOnce();
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed and repeated log IDs before selecting targets', async () => {
    const f = fixture();
    await expect(
      new UpdateBulkProductLogsUseCase(f.service).execute(
        { items: [{ id: 'x OR true', stock: 0 }] },
        f.manager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      new UpdateBulkProductLogsUseCase(f.service).execute(
        { items: [{ id: logId }, { id: logId.toUpperCase() }] },
        f.manager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.logs.createQueryBuilder).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
});
