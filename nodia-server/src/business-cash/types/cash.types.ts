export interface CashCategory {
  id: string;
  business_id: string;
  name: string;
  description: string;
  is_active: boolean;
  version: number;
}

export type CashMovementType = 'income' | 'expense';

export interface CashMovement {
  id: string;
  business_id: string;
  category_id: string;
  category: Pick<CashCategory, 'id' | 'name' | 'is_active'>;
  type: CashMovementType;
  amount: string;
  occurred_on: string;
  description: string;
  is_active: boolean;
  version: number;
  source: 'manual';
  invoice: null;
}

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

interface CashMutationResults {
  category_create: { category: CashCategory };
  category_update: { category: CashCategory };
  movement_create: { movement: CashMovement };
  movement_update: { movement: CashMovement };
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
