import type { RentalExpense } from '../entities/rental-expense.entity.js';

export function projectRentalExpense(row: RentalExpense) {
  return {
    id: row.id,
    property_id: row.property_id,
    reservation_id: row.reservation_id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    incurred_on: row.incurred_on,
    paid_on: row.paid_on,
    status: row.status,
    notes: row.notes,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
