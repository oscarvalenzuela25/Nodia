import { readFileSync } from 'node:fs';
import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { Business } from '../../../business/entities/business.entity.js';
import { Product } from '../../../product/entities/product.entity.js';
import { ProductLog } from '../../../product/entities/product-log.entity.js';
import { Invoice } from '../../../invoice/entities/invoice.entity.js';
import { Provider } from '../../../provider/entities/provider.entity.js';
import { ProviderContact } from '../../../provider-contact/entities/provider-contact.entity.js';
import { BusinessCollaborator } from '../../../business/entities/business-collaborator.entity.js';
import { Translation } from '../../../translation/entities/translation.entity.js';
import { UserRole } from '../../../user/entities/user-role.entity.js';
import { NodiaAiToolRegistryUseCase } from '../../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import {
  createNodiaAiBusinessToolFamily,
  NODIA_AI_BUSINESS_PENDING_TOOLS,
} from '../business-tool-family.js';
import { ReadNodiaAiBusinessUseCase } from './read-nodia-ai-business.use-case.js';

const uuid = 'b0b0b0b0-0000-4000-8000-000000000001';
const now = new Date('2026-10-16T12:00:00Z');
const common = {
  id: '9007199254740993',
  is_active: true,
  created_at: now,
  updated_at: now,
};
const product = {
  ...common,
  business_id: uuid,
  provider_id: null,
  code: 'SKU',
  measurement_unit: 'unit',
  name: 'Arroz',
  cost_price: 10,
  cost_price_tax: 12,
  sale_price: 15,
  stock: 0,
  business: { owner: { password: 'synthetic-private' } },
};
const schema = readFileSync(
  new URL('../../contracts/business.schema.json', import.meta.url),
  'utf8',
);
const family = createNodiaAiBusinessToolFamily(schema);

function harness(entity: unknown = Product, row: unknown = product) {
  const authority = { current: true, visible: true, superAdmin: false, module: true };
  const qb = {
    expressionMap: { wheres: [] },
    getParameters: vi.fn(() => ({})),
    andWhere: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    innerJoinAndSelect: vi.fn().mockReturnThis(),
    getCount: vi.fn(async () => 0),
    getOne: vi.fn(async () => row),
    getExists: vi.fn(async () => true),
    getManyAndCount: vi.fn(async () => [[row], 1]),
  };
  const main = {
    createQueryBuilder: vi.fn(() => qb),
    findOne: vi.fn(async () => row),
    existsBy: vi.fn(async () => true),
    find: vi.fn(async () => []),
    findOneBy: vi.fn(async () => null),
  };
  const role = {
    createQueryBuilder: vi.fn(() => ({
      ...qb,
      getCount: vi.fn(async () => 0),
    })),
  };
  const collaboration = { findOne: vi.fn(async () => null) };
  const translation = { find: vi.fn(async () => []) };
  const manager = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('WITH actor AS')) return [{actor_active: authority.current, allowed: authority.module}];
      if (sql.startsWith('SELECT u.id')) return authority.current ? [{
        actorId: '7', sessionId: '11111111-1111-4111-8111-111111111111', isSuperAdmin: authority.superAdmin,
      }] : [];
      if (sql.startsWith('SELECT business.id::text'))
        return authority.visible ? [{ id: uuid }] : [];
      if (sql.startsWith('SELECT resource.id::text'))
        return authority.visible ? [{ id: String((row as { id: string }).id) }] : [];
      return [];
    }),
    queryRunner: { isTransactionActive: true },
    getRepository: vi.fn((target: unknown) =>
      target === entity
        ? main
        : target === UserRole
          ? role
          : target === BusinessCollaborator
            ? collaboration
            : target === Translation
              ? translation
              : main,
    ),
  } as unknown as EntityManager;
  Object.assign(main, { manager });
  const context: NodiaAiToolHandlerContext = {
    manager,
    actor: {
      actorId: '7',
      sessionId: '11111111-1111-4111-8111-111111111111',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/business'],
  };
  return { qb, main, context, manager, collaboration, translation, authority };
}

describe('AI-15 Negocios reads', () => {
  const uc = new ReadNodiaAiBusinessUseCase();
  it('rejects a destination module revoked after a prior grant before returning product data', async () => {
    const f = harness();
    f.authority.module = false;
    await expect(uc.execute('products_get', {id: product.id}, f.context)).rejects.toThrow('core:module_access_required');
  });
  it('registers only local reads and keeps external/artifact operations gated', () => {
    const registry = new NodiaAiToolRegistryUseCase([family], 'fixture_v1');
    expect(registry.list(['/business'])).toHaveLength(12);
    const changed = new Set([
      'nodia_products_get', 'nodia_products_list',
      'nodia_product_logs_get', 'nodia_product_logs_list', 'nodia_product_logs_query',
    ]);
    for (const tool of registry.list(['/business']))
      expect(tool.revision).toBe(changed.has(tool.toolName) ? 3 : 2);
    expect(registry.list(['/business']).filter((tool) => tool.revision === 3)).toHaveLength(5);
    expect(
      new Set(registry.list(['/business']).map((tool) => tool.kind)),
    ).toEqual(new Set(['read']));
    for (const gate of NODIA_AI_BUSINESS_PENDING_TOOLS)
      expect(registry.get(gate.toolName)).toBeUndefined();
  });
  it('preserves bigint identities, zero stock and explicit projections without private relations', async () => {
    const { context, qb } = harness();
    const result = await uc.execute('products_get', { id: common.id }, context);
    expect(qb.where).toHaveBeenCalledWith('product.id = :productId', { productId: common.id });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('business_collaborators'),
      { businessAccessUserId: '7' });
    expect(result.data).toMatchObject({
      id: common.id,
      stock: 0,
      provider_id: null,
      created_at: now.toISOString(),
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-private');
    expect(JSON.stringify(result)).not.toContain('business"');
  });
  it('uses the checkpoint repository, bounded pagination and active as the initial criterion', async () => {
    const { context, qb } = harness();
    await uc.execute('products_list', {}, context);
    expect(context.manager.getRepository).toHaveBeenCalledWith(Product);
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(25);
    expect(qb.andWhere).toHaveBeenCalledWith('product.is_active = :ransack_0', {
      ransack_0: true,
    });
  });
  it('supports explicit inactive and all without silently restoring active', async () => {
    const inactive = harness();
    await uc.execute(
      'products_list',
      { activity: 'inactive' },
      inactive.context,
    );
    expect(inactive.qb.andWhere).toHaveBeenCalledWith(
      'product.is_active = :ransack_0',
      { ransack_0: false },
    );
    const all = harness();
    await uc.execute('products_list', { activity: 'all' }, all.context);
    expect(all.qb.andWhere).not.toHaveBeenCalledWith('product.is_active = :ransack_0', expect.anything());
    expect(all.qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('business_collaborators'),
      { businessAccessUserId: '7' });
  });
  it('stabilizes equal-value pages without overriding an explicit descending ID sort', async () => {
    const sorted = harness();
    await uc.execute(
      'products_list',
      { q: { s: 'created_at desc' } },
      sorted.context,
    );
    expect(sorted.qb.addOrderBy).toHaveBeenCalledWith('product.id', 'ASC');
    const byId = harness();
    await uc.execute('products_list', { q: { s: 'id desc' } }, byId.context);
    expect(byId.qb.addOrderBy).toHaveBeenCalledWith('product.id', 'DESC');
    expect(byId.qb.addOrderBy).not.toHaveBeenCalledWith('product.id', 'ASC');
  });
  it('passes product-log query lists through the existing domain UC and preserves UUID snapshots', async () => {
    const log = { ...product, id: uuid, product_id: common.id };
    const { context, qb } = harness(ProductLog, log);
    const result = await uc.execute(
      'product_logs_query',
      { product_ids: [common.id], codes: ['SKU'] },
      context,
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'product_log.product_id IN (:...ransack_0)',
      { ransack_0: [common.id] },
    );
    expect(result.data).toEqual([
      expect.objectContaining({ id: uuid, product_id: common.id }),
    ]);
  });
  it('does not expose invoice storage keys or arbitrary extracted JSON', async () => {
    const { context } = harness(Invoice, {
      ...common,
      business_id: uuid,
      provider_id: null,
      code: 'INV',
      total_amount: 0,
      path_storage: 'private/object',
      data: { issue_date: '2026-10-01', private: 'not-public' },
    });
    const result = await uc.execute('invoices_get', { id: common.id }, context);
    expect(result.data).toMatchObject({
      total_amount: 0,
      has_file: true,
      issue_date: '2026-10-01',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private|path_storage|not-public/,
    );
  });
  it('keeps supplier tax zero and omits uncontracted mapping JSON', async () => {
    const { context } = harness(Provider, {
      ...common,
      business_id: uuid,
      name: 'Supplier',
      tax: 0,
      fields: { arbitrary: 'instructions' },
    });
    const result = await uc.execute(
      'providers_get',
      { id: common.id },
      context,
    );
    expect(result.data).toMatchObject({ tax: 0 });
    expect(JSON.stringify(result)).not.toContain('instructions');
  });
  it('validates public results against their own contract, including absence and invalid historical values', async () => {
    const registry = new NodiaAiToolRegistryUseCase([family], 'fixture_v1');
    const { context } = harness();
    const result = await uc.execute('products_get', { id: common.id }, context);
    const tool = registry.get('nodia_products_get')!;
    expect(registry.validateOutput(tool, result)).toEqual(result);
    expect(() =>
      registry.validateOutput(tool, {
        data: { ...(result.data as object), stock: null },
      }),
    ).toThrow();
    expect(() =>
      registry.validateOutput(tool, {
        data: { ...(result.data as object), secret: 'forbidden' },
      }),
    ).toThrow();
    expect(() =>
      registry.validateOutput(tool, {
        data: { ...(result.data as object), sale_price: '15' },
      }),
    ).toThrow();
  });
  it('keeps nullable supplier identifiers and explicit measurement units in product and log reads', async () => {
    const registry = new NodiaAiToolRegistryUseCase([family], 'fixture_v1');
    const current = harness(Product, { ...product, code: null, measurement_unit: 'kg' });
    const result = await uc.execute('products_get', { id: common.id }, current.context);
    expect(result.data).toMatchObject({ code: null, measurement_unit: 'kg' });
    const tool = registry.get('nodia_products_get')!;
    expect(registry.validateOutput(tool, result)).toEqual(result);
    for (const measurement_unit of [null, 'mg', 'l', 'ml', 'm'])
      expect(() => registry.validateOutput(tool, { data: { ...(result.data as object), measurement_unit } })).toThrow();
    const historical = harness(ProductLog, { ...product, id: uuid, product_id: common.id, code: null, measurement_unit: 'bundle' });
    const snapshot = await uc.execute('product_logs_get', { id: uuid }, historical.context);
    expect(snapshot.data).toMatchObject({ code: null, measurement_unit: 'bundle' });
    expect(registry.validateOutput(registry.get('nodia_product_logs_get')!, snapshot)).toEqual(snapshot);
  });
  it('validates UUID identities and bounded query input without coercing numeric strings', () => {
    const registry = new NodiaAiToolRegistryUseCase([family], 'fixture_v1');
    const get = registry.get('nodia_product_logs_get')!;
    expect(registry.validateInput(get, { id: uuid })).toEqual({ id: uuid });
    const list = registry.get('nodia_products_list')!;
    expect(() => registry.validateInput(list, { limit: '10' })).toThrow();
    expect(
      registry.validateInput(list, {
        activity: 'all',
        q: { stock_gteq: 0, provider_id_null: true },
      }),
    ).toEqual({
      activity: 'all',
      q: { stock_gteq: 0, provider_id_null: true },
    });
  });
  it('rechecks business membership without reading unbounded summaries or owner relations', async () => {
    const { context, main } = harness(Business, {
      ...common,
      id: uuid,
      owner_id: '7',
      name: 'Own',
      has_description: false,
    });
    await uc.verifyAuthority('businesses_get', { id: uuid }, context);
    expect(main.findOne).toHaveBeenCalledWith({
      where: { id: uuid },
      relations: undefined,
    });
    expect(main.find).not.toHaveBeenCalled();
    expect(context.manager.getRepository).toHaveBeenCalledWith(Translation);
  });
  it('rejects a business get after collaboration revocation', async () => {
    const { context } = harness(Business, {
      ...common,
      id: uuid,
      owner_id: '8',
      name: 'Other',
      has_description: false,
    });
    await expect(
      uc.verifyAuthority('businesses_get', { id: uuid }, context),
    ).rejects.toThrow('You do not have access');
  });
  it('rejects cached business-list rows whose membership was revoked', async () => {
    const { context, qb } = harness(Business);
    qb.getCount.mockResolvedValueOnce(0);
    await expect(
      uc.verifyResultAuthority(
        'businesses_list',
        {},
        { data: [{ id: uuid }] },
        context,
      ),
    ).rejects.toThrow('business_scope_not_allowed');
    expect(qb.where).toHaveBeenCalledWith('business.id IN (:...ids)', {
      ids: [uuid],
    });
  });
  it('rejects a cached detail with another identity or contacts from a different supplier', async () => {
    const { context } = harness(Business, {
      ...common, id: uuid, owner_id: '7', name: 'Own', has_description: false,
    });
    await expect(
      uc.verifyResultAuthority(
        'businesses_get',
        { id: uuid.toUpperCase() },
        { data: { id: uuid } },
        context,
      ),
    ).resolves.toBeUndefined();
    await expect(
      uc.verifyResultAuthority(
        'businesses_get',
        { id: uuid },
        { data: { id: 'other' } },
        context,
      ),
    ).rejects.toThrow('business_result_scope_invalid');
    await expect(
      uc.verifyResultAuthority(
        'provider_contacts_list',
        { provider_id: '1' },
        { data: [{ id: '1', provider_id: '2' }] },
        context,
      ),
    ).rejects.toThrow('business_result_scope_invalid');
  });
  it('rechecks product business visibility before reusing a cached detail', async () => {
    const { context, authority } = harness();
    await expect(
      uc.verifyAuthority('products_get', { id: common.id }, context),
    ).resolves.toBeUndefined();
    expect(context.manager.getRepository).not.toHaveBeenCalled();
    authority.visible = false;
    await expect(uc.verifyAuthority('products_get', { id: common.id }, context))
      .rejects.toThrow('business:resource_not_found');
  });
  it.each([
    'products_list', 'providers_list', 'invoices_list', 'product_logs_list', 'provider_contacts_list',
  ] as const)('rejects cached %s after collaboration revocation and rechecks current administrator authority', async (operation) => {
    const id = operation === 'product_logs_list' ? uuid : common.id;
    const f = harness(Product, { id });
    const input = operation === 'provider_contacts_list' ? { provider_id: '1' } : {};
    const result = { data: [{ id, ...(operation === 'provider_contacts_list' ? { provider_id: '1' } : {}) }] };
    await expect(uc.verifyResultAuthority(operation, input, result, f.context)).resolves.toBeUndefined();
    f.authority.visible = false;
    await expect(uc.verifyResultAuthority(operation, input, result, f.context))
      .rejects.toThrow('business:resource_not_found');
    // DB role and visible-row boundaries change; the cached/client actor flag remains false.
    f.authority.superAdmin = true;
    f.authority.visible = true;
    await expect(uc.verifyResultAuthority(operation, input, result, f.context)).resolves.toBeUndefined();
    expect(f.manager.query).toHaveBeenLastCalledWith(expect.stringContaining('SELECT resource.id::text'),
      [[id], '7', true]);
    f.authority.current = false;
    await expect(uc.verifyResultAuthority(operation, input, result, f.context)).rejects.toThrow('session_expired');
  });
  it.each(['products_get', 'providers_get', 'invoices_get', 'product_logs_get'] as const)(
    'rejects cached %s after its current business visibility is removed', async (operation) => {
      const id = operation === 'product_logs_get' ? uuid : common.id;
      const f = harness(Product, { id });
      f.authority.visible = false;
      await expect(uc.verifyResultAuthority(operation, { id }, { data: { id } }, f.context))
        .rejects.toThrow('business:resource_not_found');
    },
  );
  it('requires the destination module and forbids all-business scope for an ordinary actor', async () => {
    const { context } = harness();
    await expect(
      uc.verifyAuthority('businesses_list', { all_businesses: true }, context),
    ).rejects.toThrow('business_scope_not_allowed');
    await expect(
      uc.verifyAuthority(
        'products_get',
        { id: common.id },
        { ...context, moduleRoutes: [] },
      ),
    ).rejects.toThrow('module_not_allowed');
  });
  it('checks PostgreSQL bigint overflow before any domain query', async () => {
    const { context } = harness();
    await expect(
      uc.execute(
        'products_list',
        { q: { provider_id_in: ['9223372036854775808'] } },
        context,
      ),
    ).rejects.toThrow('identifier_out_of_range');
    expect(context.manager.getRepository).not.toHaveBeenCalled();
  });
  it('does not call SQL after cancellation', async () => {
    const { context } = harness();
    const controller = new AbortController();
    controller.abort();
    await expect(
      uc.execute(
        'products_list',
        {},
        { ...context, signal: controller.signal },
      ),
    ).rejects.toThrow();
    expect(context.manager.getRepository).not.toHaveBeenCalled();
  });
  it('requires an inherited checkpoint transaction before reading', async () => {
    const { context } = harness();
    await expect(
      uc.execute(
        'products_list',
        {},
        {
          ...context,
          manager: {
            ...context.manager,
            queryRunner: undefined,
          } as unknown as EntityManager,
        },
      ),
    ).rejects.toThrow('authorization:transaction_required');
  });
  it('applies contact activity in the shared domain reader without returning idempotency metadata', async () => {
    const { context, qb } = harness(ProviderContact, {
      ...common,
      provider_id: '1',
      name: 'Contact',
      phone: [],
      schedule: {},
      email: null,
      description: null,
      version: 1,
      creation_key: 'private',
    });
    const result = await uc.execute(
      'provider_contacts_list',
      { provider_id: '1' },
      context,
    );
    expect(qb.andWhere).toHaveBeenCalledWith('contact.is_active = :isActive', {
      isActive: true,
    });
    expect(JSON.stringify(result)).not.toContain('creation_key');
  });
  it.each([
    ['nodia_products_list', { all: true }],
    ['nodia_products_list', { limit: 101 }],
    ['nodia_products_list', { q: { unknown_eq: 'x' } }],
    ['nodia_products_list', { q: { s: 'name desc; DROP TABLE products' } }],
    ['nodia_products_list', { q: { stock_status_in: ['invented'] } }],
    ['nodia_product_logs_get', { id: '1' }],
    ['nodia_invoices_list', { q: { path_storage_cont: 'private' } }],
  ])(
    'rejects unbounded, private or incompatible input %s %j',
    (name, input) => {
      const registry = new NodiaAiToolRegistryUseCase([family], 'fixture_v1');
      expect(() =>
        registry.validateInput(registry.get(name)!, input),
      ).toThrow();
    },
  );
});
