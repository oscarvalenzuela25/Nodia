import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertExpectedOrder,
  MAX_SORT_ORDER,
  parseNextSortOrder,
  rotateOrderRange,
  validateMoveOrderCommand,
  type MoveOrderCommand,
} from './order-policy.js';

const command = (): MoveOrderCommand => ({
  direction: 'down',
  expected_sort_order: 0,
  expected_neighbor: { id: '9007199254740993', sort_order: 4 },
});

describe('module order policy', () => {
  it.each([0, '0', 1, '1', MAX_SORT_ORDER, String(MAX_SORT_ORDER)])(
    'preserves the valid next database position %s',
    (value) => {
      expect(parseNextSortOrder(value)).toBe(Number(value));
    },
  );

  it.each([
    -1,
    MAX_SORT_ORDER + 1,
    '2147483648',
    NaN,
    Infinity,
    undefined,
    null,
    '',
    'bad',
  ])(
    'rejects exhausted or invalid allocation %s instead of wrapping to zero',
    (value) => {
      expect(() => parseNextSortOrder(value)).toThrow(ConflictException);
    },
  );

  it('preserves bigint identities and accepts valid holes between positions', () => {
    const input = command();
    validateMoveOrderCommand('9007199254740995', input);
    assertExpectedOrder(
      { id: '9007199254740995', sort_order: 0 },
      input.expected_neighbor,
      input,
    );
    expect(input.expected_neighbor?.id).toBe('9007199254740993');
  });

  it.each([
    { direction: 'sideways' },
    { expected_sort_order: -1 },
    { expected_sort_order: 1.2 },
    { expected_sort_order: '0' },
    { page_size: 0 },
    { page_size: 101 },
    { page_size: '10' },
    { expected_neighbor: undefined },
    { expected_neighbor: [] },
    { expected_neighbor: { id: '2', sort_order: -1 } },
    { expected_neighbor: { id: '1', sort_order: 4 } },
    { expected_neighbor: { id: '9223372036854775808', sort_order: 4 } },
  ])('rejects malformed or self-referential command %j', (fields) => {
    expect(() =>
      validateMoveOrderCommand('1', {
        ...command(),
        ...fields,
      } as MoveOrderCommand),
    ).toThrow(BadRequestException);
  });

  it('accepts null only as an explicit absent neighbor at an actual boundary', () => {
    const input = {
      ...command(),
      direction: 'up' as const,
      expected_neighbor: null,
    };
    validateMoveOrderCommand('1', input);
    expect(() =>
      assertExpectedOrder({ id: '1', sort_order: 0 }, null, input),
    ).not.toThrow();
    expect(() =>
      assertExpectedOrder(
        { id: '1', sort_order: 0 },
        { id: '2', sort_order: 1 },
        input,
      ),
    ).toThrow(ConflictException);
  });

  it.each(['before', 'after'] as const)('requires an explicit target for %s', (direction) => {
    const input = { ...command(), direction };
    expect(() => validateMoveOrderCommand('1', input)).not.toThrow();
    expect(() => validateMoveOrderCommand('1', { ...input, expected_neighbor: null }))
      .toThrow(BadRequestException);
    expect(() => validateMoveOrderCommand('1', { ...input, expected_neighbor: { id: '1', sort_order: 0 } }))
      .toThrow(BadRequestException);
  });

  it.each([
    { current: 1, neighbor: { id: '9007199254740993', sort_order: 4 } },
    { current: 0, neighbor: { id: '2', sort_order: 4 } },
    { current: 0, neighbor: { id: '9007199254740993', sort_order: 5 } },
    { current: 0, neighbor: null },
  ])(
    'rejects stale positions and neighbors without accepting a different intent %j',
    ({ current, neighbor }) => {
      expect(() =>
        assertExpectedOrder(
          { id: '1', sort_order: current },
          neighbor,
          command(),
        ),
      ).toThrow(ConflictException);
    },
  );
});

describe('relative catalog order rotation', () => {
  const rows = [
    { id: '9007199254740993', sort_order: 0 },
    { id: '2', sort_order: 4 },
    { id: '3', sort_order: 20 },
    { id: '4', sort_order: MAX_SORT_ORDER },
  ];
  const reordered = (source: string, target: string, direction: 'before' | 'after') => {
    const changes = new Map(rotateOrderRange(rows, source, target, direction)
      .map((row) => [row.id, row.sort_order]));
    return rows.map((row) => ({ ...row, sort_order: changes.get(row.id) ?? row.sort_order }))
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  it.each([
    { source: '9007199254740993', target: '4', direction: 'before', ids: ['2', '3', '9007199254740993', '4'] },
    { source: '9007199254740993', target: '4', direction: 'after', ids: ['2', '3', '4', '9007199254740993'] },
    { source: '4', target: '9007199254740993', direction: 'before', ids: ['4', '9007199254740993', '2', '3'] },
    { source: '4', target: '9007199254740993', direction: 'after', ids: ['9007199254740993', '4', '2', '3'] },
  ] as const)('moves relative to the target, preserving gaps and exact IDs: %j', (example) => {
    const output = reordered(example.source, example.target, example.direction);
    expect(output.map((row) => row.id)).toEqual(example.ids);
    expect(output.map((row) => row.sort_order)).toEqual([0, 4, 20, MAX_SORT_ORDER]);
    expect(rows[0]).toEqual({ id: '9007199254740993', sort_order: 0 });
  });

  it('already adjacent is unchanged and does not rotate unrelated positions', () => {
    expect(rotateOrderRange(rows, '2', '3', 'before')).toEqual([]);
    expect(rotateOrderRange(rows, '3', '2', 'after')).toEqual([]);
    expect(rotateOrderRange(rows.slice(0, 3), '3', '9007199254740993', 'before'))
      .toEqual([
        { id: '3', sort_order: 0 },
        { id: '9007199254740993', sort_order: 4 },
        { id: '2', sort_order: 20 },
      ]);
  });

  it.each([['absent', '2'], ['2', 'absent'], ['2', '2']])(
    'rejects an interval missing distinct source/target identities: %s/%s',
    (source, target) => {
      expect(() => rotateOrderRange(rows, source, target, 'before')).toThrow(ConflictException);
    },
  );
});
