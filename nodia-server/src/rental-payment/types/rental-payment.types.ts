import type { RentalPayment } from '../entities/rental-payment.entity.js';

export function projectRentalPayment(row: RentalPayment) {
  return {
    id: row.id,
    property_id: row.property_id,
    reservation_id: row.reservation_id,
    type: row.type,
    amount: row.amount,
    occurred_on: row.occurred_on,
    method: row.method,
    reference: row.reference,
    notes: row.notes,
    status: row.status,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
