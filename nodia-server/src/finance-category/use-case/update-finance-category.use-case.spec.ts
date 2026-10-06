import { beforeEach, describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { EntityManager } from 'typeorm';
import { FinanceCategoryService } from '../finance-category.service.js';
import { FinanceCategory } from '../entities/finance-category.entity.js';
import { UpdateFinanceCategoryUseCase } from './update-finance-category.use-case.js';
import { CreateFinanceCategoryUseCase } from './create-finance-category.use-case.js';
import { GetFinanceCategoryUseCase } from './get-finance-category.use-case.js';
import { UpdateFinanceCategoryDto } from '../dto/update-finance-category.dto.js';
import { CreateFinanceCategoryDto } from '../dto/create-finance-category.dto.js';
import { CreateFinanceCategoryGroupDto } from '../../finance-category-group/dto/create-finance-category-group.dto.js';

describe('Personal categories application rules', () => {
  const manager = {} as EntityManager;
  const service = Object.create(
    FinanceCategoryService.prototype,
  ) as FinanceCategoryService;
  beforeEach(() => {
    service.transaction = vi.fn(async (work) => work(manager));
    service.findOwned = vi.fn(async () =>
      Object.assign(new FinanceCategory(), {
        id: '10',
        user_id: '1',
        name: 'Food',
        key: 'food',
        is_active: true,
      }),
    );
    service.save = vi.fn(async (_manager, entity) => entity);
    service.insert = vi.fn(async (_manager, data) =>
      Object.assign(new FinanceCategory(), data, { id: '10' }),
    );
  });

  it('archives a category while preserving key/name and returning the authenticated owner ID', async () => {
    const result = await new UpdateFinanceCategoryUseCase(service).execute(
      '1',
      '10',
      { is_active: false },
    );
    expect(result).toMatchObject({
      id: '10',
      name: 'Food',
      key: 'food',
      is_active: false,
    });
    expect(result.user_id).toBe('1');
    expect(result).not.toHaveProperty('user');
    expect(service.findOwned).toHaveBeenCalledWith('1', '10', manager, true);
  });

  it('does not modify a category missing from the authenticated scope', async () => {
    service.findOwned = vi.fn(async () => null);
    await expect(
      new UpdateFinanceCategoryUseCase(service).execute('2', '10', {
        name: 'Overwrite',
      }),
    ).rejects.toThrow('finance:category_not_found');
    expect(service.save).not.toHaveBeenCalled();
    await expect(
      new GetFinanceCategoryUseCase(service).execute('2', '10'),
    ).rejects.toThrow('finance:category_not_found');
  });

  it('creates under authenticated ownership and maps a uniqueness race safely', async () => {
    const result = await new CreateFinanceCategoryUseCase(service).execute(
      '1',
      { name: 'Food', key: 'food' },
    );
    expect(result.is_active).toBe(true);
    expect(service.insert).toHaveBeenCalledWith(manager, {
      user_id: '1',
      name: 'Food',
      key: 'food',
      is_active: true,
    });
    service.insert = vi.fn(async () => {
      throw Object.assign(new Error('sensitive SQL'), { code: '23505' });
    });
    await expect(
      new CreateFinanceCategoryUseCase(service).execute('1', {
        name: 'Food',
        key: 'food',
      }),
    ).rejects.toThrow('finance:duplicate_key');
  });

  it('DTO rejects null updates and user_id injection, while trimming public strings', async () => {
    const invalid = plainToInstance(UpdateFinanceCategoryDto, {
      name: null,
      is_active: null,
      user_id: '2',
    });
    expect(
      (await validate(invalid, { whitelist: true, forbidNonWhitelisted: true }))
        .length,
    ).toBeGreaterThan(0);
    const valid = plainToInstance(CreateFinanceCategoryDto, {
      name: '  Food  ',
      key: ' food ',
    });
    expect(await validate(valid)).toEqual([]);
    expect(valid).toMatchObject({ name: 'Food', key: 'food' });
  });

  it('group selection DTO rejects duplicate, oversized and imprecise IDs', async () => {
    for (const category_ids of [
      ['2', '2'],
      ['9223372036854775808'],
      ['1.1'],
      [2],
      Array.from({ length: 101 }, (_, index) => String(index + 1)),
    ]) {
      const dto = plainToInstance(CreateFinanceCategoryGroupDto, {
        name: 'Expenses',
        key: 'expenses',
        category_ids,
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    }
    expect(
      await validate(
        plainToInstance(CreateFinanceCategoryGroupDto, {
          name: 'Expenses',
          key: 'expenses',
          category_ids: [],
        }),
      ),
    ).toEqual([]);
  });
});
