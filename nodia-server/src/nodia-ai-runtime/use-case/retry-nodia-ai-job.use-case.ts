import { Inject, Injectable } from '@nestjs/common';
import { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';
import type { NodiaAiClaim } from '../types/worker.types.js';
import { publishNodiaAiRunChanged } from '../../nodia-ai-run/event-journal.js';

@Injectable()
export class RetryNodiaAiJobUseCase {
  constructor(
    private readonly checkpoint: CheckpointNodiaAiJobUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(claim: NodiaAiClaim, errorCode: string): Promise<boolean> {
    if (!/^nodia_ai:[a-z0-9_]{1,100}$/.test(errorCode)) return false;
    return this.checkpoint.execute(claim, async (manager) => {
      const rows: { phase: string; deliveries: number; fits: boolean }[] =
        await manager.query(
          `SELECT a.phase,
        (SELECT COUNT(*)::integer FROM nodia_ai_job_attempts deliveries WHERE deliveries.job_id=a.job_id AND deliveries.stage_seq=a.stage_seq) AS deliveries,
        j.deadline_at > clock_timestamp()+$2*interval '1 second' AS fits
        FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id WHERE a.id=$1`,
          [
            claim.attempt.id,
            Math.max(...this.policy.retry.pre_dispatch_delay_seconds),
          ],
        );
      const row = rows[0];
      if (
        !row ||
        row.phase !== 'claimed' ||
        row.deliveries > this.policy.retry.pre_dispatch_retries ||
        !row.fits
      )
        return false;
      const delay =
        this.policy.retry.pre_dispatch_delay_seconds[row.deliveries - 1];
      if (delay === undefined) return false;
      await manager.query(
        "UPDATE nodia_ai_job_attempts SET phase='failed',error_code=$2,ended_at=clock_timestamp() WHERE id=$1",
        [claim.attempt.id, errorCode],
      );
      await manager.query(
        "UPDATE nodia_ai_jobs SET state='ready',lease_owner=NULL,lease_until=NULL,available_at=clock_timestamp()+$2*interval '1 second',updated_at=clock_timestamp() WHERE id=$1",
        [claim.job.id, delay],
      );
      await manager.query(
        "UPDATE nodia_ai_runs SET state='queued' WHERE id=$1",
        [claim.run.id],
      );
      await publishNodiaAiRunChanged(manager, {
        conversationId: claim.run.conversation_id,
        runId: claim.run.id,
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
      return true;
    });
  }
}
