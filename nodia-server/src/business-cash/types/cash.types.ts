export interface CashCategory {
  id: string;
  business_id: string;
  name: string;
  description: string;
  is_active: boolean;
  version: number;
}

export type CashMovementType = 'income' | 'expense';

interface CashMovementBase {
  id: string;
  business_id: string;
  category_id: string;
  category: Pick<CashCategory, 'id' | 'name' | 'is_active'>;
  amount: string;
  occurred_on: string;
  is_active: boolean;
  version: number;
}

export type CashMovement = CashMovementBase &
  (
    | {
        type: CashMovementType;
        source: 'manual';
        description: string;
        invoice: null;
      }
    | {
        type: 'expense';
        source: 'invoice';
        description: null;
        invoice: { id: string; code: string | null };
      }
  );

interface CashTotals {
  count: number;
  total_amount: string;
}

export interface CashSummary {
  currency: 'CLP';
  income: CashTotals;
  expense: CashTotals;
}

export interface CashMonthlySummary {
  period: { from: string; to: string; time_zone: 'America/Santiago' };
  summary: CashSummary;
}

export interface CashInvoiceResult {
  invoice_id: string;
  invoice_version: number;
  cash_movement_id: string | null;
}

interface CashMutationResults {
  category_create: { category: CashCategory };
  category_update: { category: CashCategory };
  movement_create: { movement: CashMovement };
  movement_update: { movement: CashMovement };
  invoice_create: CashInvoiceResult;
  invoice_update: CashInvoiceResult;
  invoice_ocr_confirm: CashInvoiceResult & {
    products: { id: string; version: number }[];
  };
}

export type CashOperation = keyof CashMutationResults;
export type CashMutationPayload<Operation extends CashOperation> =
  CashMutationResults[Operation];

export interface CashRejectedResult {
  status_code: number;
  message: string;
}

interface IdentifiedCashResult<Operation extends CashOperation> {
  request_key: string;
  operation: Operation;
}

export type CashMutationResult<Operation extends CashOperation> =
  IdentifiedCashResult<Operation> &
    (
      | { status: 'committed'; result: CashMutationPayload<Operation> }
      | { status: 'processing' }
    );

export type KnownCashReceipt<Operation extends CashOperation> =
  | CashMutationResult<Operation>
  | (IdentifiedCashResult<Operation> &
      (
        | { status: 'retryable' }
        | { status: 'rejected'; error: CashRejectedResult }
      ));

export type CashMutationReceipt =
  | KnownCashReceipt<CashOperation>
  | { request_key: string; status: 'unconfirmed' };
