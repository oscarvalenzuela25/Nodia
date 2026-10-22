import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { FinanceCategoryService } from '../../finance-category/finance-category.service.js';
import type { CreateFinanceCategoryUseCase } from '../../finance-category/use-case/create-finance-category.use-case.js';
import type { UpdateFinanceCategoryUseCase } from '../../finance-category/use-case/update-finance-category.use-case.js';
import type { DeleteFinanceCategoryUseCase } from '../../finance-category/use-case/delete-finance-category.use-case.js';
import type { CreateFinanceCategoryGroupUseCase } from '../../finance-category-group/use-case/create-finance-category-group.use-case.js';
import type { UpdateFinanceCategoryGroupUseCase } from '../../finance-category-group/use-case/update-finance-category-group.use-case.js';
import type { DeleteFinanceCategoryGroupUseCase } from '../../finance-category-group/use-case/delete-finance-category-group.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiFinanceOperation } from '../../nodia-ai-finance-effect/types/financial-operation.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { NodiaAiFinanceCatalogService } from '../nodia-ai-finance-catalog.service.js';
import { BuildNodiaAiFinanceCatalogOperationsUseCase } from './build-nodia-ai-finance-catalog-operations.use-case.js';

function fixture() {
  let superAdmin = false;
  let authenticated = true;
  let duplicate = false;
  let movements = false;
  let missingTarget = false;
  const target: NodiaAiJsonObject = {
    id: '7',
    user_id: '1',
    name: 'Food',
    key: 'food',
    is_active: true,
    updated_at: '2026-10-17 12:00:00.123456+00',
  };
  const category: NodiaAiJsonObject = {
    id: '8',
    user_id: '1',
    name: 'Travel',
    key: 'travel',
    is_active: true,
    updated_at: '2026-10-17 12:00:00.123456+00',
  };
  const memberships: NodiaAiJsonObject[] = [
    {
      id: '9',
      category_group_id: '7',
      category_id: '8',
      is_active: true,
      updated_at: '2026-10-17 12:00:00.123456+00',
    },
  ];
  const query = vi.fn(async (sql: string, parameters: unknown[] = []) => {
    if (sql.startsWith('SELECT u.id'))
      return authenticated
        ? [
            {
              actorId: '1',
              sessionId: '11111111-1111-4111-8111-111111111111',
              isSuperAdmin: superAdmin,
            },
          ]
        : [];
    if (sql.startsWith('SELECT EXISTS(SELECT 1 FROM users'))
      return [{ exists: true }];
    if (sql.startsWith('SELECT EXISTS(SELECT 1 FROM finance_movements'))
      return [{ exists: movements }];
    if (sql.startsWith('SELECT EXISTS(SELECT 1 FROM finance_'))
      return [{ exists: duplicate }];
    if (sql.includes('FROM finance_category_group_memberships'))
      return structuredClone(memberships);
    if (sql.includes('id=ANY'))
      return (parameters[1] as string[]).includes(String(category.id))
        ? [structuredClone(category)]
        : [];
    if (
      sql.includes('FROM finance_categories WHERE') ||
      sql.includes('FROM finance_category_groups WHERE')
    )
      return !missingTarget && parameters[0] === target.user_id
        ? [structuredClone(target)]
        : [];
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const dataSource = {
    transaction: vi.fn(async () => {
      throw new Error('independent transaction forbidden');
    }),
  } as unknown as DataSource;
  const scope = new FinanceCategoryService(dataSource);
  const create = vi.fn(async () => ({ id: '10', user_id: '1' }));
  const update = vi.fn(async () => ({ id: '7', user_id: '1' }));
  const remove = vi.fn(async () => undefined);
  const factory = new BuildNodiaAiFinanceCatalogOperationsUseCase(
    scope,
    new NodiaAiFinanceCatalogService(),
    { execute: create } as unknown as CreateFinanceCategoryUseCase,
    { execute: update } as unknown as UpdateFinanceCategoryUseCase,
    { execute: remove } as unknown as DeleteFinanceCategoryUseCase,
    { execute: create } as unknown as CreateFinanceCategoryGroupUseCase,
    { execute: update } as unknown as UpdateFinanceCategoryGroupUseCase,
    { execute: remove } as unknown as DeleteFinanceCategoryGroupUseCase,
  );
  const context: ProposalPreparerContext = {
    manager,
    conversationId: '11111111-1111-4111-8111-111111111112',
    actor: {
      actorId: '1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/tools/finances-personal'],
    maxCollectionItems: 100,
  };
  return {
    factory,
    context,
    target,
    category,
    memberships,
    query,
    create,
    update,
    remove,
    dataSource,
    operation: (
      resource: 'categories' | 'category_groups',
      operation: 'create' | 'update' | 'delete',
    ) =>
      factory.operations.find(
        (item) =>
          item.toolName === `nodia_finance_${resource}_prepare_${operation}`,
      )!,
    setSuperAdmin: (value: boolean) => {
      superAdmin = value;
    },
    setAuthenticated: (value: boolean) => {
      authenticated = value;
    },
    setDuplicate: (value: boolean) => {
      duplicate = value;
    },
    setMovements: (value: boolean) => {
      movements = value;
    },
    setMissingTarget: (value: boolean) => {
      missingTarget = value;
    },
  };
}
async function step(
  operation: NodiaAiFinanceOperation,
  input: NodiaAiJsonObject,
  context: ProposalPreparerContext,
): Promise<StoredProposalStep> {
  const prepared = await operation.prepare(input, context);
  if (prepared.status !== 'ready') throw new Error('Expected ready');
  return {
    ...prepared,
    id: '11111111-1111-4111-8111-111111111113',
    position: 1,
    toolName: operation.toolName,
    contractHash: operation.contractHash,
    outputBindings: [],
  };
}

describe('AI-21 financial catalogs exact proposals and native ports', () => {
  it('rejects explicitly undefined update values before treating them as omitted fields', async () => {
    const f = fixture();
    await expect(
      f
        .operation('categories', 'update')
        .prepare(
          { id: '7', name: undefined } as unknown as NodiaAiJsonObject,
          f.context,
        ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.update).not.toHaveBeenCalled();
  });

  it('registers six distinct immutable identities and real contract hashes', () => {
    const f = fixture();
    expect(f.factory.operations).toHaveLength(6);
    expect(
      new Set(f.factory.operations.map((item) => item.contractHash)).size,
    ).toBe(6);
    expect(
      f.factory.operations.every(
        (item) =>
          /^[a-f0-9]{64}$/.test(item.contractHash) &&
          item.catalogVersion === 'nodia-ai-ai21-finance/1',
      ),
    ).toBe(true);
  });

  it('clarifies minimum fields and retains optional false without inferring group membership', async () => {
    const f = fixture();
    const category = await f
      .operation('categories', 'create')
      .prepare({ is_active: false }, f.context);
    expect(category).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['name', 'key'],
      partial: { command: { is_active: false } },
    });
    const group = await f
      .operation('category_groups', 'create')
      .prepare({ name: 'Expenses', key: 'expenses' }, f.context);
    expect(group).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['category_ids'],
    });
    expect(f.create).not.toHaveBeenCalled();
  });

  it('uses native text normalization and only the real activity default before freezing', async () => {
    const f = fixture();
    const prepared = await step(
      f.operation('categories', 'create'),
      { name: ' Food ', key: ' food ' },
      f.context,
    );
    expect(prepared.commandTemplate).toMatchObject({
      command: { name: 'Food', key: 'food', is_active: true },
      origins: { name: 'user', key: 'user', is_active: 'contract_default' },
    });
    expect(prepared.publicStep.target).toBeNull();
    expect(f.create).not.toHaveBeenCalled();
  });

  it.each(['categories', 'category_groups'] as const)(
    'clarifies immutable %s target and rejects empty updates',
    async (resource) => {
      const f = fixture();
      expect(
        await f.operation(resource, 'delete').prepare({}, f.context),
      ).toMatchObject({ status: 'needs_clarification', missingFields: ['id'] });
      expect(
        await f.operation(resource, 'update').prepare({ id: '7' }, f.context),
      ).toMatchObject({
        status: 'needs_clarification',
        missingFields: ['changes'],
      });
    },
  );

  it.each([
    ['categories', 'create', { name: null, key: 'a' }],
    ['categories', 'update', { id: '7', is_active: null }],
    ['categories', 'delete', { id: '7', name: 'x' }],
    ['categories', 'create', { id: '7', name: 'x', key: 'x' }],
    [
      'categories',
      'create',
      { owner_id: '9223372036854775808', name: 'x', key: 'x' },
    ],
    [
      'category_groups',
      'create',
      { name: 'x', key: 'x', category_ids: ['8', '8'] },
    ],
    ['category_groups', 'update', { id: '7', category_ids: [8] }],
    ['category_groups', 'delete', { id: '7', sql: 'DROP TABLE' }],
  ] as const)(
    'rejects invalid %s/%s fields %#',
    async (resource, operation, input) => {
      const f = fixture();
      await expect(
        f
          .operation(resource, operation)
          .prepare(input as NodiaAiJsonObject, f.context),
      ).rejects.toThrow('nodia_ai:invalid_input');
    },
  );

  it('merges a clarification without changing an already selected owner or target', async () => {
    const f = fixture();
    const operation = f.operation('categories', 'create');
    const partial = await operation.prepare({ name: 'Food' }, f.context);
    if (partial.status !== 'needs_clarification')
      throw new Error('Expected partial');
    expect(
      await operation.prepare({ key: 'food' }, f.context, partial.partial),
    ).toMatchObject({
      status: 'ready',
      commandTemplate: {
        owner_id: '1',
        command: { name: 'Food', key: 'food' },
      },
    });
    await expect(
      operation.prepare(
        { owner_id: '2', key: 'food' },
        f.context,
        partial.partial,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    const update = f.operation('categories', 'update');
    const pending = await update.prepare({ id: '7' }, f.context);
    if (pending.status !== 'needs_clarification')
      throw new Error('Expected partial');
    await expect(
      update.prepare({ id: '8', name: 'Other' }, f.context, pending.partial),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });

  it('enforces current session/module/owner authority without independent transactions', async () => {
    const f = fixture();
    await expect(
      f
        .operation('categories', 'create')
        .prepare({ owner_id: '2', name: 'x', key: 'x' }, f.context),
    ).rejects.toThrow('finance:scope_denied');
    f.setSuperAdmin(true);
    expect(
      await f
        .operation('categories', 'create')
        .prepare({ owner_id: '2', name: 'x', key: 'x' }, f.context),
    ).toMatchObject({ status: 'ready', scope: { subject_user_id: '2' } });
    await expect(
      f
        .operation('categories', 'create')
        .prepare({ name: 'x', key: 'x' }, { ...f.context, moduleRoutes: [] }),
    ).rejects.toThrow('nodia_ai:capability_denied');
    f.setAuthenticated(false);
    await expect(
      f
        .operation('categories', 'create')
        .prepare({ name: 'x', key: 'x' }, f.context),
    ).rejects.toThrow('auth:session_expired');
    expect(f.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects key collisions in preparation and changed uniqueness at confirmation', async () => {
    const f = fixture();
    const operation = f.operation('categories', 'create');
    const prepared = await step(
      operation,
      { name: 'Food', key: 'food' },
      f.context,
    );
    f.setDuplicate(true);
    await expect(
      operation.prepare({ name: 'Food', key: 'food' }, f.context),
    ).rejects.toThrow('finance:duplicate_key');
    await expect(
      operation.verifyPreconditions(prepared, f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
  });

  it('detects same-timestamp material target edits and missing targets', async () => {
    const f = fixture();
    const operation = f.operation('categories', 'update');
    const prepared = await step(
      operation,
      { id: '7', name: 'Updated' },
      f.context,
    );
    f.target.key = 'changed';
    await expect(
      operation.verifyPreconditions(prepared, f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
    f.setMissingTarget(true);
    await expect(
      operation.verifyPreconditions(prepared, f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
  });

  it('blocks deletion for movements of every state and previews archived memberships too', async () => {
    const f = fixture();
    const operation = f.operation('categories', 'delete');
    f.memberships[0].is_active = false;
    const prepared = await step(operation, { id: '7' }, f.context);
    expect(prepared.publicStep.target).toEqual({
      resource_key: 'finance_categories',
      id: '7',
      label: 'Food',
    });
    expect(prepared.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'memberships',
        before: {
          kind: 'array',
          items: [
            expect.objectContaining({
              kind: 'object',
              fields: expect.arrayContaining([
                { field_key: 'is_active', value: false },
              ]),
            }),
          ],
        },
        after_present: false,
      }),
    );
    f.setMovements(true);
    await expect(operation.prepare({ id: '7' }, f.context)).rejects.toThrow(
      'finance:category_has_movements',
    );
    await expect(
      operation.executeConfirmed(prepared, f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
    expect(f.remove).not.toHaveBeenCalled();
  });

  it('preserves group membership omission versus empty replacement', async () => {
    const f = fixture();
    const operation = f.operation('category_groups', 'update');
    const nameOnly = await step(
      operation,
      { id: '7', name: 'Other' },
      f.context,
    );
    expect(nameOnly.commandTemplate.command).toEqual({ name: 'Other' });
    const clear = await step(
      operation,
      { id: '7', category_ids: [] },
      f.context,
    );
    expect(clear.commandTemplate.command).toEqual({ category_ids: [] });
    expect(clear.publicStep.changes).toContainEqual({
      field_key: 'category_ids',
      before: { kind: 'array', items: ['8'] },
      before_present: true,
      after: { kind: 'array', items: [] },
      after_present: true,
      origin: 'user',
    });
  });

  it('permits retaining an inactive category, rejects new inactive membership and foreign refs', async () => {
    const f = fixture();
    f.category.is_active = false;
    const update = f.operation('category_groups', 'update');
    expect(
      await update.prepare({ id: '7', category_ids: ['8'] }, f.context),
    ).toMatchObject({ status: 'ready' });
    f.memberships[0].is_active = false;
    await expect(
      update.prepare({ id: '7', category_ids: ['8'] }, f.context),
    ).rejects.toThrow('finance:category_inactive');
    await expect(
      f
        .operation('category_groups', 'create')
        .prepare({ name: 'G', key: 'g', category_ids: ['8'] }, f.context),
    ).rejects.toThrow('finance:category_inactive');
    await expect(
      update.prepare({ id: '7', category_ids: ['999'] }, f.context),
    ).rejects.toThrow('finance:category_not_found');
  });

  it('holds categories before membership write locks in group snapshots', async () => {
    const f = fixture();
    await step(
      f.operation('category_groups', 'delete'),
      { id: '7' },
      f.context,
    );
    const queries = f.query.mock.calls.map(([sql]) => sql);
    const categoryLock = queries.findIndex(
      (sql) => sql.includes('id=ANY') && sql.includes('FOR SHARE'),
    );
    const membershipLock = queries.findIndex(
      (sql) =>
        sql.includes('finance_category_group_memberships') &&
        sql.includes('FOR UPDATE'),
    );
    expect(categoryLock).toBeGreaterThan(-1);
    expect(membershipLock).toBeGreaterThan(categoryLock);
  });

  it('does not truncate deletion impact beyond the configured collection budget', async () => {
    const f = fixture();
    f.memberships.push({ ...f.memberships[0], id: '10' });
    await expect(
      f
        .operation('categories', 'delete')
        .prepare({ id: '7' }, { ...f.context, maxCollectionItems: 1 }),
    ).rejects.toThrow('nodia_ai:result_too_large');
    expect(f.remove).not.toHaveBeenCalled();
  });

  it('allows only registered typed field edits and keeps IDs immutable', async () => {
    const f = fixture();
    const operation = f.operation('categories', 'update');
    const prepared = await step(
      operation,
      { id: '7', name: 'Updated' },
      f.context,
    );
    expect(
      await operation.applyEdits(
        prepared.commandTemplate,
        [{ step_id: prepared.id, field_key: 'is_active', value: false }],
        f.context,
      ),
    ).toMatchObject({
      id: '7',
      command: { name: 'Updated', is_active: false },
    });
    for (const field_key of ['id', 'owner_id', 'command.name'])
      await expect(
        operation.applyEdits(
          prepared.commandTemplate,
          [{ step_id: prepared.id, field_key, value: '8' }],
          f.context,
        ),
      ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      operation.applyEdits(
        prepared.commandTemplate,
        [{ step_id: prepared.id, field_key: 'is_active', value: null }],
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });

  it.each(['categories', 'category_groups'] as const)(
    'executes %s create/update/delete with the exact caller transaction and historical delete ID',
    async (resource) => {
      const f = fixture();
      for (const mutation of ['create', 'update', 'delete'] as const) {
        const operation = f.operation(resource, mutation);
        const input: NodiaAiJsonObject =
          mutation === 'create'
            ? {
                name: 'Created',
                key: 'created',
                ...(resource === 'category_groups' ? { category_ids: [] } : {}),
              }
            : mutation === 'update'
              ? { id: '7', is_active: false }
              : { id: '7' };
        const prepared = await step(operation, input, f.context);
        expect(await operation.executeConfirmed(prepared, f.context)).toEqual({
          id: mutation === 'create' ? '10' : '7',
          ownerId: '1',
        });
        const writer =
          mutation === 'create'
            ? f.create
            : mutation === 'update'
              ? f.update
              : f.remove;
        expect(writer.mock.calls[0]?.[0]).toEqual(
          expect.objectContaining({
            userId: '1',
            sessionId: f.context.actor.sessionId,
            ownerId: '1',
            transaction: f.context.manager,
          }),
        );
      }
      expect(f.dataSource.transaction).not.toHaveBeenCalled();
    },
  );

  it('keeps historical authorization independent from deleted targets and changed associations', async () => {
    const f = fixture();
    const operation = f.operation('category_groups', 'delete');
    const prepared = await step(operation, { id: '7' }, f.context);
    f.setMissingTarget(true);
    f.memberships.splice(0);
    f.category.is_active = false;
    await expect(
      operation.verifyAuthority(prepared, f.context),
    ).resolves.toBeUndefined();
    await expect(
      operation.verifyPreconditions(prepared, f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
  });

  it('rejects nonfrozen normalization, origin injection, defaults removed and bindings before effects', async () => {
    const f = fixture();
    const operation = f.operation('categories', 'create');
    const prepared = await step(
      operation,
      { name: 'Food', key: 'food' },
      f.context,
    );
    for (const edit of [
      (item: StoredProposalStep) => {
        (item.commandTemplate.command as NodiaAiJsonObject).name = ' Food ';
      },
      (item: StoredProposalStep) => {
        delete (item.commandTemplate.command as NodiaAiJsonObject).is_active;
        delete (item.commandTemplate.origins as NodiaAiJsonObject).is_active;
      },
      (item: StoredProposalStep) => {
        (item.commandTemplate.origins as NodiaAiJsonObject).name = 'database';
      },
      (item: StoredProposalStep) => {
        item.publicStep.depends_on = ['11111111-1111-4111-8111-111111111114'];
      },
    ]) {
      const modified = structuredClone(prepared);
      edit(modified);
      await expect(
        operation.executeConfirmed(modified, f.context),
      ).rejects.toThrow('nodia_ai:invalid_input');
    }
    expect(f.create).not.toHaveBeenCalled();
  });
});
