import { BadRequestException, ConflictException } from '@nestjs/common';
import { validateCatalogId } from '../common/dto/catalog-id.dto.js';

export const MAX_SORT_ORDER = 2147483647;

export type OrderNeighbor = { id: string; sort_order: number };
export type MoveOrderCommand = {
  direction: 'up' | 'down' | 'before' | 'after';
  expected_sort_order: number;
  expected_neighbor: OrderNeighbor | null;
  page_size?: number;
};

export type OrderMoveResult = {
  status: 'moved' | 'unchanged';
  id: string;
  module_group_id?: string;
  sort_order: number;
  previous: OrderNeighbor | null;
  next: OrderNeighbor | null;
  position: number;
  page: number;
};

function isSortOrder(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_SORT_ORDER
  );
}

export function parseNextSortOrder(value: unknown): number {
  const parsed =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!isSortOrder(parsed))
    throw new ConflictException('modules:order_exhausted');
  return parsed;
}

export function validateMoveOrderCommand(
  id: string,
  command: MoveOrderCommand,
): void {
  validateCatalogId(id);
  if (!command || typeof command !== 'object' || Array.isArray(command))
    throw new BadRequestException('modules:invalid_order');
  if (
    !['up', 'down', 'before', 'after'].includes(command.direction) ||
    !isSortOrder(command.expected_sort_order) ||
    (command.page_size !== undefined &&
      (!Number.isInteger(command.page_size) ||
        command.page_size < 1 ||
        command.page_size > 100))
  ) {
    throw new BadRequestException('modules:invalid_order');
  }
  const neighbor = command.expected_neighbor;
  if (neighbor === null) {
    if (command.direction === 'before' || command.direction === 'after')
      throw new BadRequestException('modules:invalid_order');
    return;
  }
  if (
    !neighbor ||
    typeof neighbor !== 'object' ||
    Array.isArray(neighbor) ||
    !isSortOrder(neighbor.sort_order)
  )
    throw new BadRequestException('modules:invalid_order');
  validateCatalogId(neighbor.id);
  if (neighbor.id === id)
    throw new BadRequestException('modules:invalid_order');
}

/** Reuse the interval's existing ranks; holes and bigint identities survive. */
export function rotateOrderRange(
  rows: readonly OrderNeighbor[],
  sourceId: string,
  targetId: string,
  direction: 'before' | 'after',
): OrderNeighbor[] {
  const source = rows.find((row) => row.id === sourceId);
  if (!source || sourceId === targetId)
    throw new ConflictException('modules:order_conflict');
  const remaining = rows.filter((row) => row.id !== sourceId);
  const targetIndex = remaining.findIndex((row) => row.id === targetId);
  if (targetIndex < 0)
    throw new ConflictException('modules:order_conflict');
  const reordered = [...remaining];
  reordered.splice(targetIndex + (direction === 'after' ? 1 : 0), 0, source);
  return reordered.flatMap((row, index) =>
    row.sort_order === rows[index].sort_order
      ? []
      : [{ id: row.id, sort_order: rows[index].sort_order }],
  );
}

export function assertExpectedOrder(
  actual: OrderNeighbor,
  neighbor: OrderNeighbor | null,
  command: MoveOrderCommand,
): void {
  if (
    actual.sort_order !== command.expected_sort_order ||
    neighbor?.id !== command.expected_neighbor?.id ||
    neighbor?.sort_order !== command.expected_neighbor?.sort_order
  ) {
    throw new ConflictException('modules:order_conflict');
  }
}
