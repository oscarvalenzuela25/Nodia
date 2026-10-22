import { Inject, Injectable } from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';
import { lockNodiaAiQueue } from '../queue-lock.js';
import { publishNodiaAiRunChanged } from '../../nodia-ai-run/event-journal.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';

/** Reclaims only provably undispatched stages. An armed dispatch never becomes ready. */
@Injectable()
export class RecoverNodiaAiJobsUseCase {
  constructor(
    private readonly runtime: NodiaAiRuntimeService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(): Promise<number> {
    return this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const candidates: { id: string; job_id: string }[] = await manager.query(
        `
        SELECT c.id,j.id AS job_id FROM nodia_ai_conversations c
        JOIN nodia_ai_jobs j ON j.id=c.active_job_id
        JOIN nodia_ai_runs r ON r.id=j.run_id
        WHERE j.kind='turn' AND j.state IN ('ready','leased')
          AND NOT COALESCE(j.recovery_descriptor ? 'restore_quarantined',false) AND
          ((j.state='leased' AND j.lease_until<=clock_timestamp()) OR j.deadline_at<=clock_timestamp()
           OR c.expires_at<=clock_timestamp() OR c.lifecycle<>'active' OR r.state='cancel_requested'
           OR (r.provider_dispatches_used=0 AND r.created_at+$2*interval '1 second'<=clock_timestamp()))
        ORDER BY j.available_at,j.id FOR UPDATE OF c SKIP LOCKED LIMIT $1`,
        [this.policy.retention.batch_chats, this.policy.queue.wait_seconds],
      );
      let count = 0;
      for (const candidate of candidates) {
        const job = await this.runtime.lockJob(manager, candidate.job_id);
        if (!job?.run_id || !['ready', 'leased'].includes(job.state)) continue;
        const run = await this.runtime.findRun(manager, job.run_id);
        const conversation = await this.runtime.lockConversation(
          manager,
          candidate.id,
        );
        if (!run || !conversation) continue;
        const now = await this.runtime.now(manager);
        const attempts: { id: string; phase: string }[] = await manager.query(
          'SELECT id,phase FROM nodia_ai_job_attempts WHERE job_id=$1 AND fence=$2',
          [job.id, job.fence],
        );
        const attempt = attempts[0];
        const unknown =
          !!attempt &&
          ['dispatch_armed', 'sent', 'unknown'].includes(attempt.phase);
        const cancelled =
          run.state === 'cancel_requested' ||
          conversation.lifecycle !== 'active' ||
          conversation.expires_at <= now;
        const expired =
          job.deadline_at <= now ||
          run.deadline_at <= now ||
          (run.provider_dispatches_used === 0 &&
            run.created_at.getTime() + this.policy.queue.wait_seconds * 1000 <=
              now.getTime());
        const state = unknown
          ? 'unknown'
          : cancelled
            ? 'cancelled'
            : expired
              ? 'failed'
              : 'ready';
        const error = unknown
          ? 'nodia_ai:outcome_unknown'
          : cancelled
            ? 'nodia_ai:cancelled'
            : expired
              ? 'nodia_ai:deadline_exceeded'
              : 'nodia_ai:lease_lost';
        await manager.query(
          'UPDATE nodia_ai_jobs SET state=$2,fence=fence+1,lease_owner=NULL,lease_until=NULL,available_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1',
          [job.id, state],
        );
        if (attempt)
          await manager.query(
            'UPDATE nodia_ai_job_attempts SET phase=$2,error_code=$3,ended_at=clock_timestamp() WHERE id=$1 AND ended_at IS NULL',
            [attempt.id, unknown ? 'unknown' : 'abandoned', error],
          );
        await manager.query(
          "UPDATE nodia_ai_runs SET state=$2,error_code=$3,completed_at=CASE WHEN $2 IN ('failed','cancelled') THEN clock_timestamp() ELSE NULL END WHERE id=$1",
          [
            run.id,
            state === 'ready' ? 'queued' : state,
            state === 'ready' ? null : error,
          ],
        );
        if (state !== 'ready')
          await manager.query(
            'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE run_id=$1 AND revoked_at IS NULL',
            [run.id],
          );
        if (state === 'failed' || state === 'cancelled')
          await manager.query(
            'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2',
            [conversation.id, job.id],
          );
        if (attempt?.phase === 'claimed') {
          // The durable dispatch barrier was never crossed. No provider may start before it.
          await manager.query(
            "UPDATE nodia_ai_runtime_slots SET state='free',fence=fence+1,conversation_id=NULL,job_id=NULL,holder_worker_id=NULL,lease_until=NULL,external_operation_ref=NULL,updated_at=clock_timestamp() WHERE job_id=$1 AND state='held' AND external_operation_ref=$2",
            [job.id, attempt.id],
          );
        } else {
          // After arming, expiry never proves that the native process/profile was released.
          await manager.query(
            "UPDATE nodia_ai_runtime_slots SET state='unknown',updated_at=clock_timestamp() WHERE job_id=$1 AND state='held'",
            [job.id],
          );
        }
        await publishNodiaAiRunChanged(manager, {
          conversationId: conversation.id,
          runId: run.id,
          maxEvents: this.policy.results.outbox_events_per_activity,
        });
        count += 1;
      }
      return count;
    });
  }
}
