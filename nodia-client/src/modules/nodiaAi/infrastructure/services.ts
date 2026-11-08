import { mainInstance } from "../../../config/api";
import type { NodiaAiReport } from "./reportSchemas";
import {
  nodiaAiAdmitSchema, nodiaAiAdmissionSchema, nodiaAiCatalogSchema, nodiaAiConversationSchema,
  nodiaAiCreateSchema, nodiaAiDetailSchema, nodiaAiEligibilitySchema, nodiaAiListSchema,
  nodiaAiMessagesSchema, nodiaAiRoutingInputSchema, nodiaAiSelectionInputSchema, nodiaAiSelectionSchema,
  nodiaAiEventsSchema, nodiaAiObservationSchema, nodiaAiRunSchema,
  nodiaAiProposalRefSchema, nodiaAiProposalSchema,
  nodiaAiProposalReviewSchema, nodiaAiProposalUpdateSchema, nodiaAiChallengeInputSchema, nodiaAiChallengeSchema,
  nodiaAiConfirmationSchema, nodiaAiExecutionAcceptedSchema, nodiaAiExecutionSchema, nodiaAiConversationUpdateSchema,
  nodiaAiExecutionControlSchema, nodiaAiExecutionCancellationSchema,
} from "./schemas";
import type {
  NodiaAiAdmitInput, NodiaAiAdmission, NodiaAiCatalog, NodiaAiConversation, NodiaAiCreateInput,
  NodiaAiDetail, NodiaAiEligibility, NodiaAiListParams, NodiaAiMessagePage, NodiaAiConversationUpdateInput,
  NodiaAiPage, NodiaAiRoutingInput, NodiaAiSelection, NodiaAiSelectionInput,
  NodiaAiEventPage, NodiaAiToolObservation, NodiaAiToolResultRef, NodiaAiRun,
  NodiaAiProposalRef, NodiaAiPublicProposal,
  NodiaAiProposalReview, NodiaAiProposalUpdate, NodiaAiConfirmationRequest, NodiaAiConfirmationChallenge, NodiaAiExecutionStatus, NodiaAiExecutionControlInput,
} from "./types";

const base = "/nodia-ai";
const chatPath = (id: string) => `${base}/conversations/${encodeURIComponent(id)}`;

export async function getNodiaAiConversations(params: NodiaAiListParams & { cursor?: string }, signal?: AbortSignal): Promise<NodiaAiPage<NodiaAiConversation>> {
  const { data } = await mainInstance.get<unknown>(`${base}/conversations`, { params, signal });
  return nodiaAiListSchema.parse(data);
}
export async function getNodiaAiConversation(id: string, signal?: AbortSignal): Promise<NodiaAiDetail> {
  const { data } = await mainInstance.get<unknown>(chatPath(id), { signal });
  const result = nodiaAiDetailSchema.parse(data);
  if (result.conversation.conversation_id !== id) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function getNodiaAiMessages(id: string, cursor?: string, signal?: AbortSignal): Promise<NodiaAiMessagePage> {
  const { data } = await mainInstance.get<unknown>(`${chatPath(id)}/messages`, { params: { cursor, direction: "backward" }, signal });
  const result = nodiaAiMessagesSchema.parse(data);
  if (result.conversation_id !== id) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function getNodiaAiCatalog(cursor?: string, signal?: AbortSignal): Promise<NodiaAiCatalog> {
  const { data } = await mainInstance.get<unknown>(`${base}/connections`, { params: { cursor }, signal });
  return nodiaAiCatalogSchema.parse(data);
}
export async function getNodiaAiEligibility(input: NodiaAiSelection, signal?: AbortSignal): Promise<NodiaAiEligibility> {
  const selection = nodiaAiSelectionSchema.parse(input);
  const { data } = await mainInstance.get<unknown>(`${base}/connections/${encodeURIComponent(selection.connection_id)}/eligibility`, {
    params: { mode: selection.mode, model_id: selection.model_id, ...(selection.effort_id === null ? {} : { effort_id: selection.effort_id }) }, signal,
  });
  const result = nodiaAiEligibilitySchema.parse(data);
  if (!sameNodiaAiSelection(result.selection, selection)) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function createNodiaAiConversation(input: NodiaAiCreateInput): Promise<NodiaAiConversation> {
  const { data } = await mainInstance.post<unknown>(`${base}/conversations`, nodiaAiCreateSchema.parse(input));
  return nodiaAiConversationSchema.parse(data);
}
export async function updateNodiaAiConversation(id: string, input: NodiaAiConversationUpdateInput): Promise<NodiaAiConversation> {
  const body = nodiaAiConversationUpdateSchema.parse(input);
  const { data } = await mainInstance.patch<unknown>(chatPath(id), body);
  const result = nodiaAiConversationSchema.parse(data);
  if (result.conversation_id !== id || result.revision !== body.expected_conversation_revision + 1
    || (body.title !== undefined && result.title !== body.title)
    || (body.is_pinned !== undefined && result.is_pinned !== body.is_pinned)
    || (body.is_archived !== undefined && result.is_archived !== body.is_archived)) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function admitNodiaAiMessage(id: string, input: NodiaAiAdmitInput): Promise<NodiaAiAdmission> {
  // Admission includes metadata observation; this budget belongs only to sending a message.
  const { data } = await mainInstance.post<unknown>(`${chatPath(id)}/messages`, nodiaAiAdmitSchema.parse(input), { timeout: 45_000 });
  const result = nodiaAiAdmissionSchema.parse(data);
  if (result.run.conversation_id !== id) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function setNodiaAiSelection(id: string, input: NodiaAiSelectionInput): Promise<NodiaAiConversation> {
  const { data } = await mainInstance.patch<unknown>(`${chatPath(id)}/selection`, nodiaAiSelectionInputSchema.parse(input));
  const result = nodiaAiConversationSchema.parse(data);
  if (result.conversation_id !== id) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function setNodiaAiRouting(id: string, input: NodiaAiRoutingInput): Promise<NodiaAiConversation> {
  const { data } = await mainInstance.patch<unknown>(`${chatPath(id)}/routing`, nodiaAiRoutingInputSchema.parse(input));
  const result = nodiaAiConversationSchema.parse(data);
  if (result.conversation_id !== id) throw new Error("nodia_ai:invalid_response");
  return result;
}
export function sameNodiaAiSelection(left: NodiaAiSelection | null, right: NodiaAiSelection | null): boolean {
  return left === null || right === null ? left === right
    : left.connection_id === right.connection_id && left.mode === right.mode && left.model_id === right.model_id && left.effort_id === right.effort_id;
}

export async function getNodiaAiEvents(runId: string, conversationId: string, cursor?: string, signal?: AbortSignal): Promise<NodiaAiEventPage> {
  const { data } = await mainInstance.get<unknown>(`${base}/runs/${encodeURIComponent(runId)}/events`, { params: { cursor, page_limit: 100 }, signal });
  const result = nodiaAiEventsSchema.parse(data);
  if (result.conversation_id !== conversationId || result.items.some(item => item.run_id !== runId || item.conversation_id !== conversationId))
    throw new Error("nodia_ai:invalid_response");
  return result;
}

export async function getNodiaAiRun(runId: string, conversationId: string, signal?: AbortSignal): Promise<NodiaAiRun> {
  const { data } = await mainInstance.get<unknown>(`${base}/runs/${encodeURIComponent(runId)}`, { signal });
  const result = nodiaAiRunSchema.parse(data);
  if (result.run_id !== runId || result.conversation_id !== conversationId) throw new Error("nodia_ai:invalid_response");
  return result;
}

export async function getNodiaAiObservation(ref: NodiaAiToolResultRef, signal?: AbortSignal): Promise<NodiaAiToolObservation> {
  const { data } = await mainInstance.get<unknown>(`${base}/tool-calls/${encodeURIComponent(ref.tool_call_id)}/observation`, { signal });
  const result = nodiaAiObservationSchema.parse(data);
  if (result.result_ref.tool_call_id !== ref.tool_call_id || result.result_ref.tool_name !== ref.tool_name || result.result_ref.contract_hash !== ref.contract_hash)
    throw new Error("nodia_ai:invalid_response");
  return result;
}

export async function getNodiaAiReport(ref: NodiaAiToolResultRef, signal?: AbortSignal): Promise<NodiaAiReport> {
  if (ref.tool_name !== "nodia_reports_run") throw new Error("nodia_ai:invalid_response");
  const { nodiaAiReportSchema } = await import("./reportSchemas");
  const { data } = await mainInstance.get<unknown>(`${base}/tool-calls/${encodeURIComponent(ref.tool_call_id)}/result`, { signal });
  return nodiaAiReportSchema.parse(data);
}

/** A proposal event identifies an immutable revision, not permission to execute it. */
export async function getNodiaAiProposal(ref: NodiaAiProposalRef, signal?: AbortSignal): Promise<NodiaAiPublicProposal> {
  const expected = nodiaAiProposalRefSchema.parse(ref);
  const { data } = await mainInstance.get<unknown>(`${base}/proposals/${encodeURIComponent(expected.proposal_id)}`, { params: { revision: expected.revision }, signal });
  const result = nodiaAiProposalSchema.parse(data);
  if (result.proposal_id !== expected.proposal_id || result.revision !== expected.revision || result.hash !== expected.hash)
    throw new Error("nodia_ai:invalid_response");
  return result;
}

export async function getNodiaAiProposalReview(ref: NodiaAiProposalRef, signal?: AbortSignal): Promise<NodiaAiProposalReview> {
  const expected = nodiaAiProposalRefSchema.parse(ref);
  const { data } = await mainInstance.get<unknown>(`${base}/proposals/${encodeURIComponent(expected.proposal_id)}/review-metadata`, { params: { revision: expected.revision }, signal });
  const result = nodiaAiProposalReviewSchema.parse(data);
  if (result.proposal_id !== expected.proposal_id || result.revision !== expected.revision || result.hash !== expected.hash) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function updateNodiaAiProposal(id: string, input: NodiaAiProposalUpdate): Promise<NodiaAiPublicProposal> {
  const body = nodiaAiProposalUpdateSchema.parse(input);
  const { data } = await mainInstance.patch<unknown>(`${base}/proposals/${encodeURIComponent(id)}`, body);
  const result = nodiaAiProposalSchema.parse(data);
  if (result.proposal_id !== id || result.revision !== body.expected_proposal_revision + 1 || result.hash === body.expected_hash || result.state !== "ready") throw new Error("nodia_ai:invalid_response");
  return result;
}
/** Human channel only. Tokens must never enter messages, query data or persistent storage. */
export async function challengeNodiaAiProposal(ref: NodiaAiProposalRef): Promise<NodiaAiConfirmationChallenge> {
  const body = nodiaAiChallengeInputSchema.parse({ proposal_revision: ref.revision, expected_hash: ref.hash });
  const { data } = await mainInstance.post<unknown>(`${base}/proposals/${encodeURIComponent(ref.proposal_id)}/confirmation-challenge`, body);
  const result = nodiaAiChallengeSchema.parse(data);
  if (result.proposal_id !== ref.proposal_id || result.proposal_revision !== ref.revision || result.expected_hash !== ref.hash) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function confirmNodiaAiProposal(id: string, input: NodiaAiConfirmationRequest): Promise<NodiaAiExecutionStatus> {
  const { data } = await mainInstance.post<unknown>(`${base}/proposals/${encodeURIComponent(id)}/confirm`, nodiaAiConfirmationSchema.parse(input));
  return nodiaAiExecutionAcceptedSchema.parse(data).execution;
}
export async function getNodiaAiCurrentProposal(id: string): Promise<NodiaAiPublicProposal> {
  const { data } = await mainInstance.get<unknown>(`${base}/proposals/${encodeURIComponent(id)}`);
  const result = nodiaAiProposalSchema.parse(data);
  if (result.proposal_id !== id) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function getNodiaAiExecution(id: string, signal?: AbortSignal): Promise<NodiaAiExecutionStatus> {
  const { data } = await mainInstance.get<unknown>(`${base}/operations/${encodeURIComponent(id)}`, { signal });
  const result = nodiaAiExecutionSchema.parse(data);
  if (result.execution_id !== id) throw new Error("nodia_ai:invalid_response");
  return result;
}
export async function controlNodiaAiExecution(id: string, action: "cancel" | "resume", input: NodiaAiExecutionControlInput): Promise<NodiaAiExecutionStatus> {
  const body = nodiaAiExecutionControlSchema.parse(input);
  const { data } = await mainInstance.post<unknown>(`${base}/operations/${encodeURIComponent(id)}/${action}`, body);
  const result = (action === "cancel" ? nodiaAiExecutionCancellationSchema.parse(data) : nodiaAiExecutionAcceptedSchema.parse(data)).execution;
  if (result.execution_id !== id) throw new Error("nodia_ai:invalid_response");
  return result;
}
