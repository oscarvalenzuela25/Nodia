import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';

/** Durable local SQL delivery identity. Never accepted from an HTTP/model payload. */
export interface NodiaAiExecutionClaim {
  executionId: string;
  identity: NodiaAiActorReference;
  jobId: string;
  attemptId: string;
  workerId: string;
  fence: string;
  /** Trusted claim routing hint; the handler still validates the frozen SQL identity. */
  toolName?: string;
}
