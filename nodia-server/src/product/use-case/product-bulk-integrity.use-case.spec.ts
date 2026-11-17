import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { ProductService } from '../product.service.js';
import { Product } from '../entities/product.entity.js';
import { ProductLog } from '../entities/product-log.entity.js';
import { CreateBulkProductsUseCase } from './create-bulk-products.use-case.js';
import { UpdateBulkProductsUseCase } from './update-bulk-products.use-case.js';
import { normalizeOcrProducts } from '../ocr-confirmation-products.js';
const businessA = '11111111-1111-4111-8111-111111111111';
const businessB = '11111111-1111-4111-8111-111111111112';
const actor = {
  userId: '12',
  sessionId: '11111111-1111-4111-8111-111111111113',
};
const base = {
  business_id: businessA,
  provider_id: '7',
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
  const records = new Map(
    ['2', '10'].map((id) => [
      id,
      Object.assign(new Product(), { ...base, id, version: 1, code: `P-${id}` }),
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
    create: vi.fn((items: object | object[]) => {
      if (!Array.isArray(items)) return Object.assign(new Product(), { ...items, id: '20' });
      return items.map((item, index) =>
        Object.assign(new Product(), { ...item, id: String(index + 20) }),
      );
    }),
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
    if (sql.includes('AS authority_locks')) return [{ authority_locks: 9 }];
    if (sql.includes('AS "actorId"'))
      return [
        {
          actorId: actor.userId,
          sessionId: actor.sessionId,
          isSuperAdmin: true,
        },
      ];
    if (sql.includes('FROM businesses business'))
      return (args[0] as string[]).map((id) => ({ id }));
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
    if (sql.includes('FROM products p'))
      return (args[0] as string[]).flatMap((id) => {
        const product = records.get(id);
        return product ? [{ id, business_id: product.business_id, provider_id: product.provider_id }] : [];
      });
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
    { execute: vi.fn(async () => undefined) } as unknown as ConstructorParameters<typeof ProductService>[2],
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
  it('normalizes each explicit bulk price and its snapshot while preserving omitted values', async () => {
    const f = fixture();
    const created = await f.service.createBulkProducts({ items: [{ ...base, sale_price: 1444 }, { ...base, code: 'P2', sale_price: 1445 }] }, f.manager, actor);
    expect(created.map(product => product.sale_price)).toEqual([1440, 1450]);
    expect(f.logs.save).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ sale_price: 1440 }), expect.objectContaining({ sale_price: 1450 })]));
    const updated = await f.service.updateBulkProducts({ items: [{ id: '2', sale_price: 1445 }, { id: '10', name: 'Retain historical price' }] }, f.manager, actor);
    expect(updated.map(product => product.sale_price)).toEqual([1450, 4]);
  });

  it('keeps input/output order when several products have no supplier code', async () => {
    const f = fixture();
    const result = await f.service.createBulkProducts({ items: [
      { ...base, name: 'First', code: null, measurement_unit: 'kg' },
      { ...base, name: 'Second', code: '  ', measurement_unit: 'g' },
    ] }, f.manager, actor);
    expect(result.map(({ id, name, code, measurement_unit }) => ({ id, name, code, measurement_unit }))).toEqual([
      { id: '20', name: 'First', code: null, measurement_unit: 'kg' },
      { id: '21', name: 'Second', code: null, measurement_unit: 'g' },
    ]);
    expect(f.logs.save).toHaveBeenCalledWith([
      expect.objectContaining({ product_id: '20', name: 'First', code: null, measurement_unit: 'kg' }),
      expect.objectContaining({ product_id: '21', name: 'Second', code: null, measurement_unit: 'g' }),
    ]);
  });
  it('validates all references before creating any record and uses one transaction for products and derived logs', async () => {
    const f = fixture();
    const result = await new CreateBulkProductsUseCase(f.service).execute(
      {
        items: [{ ...base, business_id: businessB, provider_id: '8' }, base],
      },
      undefined,
      actor,
    );
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
    const relationReads = f.query.mock.calls.filter(
      ([sql]) =>
        sql.includes('FROM businesses WHERE') || sql.includes('FROM providers'),
    );
    expect(relationReads[0][1]).toEqual([[businessA, businessB]]);
    expect(relationReads[1][1]).toEqual([['7', '8']]);
    expect(relationReads.every(([sql]) => sql.includes('FOR SHARE'))).toBe(
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
      new CreateBulkProductsUseCase(f.service).execute(
        {
          items: [base, { ...base, code: 'P2', provider_id: '8' }],
        },
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('locks product PKs numerically in ascending order but preserves caller response order and omitted current values', async () => {
    const f = fixture();
    const result = await new UpdateBulkProductsUseCase(f.service).execute(
      {
        items: [
          { id: '10', stock: 0 },
          { id: '2', name: 'Edited', is_active: false },
        ],
      },
      undefined,
      actor,
    );
    expect(f.calls).toEqual([
      'businesses',
      'providers',
      'product:2',
      'product:10',
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
      new UpdateBulkProductsUseCase(f.service).execute(
        {
          items: [
            { id: '2', name: 'Should not persist' },
            { id: '10', business_id: businessB },
          ],
        },
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.records.get('2')?.name).toBe('Product');
    expect(f.records.get('10')?.business_id).toBe(businessA);
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('allows an explicit coherent transfer with a replacement provider and preserves null for an explicit unlink', async () => {
    const f = fixture();
    const result = await new UpdateBulkProductsUseCase(f.service).execute(
      {
        items: [
          { id: '2', business_id: businessB, provider_id: '8' },
          { id: '10', provider_id: null },
        ],
      },
      undefined,
      actor,
    );
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
      new UpdateBulkProductsUseCase(f.service).execute(
        {
          items: [{ id: '2', name: 'Race candidate' }],
        },
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.products.save).not.toHaveBeenCalled();
  });
  it('rejects a relationship change between lookup and the ordered product lock', async () => {
    const f = fixture();
    const product = f.records.get('2')!;
    f.selection.getMany.mockResolvedValueOnce([Object.assign(new Product(), product, { provider_id: null })]);
    await expect(
      f.service.updateProduct('2', { name: 'Race candidate' }, f.manager, actor),
    ).rejects.toThrow('product:version_conflict');
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('prepares OCR products and writes derived logs through the supplied transaction in input order', async () => {
    const f = fixture();
    f.providers.push({ id: '9', business_id: businessA });
    const existing = f.records.get('10')!;
    Object.assign(existing, { has_stock: null, is_active: false });
    const line = { invoice_code: null, name: 'Revisado', alias: 'Alias', alias_reviewed: true, cost_price: 3, quantity: 2.5 };
    const fields = { code: 'New', name: 'Revisado', alias: 'Alias', cost_price: 3, cost_price_tax: 4, sale_price: 15, is_active: true };
    const items = normalizeOcrProducts([
      { kind: 'manual_match', line, product_id: '10', expected_version: 1, changes: { sale_price: 105 } },
      { kind: 'create', line, product: fields },
      { kind: 'update', line, product_id: '2', expected_version: 1, product: { ...fields, code: 'Updated' } },
    ]);
    const write = await f.service.prepareOcrConfirmation(f.manager, businessA, '9', items, actor);
    expect(f.calls).toEqual(['businesses', 'providers', 'product:2', 'product:10']);
    expect(f.query.mock.calls.find(([sql]) => sql.includes('FROM providers'))?.[1])
      .toEqual([['7', '9']]);
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
    expect(await write()).toEqual([{ id: '10', version: 2 }, { id: '20', version: 1 }, { id: '2', version: 2 }]);
    expect(f.products.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: '10', provider_id: '7', is_active: false, has_stock: null, stock: 5, sale_price: 110 }),
      expect.objectContaining({ id: '20', provider_id: '9', has_stock: true, stock: 0, sale_price: 20 }),
      expect.objectContaining({ id: '2', provider_id: '9', has_stock: true, stock: 5, sale_price: 20 }),
    ]);
    expect(f.logs.save).toHaveBeenCalledWith([
      expect.objectContaining({ product_id: '10', changed_fields: ['sale_price'], product_version: 2, actor_id: actor.userId }),
      expect.objectContaining({ product_id: '20', source: 'create', product_version: 1 }),
      expect.objectContaining({ product_id: '2', source: 'update', product_version: 2 }),
    ]);
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it('propagates derived-log failure to the same transaction', async () => {
    const f = fixture();
    f.logs.save.mockRejectedValue(new Error('derived log unavailable'));
    await expect(
      new CreateBulkProductsUseCase(f.service).execute(
        { items: [base] },
        undefined,
        actor,
      ),
    ).rejects.toThrow('derived log unavailable');
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects duplicate logical targets and missing records before any effect', async () => {
    const f = fixture();
    await expect(
      new UpdateBulkProductsUseCase(f.service).execute(
        {
          items: [
            { id: '2', stock: 0 },
            { id: '02', stock: 9 },
          ],
        },
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.products.findOne).not.toHaveBeenCalled();
    await expect(
      new UpdateBulkProductsUseCase(f.service).execute(
        {
          items: [
            { id: '2', stock: 0 },
            { id: '30', stock: 9 },
          ],
        },
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(f.products.save).not.toHaveBeenCalled();
    expect(f.logs.save).not.toHaveBeenCalled();
  });
  it('refuses a supplied manager outside a transaction and never opens a second transaction when valid', async () => {
    const f = fixture();
    await expect(
      new CreateBulkProductsUseCase(f.service).execute(
        { items: [base] },
        {
          ...f.manager,
          queryRunner: { isTransactionActive: false },
        } as unknown as EntityManager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await new CreateBulkProductsUseCase(f.service).execute(
      { items: [base] },
      f.manager,
      actor,
    );
    expect(f.transaction).not.toHaveBeenCalled();
  });
});
