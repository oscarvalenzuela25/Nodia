import type { FinanceCategoryGroup } from '../entities/finance-category-group.entity.js';
import type { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';

export function financeCategoryGroupResponse(
  group: FinanceCategoryGroup,
  categoryCount: number,
) {
  return {
    id: group.id,
    user_id: group.user_id,
    name: group.name,
    key: group.key,
    is_active: group.is_active,
    created_at: group.created_at,
    updated_at: group.updated_at,
    category_count: categoryCount,
  };
}

export function financeCategoryGroupDetail(
  group: FinanceCategoryGroup,
  categories: FinanceCategory[],
) {
  return {
    ...financeCategoryGroupResponse(group, categories.length),
    categories: categories.map(({ id, name, key, is_active }) => ({
      id,
      name,
      key,
      is_active,
    })),
  };
}
