import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { NodiaAiRuntimeReconciliationPort } from '../types/reconciliation.types.js';
import { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';
import { lockNodiaAiQueue } from '../queue-lock.js';
import { readTerminalProof } from './runtime-reconciliation-descriptor.js';
import { NodiaAiJobAttempt } from '../entities/nodia-ai-job-attempt.entity.js';

/** Only idempotent deletion of an already verified native proof; never invokes generation. */
@Injectable()
export class CleanupNodiaAiRuntimeProofsUseCase {
  constructor(
    private readonly runtime: NodiaAiRuntimeService,
    private readonly native: NodiaAiRuntimeReconciliationPort,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    jobId?: string,
    manual = false,
  ): Promise<{ processed: number; settled: number }> {
    const workerId = randomUUID();
    const delivery = await this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const rows: { id: string }[] = await manager.query(
        `SELECT id FROM nodia_ai_jobs WHERE kind='reconcile' AND stage_key='reconcile_ack'
        AND NOT COALESCE(recovery_descriptor ? 'restore_quarantined',false)
        AND ($1::uuid IS NULL OR id=$1) AND ((state='waiting' AND (available_at<=clock_timestamp() OR $2)) OR (state='leased' AND lease_until<=clock_timestamp()) OR ($2 AND state='failed'))
        AND (SELECT count(*) FROM nodia_ai_jobs active WHERE active.kind='reconcile' AND active.state='leased' AND active.lease_until>clock_timestamp())<$3
        ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,
        [jobId ?? null, manual, this.policy.queue.maintenance_workers],
      );
      if (!rows[0]) return null;
      const job = await this.runtime.lockJob(manager, rows[0].id);
      if (!job || job.recovery_descriptor?.restore_quarantined !== undefined) return null;
      const proof = readTerminalProof(job.recovery_descriptor);
      const cleanupAttempts = job.recovery_descriptor?.cleanup_attempts;
      if (
        typeof cleanupAttempts !== 'number' ||
        !Number.isSafeInteger(cleanupAttempts) ||
        cleanupAttempts < 0
      )
        throw Error('nodia_ai:invalid_terminal_proof');
      if (!manual && cleanupAttempts >= this.policy.retry.cleanup_attempts) {
        await manager.query(
          "UPDATE nodia_ai_jobs SET state='failed',lease_owner=NULL,lease_until=NULL WHERE id=$1",
          [job.id],
        );
        return null;
      }
      job.fence = (BigInt(job.fence) + 1n).toString();
      job.attempt_count++;
      job.recovery_descriptor = {
        ...job.recovery_descriptor!,
        cleanup_attempts: cleanupAttempts + 1,
      };
      await manager.query(
        "UPDATE nodia_ai_jobs SET state='leased',lease_owner=$2,lease_until=clock_timestamp()+$3*interval '1 second',fence=$4,attempt_count=$5,recovery_descriptor=$6::jsonb,updated_at=clock_timestamp() WHERE id=$1",
        [
          job.id,
          workerId,
          this.policy.timing.lease_seconds,
          job.fence,
          job.attempt_count,
          JSON.stringify(job.recovery_descriptor),
        ],
      );
      const attemptId = randomUUID();
      await manager.getRepository(NodiaAiJobAttempt).insert(
        Object.assign(new NodiaAiJobAttempt(), {
          id: attemptId,
          job_id: job.id,
          attempt_no: job.attempt_count,
          fence: job.fence,
          worker_id: workerId,
          phase: 'cleanup_armed',
          error_code: null,
          external_operation_ref: proof.terminalProofId,
          started_at: await this.runtime.now(manager),
          ended_at: null,
          runtime_resource_key: null,
          runtime_fence: null,
          stage_key: 'reconcile_ack',
          stage_seq: job.stage_seq,
          selection_snapshot: null,
          routing_phase: null,
        }),
      );
      return { job, proof, attemptId, cleanupAttempts: cleanupAttempts + 1 };
    });
    if (!delivery) return { processed: 0, settled: 0 };
    let acknowledged = false;
    try {
      await this.native.acknowledge(
        delivery.proof,
        AbortSignal.timeout(this.policy.timing.domain_step_seconds * 1000),
      );
      acknowledged = true;
    } catch {
      /* Retain only proof identity for bounded idempotent cleanup. */
    }
    const settled = await this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const job = await this.runtime.lockJob(manager, delivery.job.id);
      if (!job) return true;
      if (
        job.state !== 'leased' ||
        job.fence !== delivery.job.fence ||
        job.lease_owner !== workerId
      )
        return false;
      if (acknowledged) {
        await manager.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [job.id]);
        return true;
      }
      const exhausted =
        manual ||
        delivery.cleanupAttempts >= this.policy.retry.cleanup_attempts;
      const delay =
        this.policy.retry.cleanup_delay_seconds[delivery.cleanupAttempts - 1] ??
        0;
      await manager.query(
        "UPDATE nodia_ai_jobs SET state=$2,lease_owner=NULL,lease_until=NULL,available_at=clock_timestamp()+$3*interval '1 second',updated_at=clock_timestamp() WHERE id=$1",
        [job.id, exhausted ? 'failed' : 'waiting', delay],
      );
      await manager.query(
        "UPDATE nodia_ai_job_attempts SET phase='failed',error_code='nodia_ai:reconciliation_cleanup_pending',ended_at=clock_timestamp() WHERE id=$1",
        [delivery.attemptId],
      );
      return false;
    });
    return { processed: 1, settled: settled ? 1 : 0 };
  }
}
