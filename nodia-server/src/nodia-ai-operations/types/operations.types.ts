export const NODIA_AI_OPERATION_COUNTERS = [
  'queued',
  'leased',
  'unknown_jobs',
  'unknown_slots',
  'restore_quarantined_jobs',
  'held_slots',
  'queue_wait_expired',
  'deadline_expired',
  'lease_expired',
  'cleanup_pending',
  'cleanup_exhausted',
  'blob_cleanup_overdue',
] as const;
export type NodiaAiOperationCounter =
  (typeof NODIA_AI_OPERATION_COUNTERS)[number];
export const NODIA_AI_OPERATION_AGES = [
  'oldest_queued_seconds',
  'oldest_unknown_job_seconds',
  'oldest_cleanup_job_seconds',
] as const;
export type NodiaAiOperationAge = (typeof NODIA_AI_OPERATION_AGES)[number];
export type NodiaAiOperationsAlert =
  | 'unknown_pending'
  | 'restore_quarantine_pending'
  | 'queue_wait_expired'
  | 'deadline_expired'
  | 'lease_expired'
  | 'cleanup_exhausted'
  | 'blob_cleanup_overdue';
/** Internal aggregate only. No remote readiness or unreported billing inference. */
export interface NodiaAiOperationsSnapshot {
  readonly observed_at: string;
  readonly policy_version: string;
  readonly counters: Readonly<Record<NodiaAiOperationCounter, number>>;
  readonly ages: Readonly<Record<NodiaAiOperationAge, number | null>>;
  readonly alerts: readonly NodiaAiOperationsAlert[];
  readonly database_observed: true;
  readonly operational_state: 'attention_required' | 'no_alerts_observed';
  readonly provider_ready: null;
  readonly external_cost: null;
}
