import type { RentalProperty } from '../entities/rental-property.entity.js';

export function rentalPropertyResponse(
  property: RentalProperty,
  owner: boolean,
) {
  return {
    id: property.id,
    owner_id: property.owner_id,
    name: property.name,
    location: property.location,
    timezone: property.timezone,
    max_guests: property.max_guests,
    check_in_time: property.check_in_time.slice(0, 5),
    check_out_time: property.check_out_time.slice(0, 5),
    default_nightly_rate: property.default_nightly_rate,
    default_deposit_percent: property.default_deposit_percent,
    minimum_turnover_minutes: property.minimum_turnover_minutes,
    default_cancellation_policy_id: property.default_cancellation_policy_id,
    notes: property.notes,
    is_active: property.is_active,
    created_by: property.created_by,
    updated_by: property.updated_by,
    created_at: property.created_at.toISOString(),
    updated_at: property.updated_at.toISOString(),
    membership: {
      type: owner ? 'owner' : 'collaborator',
      can_manage_configuration: owner,
      can_manage_collaborators: owner,
    },
  };
}
