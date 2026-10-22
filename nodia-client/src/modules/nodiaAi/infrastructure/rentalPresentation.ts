const rentalOperations = {
  rental_properties: ["create", "update"], rental_collaborators: ["create", "update"], rental_cancellation_policies: ["create", "update"],
  rental_reservations: ["create", "update", "confirm", "start", "complete", "cancel"],
  rental_payments: ["create", "void"], rental_expenses: ["create", "update", "pay", "void"],
  rental_blocks: ["create", "update"], rental_turnovers: ["update", "approve_same_day"],
} as const;
export const nodiaAiRentalResources = Object.keys(rentalOperations) as (keyof typeof rentalOperations)[];
export function nodiaAiRentalTool(name: string): boolean {
  return nodiaAiRentalResources.some(resource => rentalOperations[resource].some(operation => name === `nodia_${resource}_prepare_${operation}`));
}
const fields = ["id", "property_id", "owner_id", "user_id", "name", "timezone", "max_guests", "check_in_time", "check_out_time", "location", "default_nightly_rate", "default_deposit_percent", "default_cancellation_policy_id", "minimum_turnover_minutes", "notes", "is_active", "position", "rules", "min_days_before", "refund_percent", "created_at", "updated_at", "version", "guest_name", "guest_contact", "guests_count", "channel", "external_reference", "check_in_on", "check_out_on", "nightly_rate", "cleaning_fee", "discount_amount", "commission_amount", "deposit_amount", "deposit_due_at", "balance_due_at", "cancellation_policy_id", "status", "total_amount", "same_day_approvals", "platform_policy", "reference", "description", "cancelled_at", "refund_amount", "expected_refund_amount", "resolution_note", "retained_amount", "refund_due_after_cancellation", "received_amount", "balance_due_after_cancellation", "reservation_id", "type", "amount", "occurred_on", "method", "reason", "incurred_on", "paid_on", "category", "starts_at", "ends_at", "linen_ready", "cleaning_status", "planned_ready_at", "ready_at", "incoming_reservation_id", "previous_reservation_id", "same_day_approved_at", "same_day_approval", "affected_turnover_ids", "refunded_amount", "policy_snapshot", "schema_version", "kind", "policy_id", "policy_name", "captured_at", "days_basis", "refund_basis", "rounding", "platform_reference", "platform_description", "resolution"] as const;
export const nodiaAiRentalFieldLabels: Record<string, string> = Object.fromEntries(fields.map(field => [field, `nodiaAi:proposal.rental_fields.${field}`]));

/** Translate only closed native values in registered rental tools; unknown values stay visible. */
export function nodiaAiRentalValueKey(field: string | undefined, value: string): string | undefined {
  if (field === "status" && ["draft", "confirmed", "in_progress", "completed", "cancelled", "pending", "paid", "voided", "active", "inactive"].includes(value)) return `nodiaAi:proposal.rental_values.status.${value}`;
  if (field === "channel" && ["whatsapp", "airbnb", "facebook", "other"].includes(value)) return `nodiaAi:proposal.rental_values.channel.${value}`;
  if (field === "type" && ["payment", "refund"].includes(value)) return `nodiaAi:proposal.rental_values.type.${value}`;
  if (field === "cleaning_status" && ["pending", "in_progress", "completed"].includes(value)) return `nodiaAi:proposal.rental_values.cleaning_status.${value}`;
  if (field === "kind" && ["direct", "platform"].includes(value) || field === "days_basis" && value === "local_calendar_days" || field === "refund_basis" && value === "confirmed_received_amount" || field === "rounding" && value === "floor_clp" || field === "resolution" && value === "manual_external") return `nodiaAi:proposal.rental_values.policy.${value}`;
  return undefined;
}

const rentalErrorKeys = ["rental:invalid_input", "rental:owner_required", "rental:not_found", "rental:invalid_transition", "rental:agreement_immutable", "rental:turnover_required", "rental:invalid_local_time", "rental:invalid_interval", "rental:invalid_due_date", "rental:invalid_platform_agreement", "rental:invalid_approval", "rental:invalid_cancellation_time", "rental:invalid_refund", "rental:property_inactive", "rental:capacity_exceeded", "rental:availability_conflict", "rental:deposit_required", "rental:policy_required", "rental:cancellation_changed", "rental:overpayment", "rental:refund_exceeds_approved", "rental:invalid_turnover_plan", "rental:invalid_turnover_ready", "rental:idempotency_conflict", "rental:conflict", "rental:temporarily_busy"] as const;
export function nodiaAiRentalErrorKey(value: unknown): string | undefined {
  return rentalErrorKeys.find(key => key === value);
}
