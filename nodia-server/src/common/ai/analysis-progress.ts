/** Safe categories only: document text, prompts, credentials and reasoning never enter this contract. */
export const analysisStages = ['reserved', 'request_received', 'file_validated', 'connection_resolved',
  'session_checked', 'model_checked', 'provider_request_started', 'cli_initialized',
  'document_read_started', 'document_read_completed', 'turn_started', 'response_receiving',
  'response_received', 'extraction_validated', 'observation_unavailable', 'failed', 'cancelled'] as const;
export type AnalysisStage = typeof analysisStages[number];
export type AnalysisContext = { business_id: string; provider_id?: string; ai_provider_id?: string;
  ai_provider?: string; model?: string; model_type?: string; mode?: string; engine?: string;
  thinking_level?: string; extended_thinking?: boolean };
export type AnalysisIdentity = { providerId: string | null; provider: string; mode: string | null; model: string | null };
export interface AnalysisProgress {
  validateContext(context: AnalysisContext): void;
  emit(stage: AnalysisStage): void;
  resolve(identity: AnalysisIdentity): void;
  reportGap?(): void;
}
