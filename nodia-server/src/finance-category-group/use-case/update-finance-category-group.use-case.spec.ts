import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { FinanceCategoryGroup } from '../entities/finance-category-group.entity.js';
import { FinanceCategoryGroupMembership } from '../entities/finance-category-group-membership.entity.js';
import { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import { UpdateFinanceCategoryGroupUseCase } from './update-finance-category-group.use-case.js';
import { CreateFinanceCategoryGroupUseCase } from './create-finance-category-group.use-case.js';
import { GetFinanceCategoryGroupUseCase } from './get-finance-category-group.use-case.js';
import { GetFinanceCategoryGroupsUseCase } from './get-finance-category-groups.use-case.js';
import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';

const manager = {} as EntityManager;
const category = (id: string, active = true) =>
  Object.assign(new FinanceCategory(), {
    id,
    user_id: '1',
    name: `Category ${id}`,
    key: id,
    is_active: active,
  });
const membership = (id: string, categoryId: string, active = true) =>
  Object.assign(new FinanceCategoryGroupMembership(), {
    id,
    user_id: '1',
    category_group_id: '10',
    category_id: categoryId,
    is_active: active,
  });

describe('Personal category groups application rules', () => {
  const service = Object.create(
    FinanceCategoryGroupService.prototype,
  ) as FinanceCategoryGroupService;
  const group = () =>
    Object.assign(new FinanceCategoryGroup(), {
      id: '10',
      user_id: '1',
      name: 'Expenses',
      key: 'expenses',
      is_active: true,
    });
  beforeEach(() => {
    service.transaction = vi.fn(async (work) => work(manager));
    service.findOwned = vi.fn(async () => group());
    service.save = vi.fn(async (_manager, entity) => entity);
    service.insert = vi.fn(async () => group());
    service.lockCategories = vi.fn(async (_manager, _actor, ids) =>
      ids.map((id) => category(id)),
    );
    service.memberships = vi.fn(async () => []);
    service.categories = vi.fn(async () => []);
    service.saveMemberships = vi.fn(async (_manager, entities) => entities);
    service.findPage = vi.fn(async () => [[group()], 1]);
    service.categoryCounts = vi.fn(async () => new Map([['10', 2]]));
  });

  it('omitted selection preserves associations while metadata is updated', async () => {
    const result = await new UpdateFinanceCategoryGroupUseCase(service).execute(
      '1',
      '10',
      { name: 'New name', is_active: false },
    );
    expect(result.name).toBe('New name');
    expect(result.is_active).toBe(false);
    expect(service.lockCategories).not.toHaveBeenCalled();
    expect(service.saveMemberships).not.toHaveBeenCalled();
  });

  it('empty selection archives existing pivots without hard deletion', async () => {
    service.memberships = vi.fn(async () => [membership('20', '2')]);
    await new UpdateFinanceCategoryGroupUseCase(service).execute('1', '10', {
      category_ids: [],
    });
    expect(service.saveMemberships).toHaveBeenCalledWith(manager, [
      expect.objectContaining({ id: '20', category_id: '2', is_active: false }),
    ]);
  });

  it('reuses an archived pivot and archives removed members atomically', async () => {
    service.memberships = vi.fn(async () => [
      membership('20', '2', false),
      membership('21', '3'),
    ]);
    await new UpdateFinanceCategoryGroupUseCase(service).execute('1', '10', {
      category_ids: ['2', '4'],
    });
    expect(service.saveMemberships).toHaveBeenCalledWith(
      manager,
      expect.arrayContaining([
        expect.objectContaining({
          id: '20',
          category_id: '2',
          is_active: true,
        }),
        expect.objectContaining({
          id: '21',
          category_id: '3',
          is_active: false,
        }),
        expect.objectContaining({
          category_id: '4',
          category_group_id: '10',
          user_id: '1',
          is_active: true,
        }),
      ]),
    );
  });

  it('rejects a missing or foreign category before changing any membership', async () => {
    service.lockCategories = vi.fn(async () => []);
    await expect(
      new UpdateFinanceCategoryGroupUseCase(service).execute('1', '10', {
        category_ids: ['2'],
      }),
    ).rejects.toThrow('finance:category_not_found');
    expect(service.saveMemberships).not.toHaveBeenCalled();
    expect(service.save).not.toHaveBeenCalled();
  });

  it('rejects new inactive categories but preserves inactive historical selection', async () => {
    service.lockCategories = vi.fn(async () => [category('2', false)]);
    await expect(
      new UpdateFinanceCategoryGroupUseCase(service).execute('1', '10', {
        category_ids: ['2'],
      }),
    ).rejects.toThrow('finance:category_inactive');
    service.memberships = vi.fn(async () => [membership('20', '2')]);
    await expect(
      new UpdateFinanceCategoryGroupUseCase(service).execute('1', '10', {
        category_ids: ['2'],
      }),
    ).resolves.toBeDefined();
    expect(service.saveMemberships).not.toHaveBeenCalled();
  });

  it('does not expose or update a missing/foreign group', async () => {
    service.findOwned = vi.fn(async () => null);
    await expect(
      new UpdateFinanceCategoryGroupUseCase(service).execute('2', '10', {
        name: 'Foreign',
      }),
    ).rejects.toThrow('finance:category_group_not_found');
    expect(service.findOwned).toHaveBeenCalledWith('2', '10', manager, true);
    expect(service.save).not.toHaveBeenCalled();
  });

  it('hydrates archived categories and projects only public group fields', async () => {
    service.categories = vi.fn(async () => [category('2', false)]);
    const result = await new GetFinanceCategoryGroupUseCase(service).execute(
      '1',
      '10',
    );
    expect(result.category_count).toBe(1);
    expect(result.categories).toEqual([
      { id: '2', name: 'Category 2', key: '2', is_active: false },
    ]);
    expect(result.user_id).toBe('1');
    expect(result).not.toHaveProperty('user');
    expect(result.categories[0]).not.toHaveProperty('user_id');
  });

  it('batches group category counts for the whole page', async () => {
    const result = await new GetFinanceCategoryGroupsUseCase(service).execute(
      '1',
      new FinanceQueryDto(),
    );
    expect(result.data[0].category_count).toBe(2);
    expect(service.categoryCounts).toHaveBeenCalledTimes(1);
    expect(service.categoryCounts).toHaveBeenCalledWith('1', ['10']);
  });

  it('propagates a membership failure for transactional rollback rather than success', async () => {
    service.saveMemberships = vi.fn(async () => {
      throw new Error('synthetic persistence failure');
    });
    await expect(
      new CreateFinanceCategoryGroupUseCase(service).execute('1', {
        name: 'Expenses',
        key: 'expenses',
        category_ids: ['2'],
      }),
    ).rejects.toThrow('synthetic persistence failure');
    expect(service.insert).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ user_id: '1' }),
    );
  });

  it('maps key uniqueness races to a safe conflict', async () => {
    service.insert = vi.fn(async () => {
      throw Object.assign(new Error('private SQL'), { code: '23505' });
    });
    await expect(
      new CreateFinanceCategoryGroupUseCase(service).execute('1', {
        name: 'Expenses',
        key: 'expenses',
        category_ids: [],
      }),
    ).rejects.toThrow('finance:duplicate_key');
  });
});
