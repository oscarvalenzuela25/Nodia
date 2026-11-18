import type { EntityManager } from 'typeorm';
import type { BusinessCashMovementAuditOperation } from './entities/business-cash-movement-audit.entity.js';
import type { CashMovement } from './types/cash.types.js';
import { CashWriteRejection } from './use-case/execute-cash-mutation.use-case.js';

type SnapshotBase = Pick<
  CashMovement,
  | 'id'
  | 'business_id'
  | 'category_id'
  | 'amount'
  | 'occurred_on'
  | 'is_active'
  | 'version'
>;

export type InvoiceCashExpenseSnapshot = SnapshotBase & {
  source: 'invoice';
  type: 'expense';
  description: null;
  invoice_id: string;
  withdrawn_from_invoice: boolean;
};

type ManualCashMovementSnapshot = SnapshotBase & {
  source: 'manual';
  type: CashMovement['type'];
  description: string;
  invoice_id: null;
  withdrawn_from_invoice: false;
};

export type CashMovementSnapshot =
  ManualCashMovementSnapshot | InvoiceCashExpenseSnapshot;

export const CASH_MOVEMENT_SNAPSHOT_COLUMNS = `id, business_id, category_id::text, type,
  amount::text, to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, description,
  is_active, version, source, invoice_id::text, withdrawn_from_invoice`;

export const cashMovementNotFound = () =>
  new CashWriteRejection(404, 'business:resource_not_found');
export const cashMovementVersionConflict = () =>
  new CashWriteRejection(409, 'business:cash_version_conflict');

export async function lockCashMovementCategory(
  manager: EntityManager,
  businessId: string,
  categoryId: string,
): Promise<{ is_active: boolean } | undefined> {
  const [category] = await manager.query<{ is_active: boolean }[]>(
    `SELECT is_active FROM business_cash_categories
     WHERE id=$1 AND business_id=$2 FOR SHARE`,
    [categoryId, businessId],
  );
  return category;
}

export function assertCashMovementCategoryAssignable(
  category: { is_active: boolean } | undefined,
): void {
  if (!category) throw cashMovementNotFound();
  if (!category.is_active)
    throw new CashWriteRejection(409, 'business:cash_category_inactive');
}

export async function recordCashMovementAudit(
  manager: EntityManager,
  actorId: string,
  operation: BusinessCashMovementAuditOperation,
  before: CashMovementSnapshot | null,
  after: CashMovementSnapshot,
): Promise<void> {
  await manager.query(
    `INSERT INTO business_cash_movement_audit
       (movement_id, version, business_id, actor_id, operation, "before", "after")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
    [
      after.id,
      after.version,
      after.business_id,
      actorId,
      operation,
      before ? JSON.stringify(before) : null,
      JSON.stringify(after),
    ],
  );
}
