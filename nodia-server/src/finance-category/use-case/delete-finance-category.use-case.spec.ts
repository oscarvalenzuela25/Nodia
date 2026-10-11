import { FinanceCategory } from '../entities/finance-category.entity.js';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { FinanceCategoryService } from '../finance-category.service.js';
import { DeleteFinanceCategoryUseCase } from './delete-finance-category.use-case.js';

function fixture() {
  const manager = {} as EntityManager;
  const service = Object.create(
    FinanceCategoryService.prototype,
  ) as FinanceCategoryService;
  service.transaction = vi.fn(async (work) => work(manager));
  service.findOwned = vi.fn(async (actor, id) =>
    actor === '1'
      ? Object.assign(new FinanceCategory(), { id, user_id: actor })
      : null,
  );
  service.hasMovements = vi.fn(async () => false);
  service.deleteMemberships = vi.fn(async () => ({ affected: 2, raw: [] }));
  service.deleteOwned = vi.fn(async () => ({ affected: 1, raw: [] }));
  return {
    service,
    manager,
    useCase: new DeleteFinanceCategoryUseCase(service),
  };
}
describe('Delete personal category', () => {
  it('locks ownership and removes memberships before the unused category with exact bigint identity', async () => {
    const f = fixture();
    const id = '9007199254740993';
    await f.useCase.execute('1', id);
    expect(f.service.findOwned).toHaveBeenCalledWith('1', id, f.manager, true);
    expect(f.service.deleteMemberships).toHaveBeenCalledWith(
      f.manager,
      '1',
      id,
    );
    expect(f.service.deleteOwned).toHaveBeenCalledWith(f.manager, '1', id);
  });
  it('rejects any movement association before deleting anything', async () => {
    const f = fixture();
    f.service.hasMovements = vi.fn(async () => true);
    await expect(f.useCase.execute('1', '2')).rejects.toThrow(
      'finance:category_has_movements',
    );
    expect(f.service.deleteMemberships).not.toHaveBeenCalled();
    expect(f.service.deleteOwned).not.toHaveBeenCalled();
  });
  it('does not delete another principal’s record', async () => {
    const f = fixture();
    await expect(f.useCase.execute('2', '2')).rejects.toThrow(
      'finance:category_not_found',
    );
    expect(f.service.hasMovements).not.toHaveBeenCalled();
    expect(f.service.deleteOwned).not.toHaveBeenCalled();
  });
  it.each(['23503', '40P01', '40001'])(
    'maps concurrent persistence failures %s without returning success',
    async (code) => {
      const f = fixture();
      f.service.deleteOwned = vi.fn(async () => {
        throw Object.assign(new Error('SQL'), { code });
      });
      await expect(f.useCase.execute('1', '2')).rejects.toThrow(
        code === '23503'
          ? 'finance:association_conflict'
          : 'finance:concurrent_conflict',
      );
    },
  );
});
