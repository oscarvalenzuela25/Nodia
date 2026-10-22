// Synthetic AI-26 protocol fixtures; never imported by the production route.
import type { NodiaAiEditableField, NodiaAiProposalReview, NodiaAiPublicProposal, NodiaAiReviewValue } from "../../../../modules/nodiaAi/infrastructure/types";
import { proposal, stepId } from "./proposalFixtures";
import { rentalPolicyReview } from "./rentalFixtures";

function fixture(tool: string, values: Record<string, NodiaAiReviewValue>, derived: Record<string, NodiaAiReviewValue> = {}): NodiaAiPublicProposal {
  return { ...proposal, steps: [{ ...proposal.steps[0], tool_name: `nodia_${tool}`, effect_key: `synthetic.${tool}`, scope: { property_id: "9007199254740993" }, changes: [
    ...Object.entries(values).map(([field_key, after]) => ({ field_key, after, before: null, before_present: false, after_present: true, origin: "user" as const })),
    ...Object.entries({ timezone: "America/Santiago", ...derived }).map(([field_key, after]) => ({ field_key, after, before: null, before_present: false, after_present: true, origin: "database" as const })),
  ] }] };
}
function field(field_key: string, kind: NodiaAiEditableField["kind"] = "text", nullable = false): NodiaAiEditableField {
  return { step_id: stepId, field_key, label_key: `nodiaAi:proposal.rental_fields.${field_key}`, kind, nullable, max_length: kind === "text" ? 5000 : null, minimum: kind === "bigint" ? "1" : null, maximum: kind === "bigint" ? "9223372036854775807" : null, options: [] };
}
function review(fields: NodiaAiEditableField[]): NodiaAiProposalReview { return { ...rentalPolicyReview, editable_fields: fields }; }

export const rentalPaymentProposal = fixture("rental_payments_prepare_create", { reservation_id: "9007199254740994", type: "payment", amount: "9007199254740993", occurred_on: "2026-10-17", method: null, notes: "[QA] Cobro / Payment" }, { status: "confirmed" });
export const rentalPaymentReview = review([field("amount", "bigint"), field("occurred_on"), field("method", "text", true), field("notes", "text", true)]);
export const rentalRefundProposal = fixture("rental_payments_prepare_create", { reservation_id: "9007199254740994", type: "refund", amount: "10000", occurred_on: "2026-10-17", method: null, notes: "[QA] Dinero ya devuelto / Already refunded" }, { status: "confirmed" });
export const rentalVoidProposal = fixture("rental_payments_prepare_void", { reason: "[QA] Corrección de registro / Record correction" }, { type: "payment", amount: "10000", status: "voided" });
export const rentalVoidReview = review([field("reason")]);
export const rentalExpenseProposal = fixture("rental_expenses_prepare_create", { name: "[QA] Limpieza / Cleaning", amount: "25000", incurred_on: "2026-10-17", status: "paid", paid_on: "2026-10-17", reservation_id: null, category: null, notes: null });
export const rentalExpenseReview = review([field("name"), field("amount", "bigint"), field("incurred_on"), field("paid_on", "text", true), field("reservation_id", "bigint", true), field("category", "text", true), field("notes", "text", true)]);
export const rentalExpensePayProposal = fixture("rental_expenses_prepare_pay", { paid_on: "2026-10-17" }, { name: "[QA] Limpieza / Cleaning", amount: "25000", status: "paid" });
export const rentalExpensePayReview = review([field("paid_on")]);
export const rentalBlockProposal = fixture("rental_blocks_prepare_update", { starts_at: "2026-11-01T15:00:00-03:00", ends_at: "2026-11-02T11:00:00-03:00", reason: "[QA] Mantenimiento / Maintenance", notes: null, is_active: true }, { affected_turnover_ids: { kind: "array", items: ["9007199254740995"] } });
export const rentalBlockReview = review([field("starts_at"), field("ends_at"), field("reason"), field("notes", "text", true), field("is_active", "boolean")]);
export const rentalPreparationProposal = fixture("rental_turnovers_prepare_update", { linen_ready: null, cleaning_status: "pending", planned_ready_at: "2026-11-01T12:00:00-03:00", ready_at: null, notes: "[QA] Revisar preparación / Check preparation" }, { incoming_reservation_id: "9007199254740994", previous_reservation_id: "9007199254740995", same_day_approved_at: null });
export const rentalPreparationReview = review([field("linen_ready", "boolean", true), { ...field("cleaning_status", "enum"), options: ["pending", "in_progress", "completed"].map(value => ({ value, label_key: `nodiaAi:proposal.rental_values.cleaning_status.${value}` })) }, field("planned_ready_at", "text", true), field("ready_at", "text", true), field("notes", "text", true)]);
export const rentalApprovalProposal = fixture("rental_turnovers_prepare_approve_same_day", {}, { same_day_approval: true, linen_ready: true, cleaning_status: "pending", planned_ready_at: "2026-11-01T12:00:00-03:00", ready_at: null, incoming_reservation_id: "9007199254740994", previous_reservation_id: "9007199254740995" });
