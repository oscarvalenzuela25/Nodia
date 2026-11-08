import type { EntityManager } from 'typeorm';
import { assertCoreAuthorityTransaction } from '../authorization/core-authority-transaction.js';
import { validateCatalogId } from '../common/dto/catalog-id.dto.js';
import { parseNextSortOrder } from './order-policy.js';

export async function nextModuleSortOrder(
  manager: EntityManager,
  moduleGroupId: string,
): Promise<number> {
  assertCoreAuthorityTransaction(manager);
  validateCatalogId(moduleGroupId);
  const rows: { next_sort_order: string }[] = await manager.query(
    'SELECT COALESCE(MAX(sort_order)::bigint, -1) + 1 AS next_sort_order FROM modules WHERE module_group_id = $1',
    [moduleGroupId],
  );
  return parseNextSortOrder(rows[0]?.next_sort_order);
}

export async function nextModuleGroupSortOrder(
  manager: EntityManager,
): Promise<number> {
  assertCoreAuthorityTransaction(manager);
  const rows: { next_sort_order: string }[] = await manager.query(
    'SELECT COALESCE(MAX(sort_order)::bigint, -1) + 1 AS next_sort_order FROM module_groups',
  );
  return parseNextSortOrder(rows[0]?.next_sort_order);
}
