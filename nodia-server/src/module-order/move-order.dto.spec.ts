import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { MoveModuleOrderDto } from '../module/dto/move-module-order.dto.js';
import { MoveModuleGroupOrderDto } from '../module-group/dto/move-module-group-order.dto.js';

const base = {
  direction: 'up',
  expected_sort_order: 4,
  expected_neighbor: null,
};
const errors = (value: object) =>
  validate(value, { whitelist: true, forbidNonWhitelisted: true });

describe('module order input contracts', () => {
  it('accepts an explicit boundary or a typed neighbor while preserving string IDs', async () => {
    for (const expected_neighbor of [
      null,
      { id: '9007199254740993', sort_order: 0 },
    ]) {
      const dto = plainToInstance(MoveModuleOrderDto, {
        ...base,
        expected_neighbor,
        expected_module_group_id: '9007199254740995',
        page_size: 20,
      });
      expect(await errors(dto)).toEqual([]);
      expect(dto.expected_neighbor?.id ?? null).toBe(
        expected_neighbor?.id ?? null,
      );
    }
  });

  it.each([
    { expected_neighbor: undefined },
    { expected_neighbor: '2' },
    { expected_neighbor: [] },
    { expected_neighbor: { id: '2' } },
    { expected_neighbor: { id: '2', sort_order: 1, unexpected: true } },
    { expected_sort_order: '4' },
    { expected_sort_order: -1 },
    { page_size: '20' },
    { page_size: 101 },
    { direction: 'UP' },
    { direction: 'before', expected_neighbor: null },
    { direction: 'after', expected_neighbor: null },
  ])('rejects non-contract input %j', async (fields) => {
    const dto = plainToInstance(MoveModuleGroupOrderDto, {
      ...base,
      ...fields,
    });
    expect((await errors(dto)).length).toBeGreaterThan(0);
  });

  it.each(['before', 'after'])('accepts %s with a typed non-null target', async (direction) => {
    const dto = plainToInstance(MoveModuleOrderDto, {
      ...base, direction, expected_module_group_id: '1',
      expected_neighbor: { id: '9007199254740993', sort_order: 20 },
    });
    expect(await errors(dto)).toEqual([]);
    expect(dto.expected_neighbor?.id).toBe('9007199254740993');
  });

  it('requires the expected module group rather than inferring another scope', async () => {
    expect(
      (await errors(plainToInstance(MoveModuleOrderDto, base))).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await errors(
          plainToInstance(MoveModuleGroupOrderDto, {
            ...base,
            expected_module_group_id: '2',
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
