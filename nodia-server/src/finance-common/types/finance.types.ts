export type FinanceActive = 'active' | 'inactive' | 'all';

export interface FinancePage<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}
