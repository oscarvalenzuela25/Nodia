import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import {
  NodiaAiLostLeaseError,
  type NodiaAiClaim,
  type NodiaAiRuntimeReservation,
} from '../types/worker.types.js';
import type { NodiaAiRuntimeTerminalProof } from '../types/reconciliation.types.js';
import {
  assertRuntimeTerminalProof,
  readRuntimeProofRequest,
} from './runtime-reconciliation-descriptor.js';

/** Only the verified terminal adapter path may invoke this port; expiry is not a closure proof. */
@Injectable()
export class ReleaseNodiaAiRuntimeSlotUseCase {
  constructor(private readonly checkpoint: CheckpointNodiaAiJobUseCase) {}
  async execute(
    claim: NodiaAiClaim,
    reservation: NodiaAiRuntimeReservation,
    proof: NodiaAiRuntimeTerminalProof,
    manager?: EntityManager,
  ): Promise<void> {
    const release = async (transaction: EntityManager) => {
      const jobs: { recovery_descriptor: unknown }[] = await transaction.query(
        'SELECT recovery_descriptor FROM nodia_ai_jobs WHERE id=$1',
        [claim.job.id],
      );
      if (!jobs[0]) throw new NodiaAiLostLeaseError();
      const request = readRuntimeProofRequest(jobs[0].recovery_descriptor);
      assertRuntimeTerminalProof(request, proof);
      if (
        proof.attemptId !== claim.attempt.id ||
        proof.operationRef !== reservation.operationRef ||
        proof.resourceKey !== reservation.resourceKey
      )
        throw new NodiaAiLostLeaseError();
      const updated: { resource_key: string }[] = await transaction.query(
        "WITH changed AS (UPDATE nodia_ai_runtime_slots SET state='free',conversation_id=NULL,job_id=NULL,holder_worker_id=NULL,lease_until=NULL,external_operation_ref=NULL,updated_at=clock_timestamp() WHERE resource_key=$1 AND state='held' AND job_id=$2 AND holder_worker_id=$3 AND fence=$4 AND external_operation_ref=$5 AND lease_until>clock_timestamp() AND EXISTS(SELECT 1 FROM nodia_ai_jobs j WHERE j.id=$2 AND j.state='leased' AND j.fence=$6 AND j.lease_owner=$3 AND j.lease_until>clock_timestamp()) RETURNING resource_key) SELECT resource_key FROM changed",
        [
          reservation.resourceKey,
          claim.job.id,
          claim.attempt.worker_id,
          reservation.fence,
          reservation.operationRef,
          claim.job.fence,
        ],
      );
      if (updated.length !== 1) throw new NodiaAiLostLeaseError();
    };
    if (manager) {
      if (!manager.queryRunner?.isTransactionActive)
        throw new NodiaAiLostLeaseError();
      await release(manager);
    } else await this.checkpoint.execute(claim, release);
  }
}
