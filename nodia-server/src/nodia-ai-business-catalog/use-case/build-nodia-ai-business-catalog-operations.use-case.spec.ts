import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiNativeOperation } from '../../nodia-ai-proposal/types/native-operation.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { NodiaAiBusinessCatalogService } from '../nodia-ai-business-catalog.service.js';
import { BuildNodiaAiBusinessCatalogOperationsUseCase } from './build-nodia-ai-business-catalog-operations.use-case.js';
const businessId = '11111111-1111-4111-8111-111111111111';
const otherBusiness = '11111111-1111-4111-8111-111111111112';
const logId = '11111111-1111-4111-8111-111111111113';
const prices = {
  code: 'A-1',
  name: 'Article',
  cost_price: 10,
  cost_price_tax: 12,
  profit_percentage: 20,
  sale_price: 20,
  stock: 8,
};
function fixture() {
  let authenticated = true;
  let superAdmin = false;
  let duplicate = false;
  let missing = false;
  const business: NodiaAiJsonObject = {
    id: businessId,
    owner_id: '1',
    name: 'Business',
    is_active: true,
    has_description: true,
    updated_at: '2026-10-17 00:00:00.123456',
  };
  const product: NodiaAiJsonObject = {
    id: '3',
    business_id: businessId,
    provider_id: '4',
    ...prices,
    is_active: true,
    updated_at: '2026-10-17 00:00:00.123456',
  };
  const log: NodiaAiJsonObject = {
    id: logId,
    product_id: '3',
    ...prices,
    updated_at: '2026-10-17 00:00:00.123456',
  };
  const provider: NodiaAiJsonObject = {
    id: '4',
    business_id: businessId,
    name: 'Supplier',
    is_active: true,
    updated_at: '2026-10-17 00:00:00.123456',
  };
  const translations: NodiaAiJsonObject[] = [
    {
      id: '8',
      source_key: 'description',
      locale: 'es',
      value: 'Old',
      is_active: true,
      updated_at: 'same',
    },
  ];
  const collaborators: NodiaAiJsonObject[] = [
    {
      id: '9',
      user_id: '2',
      position: 'Cashier',
      action_ids: ['7'],
      is_active: true,
      updated_at: 'same',
    },
  ];
  const users: NodiaAiJsonObject[] = [
    { id: '2', is_active: true, updated_at: 'same' },
  ];
  const actions: NodiaAiJsonObject[] = [
    { id: '7', key: 'products:edit', is_active: true, updated_at: 'same' },
  ];
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith('SELECT u.id'))
      return authenticated
        ? [{ actorId: '1', sessionId: businessId, isSuperAdmin: superAdmin }]
        : [];
    if (sql.startsWith('SELECT EXISTS')) return [{ exists: duplicate }];
    if (sql.includes('FROM business_collaborators'))
      return structuredClone(collaborators);
    if (sql.includes('FROM businesses'))
      return args[0] === otherBusiness
        ? [{ ...business, id: otherBusiness }]
        : [structuredClone(business)];
    if (sql.includes('FROM product_logs'))
      return missing ? [] : [structuredClone(log)];
    if (sql.includes('FROM products'))
      return missing
        ? []
        : args[0] === '5'
          ? [
              {
                ...product,
                id: '5',
                business_id: otherBusiness,
                provider_id: null,
              },
            ]
          : [structuredClone(product)];
    if (sql.includes('FROM providers')) return [structuredClone(provider)];
    if (sql.includes('FROM translations')) return structuredClone(translations);
    if (sql.includes('FROM users WHERE')) return structuredClone(users);
    if (sql.includes('FROM business_actions'))
      return structuredClone(
        actions.filter((action) =>
          (args[0] as string[]).includes(String(action.id)),
        ),
      );
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const writers = Array.from({ length: 7 }, (_, index) => ({
    execute: vi.fn(async (..._args: unknown[]) => ({
      id: index < 3 ? businessId : index < 5 ? '3' : logId,
    })),
  }));
  type Params = ConstructorParameters<
    typeof BuildNodiaAiBusinessCatalogOperationsUseCase
  >;
  const factory = new BuildNodiaAiBusinessCatalogOperationsUseCase(
    new NodiaAiBusinessCatalogService(),
    writers[0] as unknown as Params[1],
    writers[1] as unknown as Params[2],
    writers[2] as unknown as Params[3],
    writers[3] as unknown as Params[4],
    writers[4] as unknown as Params[5],
    writers[5] as unknown as Params[6],
    writers[6] as unknown as Params[7],
  );
  const context: ProposalPreparerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: businessId,
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/tools/business'],
    conversationId: otherBusiness,
    maxCollectionItems: 100,
  };
  return {
    factory,
    context,
    business,
    product,
    provider,
    log,
    translations,
    collaborators,
    users,
    actions,
    writers,
    query,
    setMissing: () => {
      missing = true;
    },
    setDuplicate: () => {
      duplicate = true;
    },
    setUnauthenticated: () => {
      authenticated = false;
    },
    setSuper: () => {
      superAdmin = true;
    },
    op: (resource: string, operation = 'create') =>
      factory.operations.find(
        (item) => item.toolName === `nodia_${resource}_prepare_${operation}`,
      )!,
  };
}
async function step(
  op: NodiaAiNativeOperation,
  input: NodiaAiJsonObject,
  context: ProposalPreparerContext,
): Promise<StoredProposalStep> {
  const prepared = await op.prepare(input, context);
  if (prepared.status !== 'ready')
    throw new Error(`Expected ready: ${JSON.stringify(prepared)}`);
  return {
    ...prepared,
    id: randomUUID(),
    toolName: op.toolName,
    contractHash: op.contractHash,
    position: 1,
    outputBindings: [],
  };
}
function change(s: StoredProposalStep, key: string) {
  return (s.publicStep.changes as NodiaAiJsonObject[]).find(
    (item) => item.field_key === key,
  )!;
}
describe('AI-22 native business/catalog proposals', () => {
  it('represents every absent create-before value as null even for translation effects', async () => {
    const f = fixture();
    const s = await step(
      f.op('businesses'),
      {
        name: 'Translated',
        translates: [{ key: 'description', es: 'Detail', en: 'Detail' }],
      },
      f.context,
    );
    const changes = s.publicStep.changes as NodiaAiJsonObject[];
    expect(
      changes.some((change) => change.field_key === 'translation_effects'),
    ).toBe(true);
    for (const change of changes) {
      expect(change.before_present).toBe(false);
      expect(change.before).toBeNull();
    }
  });
  it('bounds the union of collaborator actions before querying instead of multiplying per-user limits', async () => {
    const f = fixture(); f.users.push({ id: '6', is_active: true, updated_at: 'same' });
    await expect(f.op('businesses', 'set_collaborators').prepare({ id: businessId, users: [{ user_id: '2', action_ids: ['7', '8'] }, { user_id: '6', action_ids: ['9', '10'] }] }, { ...f.context, maxCollectionItems: 2 })).rejects.toMatchObject({ status: 409 });
    expect(f.query.mock.calls.some(([sql]) => sql.includes('FROM business_actions'))).toBe(false);
  });
  it.each([255, 256])('counts Unicode code points consistently with native DTOs and PostgreSQL varchar for %s characters', async count => {
    const f = fixture(); const value = '🍽'.repeat(count);
    const cases: [NodiaAiNativeOperation, NodiaAiJsonObject][] = [
      [f.op('businesses'), { name: value }],
      [f.op('products'), { business_id: businessId, ...prices, code: value, name: value }],
      [f.op('businesses'), { name: 'Business', translates: [{ key: value, es: 'ES', en: 'EN' }] }],
      [f.op('businesses', 'set_collaborators'), { id: businessId, users: [{ user_id: '2', position: value, action_ids: ['7'] }] }],
    ];
    for (const [op, input] of cases) {
      if (count === 255) expect((await op.prepare(input, f.context)).status).toBe('ready');
      else await expect(op.prepare(input, f.context)).rejects.toMatchObject({ status: 400 });
    }
  });
  it('registers seven exact existing individual operations and no bulk or invented deletes', () => {
    const f = fixture();
    expect(f.factory.operations).toHaveLength(7);
    expect(f.factory.operations.map((op) => op.toolName)).toEqual([
      'nodia_businesses_prepare_create',
      'nodia_businesses_prepare_update',
      'nodia_businesses_prepare_set_collaborators',
      'nodia_products_prepare_create',
      'nodia_products_prepare_update',
      'nodia_product_logs_prepare_create',
      'nodia_product_logs_prepare_update',
    ]);
  });
  it('all seven previews satisfy the actual public schema, including recursive derived effects', async () => {
    const f = fixture();
    const sourceJson = readFileSync(
      new URL(
        '../../nodia-ai-tools/config/common-schema.json',
        import.meta.url,
      ),
      'utf8',
    );
    const { validate } = compileNodiaAiToolSchema({
      sourceJson,
      definition: 'PublicStep',
      sha256: createHash('sha256').update(sourceJson).digest('hex'),
    });
    const cases: [NodiaAiNativeOperation, NodiaAiJsonObject][] = [
      [f.op('businesses'), { name: 'New business' }],
      [f.op('businesses', 'update'), { id: businessId, is_active: false }],
      [
        f.op('businesses', 'set_collaborators'),
        { id: businessId, users: [{ user_id: '2', action_ids: [] }] },
      ],
      [f.op('products'), { business_id: businessId, ...prices }],
      [
        f.op('products', 'update'),
        { business_id: businessId, id: '3', sale_price: 0 },
      ],
      [
        f.op('product_logs'),
        { business_id: businessId, product_id: '3', ...prices },
      ],
      [
        f.op('product_logs', 'update'),
        { business_id: businessId, id: logId, stock: 0 },
      ],
    ];
    for (const [op, input] of cases) {
      const s = await step(op, input, f.context);
      expect(
        validate({ ...s.publicStep, step_id: s.id }),
        JSON.stringify(validate.errors),
      ).toBe(true);
    }
  });
  it('asks only the missing required product fields and accepts zero/false without treating them as missing', async () => {
    const f = fixture();
    const result = await f
      .op('products')
      .prepare(
        {
          business_id: businessId,
          name: 'New',
          code: 'N',
          cost_price: 0,
          is_active: false,
        },
        f.context,
      );
    expect(result).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['cost_price_tax', 'profit_percentage', 'sale_price'],
    });
  });
  it('merges clarification while keeping immutable original scope and target', async () => {
    const f = fixture();
    const op = f.op('products');
    const initial = await op.prepare(
      { business_id: businessId, code: 'X' },
      f.context,
    );
    if (initial.status !== 'needs_clarification') throw new Error();
    const result = await op.prepare(
      {
        name: 'X',
        cost_price: 0,
        cost_price_tax: 0,
        profit_percentage: 0,
        sale_price: 0,
      },
      f.context,
      initial.partial,
    );
    expect(result.status).toBe('ready');
    await expect(
      op.prepare({ business_id: otherBusiness }, f.context, initial.partial),
    ).rejects.toMatchObject({ status: 400 });
  });
  it.each([
    { schema_version: 1, command: {}, origins: {} },
    { origins: {} },
    { owner_id: '2', name: 'X' },
    { name: null },
    { name: undefined },
  ])(
    'rejects backend envelopes, owner spoofing and invalid optional values: %j',
    async (value) => {
      const f = fixture();
      await expect(
        f
          .op('businesses')
          .prepare(value as unknown as NodiaAiJsonObject, f.context),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it.each([-2147483649, 2147483648, 0.5, '2', null])(
    'rejects invalid native integer %j',
    async (value) => {
      const f = fixture();
      await expect(
        f
          .op('products')
          .prepare(
            { business_id: businessId, ...prices, cost_price: value },
            f.context,
          ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it.each([-2147483648, 0, 2147483647])(
    'preserves native valid integer %s and exposes exact integer edit boundaries',
    async (value) => {
      const f = fixture();
      const op = f.op('products');
      const s = await step(
        op,
        { business_id: businessId, ...prices, cost_price: value },
        f.context,
      );
      expect(change(s, 'cost_price').after).toBe(value);
      expect(
        op.reviewFields?.find((field) => field.field_key === 'cost_price'),
      ).toMatchObject({
        kind: 'integer',
        minimum: '-2147483648',
        maximum: '2147483647',
      });
    },
  );
  it('freezes complete automatic product log without resetting omitted update defaults', async () => {
    const f = fixture();
    const op = f.op('products', 'update');
    const s = await step(
      op,
      { business_id: businessId, id: '3', name: 'Renamed' },
      f.context,
    );
    expect(change(s, 'product_snapshot').after).toMatchObject({
      kind: 'object',
      fields: expect.arrayContaining([{ field_key: 'stock', value: 8 }]),
    });
    await op.executeConfirmed(s, f.context);
    expect(f.writers[4].execute.mock.calls[0]?.[1]).toEqual({
      name: 'Renamed',
    });
  });
  it('records contract defaults without inventing prices and re-prepares backend envelope only through trusted channel', async () => {
    const f = fixture();
    const op = f.op('products');
    const { stock: _stock, ...fields } = prices;
    const s = await step(op, { business_id: businessId, ...fields }, f.context);
    expect(s.commandTemplate.command).toMatchObject({
      stock: 0,
      provider_id: null,
      is_active: true,
    });
    expect(s.commandTemplate.origins).toMatchObject({
      stock: 'contract_default',
      provider_id: 'contract_default',
      is_active: 'contract_default',
    });
    expect(
      (await op.reprepareStored(s.commandTemplate, f.context)).status,
    ).toBe('ready');
  });
  it('normalizes missing business description locale in the frozen preview and derives has_description', async () => {
    const f = fixture();
    const s = await step(
      f.op('businesses'),
      {
        name: 'New business',
        translates: [{ key: 'description', es: 'Descripcion' }],
      },
      f.context,
    );
    expect(s.commandTemplate.command).toMatchObject({
      translates: [{ key: 'description', es: 'Descripcion', en: '' }],
    });
    expect(change(s, 'has_description').after).toBe(true);
  });
  it('business creation always uses authenticated actor and returns generated UUID identity', async () => {
    const f = fixture();
    const op = f.op('businesses');
    const s = await step(op, { name: 'New business' }, f.context);
    expect(s.scope).toEqual({});
    expect(await op.executeConfirmed(s, f.context)).toEqual({
      id: businessId,
      businessId,
    });
    expect(f.writers[0].execute.mock.calls[0]?.[0]).toBe('1');
  });
  it('rejects collaborators attempting owner mutations and re-reads super_admin authority', async () => {
    const f = fixture();
    f.business.owner_id = '2';
    await expect(
      f
        .op('businesses', 'update')
        .prepare({ id: businessId, name: 'X2' }, f.context),
    ).rejects.toMatchObject({ status: 403 });
    f.setSuper();
    expect(
      (
        await f
          .op('businesses', 'update')
          .prepare({ id: businessId, name: 'X2' }, f.context)
      ).status,
    ).toBe('ready');
  });
  it('global product authority intentionally does not require owner membership but requires destination module', async () => {
    const f = fixture();
    f.business.owner_id = '2';
    expect(
      (
        await f
          .op('products')
          .prepare({ business_id: businessId, ...prices }, f.context)
      ).status,
    ).toBe('ready');
    await expect(
      f
        .op('products')
        .prepare(
          { business_id: businessId, ...prices },
          { ...f.context, moduleRoutes: [] },
        ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects session revocation even with a previously trusted context', async () => {
    const f = fixture();
    const op = f.op('products', 'update');
    const s = await step(
      op,
      { business_id: businessId, id: '3', stock: 0 },
      f.context,
    );
    f.setUnauthenticated();
    await expect(op.verifyAuthority(s, f.context)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('historical product receipt authority does not require deleted or edited targets', async () => {
    const f = fixture();
    const op = f.op('products', 'update');
    const s = await step(
      op,
      { business_id: businessId, id: '3', stock: 0 },
      f.context,
    );
    f.setMissing();
    await expect(op.verifyAuthority(s, f.context)).resolves.toBeUndefined();
    await expect(op.verifyPreconditions(s, f.context)).rejects.toMatchObject({
      status: 409,
    });
  });
  it.each(['name', 'stock', 'provider_id'])(
    'detects material target %s changes even at identical timestamp',
    async (field) => {
      const f = fixture();
      const op = f.op('products', 'update');
      const s = await step(
        op,
        { business_id: businessId, id: '3', name: 'Edited' },
        f.context,
      );
      f.product[field] =
        field === 'stock' ? 99 : field === 'provider_id' ? null : 'Other';
      await expect(op.executeConfirmed(s, f.context)).rejects.toMatchObject({
        status: 409,
      });
      expect(f.writers[4].execute).not.toHaveBeenCalled();
    },
  );
  it('detects reference metadata and translation changes, not timestamps alone', async () => {
    const f = fixture();
    const op = f.op('businesses', 'update');
    const s = await step(op, { id: businessId, name: 'Edited' }, f.context);
    f.translations[0].value = 'Changed';
    await expect(op.verifyPreconditions(s, f.context)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('rejects provider from a different business and does not silently clear it when moving a product', async () => {
    const f = fixture();
    await expect(
      f
        .op('products', 'update')
        .prepare(
          {
            business_id: businessId,
            id: '3',
            command: { business_id: otherBusiness },
          },
          f.context,
        ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('supports explicit product transfer and freezes destination business separately', async () => {
    const f = fixture();
    const op = f.op('products', 'update');
    const s = await step(
      op,
      {
        business_id: businessId,
        id: '3',
        command: { business_id: otherBusiness, provider_id: null },
      },
      f.context,
    );
    expect(s.scope).toEqual({ business_id: businessId });
    expect(s.preconditions.destination_business_id).toBe(otherBusiness);
    expect(change(s, 'destination_business_id').after).toBe(otherBusiness);
    expect(await op.executeConfirmed(s, f.context)).toEqual({
      id: '3',
      businessId: otherBusiness,
    });
  });
  it('supports native log reassociation and reports actual destination instead of original scope', async () => {
    const f = fixture();
    const op = f.op('product_logs', 'update');
    const s = await step(
      op,
      { business_id: businessId, id: logId, product_id: '5' },
      f.context,
    );
    expect(s.preconditions.destination_business_id).toBe(otherBusiness);
    expect(await op.executeConfirmed(s, f.context)).toEqual({
      id: logId,
      businessId: otherBusiness,
    });
  });
  it('validates source business before updating a foreign product or log', async () => {
    const f = fixture();
    await expect(
      f
        .op('products', 'update')
        .prepare(
          { business_id: otherBusiness, id: '3', name: 'Edited' },
          f.context,
        ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('rejects duplicate create and detects a later collision as changed preconditions', async () => {
    const f = fixture();
    const op = f.op('products');
    const s = await step(op, { business_id: businessId, ...prices }, f.context);
    f.setDuplicate();
    await expect(
      op.prepare({ business_id: businessId, ...prices }, f.context),
    ).rejects.toMatchObject({ status: 409 });
    await expect(op.verifyPreconditions(s, f.context)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('shows collaborator revocation and preserves omitted users and existing position', async () => {
    const f = fixture();
    const op = f.op('businesses', 'set_collaborators');
    const s = await step(
      op,
      { id: businessId, users: [{ user_id: '2', action_ids: [] }] },
      f.context,
    );
    expect(change(s, 'collaborator_effects').after).toMatchObject({
      kind: 'array',
      items: [
        {
          kind: 'object',
          fields: expect.arrayContaining([
            { field_key: 'is_active', value: false },
            { field_key: 'position', value: 'Cashier' },
          ]),
        },
      ],
    });
    expect(await op.executeConfirmed(s, f.context)).toEqual({
      id: businessId,
      businessId,
    });
  });
  it.each([
    {
      users: [
        { user_id: '2', action_ids: [] },
        { user_id: '2', action_ids: [] },
      ],
    },
    { users: [] },
    { users: [{ user_id: '2', action_ids: ['7', '7'] }] },
  ])('rejects ambiguous collaborator collections %j', async (body) => {
    const f = fixture();
    await expect(
      f
        .op('businesses', 'set_collaborators')
        .prepare({ id: businessId, ...body }, f.context),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects oversized relation snapshots instead of truncating a preview', async () => {
    const f = fixture();
    await expect(
      f
        .op('businesses', 'set_collaborators')
        .prepare(
          { id: businessId, users: [{ user_id: '2', action_ids: ['7'] }] },
          { ...f.context, maxCollectionItems: 0 },
        ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects target edits, duplicated editable fields, no-op updates and dependent executions', async () => {
    const f = fixture();
    const op = f.op('products', 'update');
    const s = await step(
      op,
      { business_id: businessId, id: '3', name: 'Edited' },
      f.context,
    );
    await expect(
      op.applyEdits(
        s.commandTemplate,
        [{ step_id: s.id, field_key: 'id', value: '4' }],
        f.context,
      ),
    ).rejects.toMatchObject({ status: 400 });
    const noChange = await op.prepare(
      { business_id: businessId, id: '3' },
      f.context,
    );
    expect(noChange).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['changes'],
    });
    await expect(
      op.executeConfirmed({ ...s, outputBindings: [{ from: 'x' }] }, f.context),
    ).rejects.toMatchObject({ status: 400 });
  });
});
