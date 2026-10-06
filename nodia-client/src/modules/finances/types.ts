export type FinanceResource =
  "categories" | "category-groups" | "movements" | "obligations";
export type FinanceActive = "active" | "inactive" | "all";
export type FinanceMovementType = "income" | "expense";
export type FinanceMovementStatus =
  "pending" | "received" | "paid" | "cancelled";
export type FinanceObligationType = "loan" | "debt";

export interface FinanceRecord {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface FinanceCategory extends FinanceRecord {
  key: string;
}
export interface FinanceCategorySummary {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
}
export interface FinanceCategoryGroup extends FinanceRecord {
  key: string;
  category_count: number;
  categories?: FinanceCategorySummary[];
}
export interface FinanceMovement extends FinanceRecord {
  amount: string;
  type: FinanceMovementType;
  status: FinanceMovementStatus;
  category_id: string;
  obligation_id: string | null;
  category: { id: string; name: string; key: string };
  obligation: { id: string; name: string; type: FinanceObligationType } | null;
}
export interface FinanceObligation extends FinanceRecord {
  key: string;
  type: FinanceObligationType;
  amount: string;
  description: string | null;
  paid_amount: string;
  remaining_amount: string | null;
  initial_movement: {
    id: string;
    type: FinanceMovementType;
    status: FinanceMovementStatus;
    amount: string;
    category_id: string;
  };
}
export interface FinanceRecordMap {
  categories: FinanceCategory;
  "category-groups": FinanceCategoryGroup;
  movements: FinanceMovement;
  obligations: FinanceObligation;
}
export interface FinancePage<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}
export interface FinanceQuery {
  page?: number;
  limit?: number;
  active?: FinanceActive;
  q?: Record<string, string>;
  category_ids?: string[];
  category_group_ids?: string[];
  obligation_id?: string;
}
export interface FinanceScope {
  active: FinanceActive;
  movement_filters: {
    q: Record<string, string>;
    category_ids: string[];
    category_group_ids: string[];
    obligation_id: string | null;
  };
  obligation_balances: {
    active: FinanceActive;
    repayments: "all_confirmed_history";
    includes_inactive_repayments: true;
    ignores_movement_filters: true;
  };
}
export interface FinanceOverviewData {
  scope: FinanceScope;
  totals: {
    income_amount: string;
    expense_amount: string;
    net_amount: string;
    movement_count: number;
    pending_count: number;
    cancelled_count: number;
  };
  counts: {
    categories: number;
    category_groups: number;
    loans: number;
    debts: number;
  };
  obligations: { loan_remaining_amount: string; debt_remaining_amount: string };
}
export interface FinanceSummary {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
  movement_count: number;
  income_amount: string;
  expense_amount: string;
  net_amount: string;
}
export interface FinanceSummaryPage extends FinancePage<FinanceSummary> {
  scope: FinanceScope;
  overlapping_groups?: true;
}

export interface FinanceCreateMap {
  categories: { name: string; key: string; is_active?: boolean };
  "category-groups": {
    name: string;
    key: string;
    category_ids: string[];
    is_active?: boolean;
  };
  movements: {
    name: string;
    amount: string;
    type: FinanceMovementType;
    status: FinanceMovementStatus;
    category_id: string;
    obligation_id?: string | null;
    is_active?: boolean;
  };
  obligations: {
    name: string;
    key: string;
    type: FinanceObligationType;
    amount: string;
    category_id: string;
    description?: string | null;
    is_active?: boolean;
  };
}
export interface FinanceUpdateMap {
  categories: Partial<FinanceCreateMap["categories"]>;
  "category-groups": Partial<FinanceCreateMap["category-groups"]>;
  movements: Partial<Omit<FinanceCreateMap["movements"], "obligation_id">>;
  obligations: Partial<
    Omit<FinanceCreateMap["obligations"], "type" | "category_id">
  >;
}
export type FinanceMutationInput<R extends FinanceResource> =
  | { id?: undefined; data: FinanceCreateMap[R] }
  | { id: string; data: FinanceUpdateMap[R] };
