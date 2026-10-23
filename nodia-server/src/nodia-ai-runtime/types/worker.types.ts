import type { EntityManager } from 'typeorm';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiJob } from '../entities/nodia-ai-job.entity.js';
import type { NodiaAiJobAttempt } from '../entities/nodia-ai-job-attempt.entity.js';
import type { NodiaAiCodexRuntimeProofRequest, NodiaAiRuntimeTerminalProof } from './reconciliation.types.js';

export const NODIA_AI_STAGE_HANDLER = Symbol('NODIA_AI_STAGE_HANDLER');
export const NODIA_AI_CHAT_OPERATION = 'chat:respond';
export const NODIA_AI_MAINTENANCE_HANDLER = Symbol(
  'NODIA_AI_MAINTENANCE_HANDLER',
);
export interface NodiaAiClaim {
  job: NodiaAiJob;
  attempt: NodiaAiJobAttempt;
  run: NodiaAiRun;
  identity: NodiaAiActorReference;
}
export interface NodiaAiRuntimeReservation {
  resourceKey: string;
  fence: string;
  operationRef: string;
  /** Private observation identity, bound to the durable descriptor before transport. */
  adapterIdentity?: NodiaAiCodexRuntimeProofRequest['adapterIdentity'];
  sessionGeneration?: string;
}
export interface NodiaAiStageContext {
  signal: AbortSignal;
  /** Reserves durable budget before sending; returns the single bounded dispatch deadline after commit. */
  armDispatch(
    selection?: NodiaAiSelection,
    runtime?: NodiaAiRuntimeReservation,
    validate?: (manager: EntityManager) => Promise<void>,
  ): Promise<Date>;
  /** Local transactional checkpoint. No network, SDK, provider or user waits inside it. */
  checkpoint<T>(
    work: (manager: EntityManager) => Promise<T>,
    isolation?: 'REPEATABLE READ',
  ): Promise<T>;
}
export type NodiaAiStagePersist = (manager: EntityManager) => Promise<void>;
export type NodiaAiStageOutcome =
  | {
      status: 'continue';
      nextStage: string;
      persist?: NodiaAiStagePersist;
      terminalProof?: NodiaAiRuntimeTerminalProof;
    }
  | {
      status: 'completed' | 'waiting';
      persist?: NodiaAiStagePersist;
      terminalProof?: NodiaAiRuntimeTerminalProof;
    }
  | {
      status: 'failed';
      errorCode: string;
      /** A validated, finished provider response can fail local parsing without being unknown. */
      terminalProof?: NodiaAiRuntimeTerminalProof;
      persist?: NodiaAiStagePersist;
    }
  | { status: 'unknown'; errorCode: string };
export interface NodiaAiStageHandler {
  readonly catalogVersions: readonly string[];
  execute(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
  ): Promise<NodiaAiStageOutcome>;
}
export interface NodiaAiMaintenanceHandler {
  execute(): Promise<unknown>;
}
export class NodiaAiLostLeaseError extends Error {
  constructor() {
    super('nodia_ai:lease_lost');
  }
}
export class NodiaAiKnownPreDispatchError extends Error {
  constructor(
    readonly errorCode: string,
    readonly retryable = false,
  ) {
    super(errorCode);
  }
}
