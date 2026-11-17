import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { readInvoiceCashExpense } from '../business-cash/invoice-cash-expense.js';

export const CASH_INVOICE_TRANSFER_NOT_ALLOWED =
  'business:cash_invoice_transfer_not_allowed';
export const CASH_INVOICE_REVIEW_REQUIRED =
  'business:cash_invoice_review_required';

interface InvoiceCashFields {
  business_id: string;
  total_amount: unknown;
  data: unknown;
}

function issueDate(data: unknown): unknown {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>).issue_date
    : undefined;
}

/** Called with the invoice locked. No cash lock is needed to inspect this stable link. */
export async function assertInvoiceCashCompatibility(
  manager: EntityManager,
  before: InvoiceCashFields & { id: string },
  candidate: InvoiceCashFields,
): Promise<void> {
  const moving = before.business_id !== candidate.business_id;
  if (
    !moving &&
    before.total_amount === candidate.total_amount &&
    issueDate(before.data) === issueDate(candidate.data)
  )
    return;

  const expense = await readInvoiceCashExpense(manager, before);
  if (expense && moving)
    throw new ConflictException(CASH_INVOICE_TRANSFER_NOT_ALLOWED);
  if (expense && !expense.withdrawn_from_invoice)
    throw new ConflictException(CASH_INVOICE_REVIEW_REQUIRED);
}
