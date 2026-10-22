// Synthetic AI-24 protocol fixtures. No production data or provider access.
import type { NodiaAiProposalReview, NodiaAiPublicProposal, NodiaAiReviewValue } from "../../../../modules/nodiaAi/infrastructure/types";
import { proposal, readonlyReview, stepId } from "./proposalFixtures";

export const policyRules: NodiaAiReviewValue = { kind: "array", items: [
  { kind: "object", fields: [{ field_key: "min_days_before", value: 0 }, { field_key: "refund_percent", value: "0.00" }] },
  { kind: "object", fields: [{ field_key: "min_days_before", value: 7 }, { field_key: "refund_percent", value: "50.00" }] },
] };
export const rentalPolicyProposal: NodiaAiPublicProposal = { ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_rental_cancellation_policies_prepare_create", effect_key: "rental.policy.create", scope: { property_id: "9007199254740993" }, changes: [
  { field_key: "name", before: null, after: "[QA] Flexible", before_present: false, after_present: true, origin: "user" },
  { field_key: "rules", before: null, after: policyRules, before_present: false, after_present: true, origin: "user" },
] }] };
export const rentalPolicyReview: NodiaAiProposalReview = { ...readonlyReview, read_only: false, confirmation: { available: true, reason: null }, editable_fields: [
  { step_id: stepId, field_key: "name", label_key: "nodiaAi:proposal.rental_fields.name", kind: "text", nullable: false, max_length: 255, minimum: null, maximum: null, options: [] },
  { step_id: stepId, field_key: "rules", label_key: "nodiaAi:proposal.rental_fields.rules", kind: "rental_cancellation_rules", nullable: false, max_length: null, minimum: "1", maximum: "100", options: [] },
] };

// AI-25 synthetic exact-value previews; they do not assert real availability or a payment.
export const rentalReservationProposal: NodiaAiPublicProposal = { ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_rental_reservations_prepare_create", effect_key: "rental.reservation.create", scope: { property_id: "9007199254740993" }, changes: [
  ...Object.entries({ guest_name: "[QA] Huésped / Guest", guest_contact: "qa@example.invalid", guests_count: 2, channel: "whatsapp", check_in_on: "2026-11-01", check_out_on: "2026-11-03", check_in_time: "15:00", check_out_time: "11:00", nightly_rate: "9007199254740993", deposit_amount: "0" }).map(([field_key, after]) => ({ field_key, after, before: null, before_present: false, after_present: true, origin: "user" as const })),
  ...Object.entries({ timezone: "America/Santiago", status: "draft", total_amount: "18014398509481986" }).map(([field_key, after]) => ({ field_key, after, before: null, before_present: false, after_present: true, origin: "database" as const })),
] }] };
export const rentalReservationReview: NodiaAiProposalReview = { ...rentalPolicyReview, editable_fields: [
  ...["guest_name", "check_in_on", "check_out_on", "check_in_time", "check_out_time"].map(field_key => ({ step_id: stepId, field_key, label_key: `nodiaAi:proposal.rental_fields.${field_key}`, kind: "text" as const, nullable: false, max_length: 255, minimum: null, maximum: null, options: [] })),
] };
export const rentalCancellationProposal: NodiaAiPublicProposal = { ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_rental_reservations_prepare_cancel", effect_key: "rental.reservation.cancel", scope: { property_id: "9007199254740993" }, target: { resource_key: "rental_reservations", id: "9007199254740994", label: "[QA] Reserva / Reservation" }, changes: [
  { field_key: "status", before: "confirmed", after: "cancelled", before_present: true, after_present: true, origin: "database" },
  ...Object.entries({ timezone: "America/Santiago", expected_refund_amount: "0", received_amount: "10000", retained_amount: "10000", balance_due_after_cancellation: "0", refund_due_after_cancellation: "0" }).map(([field_key, after]) => ({ field_key, after, before: null, before_present: false, after_present: true, origin: "database" as const })),
  ...Object.entries({ cancelled_at: "2026-10-17T12:30:00.000Z", refund_amount: "0", resolution_note: "[QA] Resolución / Resolution" }).map(([field_key, after]) => ({ field_key, after, before: null, before_present: false, after_present: true, origin: "user" as const })),
] }] };
export const rentalCancellationReview: NodiaAiProposalReview = { ...rentalPolicyReview, editable_fields: [
  { step_id: stepId, field_key: "cancelled_at", label_key: "nodiaAi:proposal.rental_fields.cancelled_at", kind: "text", nullable: false, max_length: null, minimum: null, maximum: null, options: [] },
  { step_id: stepId, field_key: "refund_amount", label_key: "nodiaAi:proposal.rental_fields.refund_amount", kind: "bigint", nullable: false, max_length: null, minimum: "0", maximum: "9223372036854775807", options: [] },
  { step_id: stepId, field_key: "resolution_note", label_key: "nodiaAi:proposal.rental_fields.resolution_note", kind: "text", nullable: false, max_length: 1000, minimum: null, maximum: null, options: [] },
] };
