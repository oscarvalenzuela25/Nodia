import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import {
  CASH_MOVEMENT_SNAPSHOT_COLUMNS,
  assertCashMovementCategoryAssignable,
  cashMovementVersionConflict,
  lockCashMovementCategory,
  recordCashMovementAudit,
  type InvoiceCashExpenseSnapshot,
} from './cash-movement-persistence.js';
import { CASH_MAX_VERSION } from './policies/cash-category.policy.js';
import { isCashMovementDate } from './policies/cash-movement-date.js';
import { CashWriteRejection } from './use-case/execute-cash-mutation.use-case.js';

export type { InvoiceCashExpenseSnapshot } from './cash-movement-persistence.js';

interface InvoiceIdentity {
  id: string;
  business_id: string;
}

interface InvoiceWithExpenseData extends InvoiceIdentity {
  total_amount: number;
  data: Record<string, unknown>;
}

interface InvoiceCashExpenseResult {
  movementId: string | null;
  changed: boolean;
}

export async function readInvoiceCashExpense(
  manager: EntityManager,
  invoice: InvoiceIdentity,
  lock = false,
): Promise<InvoiceCashExpenseSnapshot | undefined> {
  const [row] = await manager.query<InvoiceCashExpenseSnapshot[]>(
    `SELECT ${CASH_MOVEMENT_SNAPSHOT_COLUMNS} FROM business_cash_movements
     WHERE invoice_id=$1 AND business_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [invoice.id, invoice.business_id],
  );
  return row;
}

// The caller has already locked/inserted the invoice in this transaction.
// Every writer of an invoice's cash movement must acquire its invoice lock first.
export async function syncInvoiceCashExpense(
  manager: EntityManager,
  actorId: string,
  invoice: InvoiceWithExpenseData,
  cashCategoryId: string | null | undefined,
): Promise<InvoiceCashExpenseResult> {
  const existing = await readInvoiceCashExpense(manager, invoice);
  const categoryId =
    cashCategoryId === undefined && existing && !existing.withdrawn_from_invoice
      ? existing.category_id
      : cashCategoryId;

  if (categoryId == null) {
    if (!existing || existing.withdrawn_from_invoice)
      return { movementId: null, changed: false };
    const before = await readInvoiceCashExpense(manager, invoice, true);
    if (
      !before ||
      before.withdrawn_from_invoice ||
      before.version >= CASH_MAX_VERSION
    )
      throw cashMovementVersionConflict();
    const [after] = await manager.query<InvoiceCashExpenseSnapshot[]>(
      `WITH updated AS (
         UPDATE business_cash_movements
         SET withdrawn_from_invoice=true, version=version+1, updated_by=$3, updated_at=clock_timestamp()
         WHERE id=$1 AND business_id=$2
         RETURNING ${CASH_MOVEMENT_SNAPSHOT_COLUMNS}
       ) SELECT * FROM updated`,
      [before.id, invoice.business_id, actorId],
    );
    await recordCashMovementAudit(
      manager,
      actorId,
      'invoice_withdraw',
      before,
      after,
    );
    return { movementId: null, changed: true };
  }

  const issueDate = invoice.data?.issue_date;
  if (!isCashMovementDate(issueDate))
    throw new CashWriteRejection(400, 'business:cash_invoice_invalid_date');
  if (
    !Number.isInteger(invoice.total_amount) ||
    invoice.total_amount <= 0 ||
    invoice.total_amount > CASH_MAX_VERSION
  )
    throw new CashWriteRejection(400, 'business:cash_invoice_invalid_amount');
  const amount = String(invoice.total_amount);

  if (
    !existing ||
    existing.withdrawn_from_invoice ||
    existing.category_id !== categoryId
  )
    assertCashMovementCategoryAssignable(
      await lockCashMovementCategory(manager, invoice.business_id, categoryId),
    );

  const before = await readInvoiceCashExpense(manager, invoice, true);
  if (!before) {
    const [after] = await manager.query<InvoiceCashExpenseSnapshot[]>(
      `INSERT INTO business_cash_movements
         (id, business_id, category_id, type, amount, occurred_on, source, invoice_id, created_by, updated_by)
       VALUES ($1,$2,$3,'expense',$4,$5,'invoice',$6,$7,$7)
       RETURNING ${CASH_MOVEMENT_SNAPSHOT_COLUMNS}`,
      [
        randomUUID(),
        invoice.business_id,
        categoryId,
        amount,
        issueDate,
        invoice.id,
        actorId,
      ],
    );
    await recordCashMovementAudit(
      manager,
      actorId,
      'invoice_create',
      null,
      after,
    );
    return { movementId: after.id, changed: true };
  }

  if (
    !before.withdrawn_from_invoice &&
    before.category_id === categoryId &&
    before.amount === amount &&
    before.occurred_on === issueDate
  )
    return { movementId: before.id, changed: false };
  if (before.version >= CASH_MAX_VERSION) throw cashMovementVersionConflict();
  const [after] = await manager.query<InvoiceCashExpenseSnapshot[]>(
    `WITH updated AS (
       UPDATE business_cash_movements
       SET category_id=$3, amount=$4, occurred_on=$5,
           is_active=withdrawn_from_invoice OR is_active, withdrawn_from_invoice=false,
           version=version+1, updated_by=$6, updated_at=clock_timestamp()
       WHERE id=$1 AND business_id=$2
       RETURNING ${CASH_MOVEMENT_SNAPSHOT_COLUMNS}
     ) SELECT * FROM updated`,
    [before.id, invoice.business_id, categoryId, amount, issueDate, actorId],
  );
  await recordCashMovementAudit(
    manager,
    actorId,
    before.withdrawn_from_invoice ? 'invoice_restore' : 'invoice_update',
    before,
    after,
  );
  return { movementId: after.id, changed: true };
}
