import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { SeedAuthUseCase } from './seed-auth.use-case.js';
import type { TranslationService } from '../../translation/translation.service.js';
import type { RedisService } from '../../common/redis/redis.service.js';
import { envs } from '../../config/envs.config.js';
import { Role } from '../../role/entities/role.entity.js';
import { User } from '../../user/entities/user.entity.js';
import { UserRole } from '../../user/entities/user-role.entity.js';
import { UserModule } from '../../user/entities/user-module.entity.js';
import { ModuleGroup } from '../../module-group/entities/module-group.entity.js';
import { Module } from '../../module/entities/module.entity.js';

describe('SeedAuthUseCase', () => {
  let useCase: SeedAuthUseCase;
  let dataSourceMock: Partial<DataSource>;
  let translationServiceMock: Partial<TranslationService>;
  let redisServiceMock: Partial<RedisService>;
  let managerMock: Partial<EntityManager>;

  // Mock repository stores
  let rolesStore: Map<string, Role>;
  let moduleGroupsStore: Map<string, ModuleGroup>;
  let modulesStore: Map<string, Module>;
  let usersStore: Map<string, User>;
  let userRolesStore: UserRole[];
  let userModulesStore: UserModule[];

  let idCounter = 1;
  function createMockRepo<T extends { id?: string; key?: string; email?: string }>(
    store: Map<string, T> | T[],
  ): Partial<Repository<T>> {
    return {
      findOne: vi.fn().mockImplementation(async ({ where }: { where: Record<string, any> }) => {
        if (Array.isArray(store)) {
          return (
            store.find((item: any) =>
              Object.entries(where).every(([k, v]) => item[k] === v),
            ) ?? null
          );
        }
        for (const item of store.values() as any) {
          const match = Object.entries(where).every(([k, v]) => {
            if (k === 'email' && typeof item[k] === 'string') {
              return item[k].toLowerCase() === String(v).toLowerCase();
            }
            return item[k] === v;
          });
          if (match) return item;
        }
        return null;
      }),
      create: vi.fn().mockImplementation((entity: any) => ({
        id: String(idCounter++),
        ...entity,
      })),
      save: vi.fn().mockImplementation(async (entity: any) => {
        if (!entity.id) entity.id = String(idCounter++);
        if (Array.isArray(store)) {
          const index = store.findIndex((i: any) => i.id === entity.id);
          if (index >= 0) store[index] = entity;
          else store.push(entity);
        } else {
          store.set(entity.id, entity);
        }
        return entity;
      }),
    };
  }

  beforeEach(() => {
    idCounter = 1;
    rolesStore = new Map();
    moduleGroupsStore = new Map();
    modulesStore = new Map();
    usersStore = new Map();
    userRolesStore = [];
    userModulesStore = [];

    const roleRepo = createMockRepo(rolesStore);
    const userRoleRepo = createMockRepo(userRolesStore);
    const userRepo = createMockRepo(usersStore);
    const userModuleRepo = createMockRepo(userModulesStore);
    const moduleGroupRepo = createMockRepo(moduleGroupsStore);
    const moduleRepo = createMockRepo(modulesStore);

    const getRepo = vi.fn().mockImplementation((target: any) => {
      if (target === Role) return roleRepo;
      if (target === UserRole) return userRoleRepo;
      if (target === User) return userRepo;
      if (target === UserModule) return userModuleRepo;
      if (target === ModuleGroup) return moduleGroupRepo;
      if (target === Module) return moduleRepo;
      return null;
    });

    managerMock = {
      getRepository: getRepo as any,
    };

    dataSourceMock = {
      getRepository: getRepo as any,
      transaction: vi.fn().mockImplementation(async (cb: (m: EntityManager) => any) => {
        return cb(managerMock as EntityManager);
      }),
    };

    translationServiceMock = {
      saveTranslations: vi.fn().mockResolvedValue(undefined),
    };

    redisServiceMock = {
      delByPattern: vi.fn().mockResolvedValue(undefined),
    };

    envs.SECRET_SEED = 'valid_secret_seed';

    useCase = new SeedAuthUseCase(
      dataSourceMock as DataSource,
      translationServiceMock as TranslationService,
      redisServiceMock as RedisService,
    );
  });

  it('should throw UnauthorizedException when secret_seed is invalid', async () => {
    await expect(
      useCase.execute({
        secret_seed: 'wrong_secret',
        super_admin_email: 'admin@nodia.com',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ConflictException if a super_admin already exists', async () => {
    const superRole: Role = {
      id: '1',
      key: 'super_admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      role_users: [],
      role_actions: [],
    };
    rolesStore.set(superRole.id, superRole);

    userRolesStore.push({
      id: '100',
      user_id: '50',
      role_id: '1',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      user: null as any,
      role: null as any,
    });

    await expect(
      useCase.execute({
        secret_seed: 'valid_secret_seed',
        super_admin_email: 'admin@nodia.com',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should seed role, module group, modules, and super admin user successfully', async () => {
    const result = await useCase.execute({
      secret_seed: 'valid_secret_seed',
      super_admin_email: 'superadmin@nodia.com',
    });

    expect(result).toBeDefined();
    expect(result.super_admin_email).toBe('superadmin@nodia.com');
    expect(result.role).toBe('super_admin');
    expect(result.module_group).toBe('general_settings');
    expect(result.modules).toEqual(['users', 'roles', 'actions', 'modules']);

    // Check Role created
    const createdRole = Array.from(rolesStore.values()).find((r) => r.key === 'super_admin');
    expect(createdRole).toBeDefined();
    expect(createdRole?.is_active).toBe(true);

    // Check Translations called for Role
    expect(translationServiceMock.saveTranslations).toHaveBeenCalledWith(
      'roles',
      createdRole?.id,
      expect.arrayContaining([
        expect.objectContaining({ key: 'key', es: 'Super Administrador' }),
      ]),
    );

    // Check ModuleGroup created
    const createdGroup = Array.from(moduleGroupsStore.values()).find(
      (g) => g.key === 'general_settings',
    );
    expect(createdGroup).toBeDefined();

    // Check Translations called for ModuleGroup
    expect(translationServiceMock.saveTranslations).toHaveBeenCalledWith(
      'module_groups',
      createdGroup?.id,
      expect.arrayContaining([
        expect.objectContaining({ key: 'key', es: 'Administrador General' }),
      ]),
    );

    // Check Modules created with links and group_id
    const modules = Array.from(modulesStore.values());
    expect(modules).toHaveLength(4);
    const usersMod = modules.find((m) => m.key === 'users');
    expect(usersMod?.link).toBe('/settings/users');
    expect(usersMod?.module_group_id).toBe(createdGroup?.id);

    const rolesMod = modules.find((m) => m.key === 'roles');
    expect(rolesMod?.link).toBe('/settings/roles');

    const actionsMod = modules.find((m) => m.key === 'actions');
    expect(actionsMod?.link).toBe('/settings/actions');

    const modulesMod = modules.find((m) => m.key === 'modules');
    expect(modulesMod?.link).toBe('/settings/modules');

    // Check User created and relations assigned
    const createdUser = Array.from(usersStore.values()).find(
      (u) => u.email === 'superadmin@nodia.com',
    );
    expect(createdUser).toBeDefined();
    expect(createdUser?.is_active).toBe(true);

    const userRole = userRolesStore.find(
      (ur) => ur.user_id === createdUser?.id && ur.role_id === createdRole?.id,
    );
    expect(userRole).toBeDefined();
    expect(userRole?.is_active).toBe(true);

    expect(userModulesStore.filter((um) => um.user_id === createdUser?.id)).toHaveLength(4);

    // Check Redis cache invalidated
    expect(redisServiceMock.delByPattern).toHaveBeenCalledWith('auth:context:*');
  });

  it('should reuse existing user if already registered and assign super_admin role and modules', async () => {
    const existingUser: User = {
      id: '88',
      email: 'existing@nodia.com',
      name: 'Existing User',
      image_url: null,
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
      user_roles: [],
      user_modules: [],
    };
    usersStore.set(existingUser.id, existingUser);

    const result = await useCase.execute({
      secret_seed: 'valid_secret_seed',
      super_admin_email: 'existing@nodia.com',
    });

    expect(result.super_admin_email).toBe('existing@nodia.com');
    expect(existingUser.is_active).toBe(true);

    const role = Array.from(rolesStore.values()).find((r) => r.key === 'super_admin');
    const assignedUserRole = userRolesStore.find(
      (ur) => ur.user_id === '88' && ur.role_id === role?.id,
    );
    expect(assignedUserRole).toBeDefined();
  });
});
