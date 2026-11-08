/** Shared identity, never an inferred model or a provider fallback. */
export interface AiSelection {
  connection_id: string;
  mode: 'agentic' | 'api_key';
  model_id: string;
  effort_id: string | null;
}
