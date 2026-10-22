import { describe, expect, it, vi } from 'vitest';
import type { EntityManager, Repository, ObjectLiteral } from 'typeorm';
import { ActionService } from '../../../action/action.service.js';
import { BusinessActionService } from '../../../business-action/business-action.service.js';
import { ModuleService } from '../../../module/module.service.js';
import { ModuleGroupService } from '../../../module-group/module-group.service.js';
import { RoleService } from '../../../role/role.service.js';
import { UserService } from '../../../user/user.service.js';
import { TranslationService } from '../../../translation/translation.service.js';
import { RedisService } from '../../../common/redis/redis.service.js';
import { GetAllActionsUseCase } from '../../../action/use-case/get-all-actions.use-case.js';
import { GetAllBusinessActionsUseCase } from '../../../business-action/use-case/get-all-business-actions.use-case.js';
import { GetAllModulesUseCase } from '../../../module/use-case/get-all-modules.use-case.js';
import { GetAllModuleGroupsUseCase } from '../../../module-group/use-case/get-all-module-groups.use-case.js';
import { GetAllRolesUseCase } from '../../../role/use-case/get-all-roles.use-case.js';
import { GetAllUsersUseCase } from '../../../user/use-case/get-all-users.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import { NodiaAiToolRegistryUseCase } from '../../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { createNodiaAiCoreSettingsReadFamily } from '../core-settings-read.family.js';
import { ExecuteNodiaAiCoreSettingsReadUseCase } from './execute-nodia-ai-core-settings-read.use-case.js';

function fixture() {
  const dates = {
    created_at: new Date('2026-10-16T12:00:00Z'),
    updated_at: new Date('2026-10-16T12:00:00Z'),
  };
  const rows: Record<string, ObjectLiteral> = {
    Action: {
      id: '5',
      key: 'read',
      description: null,
      is_active: true,
      ...dates,
      secret: 'hidden',
    },
    BusinessAction: {
      id: '6',
      key: 'buy',
      has_description: true,
      is_active: true,
      ...dates,
    },
    Module: {
      id: '7',
      key: 'users',
      module_group_id: '8',
      link: '/settings/users',
      icon: null,
      is_active: true,
      ...dates,
    },
    ModuleGroup: {
      id: '8',
      key: 'settings',
      icon: null,
      is_active: true,
      ...dates,
    },
    Role: {
      id: '9',
      key: 'admin',
      is_active: true,
      role_actions: [],
      ...dates,
    },
    User: {
      id: '1',
      name: 'Synthetic user',
      email: 'fixture@example.invalid',
      image_url: null,
      google_sub: 'not-public',
      credential: 'not-public',
      is_active: true,
      ...dates,
    },
  };
  const clauses: string[] = [];
  const orders: unknown[][] = [];
  let currentRow: ObjectLiteral | undefined;
  const qb = {
    getParameters: vi.fn(() => ({})),
    andWhere: vi.fn((sql: string) => {
      clauses.push(sql);
      return qb;
    }),
    addOrderBy: vi.fn((...args: unknown[]) => {
      orders.push(args);
      return qb;
    }),
    orderBy: vi.fn(() => qb),
    skip: vi.fn(() => qb),
    take: vi.fn(() => qb),
    getManyAndCount: vi.fn(async () =>
      currentRow ? [[currentRow], 1] : [[], 0],
    ),
  };
  const repositories = new Map<string, unknown>();
  const repository = <T extends ObjectLiteral>(name: string): Repository<T> => {
    if (!repositories.has(name))
      repositories.set(name, {
        createQueryBuilder: vi.fn(() => {
          currentRow = rows[name];
          return qb;
        }),
        findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
          rows[name]?.id === where.id ? rows[name] : null,
        ),
        find: vi.fn(async () => []),
      });
    return repositories.get(name) as Repository<T>;
  };
  const globalRepository = <T extends ObjectLiteral>(): Repository<T> =>
    ({
      createQueryBuilder: () => {
        throw new Error('global repository forbidden');
      },
      findOne: () => {
        throw new Error('global repository forbidden');
      },
      find: () => {
        throw new Error('global translation repository forbidden');
      },
    }) as unknown as Repository<T>;
  let revoked = false;
  let roleActionCount = 0;
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async (sql: string) =>
      sql.startsWith('SELECT count(*)::integer AS count')
        ? [{ count: roleActionCount }]
        : sql === 'SHOW transaction_isolation'
          ? [{ transaction_isolation: 'repeatable read' }]
          : revoked
            ? []
            : [
                {
                  actorId: '1',
                  sessionId: '11111111-1111-4111-8111-111111111111',
                  isSuperAdmin: false,
                },
              ],
    ),
    getRepository: vi.fn((entity: { name: string }) => repository(entity.name)),
  } as unknown as EntityManager;
  // The fixture never starts Redis lifecycle/network; reads must not touch it.
  const redis = new RedisService();
  const translation = new TranslationService(globalRepository());
  const actions = new ActionService(globalRepository(), translation, redis);
  const businessActions = new BusinessActionService(
    globalRepository(),
    translation,
    redis,
  );
  const modules = new ModuleService(globalRepository(), translation, redis);
  const groups = new ModuleGroupService(globalRepository(), translation, redis);
  const roles = new RoleService(
    globalRepository(),
    globalRepository(),
    globalRepository(),
    translation,
    redis,
  );
  const users = new UserService(
    globalRepository(),
    globalRepository(),
    globalRepository(),
    translation,
    redis,
  );
  const ports = {
    actions,
    businessActions,
    modules,
    roles,
    listActions: new GetAllActionsUseCase(actions),
    listBusinessActions: new GetAllBusinessActionsUseCase(businessActions),
    listModules: new GetAllModulesUseCase(modules),
    listGroups: new GetAllModuleGroupsUseCase(groups),
    listRoles: new GetAllRolesUseCase(roles),
    listUsers: new GetAllUsersUseCase(users),
  };
  const family = createNodiaAiCoreSettingsReadFamily(ports);
  const registry = new NodiaAiToolRegistryUseCase([family], 'test-v1');
  const context: NodiaAiToolHandlerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: [
      '/settings/users',
      '/settings/roles',
      '/settings/modules',
      '/settings/actions',
    ],
  };
  return {
    rows,
    family,
    registry,
    clauses,
    orders,
    context,
    qb,
    reader: new ExecuteNodiaAiCoreSettingsReadUseCase(ports),
    roles,
    roleActions: (value: number) => {
      roleActionCount = value;
    },
    revoke: () => {
      revoked = true;
    },
  };
}

describe('ExecuteNodiaAiCoreSettingsReadUseCase', () => {
  it('rejects excessive role actions before hydrating native relations', async () => {
    const f = fixture();
    f.roleActions(129);
    const find = vi.spyOn(f.roles, 'findOne');
    await expect(
      f.reader.execute(
        'roles',
        'roles',
        { id: '9' },
        { ...f.context, maxCollectionItems: 128 },
      ),
    ).rejects.toThrow('nodia_ai:context_limit');
    expect(find).not.toHaveBeenCalled();
    expect(f.context.manager.query).toHaveBeenCalledWith(
      'SELECT count(*)::integer AS count FROM (SELECT 1 FROM role_actions WHERE role_id=$1 LIMIT $2) bounded',
      ['9', 129],
    );
  });

  it('permits a native role detail at the configured collection bound', async () => {
    const f = fixture();
    f.roleActions(128);
    const find = vi.spyOn(f.roles, 'findOne');
    const result = await f.reader.execute(
      'roles',
      'roles',
      { id: '9' },
      { ...f.context, maxCollectionItems: 128 },
    );
    expect(find).toHaveBeenCalledWith('9', f.context.manager);
    expect(result).toMatchObject({ id: '9', key: 'admin', actions: [] });
    expect(
      f.registry.validateOutput(f.registry.get('nodia_roles_get')!, result),
    ).toEqual(result);
  });

  it('registers exactly ten closed public read contracts', () => {
    const { family, registry, context } = fixture();
    expect(registry.list(context.moduleRoutes)).toHaveLength(10);
    for (const capability of family.capabilities) {
      const tool = registry.get(capability.toolName)!;
      expect(capability.capabilityId).toBe(capability.toolName);
      expect(() =>
        registry.validateInput(tool, { sql: 'SELECT *', all: true }),
      ).toThrow('nodia_ai:invalid_tool_input');
      expect(() =>
        registry.validateOutput(tool, { credentials: 'hidden' }),
      ).toThrow('nodia_ai:invalid_tool_output');
    }
  });

  it.each([
    ['listActions', 'actions', 'nodia_actions_list'],
    ['listBusinessActions', 'business_actions', 'nodia_business_actions_list'],
    ['listModules', 'modules', 'nodia_modules_list'],
    ['listGroups', 'module_groups', 'nodia_module_groups_list'],
    ['listRoles', 'roles', 'nodia_roles_list'],
    ['listUsers', 'users', 'nodia_users_list'],
  ] as const)(
    'shares manager, native use case and translations for %s',
    async (operation, resource, name) => {
      const f = fixture();
      const result = await f.reader.execute(operation, resource, {}, f.context);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      });
      expect(f.registry.validateOutput(f.registry.get(name)!, result)).toEqual(
        result,
      );
      expect(f.clauses.some((sql) => sql.includes('is_active'))).toBe(true);
      expect(f.orders.some((order) => String(order[0]).endsWith('.id'))).toBe(
        true,
      );
    },
  );

  it('omits activity predicate for all and never downloads unlimited rows', async () => {
    const f = fixture();
    await f.reader.execute(
      'listActions',
      'actions',
      { active: 'all', page: 2, limit: 20 },
      f.context,
    );
    expect(f.clauses.some((sql) => sql.includes('is_active'))).toBe(false);
    expect(f.qb.skip).toHaveBeenCalledWith(20);
    expect(f.qb.take).toHaveBeenCalledWith(20);
  });

  it('removes authentication identifiers, arbitrary entity fields and relations from public users', async () => {
    const f = fixture();
    const output = await f.reader.execute('listUsers', 'users', {}, f.context);
    expect(output.data).toEqual([
      {
        id: '1',
        name: 'Synthetic user',
        email: 'fixture@example.invalid',
        image_url: null,
        is_active: true,
        created_at: '2026-10-16T12:00:00.000Z',
        updated_at: '2026-10-16T12:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(output)).not.toContain('not-public');
  });

  it('returns native detail and preserves the actual missing record error', async () => {
    const f = fixture();
    const result = await f.reader.execute(
      'actions',
      'actions',
      { id: '5' },
      f.context,
    );
    expect(result).not.toHaveProperty('secret');
    expect(
      f.registry.validateOutput(f.registry.get('nodia_actions_get')!, result),
    ).toEqual(result);
    await expect(
      f.reader.execute('actions', 'actions', { id: '99' }, f.context),
    ).rejects.toThrow('not found');
  });

  it('rechecks native session on recovery and requires a transaction', async () => {
    const f = fixture();
    await f.reader.verifyAuthority({}, f.context);
    f.revoke();
    await expect(f.reader.verifyAuthority({}, f.context)).rejects.toThrow(
      'auth:session_expired',
    );
    await expect(
      f.reader.verifyAuthority(
        {},
        {
          ...f.context,
          manager: {
            queryRunner: { isTransactionActive: false },
          } as EntityManager,
        },
      ),
    ).rejects.toThrow('authorization:transaction_required');
  });

  it('rejects unknown filter fields, oversized lists and arbitrary sorts', () => {
    const { registry } = fixture();
    const tool = registry.get('nodia_users_list')!;
    for (const value of [
      { limit: 101 },
      { includes: true },
      { q: { google_sub_eq: 'secret' } },
      { q: { s: 'password asc' } },
      {
        q: {
          modules_id_in: Array.from({ length: 101 }, (_, i) => String(i + 1)),
        },
      },
    ])
      expect(() => registry.validateInput(tool, value)).toThrow(
        'nodia_ai:invalid_tool_input',
      );
    expect(
      registry.validateInput(tool, {
        q: {
          modules_id_in: ['5'],
          email_cont: '@example.invalid',
          s: 'name asc',
        },
      }),
    ).toMatchObject({ q: { modules_id_in: ['5'] } });
  });
});
