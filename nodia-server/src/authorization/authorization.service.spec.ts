import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { User } from '../user/entities/user.entity.js';
import type { ModuleGroup } from '../module-group/entities/module-group.entity.js';
import type { TranslationService } from '../translation/translation.service.js';
import type { RedisService } from '../common/redis/redis.service.js';
import { AuthorizationService } from './authorization.service.js';

const fixture = (superAdmin: boolean) => {
  const activeGroup = { id: '1', key: 'settings', is_active: true };
  const catalog = [
    {
      id: '1',
      key: 'users',
      link: '/users',
      is_active: true,
      module_group: activeGroup,
    },
    {
      id: '2',
      key: 'roles',
      link: '/roles',
      is_active: true,
      module_group: activeGroup,
    },
    {
      id: '3',
      key: 'hidden',
      link: '/hidden',
      is_active: true,
      module_group: { id: '2', key: 'inactive', is_active: false },
    },
  ];
  const user = {
    id: '12',
    is_active: true,
    user_roles: superAdmin
      ? [
          {
            is_active: true,
            role: { key: 'super_admin', is_active: true, role_actions: [] },
          },
        ]
      : [],
    user_modules: [{ is_active: true, module: catalog[0] }],
  };
  const qb = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn(async () => user),
  };
  const find = vi.fn(async () => catalog);
  const repository = {
    createQueryBuilder: vi.fn(() => qb),
    manager: { getRepository: vi.fn(() => ({ find })) },
  };
  const service = new AuthorizationService(
    repository as unknown as Repository<User>,
    { find: vi.fn(async () => []) } as unknown as Repository<ModuleGroup>,
    {
      attachTranslations: vi.fn(
        async (_table: string, values: unknown[]) => values,
      ),
    } as unknown as TranslationService,
    {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
    } as unknown as RedisService,
  );
  return { service, find, user };
};

describe('AuthorizationService effective navigation', () => {
  it('offers all active catalog modules to super_admin without creating assignments or showing inactive groups', async () => {
    const f = fixture(true);
    const result = await f.service.getContext('synthetic@example.invalid');
    expect(
      result.modules.flatMap((group) =>
        group.modules.map((module) => module.link),
      ),
    ).toEqual(['/users', '/roles']);
    expect(f.user.user_modules).toHaveLength(1);
    expect(f.find).toHaveBeenCalledOnce();
  });

  it('keeps ordinary navigation limited to assigned modules without fetching the whole catalog', async () => {
    const f = fixture(false);
    const result = await f.service.getContext('synthetic@example.invalid');
    expect(
      result.modules.flatMap((group) =>
        group.modules.map((module) => module.link),
      ),
    ).toEqual(['/users']);
    expect(f.find).not.toHaveBeenCalled();
  });

  it('does not give the super_admin bypass through an inactive role assignment', async () => {
    const f = fixture(true);
    f.user.user_roles[0].is_active = false;
    const result = await f.service.getContext('synthetic@example.invalid');
    expect(result.roles).toEqual([]);
    expect(
      result.modules.flatMap((group) =>
        group.modules.map((module) => module.link),
      ),
    ).toEqual(['/users']);
    expect(f.find).not.toHaveBeenCalled();
  });
});
