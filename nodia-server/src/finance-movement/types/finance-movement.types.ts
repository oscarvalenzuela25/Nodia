import type { FinanceMovement } from '../entities/finance-movement.entity.js';

export function projectMovement(movement: FinanceMovement) {
  return {
    id: movement.id,
    user_id: movement.user_id,
    name: movement.name,
    amount: movement.amount,
    type: movement.type,
    status: movement.status,
    category_id: movement.category_id,
    obligation_id: movement.obligation_id,
    is_active: movement.is_active,
    created_at: movement.created_at,
    updated_at: movement.updated_at,
    category: {
      id: movement.category.id,
      name: movement.category.name,
      key: movement.category.key,
    },
    obligation:
      movement.obligation === null
        ? null
        : {
            id: movement.obligation.id,
            name: movement.obligation.name,
            type: movement.obligation.type,
          },
  };
}
