export interface NodiaAiRuntimeProofRequest {
  engine: 'web' | 'agentic';
  attemptId: string;
  resourceKey: string;
  sessionGeneration: string;
  operationRef: string;
}
export interface NodiaAiRuntimeTerminalProof extends NodiaAiRuntimeProofRequest {
  terminalProofId: string;
  processClosed: true;
  outcome: 'completed' | 'abandoned_unknown';
  observedAt: Date;
}
/** Private authenticated adapter only. The model and public DTOs never supply a proof. */
export abstract class NodiaAiRuntimeReconciliationPort {
  abstract reconcile(
    request: NodiaAiRuntimeProofRequest,
    signal: AbortSignal,
  ): Promise<NodiaAiRuntimeTerminalProof>;
  abstract acknowledge(
    proof: NodiaAiRuntimeTerminalProof,
    signal: AbortSignal,
  ): Promise<void>;
}
