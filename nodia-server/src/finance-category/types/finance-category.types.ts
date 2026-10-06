import type { FinanceCategory } from '../entities/finance-category.entity.js';

export interface FinanceCategoryResponse {
  id: string;
  user_id: string;
  name: string;
  key: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export function financeCategoryResponse(
  category: FinanceCategory,
): FinanceCategoryResponse {
  return {
    id: category.id,
    user_id: category.user_id,
    name: category.name,
    key: category.key,
    is_active: category.is_active,
    created_at: category.created_at,
    updated_at: category.updated_at,
  };
}
