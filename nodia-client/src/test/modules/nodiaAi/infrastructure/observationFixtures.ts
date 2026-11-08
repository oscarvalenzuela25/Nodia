import type { NodiaAiEvent, NodiaAiToolObservation } from "../../../../modules/nodiaAi/infrastructure/types";
import { chatId, conversation, messageId, runId } from "./fixtures";

// Synthetic events and domain references, never imported by production code.
export const toolRef = { tool_call_id: "55555555-5555-4555-8555-555555555555", tool_name: "synthetic_businesses_list", contract_hash: "a".repeat(64) };
export const acceptedEvent: NodiaAiEvent = { event_id: messageId, conversation_id: chatId, run_id: runId, seq: "1", cursor: "synthetic-cursor-1", created_at: conversation.created_at, kind: "run_accepted", payload: { message_id: messageId, run_revision: 1 } };
export const toolEvent: NodiaAiEvent = { ...acceptedEvent, event_id: toolRef.tool_call_id, seq: "2", cursor: "synthetic-cursor-2", kind: "tool_completed", payload: { result_ref: toolRef, state: "completed", error: null } };
export const observation: NodiaAiToolObservation = {
  result_ref: toolRef, observed_at: conversation.created_at,
  source: { module_key: "businesses", resource_key: "synthetic-businesses", operation_key: "list", description_key: "synthetic.description" },
  summary: { total: 0, returned: 0 },
  navigation: [{ kind: "business_detail", id: chatId, module_route: "/business", label: "Synthetic business" }],
};
