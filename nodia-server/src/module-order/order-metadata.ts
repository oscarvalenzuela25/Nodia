import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { OrderNeighbor } from './order-policy.js';
import { validateCatalogId } from '../common/dto/catalog-id.dto.js';

export type OrderMetadata = {
  previous: OrderNeighbor | null;
  next: OrderNeighbor | null;
};

type OrderRow = {
  id: string;
  previous_id: string | null;
  previous_sort_order: number | null;
  next_id: string | null;
  next_sort_order: number | null;
};

export function assertOrderView(options: {
  ordering?: boolean;
  all?: boolean;
  limit?: number;
  q?: object;
}): void {
  if (!options.ordering) return;
  const limit = options.limit ?? 10;
  if (options.all || !Number.isInteger(limit) || limit < 1 || limit > 100 || Object.keys(options.q ?? {}).length)
    throw new BadRequestException('modules:invalid_order_view');
}

export async function locateModuleOrderPage(
  manager: EntityManager,
  id: string,
  limit: number,
): Promise<number> {
  validateCatalogId(id);
  assertOrderView({ ordering: true, limit });
  const rows = await manager.query<{ position: string }[]>(
    `WITH ordered AS (
       SELECT m.id, row_number() OVER (
         ORDER BY g.sort_order, g.id, m.sort_order, m.id
       )::text AS position
       FROM modules m JOIN module_groups g ON g.id = m.module_group_id
     ) SELECT position FROM ordered WHERE id = $1`,
    [id],
  );
  if (!rows[0]) throw new NotFoundException('modules:not_found');
  const position = Number(rows[0].position);
  if (!Number.isSafeInteger(position) || position < 1)
    throw new InternalServerErrorException('modules:invalid_order_metadata');
  return Math.ceil(position / limit);
}

function neighbor(id: string | null, sortOrder: number | null): OrderNeighbor | null {
  if (id === null && sortOrder === null) return null;
  if (id === null || sortOrder === null)
    throw new InternalServerErrorException('modules:invalid_order_metadata');
  return { id, sort_order: sortOrder };
}

function metadata(row: OrderRow | undefined): OrderMetadata {
  if (!row) throw new InternalServerErrorException('modules:invalid_order_metadata');
  return {
    previous: neighbor(row.previous_id, row.previous_sort_order),
    next: neighbor(row.next_id, row.next_sort_order),
  };
}

export async function attachGroupOrderMetadata<T extends { id: string }>(
  manager: EntityManager,
  items: T[],
): Promise<Array<T & { ordering: OrderMetadata }>> {
  if (items.length === 0) return [];
  const rows = await manager.query<OrderRow[]>(
    `WITH ordered_groups AS (
       SELECT id::text AS id,
              LAG(id) OVER w AS previous_id,
              LAG(sort_order) OVER w AS previous_sort_order,
              LEAD(id) OVER w AS next_id,
              LEAD(sort_order) OVER w AS next_sort_order
       FROM module_groups WINDOW w AS (ORDER BY sort_order, id)
     )
     SELECT id, previous_id::text, previous_sort_order, next_id::text, next_sort_order
     FROM ordered_groups WHERE id::bigint = ANY($1::bigint[])`,
    [items.map((item) => item.id)],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return items.map((item) => ({ ...item, ordering: metadata(byId.get(item.id)) }));
}

export async function attachModuleOrderMetadata<T extends { id: string; module_group_id: string }>(
  manager: EntityManager,
  items: T[],
): Promise<Array<T & { ordering: OrderMetadata; group_ordering: OrderMetadata }>> {
  if (items.length === 0) return [];
  const groups = await attachGroupOrderMetadata(
    manager,
    [...new Set(items.map((item) => item.module_group_id))].map((id) => ({ id })),
  );
  const groupsById = new Map(groups.map((group) => [group.id, group.ordering]));
  const rows = await manager.query<OrderRow[]>(
    `WITH ordered_modules AS (
       SELECT id::text AS id,
              LAG(id) OVER w AS previous_id,
              LAG(sort_order) OVER w AS previous_sort_order,
              LEAD(id) OVER w AS next_id,
              LEAD(sort_order) OVER w AS next_sort_order
       FROM modules WHERE module_group_id = ANY($1::bigint[])
       WINDOW w AS (PARTITION BY module_group_id ORDER BY sort_order, id)
     )
     SELECT id, previous_id::text, previous_sort_order, next_id::text, next_sort_order
     FROM ordered_modules WHERE id::bigint = ANY($2::bigint[])`,
    [groups.map((group) => group.id), items.map((item) => item.id)],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return items.map((item) => {
    const groupOrdering = groupsById.get(item.module_group_id);
    if (!groupOrdering) throw new InternalServerErrorException('modules:invalid_order_metadata');
    return {
      ...item,
      ordering: metadata(byId.get(item.id)),
      group_ordering: groupOrdering,
    };
  });
}
