import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { NodiaAiRun } from '../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiConversation } from '../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { NodiaAiJob } from './entities/nodia-ai-job.entity.js';
import { NodiaAiJobAttempt } from './entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiExecutionGrant } from './entities/nodia-ai-execution-grant.entity.js';
import { NodiaAiRuntimeSlot } from './entities/nodia-ai-runtime-slot.entity.js';
import { NodiaAiAuditEvent } from './entities/nodia-ai-audit-event.entity.js';
/** Persistence only. Job, lease and authority rules live in runtime use cases. */
@Injectable()
export class NodiaAiRuntimeService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
    isolation?: 'REPEATABLE READ',
  ): Promise<T> {
    return isolation
      ? this.source.transaction(isolation, work)
      : this.source.transaction(work);
  }

  async now(manager: EntityManager): Promise<Date> {
    const rows: { now: Date }[] = await manager.query(
      'SELECT clock_timestamp() AS now',
    );
    return new Date(rows[0].now);
  }
  async lockConversation(manager: EntityManager, id: string) {
    return manager
      .getRepository(NodiaAiConversation)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  async lockJob(manager: EntityManager, id: string) {
    return manager
      .getRepository(NodiaAiJob)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  findRun(manager: EntityManager, id: string) {
    return manager.getRepository(NodiaAiRun).findOne({ where: { id } });
  }
  findRunGrant(manager: EntityManager, runId: string) {
    return manager
      .getRepository(NodiaAiExecutionGrant)
      .findOne({ where: { run_id: runId } });
  }
  async candidate(
    manager: EntityManager,
    policyHash: string,
    catalogs: readonly string[],
    foregroundWorkers: number,
    activePerOwner: number,
    waitSeconds: number,
  ): Promise<string | null> {
    const rows: { id: string }[] = await manager.query(
      `WITH active_owner_counts AS MATERIALIZED (
        SELECT owner.owner_id,COUNT(*) AS active_count
        FROM nodia_ai_jobs active JOIN nodia_ai_conversations owner ON owner.id=active.conversation_id
        WHERE active.kind IN ('turn','execution') AND active.state IN ('leased','unknown')
        GROUP BY owner.owner_id
      )
      SELECT c.id FROM nodia_ai_conversations c
      JOIN nodia_ai_jobs j ON j.id=c.active_job_id
      LEFT JOIN active_owner_counts ON active_owner_counts.owner_id=c.owner_id
      JOIN nodia_ai_runs r ON r.id=j.run_id
      WHERE j.kind='turn' AND j.state='ready' AND j.available_at<=clock_timestamp()
      AND NOT COALESCE(j.recovery_descriptor ? 'restore_quarantined',false)
      AND j.deadline_at>clock_timestamp() AND c.lifecycle='active' AND c.expires_at>clock_timestamp()
      AND r.policy_hash=$1 AND r.catalog_version=ANY($2::text[])
      AND (r.provider_dispatches_used>0 OR r.created_at+$5*interval '1 second'>clock_timestamp())
      AND (j.stage_key<>'inference' OR NOT EXISTS(SELECT 1 FROM nodia_ai_runtime_slots s WHERE s.resource_key=r.context_manifest->>'resource_key' AND s.state IN ('held','unknown')))
      AND (SELECT COUNT(*) FROM nodia_ai_jobs active WHERE active.kind IN ('turn','execution') AND active.state='leased')<$3
      AND COALESCE(active_owner_counts.active_count,0)<$4
      ORDER BY j.available_at,j.id FOR UPDATE OF c SKIP LOCKED LIMIT 1`,
      [policyHash, catalogs, foregroundWorkers, activePerOwner, waitSeconds],
    );
    return rows[0]?.id ?? null;
  }
  findJob(manager: EntityManager, jobId: string) {
    return manager.getRepository(NodiaAiJob).findOne({ where: { id: jobId } });
  }
  findAttempt(manager: EntityManager, jobId: string, attemptId: string) {
    return manager
      .getRepository(NodiaAiJobAttempt)
      .findOne({ where: { id: attemptId, job_id: jobId } });
  }
  findGrant(manager: EntityManager, grantId: string) {
    return manager
      .getRepository(NodiaAiExecutionGrant)
      .findOne({ where: { id: grantId } });
  }
  findSlot(manager: EntityManager, resourceKey: string) {
    return manager
      .getRepository(NodiaAiRuntimeSlot)
      .findOne({ where: { resource_key: resourceKey } });
  }
  findAuditEvent(manager: EntityManager, auditEventId: string) {
    return manager
      .getRepository(NodiaAiAuditEvent)
      .findOne({ where: { id: auditEventId } });
  }
}
