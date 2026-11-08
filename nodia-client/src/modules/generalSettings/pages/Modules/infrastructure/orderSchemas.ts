import { z } from "zod";
import type { MoveOrderCommand, OrderMoveResult } from "../types";

const catalogId = z.string().refine((value) =>
  /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n,
);
const sortOrder = z.number().int().min(0).max(2147483647);
const neighbor = z.strictObject({ id: catalogId, sort_order: sortOrder });
const ordering = z.strictObject({ previous: neighbor.nullable(), next: neighbor.nullable() });
const command = {
  expected_sort_order: sortOrder,
  page_size: z.number().int().min(1).max(100).optional(),
};
const arrowCommand = { direction: z.enum(["up", "down"]), expected_neighbor: neighbor.nullable() };
const targetCommand = { direction: z.enum(["before", "after"]), expected_neighbor: neighbor };
export const moduleMoveCommandSchema = z.discriminatedUnion("direction", [
  z.strictObject({ ...command, ...arrowCommand, expected_module_group_id: catalogId }),
  z.strictObject({ ...command, ...targetCommand, expected_module_group_id: catalogId }),
]);
export const groupMoveCommandSchema = z.discriminatedUnion("direction", [
  z.strictObject({ ...command, ...arrowCommand }),
  z.strictObject({ ...command, ...targetCommand }),
]);
const resultSchema = z.strictObject({
  status: z.enum(["moved", "unchanged"]), id: catalogId,
  module_group_id: catalogId.optional(), sort_order: sortOrder,
  previous: neighbor.nullable(), next: neighbor.nullable(),
  position: z.number().int().positive().safe(), page: z.number().int().positive().safe(),
});
const groupRow = z.looseObject({ id: catalogId, key: z.string(), sort_order: sortOrder, ordering });
const moduleRow = z.looseObject({
  id: catalogId, key: z.string(), module_group_id: catalogId, sort_order: sortOrder,
  ordering, group_ordering: ordering,
  module_group: z.looseObject({ id: catalogId, key: z.string(), sort_order: sortOrder }).optional(),
});
const meta = z.looseObject({
  page: z.number().int().positive(), limit: z.number().int().min(1).max(100),
  total_items: z.number().int().min(0).safe(), total_pages: z.number().int().min(0).safe(),
});
const modulePage = z.looseObject({ data: z.array(moduleRow).max(100), meta });
const groupPage = z.looseObject({ data: z.array(groupRow).max(100), meta });

export class InvalidOrderResponseError extends Error {
  constructor() { super("modules:ordering.invalid_response"); }
}

function validNeighbors(
  id: string,
  rank: number | undefined,
  metadata: z.infer<typeof ordering>,
): boolean {
  const { previous, next } = metadata;
  return previous?.id !== id && next?.id !== id &&
    !(previous && next && previous.id === next.id) &&
    !(rank !== undefined && previous && previous.sort_order >= rank) &&
    !(rank !== undefined && next && next.sort_order <= rank);
}

export function validateOrderingPage<T>(value: T, kind: "module" | "group", requireGroup = false): T {
  if (kind === "module") {
    const parsed = modulePage.safeParse(value);
    if (!parsed.success || parsed.data.data.length > parsed.data.meta.limit || parsed.data.data.some((item) =>
      !validNeighbors(item.id, item.sort_order, item.ordering) ||
      (requireGroup && !item.module_group) ||
      (item.module_group && item.module_group.id !== item.module_group_id) ||
      !validNeighbors(item.module_group_id, item.module_group?.sort_order, item.group_ordering),
    )) throw new InvalidOrderResponseError();
  } else {
    const parsed = groupPage.safeParse(value);
    if (!parsed.success || parsed.data.data.length > parsed.data.meta.limit || parsed.data.data.some((item) =>
      !validNeighbors(item.id, item.sort_order, item.ordering),
    )) throw new InvalidOrderResponseError();
  }
  return value;
}

export function parseOrderMoveResult(
  value: unknown,
  kind: "module" | "group",
  id: string,
  submitted: MoveOrderCommand & { expected_module_group_id?: string },
): OrderMoveResult {
  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) throw new InvalidOrderResponseError();
  const data = parsed.data;
  const placementValid = submitted.direction === "before" || submitted.direction === "after"
    ? (submitted.direction === "before" ? data.next : data.previous)?.id === submitted.expected_neighbor.id &&
      (data.status === "moved" ? data.sort_order !== submitted.expected_sort_order : data.sort_order === submitted.expected_sort_order)
    : data.status === "moved"
      ? submitted.expected_neighbor !== null && data.sort_order === submitted.expected_neighbor.sort_order
      : submitted.expected_neighbor === null && data.sort_order === submitted.expected_sort_order;
  if (data.id !== id || data.page !== Math.ceil(data.position / (submitted.page_size ?? 10)) ||
    (kind === "module" ? data.module_group_id !== submitted.expected_module_group_id : data.module_group_id !== undefined) ||
    !validNeighbors(data.id, data.sort_order, data) ||
    !placementValid) {
    throw new InvalidOrderResponseError();
  }
  return data;
}

export function validateOrderId(id: string): void { catalogId.parse(id); }
