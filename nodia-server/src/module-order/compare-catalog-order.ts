export function compareCatalogOrder(
  left: { id: string; sort_order: number },
  right: { id: string; sort_order: number },
): number {
  const order = left.sort_order - right.sort_order;
  if (order) return order;
  const leftId = BigInt(left.id);
  const rightId = BigInt(right.id);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}
