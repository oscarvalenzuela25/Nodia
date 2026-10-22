/** Validated internal snapshots; metadata never carries credentials or executable SQL. */
export interface NodiaAiSelection {
  connection_id: string;
  mode: 'api_key' | 'token_plan_web' | 'token_plan_agentic';
  model_id: string;
  effort_id: string | null;
}
export interface NodiaAiRoutingTarget {
  selection: NodiaAiSelection & { mode: 'token_plan_agentic' };
  configuration_generation: string;
  session_generation: string;
}
export interface NodiaAiRoutingSnapshot {
  schema_version: 1;
  enabled: boolean;
  revision: number;
  target: NodiaAiRoutingTarget | null;
}
export interface NodiaAiBudgetSnapshot {
  schema_version: 1;
  tool_calls: number;
  mcp_rpc_messages: number;
  provider_dispatches: number;
  compactions: number;
  delegations: number;
}
/** Private per-capability payload, validated by its registered contract before use. */
export type NodiaAiJsonValue =
  string | number | boolean | null | NodiaAiJsonObject | NodiaAiJsonValue[];
export interface NodiaAiJsonObject {
  [key: string]: NodiaAiJsonValue;
}
export interface NodiaAiConversationSummary {
  conversation_id: string;
  owner_user_id: string;
  title: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  revision: number;
  selection: NodiaAiSelection | null;
  routing: NodiaAiRoutingSnapshot;
  last_owner_message_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  read_only: boolean;
}
