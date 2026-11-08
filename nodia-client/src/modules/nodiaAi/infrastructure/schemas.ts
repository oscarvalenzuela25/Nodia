import { z } from "zod";
import type { NodiaAiReviewValue } from "./types";
import { attachmentPartSchema } from "./attachmentSchemas";

/** Nodia admission contract: policy50, 32 KiB UTF-8, independent of provider quotas. */
export const NODIA_AI_MESSAGE_TEXT_BYTES = 32768;

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const bigint = z.string().regex(/^[1-9]\d{0,18}$/).refine((value) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n);
const revision = z.number().int().min(1).max(2147483647);
const instant = z.iso.datetime({ offset: true });
const text = (bytes: number) => z.string().refine((value) => /\S/u.test(value) && new TextEncoder().encode(value).length <= bytes);
export const nodiaAiModeSchema = z.enum(["api_key", "agentic"]);
export const nodiaAiSelectionSchema = z.object({
  connection_id: bigint,
  mode: nodiaAiModeSchema,
  model_id: text(1024),
  effort_id: text(256).nullable(),
}).strict();
const runSelection = nodiaAiSelectionSchema.extend({ mode: z.enum(["api_key", "agentic", "retired"]) });
const target = z.object({
  selection: nodiaAiSelectionSchema.extend({ mode: z.literal("agentic") }),
  configuration_generation: text(256),
  session_generation: text(256),
}).strict();
const routing = z.object({ schema_version: z.literal(1), enabled: z.boolean(), revision, target: target.nullable() }).strict()
  .refine((value) => !value.enabled || value.target !== null);
export const nodiaAiConversationSchema = z.object({
  conversation_id: uuid, owner_user_id: bigint, title: z.string().nullable(),
  is_pinned: z.boolean(), is_archived: z.boolean(), revision,
  selection: nodiaAiSelectionSchema.nullable(), routing,
  last_owner_message_at: instant.nullable(), expires_at: instant, created_at: instant, updated_at: instant,
  read_only: z.boolean(),
}).strict();
const budget = z.object({
  tool_calls: z.number().int().nonnegative(), mcp_rpc_messages: z.number().int().nonnegative(),
  provider_dispatches: z.number().int().nonnegative(), compactions: z.number().int().nonnegative(),
  delegations: z.number().int().nonnegative(),
}).strict();
export const nodiaAiRunSchema = z.object({
  run_id: uuid, conversation_id: uuid, user_message_id: uuid, assistant_message_id: uuid.nullable(),
  revision, selection: runSelection, catalog_version: text(256),
  state: z.enum(["queued", "running", "waiting_for_user", "completed", "failed", "cancel_requested", "cancelled", "unknown"]),
  phase: z.string(), deadline_at: instant, created_at: instant, completed_at: instant.nullable(),
  error: z.object({ code: z.string(), message_key: z.string(), field_errors: z.array(z.unknown()), retry_action: z.string(), correlation_id: uuid }).strict().nullable(),
  routing, budget_limits: budget.extend({ schema_version: z.literal(1) }), budget_used: budget, active_stage: z.null(),
}).strict();
const entityRefSchema = z.object({ resource_key: z.string().min(1), id: z.union([bigint, z.uuid()]), label: z.string().optional() }).strict();
const executionError = z.object({ code: z.string().min(1), message_key: z.string().min(1), safe_message: z.string().optional(),
  field_errors: z.array(z.object({ field_key: z.string().min(1), code: z.string().min(1), message_key: z.string().min(1) }).strict()),
  retry_action: z.enum(["none", "recover_status", "manual_after_review"]), correlation_id: uuid,
}).strict();
export const nodiaAiApiErrorSchema = executionError;
export const nodiaAiErrorResponseSchema = z.object({ error: executionError }).strict();
export const nodiaAiExecutionSchema = z.object({ execution_id: uuid, revision,
  state: z.enum(["queued", "running", "waiting_for_user", "completed", "partially_completed", "failed", "cancel_requested", "cancelled", "unknown"]),
  steps: z.array(z.object({ step_id: uuid, state: z.enum(["blocked", "ready", "running", "waiting_for_user", "completed", "failed", "unknown", "skipped", "cancelled"]),
    result_refs: z.array(entityRefSchema), error: executionError.nullable(),
  }).strict()), can_resume: z.boolean(), observed_at: instant,
}).strict();
export const nodiaAiExecutionAcceptedSchema = z.object({ execution: nodiaAiExecutionSchema }).strict();
export const nodiaAiExecutionControlSchema = z.object({ client_request_id: uuid, expected_execution_revision: revision }).strict();
export const nodiaAiExecutionCancellationSchema = z.object({ status: z.enum(["accepted", "already_terminal"]), execution: nodiaAiExecutionSchema }).strict();
export const nodiaAiDetailSchema = z.object({ conversation: nodiaAiConversationSchema, current_run: nodiaAiRunSchema.nullable(), active_execution: nodiaAiExecutionSchema.nullable() }).strict();
const part = z.union([z.object({ kind: z.literal("text"), text: z.string() }).strict(), attachmentPartSchema.extend({ text: z.string().nullable() }).strict()]);
const messageBase = z.object({ message_id: uuid, run_id: uuid.nullable(), seq: bigint, role: z.string(), status: z.string(), created_at: instant });
const message = z.discriminatedUnion("visibility", [
  messageBase.extend({ visibility: z.literal("restricted") }).strict(),
  messageBase.extend({ visibility: z.literal("visible"), author_user_id: bigint.nullable(), sealed_at: instant.nullable(), parts: z.array(part) }).strict(),
]);
const cursor = z.string().max(2048).nullable();
export const nodiaAiListSchema = z.object({ items: z.array(nodiaAiConversationSchema), next_cursor: cursor }).strict();
export const nodiaAiMessagesSchema = z.object({ conversation_id: uuid, items: z.array(message), next_cursor: cursor }).strict();
export const nodiaAiCatalogSchema = z.object({
  items: z.array(z.object({
    connection_id: bigint, label: z.string(), provider_key: text(256), is_active: z.boolean(),
    is_default: z.boolean().optional(), default_mode: nodiaAiModeSchema.nullable().optional(),
    modes: z.array(z.object({
      mode: nodiaAiModeSchema, configured_selection: nodiaAiSelectionSchema.nullable(),
      configuration: z.enum(["configured", "incomplete", "disabled"]), authentication: z.literal("unknown"),
      inference: z.literal("unknown"), tools: z.enum(["unknown", "unsupported"]), observed_at: z.null(), block_reason: z.null(),
      models: z.array(z.object({ model_id: text(1024), label: z.string(), efforts: z.array(z.object({ effort_id: text(256), label: z.string() }).strict()) }).strict()),
    }).strict()),
  }).strict()), next_cursor: cursor,
}).strict();
export const nodiaAiEligibilitySchema = z.object({
  selection: nodiaAiSelectionSchema, available: z.boolean(), reason: z.string().nullable(), observed_at: instant.nullable(),
  supports_tools: z.boolean().optional(), supports_image_generation: z.boolean().optional(),
  supports_mcp: z.boolean(), routing_target: target.nullable(),
  invoice_ocr: z.object({
    media_types: z.array(z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]))
      .min(1).max(4).refine(values => new Set(values).size === values.length),
    file_bytes: z.literal(10485760),
  }).strict().nullable().optional(),
}).strict();
export const nodiaAiCreateSchema = z.object({ client_request_id: uuid, title: text(256).optional(), selection: nodiaAiSelectionSchema.optional() }).strict();
export const nodiaAiConversationUpdateSchema = z.object({
  expected_conversation_revision: revision,
  title: text(256).nullable().optional(),
  is_pinned: z.boolean().optional(),
  is_archived: z.boolean().optional(),
}).strict().refine(value => value.title !== undefined || value.is_pinned !== undefined || value.is_archived !== undefined);
export const nodiaAiAdmitSchema = z.object({ client_message_id: uuid, expected_conversation_revision: revision, parts: z.array(z.union([z.object({kind: z.literal("text"), text: text(NODIA_AI_MESSAGE_TEXT_BYTES)}).strict(), attachmentPartSchema])).min(1).max(8) }).strict();
export const nodiaAiAdmissionSchema = z.object({ message_id: uuid, conversation_revision: revision, run: nodiaAiRunSchema }).strict();
export const nodiaAiSelectionInputSchema = z.object({ expected_conversation_revision: revision, selection: nodiaAiSelectionSchema }).strict();
export const nodiaAiRoutingInputSchema = z.object({ expected_conversation_revision: revision, expected_routing_revision: revision, enabled: z.literal(false), target: z.null() }).strict();

const resultRef = z.object({ tool_call_id: uuid, tool_name: text(256), contract_hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const eventBase = z.object({ event_id: uuid, conversation_id: uuid, seq: bigint, cursor: z.string().min(1).max(2048), created_at: instant, run_id: uuid });
export const nodiaAiProposalRefSchema = z.object({ proposal_id: uuid, revision, hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const event = z.discriminatedUnion("kind", [
  eventBase.extend({ kind: z.literal("run_accepted"), payload: z.object({ message_id: uuid, run_revision: revision }).strict() }).strict(),
  eventBase.extend({ kind: z.literal("run_changed"), payload: z.object({ revision, state: nodiaAiRunSchema.shape.state, error: nodiaAiRunSchema.shape.error }).strict() }).strict(),
  eventBase.extend({ kind: z.literal("message_sealed"), payload: z.object({ message_id: uuid, status: z.enum(["sealed", "partial"]) }).strict() }).strict(),
  eventBase.extend({ kind: z.literal("tool_completed"), payload: z.object({ result_ref: resultRef, state: z.enum(["completed", "rejected", "unknown"]), error: nodiaAiRunSchema.shape.error }).strict() }).strict(),
  eventBase.extend({ kind: z.literal("run_stage_changed"), payload: z.object({ stage: z.object({ stage_seq: revision, stage_key: text(128), routing_phase: z.enum(["base", "delegated"]), selection: runSelection }).strict() }).strict() }).strict(),
  eventBase.extend({ kind: z.literal("proposal_ready"), payload: nodiaAiProposalRefSchema }).strict(),
]);
export const nodiaAiEventsSchema = z.object({ conversation_id: uuid, items: z.array(event).max(100), next_cursor: cursor, cursor_state: z.enum(["current", "reset_required"]), has_more: z.boolean() }).strict();
export const nodiaAiObservationSchema = z.object({
  result_ref: resultRef, observed_at: instant,
  source: z.object({ module_key: text(256), resource_key: text(256), operation_key: text(256), description_key: text(1024) }).strict(),
  summary: z.object({ total: z.union([z.number().finite(), z.string()]).nullable(), returned: z.number().int().nonnegative().nullable() }).strict(),
  navigation: z.array(z.object({ kind: z.enum(["business_detail", "rental_property", "module"]), id: z.string().nullable(), module_route: text(256), label: z.string().nullable() }).strict()).max(100),
}).strict();

export const nodiaAiReviewValueSchema: z.ZodType<NodiaAiReviewValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.object({ kind: z.literal("array"), items: z.array(nodiaAiReviewValueSchema) }).strict(),
  z.object({ kind: z.literal("object"), fields: z.array(z.object({ field_key: z.string().min(1), value: nodiaAiReviewValueSchema }).strict()) }).strict()
    .refine(value => new Set(value.fields.map(field => field.field_key)).size === value.fields.length),
]));
export const nodiaAiProposalSchema = nodiaAiProposalRefSchema.extend({
  catalog_version: z.string().min(1).max(128),
  state: z.enum(["draft", "ready", "confirmed", "superseded", "cancelled", "expired", "invalidated"]),
  steps: z.array(z.object({
    step_id: uuid, tool_name: z.string().min(1), kind: z.enum(["domain_change", "secure_flow", "preference_change"]),
    target: entityRefSchema.nullable(),
    scope: z.object({ subject_user_id: bigint.optional(), property_id: bigint.optional(), business_id: z.uuid().optional(), provider_id: bigint.optional() }).strict(),
    changes: z.array(z.object({ field_key: z.string().min(1), before: nodiaAiReviewValueSchema, after: nodiaAiReviewValueSchema, before_present: z.boolean(), after_present: z.boolean(), origin: z.enum(["user", "accepted_preference", "database", "contract_default", "future_step"]) }).strict()),
    depends_on: z.array(uuid), effect_key: z.string().min(1), precondition_summary: z.string().optional(),
    output_bindings: z.array(z.object({ target_field_key: z.string().min(1), from_step_id: uuid, output_key: z.string().min(1) }).strict()),
  }).strict()).min(1).max(8),
  execution_id: uuid.nullable(), created_at: instant, expires_at: instant.nullable(),
}).strict().superRefine((proposal, context) => {
  const earlier = new Set<string>();
  proposal.steps.forEach((step, index) => {
    if (earlier.has(step.step_id) || new Set(step.depends_on).size !== step.depends_on.length
      || step.depends_on.some(id => !earlier.has(id))
      || step.output_bindings.some(binding => !step.depends_on.includes(binding.from_step_id))
      || new Set(step.output_bindings.map(binding => binding.target_field_key)).size !== step.output_bindings.length
      || new Set(step.changes.map(change => change.field_key)).size !== step.changes.length)
      context.addIssue({ code: "custom", path: ["steps", index], message: "nodia_ai:invalid_response" });
    earlier.add(step.step_id);
  });
});

export const nodiaAiProposalReviewSchema = nodiaAiProposalRefSchema.extend({
  read_only: z.boolean(),
  editable_fields: z.array(z.object({
    step_id: uuid, field_key: z.string().min(1), label_key: z.string().min(1), kind: z.enum(["text", "bigint", "integer", "enum", "boolean", "rental_cancellation_rules", "core_id_list", "core_translations"]),
    nullable: z.boolean(), max_length: z.number().int().positive().nullable(), minimum: z.string().regex(/^-?\d+$/).nullable(), maximum: z.string().regex(/^-?\d+$/).nullable(),
    options: z.array(z.object({ value: z.string(), label_key: z.string().min(1) }).strict()),
  }).strict()), confirmation: z.object({ available: z.boolean(), reason: z.string().nullable() }).strict(),
}).strict().superRefine((value, context) => {
  if (new Set(value.editable_fields.map(field => `${field.step_id}:${field.field_key}`)).size !== value.editable_fields.length
    || value.read_only && (value.editable_fields.length > 0 || value.confirmation.available)
    || value.editable_fields.some(field => new Set(field.options.map(option => option.value)).size !== field.options.length
      || field.kind === "enum" && !field.options.length || field.kind !== "enum" && field.options.length > 0
      || field.minimum !== null && field.maximum !== null && BigInt(field.minimum) > BigInt(field.maximum)
      || field.kind === "integer" && ([field.minimum, field.maximum].some(bound => bound !== null && (!Number.isSafeInteger(Number(bound)) || BigInt(bound) < -2147483648n || BigInt(bound) > 2147483647n)) || field.max_length !== null)
      || ["core_id_list", "core_translations"].includes(field.kind) && (field.nullable || field.minimum !== "0" || field.maximum !== "100" || field.max_length !== null)
      || field.kind === "rental_cancellation_rules" && (field.nullable || field.minimum !== "1" || field.maximum !== "100" || field.max_length !== null)))
    context.addIssue({ code: "custom", message: "nodia_ai:invalid_response" });
});
export const nodiaAiProposalUpdateSchema = z.object({ expected_proposal_revision: revision, expected_hash: nodiaAiProposalRefSchema.shape.hash,
  edits: z.array(z.object({ step_id: uuid, field_key: z.string().min(1), value: nodiaAiReviewValueSchema }).strict()).min(1),
}).strict().refine(value => new Set(value.edits.map(edit => `${edit.step_id}:${edit.field_key}`)).size === value.edits.length);
export const nodiaAiChallengeInputSchema = z.object({ proposal_revision: revision, expected_hash: nodiaAiProposalRefSchema.shape.hash }).strict();
const confirmationToken = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
export const nodiaAiChallengeSchema = nodiaAiChallengeInputSchema.extend({ proposal_id: uuid, confirmation_token: confirmationToken, expires_at: instant }).strict();
export const nodiaAiConfirmationSchema = nodiaAiChallengeInputSchema.extend({ client_request_id: uuid, confirmation_token: confirmationToken }).strict();

