import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { ProductService } from '../product.service.js';
import { Product } from '../entities/product.entity.js';
import { ProductLog } from '../entities/product-log.entity.js';
import { CreateBulkProductsUseCase } from './create-bulk-products.use-case.js';
import { UpdateBulkProductsUseCase } from './update-bulk-products.use-case.js';
const businessA = '11111111-1111-4111-8111-111111111111';
const businessB = '11111111-1111-4111-8111-111111111112';
const base = {
  business_id: businessA,
  provider_id: '7',
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
  const records = new Map(
    ['2', '10'].map((id) => [
      id,
      Object.assign(new Product(), { ...base, id, code: `P-${id}` }),
    ]),
  );
  const calls: string[] = [];
  const providers = [
    { id: '7', business_id: businessA },
    { id: '8', business_id: businessB },
  ];
  let selectedIds: string[] = [];
  const selection = {
    where: vi.fn((_sql: string, parameters: { ids: string[] }) => {
      selectedIds = parameters.ids;
      return selection;
    }),
    orderBy: vi.fn(() => selection),
    setLock: vi.fn(() => selection),
    getMany: vi.fn(async () =>
      [...selectedIds]
        .sort((a, b) =>
          BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
        )
        .flatMap((id) => {
          calls.push(`product:${id}`);
          return records.has(id) ? [records.get(id)!] : [];
        }),
    ),
  };
  const products = {
    createQueryBuilder: vi.fn(() => selection),
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => {
      calls.push(`product:${where.id}`);
      return records.get(where.id) ?? null;
    }),
    create: vi.fn((items: object[]) =>
      items.map((item, index) =>
        Object.assign(new Product(), { ...item, id: String(index + 20) }),
      ),
    ),
    save: vi.fn(async (items: Product[]) => {
      calls.push('save-products');
      return items;
    }),
  };
  const logs = {
    create: vi.fn((item: object) => Object.assign(new ProductLog(), item)),
    save: vi.fn(async (items: ProductLog[]) => {
      calls.push('save-logs');
      return items;
    }),
  };
  const query = vi.fn(async (sql: string, args: unknown[]) => {
    if (sql.includes('FROM businesses')) {
      calls.push('businesses');
      return (args[0] as string[]).map((id) => ({ id }));
    }
    if (sql.includes('FROM providers')) {
      calls.push('providers');
      return providers.filter((provider) =>
        (args[0] as string[]).includes(provider.id),
      );
    }
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
    getRepository: vi.fn((entity: unknown) =>
      entity === Product ? products : logs,
    ),
  } as unknown as EntityManager;
  const transaction = vi.fn(
    async (work: (tx: EntityManager) => Promise<unknown>) => work(manager),
  );
  const globalProduct = {
    manager: { transaction },
    save: vi.fn(() => {
      throw new Error('global writes forbidden');
    }),
  };
  const globalLog = {
    save: vi.fn(() => {
      throw new Error('global writes forbidden');
    }),
  };
  const service = new ProductService(
    globalProduct as unknown as ConstructorParameters<typeof ProductService>[0],
    globalLog as unknown as ConstructorParameters<typeof ProductService>[1],
  );
  return {
    service,
    manager,
    transaction,
    products,
    logs,
    records,
    providers,
    calls,
    query,
    selection,
    globalProduct,
    globalLog,
  };
}
describe('Legacy product bulk relation integrity through native use cases', () => {
  it('validates all references before creating any record and uses one transaction for products and derived logs', async () => {
    const f = fixture();
    const result = await new CreateBulkProductsUseCase(f.service).execute({
      items: [{ ...base, business_id: businessB, provider_id: '8' }, base],
    });
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(result.map((item) => item.business_id)).toEqual([
      businessB,
      businessA,
    ]);
    expect(f.calls).toEqual([
      'businesses',
      'providers',
      'save-products',
      'save-logs',
    ]);
    expect(f.query.mock.calls[0][1]).toEqual([[businessA, businessB]]);
    expect(f.query.mock.calls[1][1]).toEqual([['7', '8']]);
    expect(f.query.mock.calls.every(([sql]) => sql.includes('FOR SHARE'))).toBe(
      true,
    );
    expect(f.logs.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ product_id: result[0].id, stock: 5 }),
      ]),
    );
    expect(f.globalProduct.save).not.toHaveBeenCalled();
    expect(f.globalLog.save).not.toHaveBeenCalled();
  });
  it('rejects a mismatched provider in any create item before persisting the otherwise valid first item', async () => {
    const f = fixture();
    await expect(
      new CreateBulkProductsUseCase(f.service).execute({
        items: [base, { ...base, code: 'P2', provider_id: '8' }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('locks product PKs numerically in ascending order but preserves caller response order and omitted current values', async () => {
    const f = fixture();
    const result = await new UpdateBulkProductsUseCase(f.service).execute({
      items: [
        { id: '10', stock: 0 },
        { id: '2', name: 'Edited', is_active: false },
      ],
    });
    expect(f.calls).toEqual([
      'product:2',
      'product:10',
      'businesses',
      'providers',
      'save-products',
      'save-logs',
    ]);
    expect(result.map((item) => item.id)).toEqual(['10', '2']);
    expect(result[1]).toMatchObject({
      name: 'Edited',
      stock: 5,
      is_active: false,
      sale_price: 4,
    });
    expect(f.products.findOne).not.toHaveBeenCalled();
    expect(f.products.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(f.selection.where).toHaveBeenCalledWith('product.id IN (:...ids)', {
      ids: ['10', '2'],
    });
    expect(f.selection.orderBy).toHaveBeenCalledWith('product.id', 'ASC');
    expect(f.selection.setLock).toHaveBeenCalledWith('pessimistic_write');
  });
  it('rejects a mismatched update without mutating another loaded entity or creating a derived log', async () => {
    const f = fixture();
    await expect(
      new UpdateBulkProductsUseCase(f.service).execute({
        items: [
          { id: '2', name: 'Should not persist' },
          { id: '10', business_id: businessB },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.records.get('2')?.name).toBe('Product');
    expect(f.records.get('10')?.business_id).toBe(businessA);
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('allows an explicit coherent transfer with a replacement provider and preserves null for an explicit unlink', async () => {
    const f = fixture();
    const result = await new UpdateBulkProductsUseCase(f.service).execute({
      items: [
        { id: '2', business_id: businessB, provider_id: '8' },
        { id: '10', provider_id: null },
      ],
    });
    expect(result[0]).toMatchObject({
      business_id: businessB,
      provider_id: '8',
    });
    expect(result[1].provider_id).toBeNull();
  });
  it('rechecks the provider business returned after acquiring its lock rather than trusting the pre-lock association', async () => {
    const f = fixture();
    f.providers[0].business_id = businessB;
    await expect(
      new UpdateBulkProductsUseCase(f.service).execute({
        items: [{ id: '2', name: 'Race candidate' }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.products.save).not.toHaveBeenCalled();
  });
  it('propagates derived-log failure to the same transaction', async () => {
    const f = fixture();
    f.logs.save.mockRejectedValue(new Error('derived log unavailable'));
    await expect(
      new CreateBulkProductsUseCase(f.service).execute({ items: [base] }),
    ).rejects.toThrow('derived log unavailable');
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects duplicate logical targets and missing records before any effect', async () => {
    const f = fixture();
    await expect(
      new UpdateBulkProductsUseCase(f.service).execute({
        items: [
          { id: '2', stock: 0 },
          { id: '02', stock: 9 },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.products.findOne).not.toHaveBeenCalled();
    await expect(
      new UpdateBulkProductsUseCase(f.service).execute({
        items: [
          { id: '2', stock: 0 },
          { id: '30', stock: 9 },
        ],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('refuses a supplied manager outside a transaction and never opens a second transaction when valid', async () => {
    const f = fixture();
    await expect(
      new CreateBulkProductsUseCase(f.service).execute({ items: [base] }, {
        ...f.manager,
        queryRunner: { isTransactionActive: false },
      } as unknown as EntityManager),
    ).rejects.toMatchObject({ status: 400 });
    await new CreateBulkProductsUseCase(f.service).execute(
      { items: [base] },
      f.manager,
    );
    expect(f.transaction).not.toHaveBeenCalled();
  });
});
