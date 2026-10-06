import type {
  FinanceActive,
  FinancePage,
} from '../../finance-common/types/finance.types.js';

export interface FinanceOverviewScope {
  active: FinanceActive;
  movement_filters: {
    q: Record<string, unknown>;
    category_ids: string[];
    category_group_ids: string[];
    obligation_id: string | null;
  };
  obligation_balances: {
    active: FinanceActive;
    repayments: 'all_confirmed_history';
    includes_inactive_repayments: true;
    ignores_movement_filters: true;
  };
}

export interface FinanceMovementTotalsRow {
  income_amount: string;
  expense_amount: string;
  movement_count: string;
  pending_count: string;
  cancelled_count: string;
}

export interface FinanceOverviewCountsRow {
  categories: string;
  category_groups: string;
  loans: string;
  debts: string;
}

export interface FinanceOverviewObligationsRow {
  loan_remaining_amount: string;
  debt_remaining_amount: string;
}

export interface FinanceOverview {
  scope: FinanceOverviewScope;
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
  obligations: FinanceOverviewObligationsRow;
}

export interface FinanceSummaryRow {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
  movement_count: string;
  income_amount: string;
  expense_amount: string;
}

export interface FinanceSummary extends Omit<
  FinanceSummaryRow,
  'movement_count'
> {
  movement_count: number;
  net_amount: string;
}

export interface FinanceSummaryPage extends FinancePage<FinanceSummary> {
  scope: FinanceOverviewScope;
  overlapping_groups?: true;
}
