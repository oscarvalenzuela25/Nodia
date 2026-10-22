import type { NodiaAiConversation, NodiaAiDetail, NodiaAiRun, NodiaAiSelection } from "../../../../modules/nodiaAi/infrastructure/types";

// Synthetic transport fixtures; no real provider identifiers or credentials.
export const chatId = "11111111-1111-4111-8111-111111111111";
export const messageId = "22222222-2222-4222-8222-222222222222";
export const runId = "33333333-3333-4333-8333-333333333333";
export const selection: NodiaAiSelection = { connection_id: "9007199254740993", mode: "token_plan_web", model_id: "synthetic-model", effort_id: null };
export const conversation: NodiaAiConversation = {
  conversation_id: chatId, owner_user_id: "9", title: null, is_pinned: false, is_archived: false,
  revision: 1, selection, routing: {schema_version: 1, enabled: false, revision: 1, target: null},
  last_owner_message_at: null, expires_at: "2027-01-01T00:00:00.000Z", created_at: "2026-10-16T00:00:00.000Z", updated_at: "2026-10-16T00:00:00.000Z", read_only: false,
};
export const run: NodiaAiRun = {
  run_id: runId, conversation_id: chatId, user_message_id: messageId, assistant_message_id: null, revision: 1,
  selection, catalog_version: "synthetic-catalog-version", state: "queued", phase: "queued", deadline_at: "2026-10-16T00:05:00.000Z", created_at: "2026-10-16T00:00:00.000Z", completed_at: null, error: null,
  routing: conversation.routing, budget_limits: {schema_version: 1, tool_calls: 12, mcp_rpc_messages: 128, provider_dispatches: 3, compactions: 1, delegations: 1},
  budget_used: {tool_calls: 0, mcp_rpc_messages: 0, provider_dispatches: 0, compactions: 0, delegations: 0}, active_stage: null,
};
export const detail: NodiaAiDetail = {conversation, current_run: null, active_execution: null};
