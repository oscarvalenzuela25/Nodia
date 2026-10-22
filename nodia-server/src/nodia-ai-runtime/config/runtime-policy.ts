export const NODIA_AI_RUNTIME_POLICY = Symbol('NODIA_AI_RUNTIME_POLICY');
/** Validated release policy; numbers originate exclusively in the build-owned asset. */
export interface NodiaAiRuntimePolicy {
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly admission: {
    readonly http_json_bytes: number;
    readonly message_text_utf8_bytes: number;
    readonly parts_per_message: number;
    readonly title_utf8_bytes: number;
    readonly file_bytes: number;
    readonly files_per_message: number;
    readonly message_files_bytes: number;
    readonly audio_seconds: number;
    readonly pdf_pages: number;
    readonly image_pixels: number;
    readonly attachments_per_chat: number;
    readonly chat_storage_bytes: number;
    readonly owner_storage_bytes: number;
    readonly upload_seconds: number;
    readonly upload_intent_seconds: number;
    readonly parse_seconds: number;
    readonly parse_memory_mib: number;
    readonly uploads_per_owner: number;
    readonly uploads_global: number;
  };
  readonly results: {
    readonly tool_arguments_utf8_bytes: number;
    readonly tool_result_utf8_bytes: number;
    readonly json_depth: number;
    readonly json_collection_items: number;
    readonly assembled_context_utf8_bytes: number;
    readonly assistant_text_utf8_bytes: number;
    readonly list_default_rows: number;
    readonly list_max_rows: number;
    readonly report_max_groups: number;
    readonly report_max_filters: number;
    readonly provider_stream_bytes: number;
    readonly outbox_events_per_activity: number;
    readonly delta_batch_utf8_bytes: number;
    readonly delta_flush_milliseconds: number;
    readonly sse_connections_per_owner: number;
  };
  readonly budget: {
    readonly tool_calls_per_run: number;
    readonly mcp_rpc_messages_per_run: number;
    readonly provider_dispatches_per_run: number;
    readonly compactions_per_run: number;
    readonly delegations_per_run: number;
    readonly steps_per_proposal: number;
  };
  readonly queue: {
    readonly active_per_chat: number;
    readonly active_per_owner: number;
    readonly waiting_per_owner: number;
    readonly waiting_global: number;
    readonly foreground_workers: number;
    readonly maintenance_workers: number;
    readonly holders_per_runtime_resource: number;
    readonly wait_seconds: number;
    readonly local_retry_after_seconds: number;
  };
  readonly timing: {
    readonly run_seconds: number;
    readonly execution_admission_seconds: number;
    readonly provider_dispatch_seconds: number;
    readonly read_query_seconds: number;
    readonly domain_step_seconds: number;
    readonly proposal_seconds: number;
    readonly confirmation_challenge_seconds: number;
    readonly heartbeat_seconds: number;
    readonly lease_seconds: number;
    readonly cancellation_seconds: number;
    readonly flush_seconds: number;
    readonly drain_seconds: number;
    readonly eligibility_observation_seconds: number;
    readonly secure_human_seconds: number;
  };
  readonly retry: {
    readonly pre_dispatch_retries: number;
    readonly pre_dispatch_delay_seconds: readonly number[];
    readonly uncertain_dispatch_retries: number;
    readonly cleanup_attempts: number;
    readonly cleanup_delay_seconds: readonly number[];
  };
  readonly routing: {
    readonly source_mode: string;
    readonly target_mode: string;
    readonly same_connection_only: boolean;
    readonly default_enabled: boolean;
    readonly return_to_base_next_turn: boolean;
    readonly fallback_on_error: boolean;
    readonly switch_confirms_writes: boolean;
    readonly api_delegation_enabled: boolean;
  };
  readonly search: {
    readonly query_utf8_bytes: number;
    readonly default_rows: number;
    readonly max_rows: number;
    readonly sources: readonly string[];
    readonly exclude_expired: boolean;
  };
  readonly retention: {
    readonly chat_days: number;
    readonly basis: string;
    readonly audit_days_after_chat: number;
    readonly settled_receipt_days_after_chat: number;
    readonly terminal_attempt_days_after_chat: number;
    readonly accepted_preferences: string;
    readonly unresolved_work: string;
    readonly provider_unknown: string;
    readonly sweep_seconds: number;
    readonly batch_chats: number;
    readonly physical_cleanup_target_seconds: number;
    readonly backup_max_days: number;
    readonly restore_mode: string;
  };
  readonly publication_gates: readonly string[];
}
