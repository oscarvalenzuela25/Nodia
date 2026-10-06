import type { RentalTurnover } from '../entities/rental-turnover.entity.js';
export function projectTurnover(row: RentalTurnover) {
  return {
    id: row.id,
    property_id: row.property_id,
    incoming_reservation_id: row.incoming_reservation_id,
    previous_reservation_id: row.previous_reservation_id,
    linen_ready: row.linen_ready,
    cleaning_status: row.cleaning_status,
    planned_ready_at: row.planned_ready_at?.toISOString() ?? null,
    ready_at: row.ready_at?.toISOString() ?? null,
    same_day_approved_at: row.same_day_approved_at?.toISOString() ?? null,
    notes: row.notes,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
