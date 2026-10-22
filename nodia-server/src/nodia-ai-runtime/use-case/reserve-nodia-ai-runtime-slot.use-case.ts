import { Inject, Injectable } from '@nestjs/common';
import { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';
import {
  NodiaAiKnownPreDispatchError,
  type NodiaAiClaim,
  type NodiaAiRuntimeReservation,
} from '../types/worker.types.js';

@Injectable()
export class ReserveNodiaAiRuntimeSlotUseCase {
  constructor(
    private readonly checkpoint: CheckpointNodiaAiJobUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    claim: NodiaAiClaim,
    resourceKey: string,
    operationRef: string,
  ): Promise<NodiaAiRuntimeReservation> {
    if (
      !/^[a-z][a-z0-9:._/-]{0,511}$/i.test(resourceKey) ||
      !/^[a-z0-9][a-z0-9:._/-]{0,511}$/i.test(operationRef)
    )
      throw new Error('nodia_ai_invalid_runtime_identity');
    return this.checkpoint.execute(claim, async (manager) => {
      await manager.query(
        "INSERT INTO nodia_ai_runtime_slots(resource_key,state,fence) VALUES($1,'free',0) ON CONFLICT(resource_key) DO NOTHING",
        [resourceKey],
      );
      const slots: { state: string }[] = await manager.query(
        'SELECT state FROM nodia_ai_runtime_slots WHERE resource_key=$1 FOR UPDATE',
        [resourceKey],
      );
      if (slots[0]?.state !== 'free')
        throw new NodiaAiKnownPreDispatchError('nodia_ai:runtime_busy', true);
      const updated: { fence: string }[] = await manager.query(
        "WITH changed AS (UPDATE nodia_ai_runtime_slots SET state='held',conversation_id=$2,job_id=$3,holder_worker_id=$4,fence=fence+1,lease_until=LEAST(clock_timestamp()+$5*interval '1 second',$6::timestamptz),external_operation_ref=$7,updated_at=clock_timestamp() WHERE resource_key=$1 AND state='free' RETURNING fence::text) SELECT fence FROM changed",
        [
          resourceKey,
          claim.job.conversation_id,
          claim.job.id,
          claim.attempt.worker_id,
          this.policy.timing.lease_seconds,
          claim.job.deadline_at,
          operationRef,
        ],
      );
      if (updated.length !== 1)
        throw new NodiaAiKnownPreDispatchError('nodia_ai:runtime_busy', true);
      return { resourceKey, fence: updated[0].fence, operationRef };
    });
  }
}
