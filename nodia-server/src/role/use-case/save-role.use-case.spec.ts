import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { SaveRoleUseCase } from './save-role.use-case.js';
import type { RoleService } from '../role.service.js';
import type { RedisService } from '../../common/redis/redis.service.js';
import type { TranslationService } from '../../translation/translation.service.js';
import { actorFixture } from '../../authorization/use-case/authority.fixture.js';
import { Action } from '../../action/entities/action.entity.js';
import { Role } from '../entities/role.entity.js';
import { RoleAction } from '../entities/role-action.entity.js';
import { withCoreAuthorityLock } from '../../authorization/core-authority-transaction.js';

describe('SaveRoleUseCase', () => {
  it('keeps numeric action IDs distinct from another action whose key is numeric', async () => {
    const actionRows = [
      { id: '60', key: 'view' },
      { id: '61', key: '60' },
    ];
    const query = {
      where: vi.fn().mockReturnThis(),
      getMany: vi.fn(async () => actionRows),
    };
    const role = {
      findOneBy: vi.fn(async () => ({
        id: '7',
        key: 'synthetic',
        is_active: true,
      })),
      create: vi.fn((data) => data),
      save: vi.fn(async (data) => data),
      findOneByOrFail: vi.fn(async () => ({ id: '7' })),
    };
    const assignments = {
      delete: vi.fn(async () => ({ affected: 0 })),
      insert: vi.fn(async () => ({})),
    };
    const manager = {
      queryRunner: { isTransactionActive: true },
      query: vi.fn(async (sql: string) =>
        sql.includes('AS "actorId"')
          ? [{ actorId: '1', isSuperAdmin: false }]
          : [],
      ),
      getRepository: vi.fn((target) =>
        target === Action
          ? { createQueryBuilder: () => query }
          : target === Role
            ? role
            : target === RoleAction
              ? assignments
              : null,
      ),
    };
    const source = { transaction: vi.fn() },
      reader = { findOne: vi.fn() },
      redis = { delByPattern: vi.fn() },
      translations = { updateTranslations: vi.fn() };
    const writer = new SaveRoleUseCase(
      source as unknown as DataSource,
      reader as unknown as RoleService,
      redis as unknown as RedisService,
      translations as unknown as TranslationService,
    );
    const tx = manager as unknown as EntityManager;
    await withCoreAuthorityLock(tx, 900, async () =>
      writer.execute(
        '7',
        { actions: ['60', '61'] },
        { ...actorFixture('1'), transaction: tx },
      ),
    );
    expect(assignments.insert).toHaveBeenCalledWith([
      { role_id: '7', action_id: '60', is_active: true },
      { role_id: '7', action_id: '61', is_active: true },
    ]);
    expect(source.transaction).not.toHaveBeenCalled();
    expect(redis.delByPattern).not.toHaveBeenCalled();
  });
});
