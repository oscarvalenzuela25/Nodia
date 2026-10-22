import type { NodiaAiEvent, NodiaAiPublicProposal, NodiaAiProposalReview, NodiaAiExecutionStatus } from "../../../../modules/nodiaAi/infrastructure/types";
import { chatId, conversation, runId } from "./fixtures";

// Synthetic protocol fixtures; no real business records or provider data.
export const proposalId = "44444444-4444-4444-8444-444444444444";
export const stepId = "55555555-5555-4555-8555-555555555555";
export const proposal: NodiaAiPublicProposal = {
  proposal_id: proposalId, revision: 1, hash: "a".repeat(64), catalog_version: "synthetic-catalog",
  state: "ready", execution_id: null, created_at: conversation.created_at, expires_at: null,
  steps: [{
    step_id: stepId, tool_name: "synthetic_prepare", kind: "domain_change", target: null,
    scope: { subject_user_id: "9" }, effect_key: "Synthetic effect", depends_on: [], output_bindings: [],
    changes: [
      { field_key: "Synthetic amount", before: null, after: "9007199254740993.01", before_present: false, after_present: true, origin: "user" },
      { field_key: "Synthetic structured value", before: null, after: { kind: "object", fields: [
        { field_key: "Synthetic exact zero", value: 0 },
        { field_key: "Synthetic false", value: false },
        { field_key: "Synthetic explicit null", value: null },
        { field_key: "Synthetic empty text", value: "" },
        { field_key: "Synthetic ordered items", value: { kind: "array", items: ["Second named item", "First named item"] } },
        { field_key: "Synthetic empty list", value: { kind: "array", items: [] } },
        { field_key: "Synthetic empty object", value: { kind: "object", fields: [] } },
      ] }, before_present: true, after_present: true, origin: "database" },
    ],
  }],
};
export const proposalEvent: Extract<NodiaAiEvent, { kind: "proposal_ready" }> = {
  event_id: "66666666-6666-4666-8666-666666666666", conversation_id: chatId, run_id: runId,
  seq: "2", cursor: "synthetic-proposal-checkpoint", created_at: conversation.created_at,
  kind: "proposal_ready", payload: { proposal_id: proposalId, revision: proposal.revision, hash: proposal.hash },
};
export const readonlyReview: NodiaAiProposalReview = { proposal_id: proposalId, revision: 1, hash: proposal.hash, read_only: true, editable_fields: [], confirmation: { available: false, reason: "nodia_ai:proposal_read_only" } };
export const editableProposal: NodiaAiPublicProposal = { ...proposal, steps: [{ ...proposal.steps[0], tool_name: "nodia_finance_movements_prepare_create", effect_key: "finance_movement.create",
  changes: Object.entries({ name: "Synthetic dinner", amount: "20000", type: "expense", status: "paid", category_id: "9007199254740993", obligation_id: null, is_active: true }).map(([field_key, after]) => ({ field_key, before: null, after, before_present: false, after_present: true, origin: "user" })),
}] };
export const editableReview: NodiaAiProposalReview = { ...readonlyReview, read_only: false, confirmation: { available: false, reason: "nodia_ai:execution_unavailable" }, editable_fields: [
  { field_key: "name", label_key: "finance:name", kind: "text", max_length: 255, minimum: null, maximum: null, options: [] },
  { field_key: "amount", label_key: "finance:amount", kind: "bigint", max_length: null, minimum: "1", maximum: "9223372036854775807", options: [] },
  { field_key: "type", label_key: "finance:type", kind: "enum", max_length: null, minimum: null, maximum: null, options: ["income", "expense"].map(value => ({ value, label_key: `finance:${value}` })) },
  { field_key: "status", label_key: "finance:status", kind: "enum", max_length: null, minimum: null, maximum: null, options: ["pending", "received", "paid", "cancelled"].map(value => ({ value, label_key: `finance:${value}` })) },
  { field_key: "is_active", label_key: "finance:active", kind: "boolean", max_length: null, minimum: null, maximum: null, options: [] },
].map(field => ({ ...field, kind: field.kind as NodiaAiProposalReview["editable_fields"][number]["kind"], step_id: stepId, nullable: false })) };
export const execution: NodiaAiExecutionStatus = { execution_id: "88888888-8888-4888-8888-888888888888", revision: 1, state: "queued", steps: [{ step_id: stepId, state: "ready", result_refs: [], error: null }], can_resume: false, observed_at: conversation.created_at };
