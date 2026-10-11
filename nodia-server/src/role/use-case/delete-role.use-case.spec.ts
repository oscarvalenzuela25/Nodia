import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { DeleteRoleUseCase } from './delete-role.use-case.js';
import { Role } from '../entities/role.entity.js';
import { RoleAction } from '../entities/role-action.entity.js';
import { UserRole } from '../../user/entities/user-role.entity.js';
import { Translation } from '../../translation/entities/translation.entity.js';
import type { RedisService } from '../../common/redis/redis.service.js';

function fixture() {
  const manager = {
    findOne: vi.fn().mockResolvedValue({ id: '7', key: 'editor' }),
    exists: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const dataSource = {
    transaction: vi.fn(async (work: (tx: EntityManager) => Promise<void>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  const redis = { delByPattern: vi.fn().mockResolvedValue(undefined) };
  const useCase = new DeleteRoleUseCase(
    dataSource as unknown as DataSource,
    redis as unknown as RedisService,
  );
  return { manager, dataSource, redis, useCase };
}
describe('DeleteRoleUseCase', () => {
  it.each([
    '0',
    '-1',
    '1.5',
    '01',
    '1 OR 1=1',
    '9223372036854775808',
    '',
    '999999999999999999999',
  ])('rejects invalid bigint ID %s before persistence', async (id) => {
    const { useCase, dataSource, redis } = fixture();
    await expect(useCase.execute(id)).rejects.toMatchObject({
      message: 'roles:invalid_id',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(redis.delByPattern).not.toHaveBeenCalled();
  });
  it('preserves exact bigint IDs without Number coercion', async () => {
    const { useCase, manager } = fixture();
    await useCase.execute('9007199254740993');
    expect(manager.findOne).toHaveBeenCalledWith(Role, {
      where: { id: '9007199254740993' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.delete).toHaveBeenLastCalledWith(Role, {
      id: '9007199254740993',
    });
  });
  it('returns 404 without cleanup or cache invalidation when absent', async () => {
    const { useCase, manager, redis } = fixture();
    manager.findOne.mockResolvedValue(null);
    await expect(useCase.execute('7')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.delete).not.toHaveBeenCalled();
    expect(redis.delByPattern).not.toHaveBeenCalled();
  });
  it('invalidates authorization only after the transaction has succeeded', async () => {
    const { useCase, manager, redis } = fixture();
    manager.delete.mockImplementation(async () => {
      expect(redis.delByPattern).not.toHaveBeenCalled();
      return { affected: 1 };
    });
    await useCase.execute('7');
    expect(redis.delByPattern).toHaveBeenCalledOnce();
    expect(redis.delByPattern).toHaveBeenCalledWith('auth:context:*');
  });
  it('does not report success or invalidate authorization after persistence fails', async () => {
    const { useCase, manager, redis } = fixture();
    manager.delete.mockRejectedValueOnce(
      new Error('Synthetic database failure'),
    );
    await expect(useCase.execute('7')).rejects.toThrow(
      'Synthetic database failure',
    );
    expect(redis.delByPattern).not.toHaveBeenCalled();
  });
  it('removes only its assignments and translations before the catalog entry', async () => {
    const { useCase, manager } = fixture();
    await useCase.execute('7');
    expect(manager.delete.mock.calls).toEqual([
      [UserRole, { role_id: '7' }],
      [RoleAction, { role_id: '7' }],
      [Translation, { source_entity: 'roles', source_id: '7' }],
      [Role, { id: '7' }],
    ]);
  });
  it.each([true, false])(
    'rejects the reserved role regardless of active state (%s)',
    async (is_active) => {
      const { useCase, manager, redis } = fixture();
      manager.findOne.mockResolvedValue({
        id: '7',
        key: 'super_admin',
        is_active,
      });
      await expect(useCase.execute('7')).rejects.toMatchObject({
        message: 'roles:protected_role',
      });
      expect(manager.delete).not.toHaveBeenCalled();
      expect(redis.delByPattern).not.toHaveBeenCalled();
    },
  );
});
