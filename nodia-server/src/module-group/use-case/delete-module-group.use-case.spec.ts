import { NotFoundException, ConflictException } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { DeleteModuleGroupUseCase } from './delete-module-group.use-case.js';
import { ModuleGroup } from '../entities/module-group.entity.js';
import type { RedisService } from '../../common/redis/redis.service.js';

function fixture() {
  const manager = {
    findOne: vi.fn().mockResolvedValue({ id: '7' }),
    exists: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const dataSource = {
    transaction: vi.fn(async (work: (tx: EntityManager) => Promise<void>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  const redis = { delByPattern: vi.fn().mockResolvedValue(undefined) };
  const useCase = new DeleteModuleGroupUseCase(
    dataSource as unknown as DataSource,
    redis as unknown as RedisService,
  );
  return { manager, dataSource, redis, useCase };
}
describe('DeleteModuleGroupUseCase', () => {
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
      message: 'modules:invalid_id',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(redis.delByPattern).not.toHaveBeenCalled();
  });
  it('preserves exact bigint IDs without Number coercion', async () => {
    const { useCase, manager } = fixture();
    await useCase.execute('9007199254740993');
    expect(manager.findOne).toHaveBeenCalledWith(ModuleGroup, {
      where: { id: '9007199254740993' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.delete).toHaveBeenLastCalledWith(ModuleGroup, {
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
  it('rejects every associated module, without filtering inactive modules', async () => {
    const { useCase, manager, redis } = fixture();
    manager.exists.mockResolvedValue(true);
    await expect(useCase.execute('7')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.exists).toHaveBeenCalledWith(expect.any(Function), {
      where: { module_group_id: '7' },
    });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(redis.delByPattern).not.toHaveBeenCalled();
  });
  it('deletes only the empty group and its own translation namespace', async () => {
    const { useCase, manager } = fixture();
    await useCase.execute('7');
    expect(manager.delete.mock.calls.map(([, criteria]) => criteria)).toEqual([
      { source_entity: 'module_groups', source_id: '7' },
      { id: '7' },
    ]);
  });
});
