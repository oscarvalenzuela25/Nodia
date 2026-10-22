// Synthetic AI-21 presentation data. No backend or business record is written.
import type { NodiaAiPublicProposal, NodiaAiProposalReview } from "../../../modules/nodiaAi/infrastructure/types";
import { editableProposal, editableReview } from "../../modules/nodiaAi/infrastructure/proposalFixtures";

export const financialObligationProposal: NodiaAiPublicProposal = { ...editableProposal, steps: [{ ...editableProposal.steps[0], tool_name: "nodia_finance_obligations_prepare_create", effect_key: "finance_obligation.create", changes: [
  ...Object.entries({ name: "[QA] Préstamo para equipamiento", key: "qa-equipment", type: "loan", amount: "9007199254740993", category_id: "9007199254740991", description: null, is_active: true }).map(([field_key, after]) => ({ field_key, before: null, before_present: false, after, after_present: true, origin: "user" as const })),
  { field_key: "initial_movement", before: null, before_present: false, after_present: true, origin: "contract_default", after: { kind: "object", fields: [{ field_key: "name", value: "[QA] Préstamo para equipamiento" }, { field_key: "type", value: "expense" }, { field_key: "status", value: "paid" }, { field_key: "amount", value: "9007199254740993" }, { field_key: "is_active", value: true }] } },
  { field_key: "paid_amount", before: null, before_present: false, after: "0", after_present: true, origin: "contract_default" },
  { field_key: "remaining_amount", before: null, before_present: false, after: "9007199254740993", after_present: true, origin: "contract_default" },
] }] };
export const financialObligationReview: NodiaAiProposalReview = { ...editableReview, editable_fields: [
  ...editableReview.editable_fields.filter(field => ["name", "amount", "is_active"].includes(field.field_key)),
  { ...editableReview.editable_fields[0], field_key: "key", label_key: "finance:key" },
  { ...editableReview.editable_fields[2], field_key: "type", label_key: "finance:type", options: ["loan", "debt"].map(value => ({ value, label_key: `finance:${value}` })) },
  { ...editableReview.editable_fields[0], field_key: "description", label_key: "finance:description", nullable: true, max_length: 5000 },
] };
export const financialGroupDeletion: NodiaAiPublicProposal = { ...editableProposal, steps: [{ ...editableProposal.steps[0], tool_name: "nodia_finance_category_groups_prepare_delete", effect_key: "finance_category_group.delete", target: { resource_key: "finance_category_groups", id: "9007199254740992", label: "[QA] Compras del negocio" }, changes: [
  { field_key: "name", before: "[QA] Compras del negocio", before_present: true, after: null, after_present: false, origin: "user" },
  { field_key: "memberships", before_present: true, before: { kind: "array", items: [{ kind: "object", fields: [{ field_key: "category_id", value: "9007199254740991" }, { field_key: "is_active", value: true }] }, { kind: "object", fields: [{ field_key: "category_id", value: "9007199254740990" }, { field_key: "is_active", value: false }] }] }, after: null, after_present: false, origin: "contract_default" },
] }] };
