import type { RentalBlock } from '../entities/rental-block.entity.js';

export function projectRentalBlock(row: RentalBlock) {
  return {
    id: row.id,
    property_id: row.property_id,
    starts_at: row.starts_at.toISOString(),
    ends_at: row.ends_at.toISOString(),
    reason: row.reason,
    notes: row.notes,
    is_active: row.is_active,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
