import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Constant number of queries; no row materialization, prompts, scope IDs or storage keys. */
@Injectable()
export class NodiaAiOperationsService {
  constructor(private readonly source: DataSource) {}
  async observe(
    waitSeconds: number,
    cleanupAttempts: number,
    querySeconds: number,
  ): Promise<unknown> {
    return this.source.transaction(async (manager) => {
      await manager.query("SELECT set_config('statement_timeout',$1,true)", [
        String(querySeconds * 1000),
      ]);
      const rows: unknown[] = await manager.query(
        `
        WITH instant AS MATERIALIZED (SELECT statement_timestamp() AS now),
        pending AS (
          SELECT j.state,j.kind,j.stage_key,j.available_at,j.lease_until,j.deadline_at,j.created_at,j.updated_at,
            j.recovery_descriptor ? 'restore_quarantined' AS restore_quarantined,
            j.attempt_count,r.provider_dispatches_used,r.created_at AS run_created_at,
            CASE WHEN j.kind='delete_blob' AND j.stage_key='attachment_cleanup' THEN j.attempt_count
              WHEN j.kind='reconcile' AND j.stage_key='reconcile_ack'
                AND jsonb_typeof(j.recovery_descriptor->'cleanup_attempts')='number'
              THEN CASE WHEN j.recovery_descriptor->>'cleanup_attempts' ~ '^[0-9]{1,9}$'
                THEN (j.recovery_descriptor->>'cleanup_attempts')::integer ELSE NULL END
              ELSE NULL END AS cleanup_attempts,
            (j.kind='delete_blob' AND j.stage_key='attachment_cleanup') OR
              (j.kind='reconcile' AND j.stage_key='reconcile_ack') AS cleanup
          FROM nodia_ai_jobs j LEFT JOIN nodia_ai_runs r ON r.id=j.run_id
          WHERE j.state IN ('ready','waiting','leased','unknown','failed')
        ), jobs AS (
          SELECT
            count(*) FILTER (WHERE kind IN ('turn','execution') AND state='ready')::text AS queued,
            count(*) FILTER (WHERE kind IN ('turn','execution') AND state='leased')::text AS leased,
            count(*) FILTER (WHERE state='unknown')::text AS unknown_jobs,
            count(*) FILTER (WHERE restore_quarantined)::text AS restore_quarantined_jobs,
            count(*) FILTER (WHERE state='ready' AND (
              (kind='turn' AND provider_dispatches_used=0 AND run_created_at+$1*interval '1 second'<=instant.now)
              OR (kind='execution' AND available_at+$1*interval '1 second'<=instant.now)))::text AS queue_wait_expired,
            count(*) FILTER (WHERE kind IN ('turn','execution') AND state IN ('ready','leased') AND deadline_at<=instant.now)::text AS deadline_expired,
            count(*) FILTER (WHERE state='leased' AND lease_until<=instant.now)::text AS lease_expired,
            count(*) FILTER (WHERE cleanup)::text AS cleanup_pending,
            count(*) FILTER (WHERE cleanup AND (state='failed' OR (state<>'leased' AND cleanup_attempts >= $2)))::text AS cleanup_exhausted,
            count(*) FILTER (WHERE kind='delete_blob' AND stage_key='attachment_cleanup' AND deadline_at<=instant.now)::text AS blob_cleanup_overdue,
            extract(epoch FROM instant.now-min(created_at) FILTER (WHERE kind IN ('turn','execution') AND state='ready'))::text AS oldest_queued_seconds,
            extract(epoch FROM instant.now-min(updated_at) FILTER (WHERE state='unknown'))::text AS oldest_unknown_job_seconds,
            extract(epoch FROM instant.now-min(created_at) FILTER (WHERE cleanup))::text AS oldest_cleanup_job_seconds
          FROM instant LEFT JOIN pending ON true GROUP BY instant.now
        ), slots AS (
          SELECT count(*) FILTER (WHERE state='unknown')::text AS unknown_slots,
            count(*) FILTER (WHERE state='held')::text AS held_slots FROM nodia_ai_runtime_slots
        ) SELECT instant.now AS observed_at,jobs.*,slots.* FROM instant CROSS JOIN jobs CROSS JOIN slots`,
        [waitSeconds, cleanupAttempts],
      );
      if (rows.length !== 1)
        throw Error('nodia_ai_operations_invalid_snapshot');
      return rows[0];
    });
  }
}
