import { aiProviderProposal, aiProviderReview } from "../../modules/nodiaAi/infrastructure/aiProviderFixtures";
import { coreUserProposal, coreUserReview, coreRoleProposal, coreRoleReview, coreDeleteProposal, coreDeleteReview } from "../../modules/nodiaAi/infrastructure/coreFixtures";
import { businessProductProposal, businessProductReview, businessContactProposal, businessInvoiceProposal } from "./business-fixtures";
// Synthetic browser-only transport. Never imported by the production route.
import { AxiosError } from "axios";
import type { AxiosAdapter, AxiosResponse } from "axios";
import type { NodiaAiConversation, NodiaAiEligibility, NodiaAiMessagePage, NodiaAiRun, NodiaAiSelection, NodiaAiExecutionStatus, NodiaAiReviewValue, NodiaAiPublicProposal } from "../../../modules/nodiaAi/infrastructure/types";
import { nodiaAiRoutingInputSchema, nodiaAiSelectionInputSchema } from "../../../modules/nodiaAi/infrastructure/schemas";
import { queryClient } from "../../../config/reactQuery";
import { proposal as syntheticProposal, editableProposal, editableReview, readonlyReview, execution as syntheticExecution } from "../../modules/nodiaAi/infrastructure/proposalFixtures";
import { financialObligationProposal, financialObligationReview, financialGroupDeletion } from "./financial-fixtures";
import { partialWorkflow, workflowProposal, workflowReview } from "../../modules/nodiaAi/infrastructure/workflowFixtures";
import { rentalPolicyProposal, rentalPolicyReview, rentalReservationProposal, rentalReservationReview, rentalCancellationProposal, rentalCancellationReview } from "../../modules/nodiaAi/infrastructure/rentalFixtures";
import { rentalPaymentProposal, rentalPaymentReview, rentalRefundProposal, rentalVoidProposal, rentalVoidReview, rentalExpenseProposal, rentalExpenseReview, rentalExpensePayProposal, rentalExpensePayReview, rentalBlockProposal, rentalBlockReview, rentalPreparationProposal, rentalPreparationReview, rentalApprovalProposal } from "../../modules/nodiaAi/infrastructure/rentalMoneyPreparationFixtures";

export const CHAT_ID = "10000000-0000-4000-8000-000000000001";
export const WEB_SELECTION: NodiaAiSelection = { connection_id: "90000000991", mode: "token_plan_web", model_id: "qa-synthetic-web", effort_id: null };
const AGENTIC_SELECTION = { ...WEB_SELECTION, mode: "token_plan_agentic" as const, model_id: "qa-synthetic-agentic", effort_id: "qa-deliberate" };
const timestamp = "2026-10-16T00:00:00Z";
export const QA_MODEL_LABEL = "Modelo sintético alternativo / Synthetic alternative model";
export const QA_HISTORY_TITLE = "QA sintético: productos, reservas y finanzas / Synthetic QA: products, reservations and finances";
const modeMetadata = { configuration: "configured", authentication: "unknown", inference: "unknown", tools: "unknown", observed_at: null, block_reason: null };

// Synthetic projection only. The real server computes this from its native
// configuration; the browser harness has no database or provider connection.
function projectProviderFixture(changes: NodiaAiPublicProposal["steps"][number]["changes"]) {
  return changes.map(change => {
    const status = change.after;
    if (change.field_key !== "configuration_status" || !status || typeof status !== "object" || status.kind !== "object") return change;
    return { ...change, after: { ...status, fields: status.fields.map(field => {
      const preferences = field.value;
      if (field.field_key !== "reasoning_preferences" || !preferences || typeof preferences !== "object" || preferences.kind !== "array") return field;
      return { ...field, value: { ...preferences, items: preferences.items.map(item => {
        if (!item || typeof item !== "object" || item.kind !== "object") return item;
        const mode = item.fields.find(entry => entry.field_key === "mode")?.value;
        if (typeof mode !== "string" || !["api_key", "token_plan_web", "token_plan_agentic"].includes(mode)) return item;
        const selected = changes.find(entry => entry.field_key === `${mode}.selected_model`);
        const level = changes.find(entry => entry.field_key === `${mode}.thinking_level`);
        return { ...item, fields: item.fields.map(entry => {
          if (entry.field_key === "model_id" && selected) return { ...entry, value: selected.after };
          if (entry.field_key === "general_level" && level) return { ...entry, value: level.after };
          if (entry.field_key === "model_override") return { ...entry, value: selected?.after === null ? null : level ? level.after : entry.value };
          return entry;
        }) };
      }) } };
    }) } };
  });
}

export function installFixture(scenario: string | null) {
  const requests: { method: string; path: string }[] = [];
  let nextFailure: string | null = null;
  const canConfirmScenario = scenario === "confirmation-ready" || scenario === "core-delete";
  const workflowScenario = scenario === "workflow" || scenario === "workflow-partial";
  const ai26Fixture = ({
    "ai-provider": { proposal: aiProviderProposal, review: aiProviderReview, resource: "ai_providers" },
    "ai-provider-receipt": { proposal: aiProviderProposal, review: readonlyReview, resource: "ai_providers" },
    "core-user": { proposal: coreUserProposal, review: coreUserReview, resource: "users" },
    "core-role": { proposal: coreRoleProposal, review: coreRoleReview, resource: "roles" },
    "core-delete": { proposal: coreDeleteProposal, review: coreDeleteReview, resource: "modules" },
    "core-receipt": { proposal: coreUserProposal, review: readonlyReview, resource: "users" },
    "rental-payment": { proposal: rentalPaymentProposal, review: rentalPaymentReview, resource: "rental_payments" },
    "rental-refund": { proposal: rentalRefundProposal, review: rentalPaymentReview, resource: "rental_payments" },
    "rental-money-void": { proposal: rentalVoidProposal, review: rentalVoidReview, resource: "rental_payments" },
    "rental-expense": { proposal: rentalExpenseProposal, review: rentalExpenseReview, resource: "rental_expenses" },
    "rental-expense-pay": { proposal: rentalExpensePayProposal, review: rentalExpensePayReview, resource: "rental_expenses" },
    "rental-block": { proposal: rentalBlockProposal, review: rentalBlockReview, resource: "rental_blocks" },
    "rental-preparation": { proposal: rentalPreparationProposal, review: rentalPreparationReview, resource: "rental_turnovers" },
    "rental-approval": { proposal: rentalApprovalProposal, review: readonlyReview, resource: "rental_turnovers" },
    "rental-money-receipt": { proposal: rentalRefundProposal, review: readonlyReview, resource: "rental_payments" },
    "rental-expense-receipt": { proposal: rentalExpensePayProposal, review: readonlyReview, resource: "rental_expenses" },
    "rental-block-receipt": { proposal: rentalBlockProposal, review: readonlyReview, resource: "rental_blocks" },
    "rental-preparation-receipt": { proposal: rentalApprovalProposal, review: readonlyReview, resource: "rental_turnovers" },
  } as Record<string, { proposal: typeof rentalPaymentProposal; review: typeof rentalPaymentReview; resource: string }>)[scenario ?? ""];
  const reservationScenario = ["reservation-create", "reservation-cancel", "reservation-receipt"].includes(scenario ?? "");
  const rentalScenario = scenario === "rental-policy" || scenario === "rental-receipt" || reservationScenario || Boolean(ai26Fixture);
  const businessScenario = ["business-product", "business-contact", "business-invoice", "business-receipt"].includes(scenario ?? "");
  const financialScenario = scenario === "finance-obligation" || scenario === "finance-group-delete" || scenario === "finance-receipt";
  const executionScenario = scenario === "execution" || scenario === "execution-queued" || scenario === "finance-receipt" || scenario === "business-receipt" || scenario === "workflow-partial" || scenario === "rental-receipt" || scenario === "reservation-receipt" || Boolean(ai26Fixture && scenario?.endsWith("-receipt"));
  const proposalScenario = scenario === "proposal" || scenario === "confirmation" || canConfirmScenario || financialScenario || businessScenario || workflowScenario || rentalScenario || executionScenario;
  let reviewedProposal = structuredClone(reservationScenario ? scenario === "reservation-create" ? rentalReservationProposal : rentalCancellationProposal : rentalScenario ? rentalPolicyProposal : workflowScenario ? workflowProposal : scenario === "business-contact" ? businessContactProposal : scenario === "business-invoice" ? businessInvoiceProposal : businessScenario ? businessProductProposal : scenario === "proposal" ? syntheticProposal : scenario === "finance-group-delete" ? financialGroupDeletion : financialScenario ? financialObligationProposal : editableProposal);
  let observedExecution: NodiaAiExecutionStatus = scenario === "workflow-partial" ? structuredClone(partialWorkflow) : scenario === "execution" ? { ...syntheticExecution, revision: 3, state: "failed", can_resume: true, steps: [{ ...syntheticExecution.steps[0], state: "failed" }] } : structuredClone(syntheticExecution);
  if (ai26Fixture) reviewedProposal = structuredClone(ai26Fixture.proposal);
  if (executionScenario) reviewedProposal = { ...reviewedProposal, state: "confirmed", execution_id: observedExecution.execution_id };
  if (scenario === "finance-receipt") observedExecution = { ...observedExecution, revision: 3, state: "completed", steps: [{ ...observedExecution.steps[0], state: "completed", result_refs: [{ resource_key: "finance_obligations", id: "9007199254740993" }] }] };
  if (scenario === "business-receipt") observedExecution = { ...observedExecution, revision: 3, state: "completed", steps: [{ ...observedExecution.steps[0], state: "completed", result_refs: [{ resource_key: "products", id: "9007199254740993" }] }] };
  if (scenario === "rental-receipt") observedExecution = { ...observedExecution, revision: 3, state: "completed", steps: [{ ...observedExecution.steps[0], state: "completed", result_refs: [{ resource_key: "rental_cancellation_policies", id: "9007199254740993" }] }] };
  if (scenario === "reservation-receipt") observedExecution = { ...observedExecution, revision: 3, state: "completed", steps: [{ ...observedExecution.steps[0], state: "completed", result_refs: [{ resource_key: "rental_reservations", id: "9007199254740994" }] }] };
  if (ai26Fixture && executionScenario) observedExecution = { ...observedExecution, revision: 3, state: "completed", steps: [{ ...observedExecution.steps[0], state: "completed", result_refs: [{ resource_key: ai26Fixture.resource, id: "9007199254740996" }] }] };
  const revisions = new Map([[reviewedProposal.revision, structuredClone(reviewedProposal)]]);
  const initialRef = { proposal_id: reviewedProposal.proposal_id, revision: reviewedProposal.revision, hash: reviewedProposal.hash };
  let conversation: NodiaAiConversation = {
    conversation_id: CHAT_ID, owner_user_id: "90000000991", title: QA_HISTORY_TITLE,
    is_pinned: false, is_archived: false, revision: 1, selection: scenario === "observation" || proposalScenario ? AGENTIC_SELECTION : WEB_SELECTION,
    routing: { schema_version: 1, enabled: false, revision: 1, target: null },
    last_owner_message_at: timestamp, expires_at: "2099-01-01T00:00:00Z", created_at: timestamp, updated_at: timestamp,
    read_only: scenario === "read-only",
  };
  const run: NodiaAiRun | null = scenario === "unknown" || scenario === "observation" || proposalScenario || scenario === "clarification" ? {
    run_id: "10000000-0000-4000-8000-000000000002", conversation_id: CHAT_ID,
    user_message_id: "10000000-0000-4000-8000-000000000003", assistant_message_id: null,
    revision: 1, selection: WEB_SELECTION, catalog_version: "qa-synthetic-catalog",
    state: scenario === "unknown" ? "unknown" : scenario === "clarification" ? "waiting_for_user" : "completed", phase: "qa-synthetic-state", deadline_at: timestamp, created_at: timestamp, completed_at: scenario === "unknown" || scenario === "clarification" ? null : timestamp,
    error: null, routing: conversation.routing,
    budget_limits: { schema_version: 1, tool_calls: 12, mcp_rpc_messages: 128, provider_dispatches: 3, compactions: 1, delegations: 1 },
    budget_used: { tool_calls: 0, mcp_rpc_messages: 0, provider_dispatches: 0, compactions: 0, delegations: 0 }, active_stage: null,
  } : null;
  const messages: NodiaAiMessagePage = { conversation_id: CHAT_ID, next_cursor: null, items: [
    { message_id: "10000000-0000-4000-8000-000000000003", run_id: null, seq: "1", role: "user", status: "sealed", visibility: "visible", author_user_id: "90000000991", sealed_at: timestamp, created_at: timestamp,
      parts: [{ kind: "text", text: "[QA SINTÉTICO / SYNTHETIC QA] Muéstrame el total por proveedor del mes. Esta conversación y sus datos existen solamente en el adaptador de pruebas." }] },
    { message_id: "10000000-0000-4000-8000-000000000004", run_id: null, seq: "2", role: "assistant", status: "sealed", visibility: "visible", author_user_id: null, sealed_at: timestamp, created_at: timestamp,
      parts: [{ kind: "text", text: "[RESPUESTA SINTÉTICA / SYNTHETIC RESPONSE] Este contenido permite revisar lectura, contraste y scroll. No se consultó Gemini ni una base de datos.\n\n" + "Detalle sintético de prueba con texto extenso que conserva la información al cambiar de ancho. / Synthetic detail retained across viewport changes.\n".repeat(12) }] },
  ] };
  const adapter: AxiosAdapter = async config => {
    const path = config.url ?? "";
    const method = (config.method ?? "get").toUpperCase();
    requests.push({ method, path });
    const response = (data: unknown, status = 200): AxiosResponse => ({ data, status, statusText: status === 200 ? "OK" : "Synthetic fixture error", headers: {}, config });
    const failureMatches = nextFailure === "catalog" && path.endsWith("/connections")
      || nextFailure === "messages" && path.endsWith("/messages") && method === "GET"
      || nextFailure === "selection" && path.endsWith("/selection")
      || nextFailure === "detail" && path.endsWith(`/${CHAT_ID}`)
      || nextFailure === "proposal" && path.includes("/proposals/")
      || nextFailure === "proposal-edit" && path.includes("/proposals/") && method === "PATCH";
    if (failureMatches) {
      nextFailure = null;
      throw new AxiosError("Synthetic fixture failure", "ERR_BAD_RESPONSE", config, undefined, response({ message: "Fallo sintético recuperable / Recoverable synthetic failure" }, 503));
    }
    if (method === "GET" && path.endsWith("/connections")) return response({ next_cursor: null, items: [{
      connection_id: WEB_SELECTION.connection_id, label: "Conexión sintética QA / Synthetic QA connection", provider_key: "gemini", is_active: true,
      modes: [
        { ...modeMetadata, mode: "token_plan_web", configured_selection: WEB_SELECTION, models: [
          { model_id: WEB_SELECTION.model_id, label: "Modelo Web sintético / Synthetic Web model", efforts: [] },
          { model_id: "qa-synthetic-alternative", label: QA_MODEL_LABEL, efforts: [] },
        ] },
        { ...modeMetadata, mode: "token_plan_agentic", configured_selection: AGENTIC_SELECTION, models: [{ model_id: AGENTIC_SELECTION.model_id, label: "Modelo Agentic sintético / Synthetic Agentic model", efforts: [{ effort_id: "qa-deliberate", label: "Intensidad sintética / Synthetic intensity" }] }] },
        { ...modeMetadata, configuration: "incomplete", tools: "unsupported", mode: "api_key", configured_selection: null, models: [] },
      ],
    }] });
    if (method === "GET" && path.endsWith("/events")) return response({ conversation_id: CHAT_ID, items: scenario === "observation" ? [{
      event_id: "10000000-0000-4000-8000-000000000005", conversation_id: CHAT_ID, run_id: run!.run_id,
      seq: "1", cursor: "synthetic-checkpoint", created_at: timestamp, kind: "tool_completed",
      payload: { state: "completed", error: null, result_ref: { tool_call_id: "10000000-0000-4000-8000-000000000006", tool_name: "qa_synthetic_businesses_list", contract_hash: "a".repeat(64) } },
    }] : proposalScenario ? [{
      event_id: "10000000-0000-4000-8000-000000000005", conversation_id: CHAT_ID, run_id: run!.run_id,
      seq: "1", cursor: "synthetic-checkpoint", created_at: timestamp, kind: "proposal_ready",
      payload: initialRef,
    }] : [], next_cursor: "synthetic-checkpoint", cursor_state: "current", has_more: false });
    if (method === "GET" && path.endsWith(`/proposals/${reviewedProposal.proposal_id}`) && proposalScenario) {
      const revision = config.params?.revision === undefined ? reviewedProposal.revision : Number(config.params.revision);
      const stored = revision === reviewedProposal.revision ? reviewedProposal : revisions.get(revision);
      if (!stored) throw new Error("Unexpected synthetic proposal revision");
      return response({ ...stored, state: revision < reviewedProposal.revision ? "superseded" : stored.state, steps: stored.steps.map(step => ({ ...step, scope: businessScenario || workflowScenario || rentalScenario ? step.scope : { subject_user_id: conversation.owner_user_id } })) });
    }
    if (method === "GET" && path.endsWith("/review-metadata") && proposalScenario) {
      const readonly = scenario === "business-contact" || scenario === "business-invoice" || scenario === "proposal" || scenario === "finance-group-delete" || Number(config.params?.revision) !== reviewedProposal.revision || reviewedProposal.state !== "ready";
      const review = ai26Fixture?.review ?? (reservationScenario ? scenario === "reservation-create" ? rentalReservationReview : rentalCancellationReview : rentalScenario ? rentalPolicyReview : workflowScenario ? workflowReview : businessScenario ? businessProductReview : financialScenario ? financialObligationReview : editableReview);
      return response({ ...(readonly ? readonlyReview : review), proposal_id: reviewedProposal.proposal_id,
        revision: Number(config.params?.revision), hash: revisions.get(Number(config.params?.revision))?.hash,
        editable_fields: readonly ? [] : review.editable_fields.map(field => ({ ...field, step_id: reviewedProposal.steps[workflowScenario ? workflowProposal.steps.findIndex(step => step.step_id === field.step_id) : 0].step_id })),
        confirmation: { available: !readonly && canConfirmScenario, reason: readonly ? "nodia_ai:proposal_read_only" : canConfirmScenario ? null : "nodia_ai:execution_unavailable" },
      });
    }
    if (method === "PATCH" && path.endsWith(`/proposals/${reviewedProposal.proposal_id}`) && proposalScenario) {
      const body = JSON.parse(String(config.data)) as { expected_proposal_revision: number; expected_hash: string; edits: { step_id: string; field_key: string; value: NodiaAiReviewValue }[] };
      if (body.expected_proposal_revision !== reviewedProposal.revision || body.expected_hash !== reviewedProposal.hash) throw new Error("Synthetic CAS conflict");
      const ids = new Map(reviewedProposal.steps.map(step => [step.step_id, crypto.randomUUID()]));
      reviewedProposal = { ...reviewedProposal, revision: reviewedProposal.revision + 1, hash: (reviewedProposal.revision + 1).toString(16).padStart(64, "0"), steps: reviewedProposal.steps.map(step => ({ ...step, step_id: ids.get(step.step_id)!, depends_on: step.depends_on.map(id => ids.get(id)!), output_bindings: step.output_bindings.map(binding => ({ ...binding, from_step_id: ids.get(binding.from_step_id)! })), changes: step.changes.map(change => { const edit = body.edits.find(edit => edit.step_id === step.step_id && edit.field_key === change.field_key); return { ...change, after: edit === undefined ? change.after : edit.value }; }) })) };
      if (scenario === "ai-provider") reviewedProposal = { ...reviewedProposal, steps: reviewedProposal.steps.map(step => ({ ...step, changes: projectProviderFixture(step.changes) })) };
      revisions.set(reviewedProposal.revision, structuredClone(reviewedProposal));
      return response(reviewedProposal);
    }
    if (method === "POST" && path.endsWith("/confirmation-challenge") && canConfirmScenario) {
      return response({ proposal_id: reviewedProposal.proposal_id, proposal_revision: reviewedProposal.revision, expected_hash: reviewedProposal.hash, confirmation_token: "A".repeat(43), expires_at: "2099-01-01T00:00:00Z" });
    }
    if (method === "POST" && path.endsWith("/confirm") && canConfirmScenario) {
      reviewedProposal = { ...reviewedProposal, state: "confirmed", execution_id: syntheticExecution.execution_id };
      if (nextFailure === "confirmation-response-lost") { nextFailure = null; throw new AxiosError("Synthetic lost confirmation response", "ERR_NETWORK", config); }
      return response({ execution: syntheticExecution }, 202);
    }
    if (method === "GET" && path.endsWith(`/operations/${syntheticExecution.execution_id}`) && (canConfirmScenario || executionScenario)) {
      return response(observedExecution);
    }
    if (method === "POST" && path.endsWith(`/operations/${syntheticExecution.execution_id}/resume`) && executionScenario) {
      observedExecution = { ...observedExecution, revision: observedExecution.revision + 1, state: "completed", can_resume: false, steps: workflowScenario ? [observedExecution.steps[0], { ...observedExecution.steps[1], state: "completed", error: null, result_refs: [{ resource_key: "provider_contacts", id: "9007199254740994" }] }] : [{ ...observedExecution.steps[0], state: "completed", result_refs: [{ resource_key: "finance_movements", id: "9007199254740993" }] }] };
      return response({ execution: observedExecution }, 202);
    }
    if (method === "POST" && path.endsWith(`/operations/${syntheticExecution.execution_id}/cancel`) && executionScenario) {
      observedExecution = { ...observedExecution, revision: observedExecution.revision + 1, state: observedExecution.steps.some(step => step.state === "completed") ? "partially_completed" : "cancelled", can_resume: false, steps: observedExecution.steps.map(step => step.state === "completed" ? step : { ...step, state: "cancelled", error: null }) };
      return response({ status: "accepted", execution: observedExecution });
    }
    if (method === "GET" && path.endsWith("/observation") && scenario === "observation") return response({
      result_ref: { tool_call_id: "10000000-0000-4000-8000-000000000006", tool_name: "qa_synthetic_businesses_list", contract_hash: "a".repeat(64) },
      observed_at: timestamp, source: { module_key: "businesses", resource_key: "businesses", operation_key: "list", description_key: "synthetic.qa.source" },
      summary: { total: 0, returned: 0 }, navigation: [{ kind: "business_detail", id: "10000000-0000-4000-8000-000000000007", module_route: "/tools/business", label: "Negocio sintético / Synthetic business" }],
    });
    if (method === "GET" && path.endsWith("/eligibility")) {
      const params = config.params as Partial<NodiaAiSelection>;
      const selection: NodiaAiSelection = { connection_id: WEB_SELECTION.connection_id, mode: params.mode ?? "token_plan_web", model_id: params.model_id ?? WEB_SELECTION.model_id, effort_id: params.effort_id ?? null };
      const data: NodiaAiEligibility = {
        selection, available: selection.mode !== "api_key", reason: null, observed_at: timestamp,
        supports_mcp: selection.mode === "token_plan_agentic",
        routing_target: selection.mode === "token_plan_web" ? { selection: AGENTIC_SELECTION, configuration_generation: "qa-synthetic-configuration", session_generation: "qa-synthetic-session" } : null,
      };
      return response(data);
    }
    if (method === "GET" && path.endsWith("/conversations")) return response({ items: scenario === "empty" ? [] : [conversation], next_cursor: null });
    if (method === "GET" && path.endsWith("/messages")) return response(scenario === "empty" ? { ...messages, items: [] } : messages);
    if (method === "GET" && path.endsWith(`/${CHAT_ID}`)) return response({ conversation, current_run: run, active_execution: reviewedProposal.state === "confirmed" && (canConfirmScenario || executionScenario) && ["queued", "running", "unknown"].includes(observedExecution.state) ? observedExecution : null });
    if (method === "PATCH" && path.endsWith("/selection")) {
      const body = nodiaAiSelectionInputSchema.parse(JSON.parse(String(config.data)));
      conversation = { ...conversation, selection: body.selection, revision: conversation.revision + 1 };
      return response(conversation);
    }
    if (method === "PATCH" && path.endsWith("/routing")) {
      const body = nodiaAiRoutingInputSchema.parse(JSON.parse(String(config.data)));
      conversation = { ...conversation, revision: conversation.revision + 1, routing: { ...conversation.routing, enabled: body.enabled, target: body.target, revision: conversation.routing.revision + 1 } };
      return response(conversation);
    }
    throw new AxiosError("Unexpected synthetic endpoint", "ERR_BAD_REQUEST", config, undefined, response({ message: "Unimplemented endpoint in synthetic QA fixture" }, 400));
  };
  return {
    adapter,
    controls: {
      requests,
      failNext: (kind: string) => { nextFailure = kind; },
      refetch: async (kind: string) => { await queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "nodia-ai" && query.queryKey[3] === kind }); },
    },
  };
}
