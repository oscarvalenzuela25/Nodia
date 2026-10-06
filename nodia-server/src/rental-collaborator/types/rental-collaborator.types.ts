import type { RentalCollaborator } from '../entities/rental-collaborator.entity.js';

export function rentalCollaboratorResponse(row: RentalCollaborator) {
  return {
    id: row.id,
    property_id: row.property_id,
    user_id: row.user_id,
    position: row.position,
    is_active: row.is_active,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    user: {
      id: row.user_id,
      name: row.relation_user_id?.name ?? null,
      image_url: row.relation_user_id?.image_url ?? null,
    },
  };
}
