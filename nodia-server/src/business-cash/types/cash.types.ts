export interface CashCategory {
  id: string;
  business_id: string;
  name: string;
  description: string;
  is_active: boolean;
  version: number;
}

export type CashCategoryOperation = 'category_create' | 'category_update';

export interface CashRejectedResult {
  status_code: number;
  message: string;
}

interface IdentifiedCashResult {
  request_key: string;
  operation: CashCategoryOperation;
}

export type CashCategoryMutationResult = IdentifiedCashResult &
  (
    | { status: 'committed'; result: { category: CashCategory } }
    | { status: 'processing' }
  );

export type CashMutationReceipt =
  | CashCategoryMutationResult
  | (IdentifiedCashResult &
      (
        | { status: 'retryable' }
        | { status: 'rejected'; error: CashRejectedResult }
      ))
  | { request_key: string; status: 'unconfirmed' };
