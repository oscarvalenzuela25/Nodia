import { FinanceCategoryGroup } from '../entities/finance-category-group.entity.js';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { DeleteFinanceCategoryGroupUseCase } from './delete-finance-category-group.use-case.js';

describe('Delete personal category group', () => {
  function fixture() {
    const manager = {} as EntityManager;
    const service = Object.create(
      FinanceCategoryGroupService.prototype,
    ) as FinanceCategoryGroupService;
    service.transaction = vi.fn(async (work) => work(manager));
    service.findOwned = vi.fn(async (actor, id) =>
      actor === '1'
        ? Object.assign(new FinanceCategoryGroup(), { id, user_id: actor })
        : null,
    );
    service.deleteMemberships = vi.fn(async () => ({ affected: 2, raw: [] }));
    service.deleteOwned = vi.fn(async () => ({ affected: 1, raw: [] }));
    return {
      service,
      manager,
      useCase: new DeleteFinanceCategoryGroupUseCase(service),
    };
  }
  it('deletes all memberships and group in the same transaction without deleting categories', async () => {
    const f = fixture();
    await f.useCase.execute('1', '9007199254740993');
    expect(f.service.findOwned).toHaveBeenCalledWith(
      '1',
      '9007199254740993',
      f.manager,
      true,
    );
    expect(f.service.deleteMemberships).toHaveBeenCalledWith(
      f.manager,
      '1',
      '9007199254740993',
    );
    expect(f.service.deleteOwned).toHaveBeenCalledWith(
      f.manager,
      '1',
      '9007199254740993',
    );
  });
  it('rejects unknown or foreign groups before touching associations', async () => {
    const f = fixture();
    await expect(f.useCase.execute('2', '3')).rejects.toThrow(
      'finance:category_group_not_found',
    );
    expect(f.service.deleteMemberships).not.toHaveBeenCalled();
  });
  it('propagates transaction failure to allow rollback', async () => {
    const f = fixture();
    f.service.deleteOwned = vi.fn(async () => {
      throw new Error('failed');
    });
    await expect(f.useCase.execute('1', '3')).rejects.toThrow('failed');
  });
});
