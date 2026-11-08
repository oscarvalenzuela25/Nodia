import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { assertCoreAuthorityTransaction } from '../authorization/core-authority-transaction.js';
import {
  assertExpectedOrder,
  rotateOrderRange,
  type MoveOrderCommand,
  type OrderMoveResult,
  type OrderNeighbor,
} from './order-policy.js';

type OrderedRow = OrderNeighbor & { module_group_id?: string };
type PositionRow = OrderedRow & {
  position: string;
  previous_id: string | null;
  previous_sort_order: number | null;
  next_id: string | null;
  next_sort_order: number | null;
};

export async function moveCatalogOrder(
  manager: EntityManager,
  resource: 'module' | 'module-group',
  id: string,
  command: MoveOrderCommand,
  expectedGroupId?: string,
): Promise<OrderMoveResult> {
  assertCoreAuthorityTransaction(manager);
  const module = resource === 'module';
  const table = module ? 'modules' : 'module_groups';
  const constraint = module
    ? 'uq_modules_group_sort_order'
    : 'uq_module_groups_sort_order';
  const currentRows: OrderedRow[] = await manager.query(
    `SELECT id::text, sort_order${module ? ', module_group_id::text' : ''} FROM ${table} WHERE id = $1`,
    [id],
  );
  const current = currentRows[0];
  if (!current)
    throw new NotFoundException(
      module ? 'modules:not_found' : 'modules:groups.not_found',
    );
  if (module && current.module_group_id !== expectedGroupId)
    throw new ConflictException('modules:order_conflict');
  let changes: OrderNeighbor[];
  if (command.direction === 'before' || command.direction === 'after') {
    const targets: OrderedRow[] = await manager.query(
      `SELECT id::text, sort_order${module ? ', module_group_id::text' : ''} FROM ${table} WHERE id = $1`,
      [command.expected_neighbor?.id],
    );
    const target = targets[0];
    if (!target || (module && target.module_group_id !== current.module_group_id))
      throw new ConflictException('modules:order_conflict');
    assertExpectedOrder(current, target, command);
    const parameters: (string | number)[] = [
      Math.min(current.sort_order, target.sort_order),
      Math.max(current.sort_order, target.sort_order),
    ];
    if (module) parameters.push(current.module_group_id!);
    const interval: OrderNeighbor[] = await manager.query(
      `SELECT id::text, sort_order FROM ${table} WHERE sort_order BETWEEN $1 AND $2${module ? ' AND module_group_id = $3' : ''} ORDER BY sort_order, id`,
      parameters,
    );
    changes = rotateOrderRange(interval, current.id, target.id, command.direction);
  } else {
    const parameters: (string | number)[] = [current.sort_order];
    if (module) parameters.push(current.module_group_id!);
    const up = command.direction === 'up';
    const neighbors: OrderedRow[] = await manager.query(
      `SELECT id::text, sort_order FROM ${table} WHERE sort_order ${up ? '<' : '>'} $1${module ? ' AND module_group_id = $2' : ''} ORDER BY sort_order ${up ? 'DESC' : 'ASC'} LIMIT 1`,
      parameters,
    );
    const neighbor = neighbors[0] ?? null;
    assertExpectedOrder(current, neighbor, command);
    changes = neighbor
      ? [
          { id: current.id, sort_order: neighbor.sort_order },
          { id: neighbor.id, sort_order: current.sort_order },
        ]
      : [];
  }
  if (changes.length > 0) {
    await manager.query(`SET CONSTRAINTS ${constraint} DEFERRED`);
    await manager.query(
      `UPDATE ${table} AS target SET sort_order = changed.sort_order, updated_at = clock_timestamp() FROM unnest($1::bigint[], $2::integer[]) AS changed(id, sort_order) WHERE target.id = changed.id`,
      [changes.map((row) => row.id), changes.map((row) => row.sort_order)],
    );
    await manager.query(`SET CONSTRAINTS ${constraint} IMMEDIATE`);
  }
  const rows: PositionRow[] = await manager.query(
    module
      ? `
    WITH ordered AS (
      SELECT m.id::text, m.module_group_id::text, m.sort_order,
        row_number() OVER (ORDER BY g.sort_order, g.id, m.sort_order, m.id)::text AS position,
        lag(m.id::text) OVER (PARTITION BY m.module_group_id ORDER BY m.sort_order, m.id) AS previous_id,
        lag(m.sort_order) OVER (PARTITION BY m.module_group_id ORDER BY m.sort_order, m.id) AS previous_sort_order,
        lead(m.id::text) OVER (PARTITION BY m.module_group_id ORDER BY m.sort_order, m.id) AS next_id,
        lead(m.sort_order) OVER (PARTITION BY m.module_group_id ORDER BY m.sort_order, m.id) AS next_sort_order
      FROM modules m JOIN module_groups g ON g.id = m.module_group_id
    ) SELECT * FROM ordered WHERE id = $1`
      : `
    WITH ordered AS (
      SELECT id::text, sort_order,
        row_number() OVER (ORDER BY sort_order, id)::text AS position,
        lag(id::text) OVER (ORDER BY sort_order, id) AS previous_id,
        lag(sort_order) OVER (ORDER BY sort_order, id) AS previous_sort_order,
        lead(id::text) OVER (ORDER BY sort_order, id) AS next_id,
        lead(sort_order) OVER (ORDER BY sort_order, id) AS next_sort_order
      FROM module_groups
    ) SELECT * FROM ordered WHERE id = $1`,
    [id],
  );
  const result = rows[0];
  const position = Number(result?.position);
  if (!result || !Number.isSafeInteger(position) || position < 1)
    throw new ConflictException('modules:order_conflict');
  return {
    status: changes.length > 0 ? 'moved' : 'unchanged',
    id: result.id,
    ...(module ? { module_group_id: result.module_group_id } : {}),
    sort_order: result.sort_order,
    previous:
      result.previous_id === null
        ? null
        : { id: result.previous_id, sort_order: result.previous_sort_order! },
    next:
      result.next_id === null
        ? null
        : { id: result.next_id, sort_order: result.next_sort_order! },
    position,
    page: Math.ceil(position / (command.page_size ?? 10)),
  };
}
