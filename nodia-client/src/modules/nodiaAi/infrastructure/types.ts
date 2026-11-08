export type NodiaAiMode = "api_key" | "agentic";
export interface NodiaAiSelection {
  connection_id: string;
  mode: NodiaAiMode;
  model_id: string;
  effort_id: string | null;
}
export interface NodiaAiRoutingTarget {
  selection: NodiaAiSelection & { mode: "agentic" };
  configuration_generation: string;
  session_generation: string;
}
export interface NodiaAiRouting {
  schema_version: 1;
  enabled: boolean;
  revision: number;
  target: NodiaAiRoutingTarget | null;
}
export interface NodiaAiConversation {
  conversation_id: string;
  owner_user_id: string;
  title: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  revision: number;
  selection: NodiaAiSelection | null;
  routing: NodiaAiRouting;
  last_owner_message_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  read_only: boolean;
}
export type NodiaAiRunState = "queued" | "running" | "waiting_for_user" | "completed" | "failed" | "cancel_requested" | "cancelled" | "unknown";
export interface NodiaAiBudget {
  tool_calls: number;
  mcp_rpc_messages: number;
  provider_dispatches: number;
  compactions: number;
  delegations: number;
}
/** A historical projection is read-only and cannot be sent as a new selection. */
export type NodiaAiRunSelection = Omit<NodiaAiSelection, "mode"> & { mode: NodiaAiMode | "retired" };
export interface NodiaAiRun {
  run_id: string;
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  revision: number;
  selection: NodiaAiRunSelection;
  catalog_version: string;
  state: NodiaAiRunState;
  phase: string;
  deadline_at: string;
  created_at: string;
  completed_at: string | null;
  error: { code: string; message_key: string; field_errors: unknown[]; retry_action: string; correlation_id: string } | null;
  routing: NodiaAiRouting;
  budget_limits: NodiaAiBudget & { schema_version: 1 };
  budget_used: NodiaAiBudget;
  active_stage: null;
}
export interface NodiaAiDetail {
  conversation: NodiaAiConversation;
  current_run: NodiaAiRun | null;
  active_execution: NodiaAiExecutionStatus | null;
}
export interface NodiaAiTextPart { kind: "text"; text: string }
export interface NodiaAiAttachmentPart { kind: "image" | "pdf" | "audio"; attachment_id: string }
export type NodiaAiMessagePart = NodiaAiTextPart | (NodiaAiAttachmentPart & { text: string | null });
interface NodiaAiMessageBase {
  message_id: string;
  run_id: string | null;
  seq: string;
  role: string;
  status: string;
  created_at: string;
}
export type NodiaAiMessage = NodiaAiMessageBase & (
  | { visibility: "restricted" }
  | { visibility: "visible"; author_user_id: string | null; sealed_at: string | null; parts: NodiaAiMessagePart[] }
);
export interface NodiaAiPage<T> { items: T[]; next_cursor: string | null }
export interface NodiaAiMessagePage extends NodiaAiPage<NodiaAiMessage> { conversation_id: string }
export interface NodiaAiConnection {
  connection_id: string;
  label: string;
  provider_key: string;
  is_active: boolean;
  is_default?: boolean;
  default_mode?: NodiaAiMode | null;
  modes: {
    mode: NodiaAiMode;
    configuration: "configured" | "incomplete" | "disabled";
    authentication: "unknown";
    inference: "unknown";
    tools: "unknown" | "unsupported";
    observed_at: null;
    block_reason: null;
    configured_selection: NodiaAiSelection | null;
    models: { model_id: string; label: string; efforts: { effort_id: string; label: string }[] }[];
  }[];
}
export type NodiaAiCatalog = NodiaAiPage<NodiaAiConnection>;
export interface NodiaAiInvoiceOcrEligibility {
  media_types: ("image/png" | "image/jpeg" | "image/webp" | "application/pdf")[];
  file_bytes: number;
}
export interface NodiaAiEligibility {
  selection: NodiaAiSelection;
  available: boolean;
  reason: string | null;
  observed_at: string | null;
  /** Optional only for compatibility with Server releases before API chat support. */
  supports_tools?: boolean;
  supports_image_generation?: boolean;
  supports_mcp: boolean;
  routing_target: NodiaAiRoutingTarget | null;
  invoice_ocr?: NodiaAiInvoiceOcrEligibility | null;
}
export interface NodiaAiListParams {
  view?: "own" | "all";
  owner_user_id?: string;
  search?: string;
  is_pinned?: boolean;
  is_archived?: boolean;
  page_limit?: number;
}
export interface NodiaAiCreateInput { client_request_id: string; title?: string; selection?: NodiaAiSelection }
export interface NodiaAiConversationUpdateInput {
  expected_conversation_revision: number;
  title?: string | null;
  is_pinned?: boolean;
  is_archived?: boolean;
}
export interface NodiaAiAdmitInput { client_message_id: string; expected_conversation_revision: number; parts: (NodiaAiTextPart | NodiaAiAttachmentPart)[] }
export interface NodiaAiAdmission { message_id: string; conversation_revision: number; run: NodiaAiRun }
export interface NodiaAiSelectionInput { expected_conversation_revision: number; selection: NodiaAiSelection }
export interface NodiaAiRoutingInput {
  expected_conversation_revision: number;
  expected_routing_revision: number;
  enabled: boolean;
  target: NodiaAiRoutingTarget | null;
}

export interface NodiaAiToolResultRef { tool_call_id: string; tool_name: string; contract_hash: string }
interface NodiaAiEventBase { event_id: string; conversation_id: string; seq: string; cursor: string; created_at: string; run_id: string }
export type NodiaAiEvent = NodiaAiEventBase & (
  | { kind: "run_accepted"; payload: { message_id: string; run_revision: number } }
  | { kind: "run_changed"; payload: { revision: number; state: NodiaAiRunState; error: NodiaAiRun["error"] } }
  | { kind: "message_sealed"; payload: { message_id: string; status: "sealed" | "partial" } }
  | { kind: "tool_completed"; payload: { result_ref: NodiaAiToolResultRef; state: "completed" | "rejected" | "unknown"; error: NodiaAiRun["error"] } }
  | { kind: "run_stage_changed"; payload: { stage: { stage_seq: number; stage_key: string; routing_phase: "base" | "delegated"; selection: NodiaAiRunSelection } } }
  | { kind: "proposal_ready"; payload: NodiaAiProposalRef }
);
export interface NodiaAiEventPage extends NodiaAiPage<NodiaAiEvent> { conversation_id: string; cursor_state: "current" | "reset_required"; has_more: boolean }
export interface NodiaAiToolObservation {
  result_ref: NodiaAiToolResultRef;
  observed_at: string;
  source: { module_key: string; resource_key: string; operation_key: string; description_key: string };
  summary: { total: number | string | null; returned: number | null };
  navigation: { kind: "business_detail" | "rental_property" | "module"; id: string | null; module_route: string; label: string | null }[];
}

export type NodiaAiReviewValue = string | number | boolean | null
  | { kind: "array"; items: NodiaAiReviewValue[] }
  | { kind: "object"; fields: { field_key: string; value: NodiaAiReviewValue }[] };
export interface NodiaAiProposalRef { proposal_id: string; revision: number; hash: string }
export interface NodiaAiPublicProposal extends NodiaAiProposalRef {
  catalog_version: string;
  state: "draft" | "ready" | "confirmed" | "superseded" | "cancelled" | "expired" | "invalidated";
  steps: {
    step_id: string; tool_name: string; kind: "domain_change" | "secure_flow" | "preference_change";
    target: { resource_key: string; id: string; label?: string } | null;
    scope: { subject_user_id?: string; property_id?: string; business_id?: string; provider_id?: string };
    changes: { field_key: string; before: NodiaAiReviewValue; after: NodiaAiReviewValue; before_present: boolean; after_present: boolean; origin: "user" | "accepted_preference" | "database" | "contract_default" | "future_step" }[];
    depends_on: string[]; effect_key: string; precondition_summary?: string;
    output_bindings: { target_field_key: string; from_step_id: string; output_key: string }[];
  }[];
  execution_id: string | null; created_at: string; expires_at: string | null;
}
export interface NodiaAiEditableField {
  step_id: string; field_key: string; label_key: string;
  kind: "text" | "bigint" | "integer" | "enum" | "boolean" | "rental_cancellation_rules" | "core_id_list" | "core_translations"; nullable: boolean;
  max_length: number | null; minimum: string | null; maximum: string | null;
  options: { value: string; label_key: string }[];
}
export interface NodiaAiProposalReview extends NodiaAiProposalRef {
  read_only: boolean; editable_fields: NodiaAiEditableField[];
  confirmation: { available: boolean; reason: string | null };
}
export interface NodiaAiProposalUpdate {
  expected_proposal_revision: number; expected_hash: string;
  edits: { step_id: string; field_key: string; value: NodiaAiReviewValue }[];
}
export interface NodiaAiConfirmationChallenge {
  proposal_id: string; proposal_revision: number; expected_hash: string;
  confirmation_token: string; expires_at: string;
}
export interface NodiaAiConfirmationRequest {
  client_request_id: string; proposal_revision: number; expected_hash: string; confirmation_token: string;
}
export interface NodiaAiExecutionStatus {
  execution_id: string; revision: number;
  state: "queued" | "running" | "waiting_for_user" | "completed" | "partially_completed" | "failed" | "cancel_requested" | "cancelled" | "unknown";
  steps: { step_id: string; state: "blocked" | "ready" | "running" | "waiting_for_user" | "completed" | "failed" | "unknown" | "skipped" | "cancelled";
    result_refs: { resource_key: string; id: string; label?: string }[];
    error: { code: string; message_key: string; safe_message?: string; field_errors: { field_key: string; code: string; message_key: string }[]; retry_action: "none" | "recover_status" | "manual_after_review"; correlation_id: string } | null;
  }[];
  can_resume: boolean; observed_at: string;
}
export interface NodiaAiExecutionControlInput { client_request_id: string; expected_execution_revision: number }
