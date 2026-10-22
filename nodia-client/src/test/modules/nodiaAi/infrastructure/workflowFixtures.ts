// Synthetic AI-23 protocol examples. No native data, credentials or MCP calls.
import type { NodiaAiExecutionStatus, NodiaAiProposalReview, NodiaAiPublicProposal } from "../../../../modules/nodiaAi/infrastructure/types";
import { execution, proposal, readonlyReview, stepId } from "./proposalFixtures";

export const dependentStepId = "77777777-7777-4777-8777-777777777777";
export const workflowProposal: NodiaAiPublicProposal = {
  ...proposal, catalog_version: "nodia-ai-ai23-workflow/1", steps: [
    { ...proposal.steps[0], tool_name: "nodia_providers_prepare_create", scope: { business_id: "20000000-0000-4000-8000-000000000001" }, effect_key: "providers.create", changes: [
      { field_key: "name", before: null, before_present: false, after: "[QA] Synthetic supplier", after_present: true, origin: "user" },
    ] },
    { ...proposal.steps[0], step_id: dependentStepId, tool_name: "nodia_provider_contacts_prepare_create", scope: { business_id: "20000000-0000-4000-8000-000000000001" }, effect_key: "provider_contacts.create",
      depends_on: [stepId], output_bindings: [{ target_field_key: "provider_id", from_step_id: stepId, output_key: "id" }], changes: [
        { field_key: "provider_id", before: null, before_present: false, after: null, after_present: false, origin: "future_step" },
        { field_key: "name", before: null, before_present: false, after: "[QA] Synthetic contact", after_present: true, origin: "user" },
      ] },
  ],
};
export const workflowReview: NodiaAiProposalReview = { ...readonlyReview, read_only: false, confirmation: { available: false, reason: "nodia_ai:execution_unavailable" }, editable_fields: workflowProposal.steps.map(step => ({ step_id: step.step_id, field_key: "name", label_key: "nodiaAi:proposal.business_fields.name", kind: "text", nullable: false, max_length: 255, minimum: null, maximum: null, options: [] })) };
export const partialWorkflow: NodiaAiExecutionStatus = { ...execution, revision: 3, state: "partially_completed", can_resume: true, steps: [
  { step_id: stepId, state: "completed", result_refs: [{ resource_key: "providers", id: "9007199254740993" }], error: null },
  { step_id: dependentStepId, state: "failed", result_refs: [], error: { code: "nodia_ai:dependency_failed", message_key: "nodia_ai:dependency_failed", field_errors: [], retry_action: "manual_after_review", correlation_id: dependentStepId } },
] };
