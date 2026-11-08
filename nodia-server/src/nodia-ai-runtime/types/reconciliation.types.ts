interface NodiaAiRuntimeProofIdentity {
  engine: 'web' | 'agentic';
  attemptId: string;
  resourceKey: string;
  sessionGeneration: string;
  operationRef: string;
}
/** Historical Gemini descriptors remain schema 1, with no extra identity fields. */
export interface NodiaAiGeminiRuntimeProofRequest extends NodiaAiRuntimeProofIdentity {
  adapterIdentity?: undefined;
}
/** Nodia-owned recovery contract, not proof of native Codex integration or availability. */
export interface NodiaAiCodexRuntimeProofRequest extends NodiaAiRuntimeProofIdentity {
  engine: 'agentic';
  adapterIdentity: {
    providerKey: 'openai';
    contractVersion: 'nodia-ai-codex-chat/1';
    /** Persisted independently of the mutable provider connection configuration. */
    connectionId: string;
  };
}
export interface NodiaAiApiRuntimeProofRequest {
  engine: 'api_key';
  attemptId: string;
  resourceKey: string;
  sessionGeneration: string;
  operationRef: string;
  adapterIdentity: {
    providerKey: 'openai' | 'gemini';
    contractVersion: 'nodia-ai-api-chat/1';
    connectionId: string;
  };
}
export type NodiaAiNativeRuntimeProofRequest =
  NodiaAiGeminiRuntimeProofRequest | NodiaAiCodexRuntimeProofRequest;
export type NodiaAiRuntimeProofRequest =
  | NodiaAiGeminiRuntimeProofRequest
  | NodiaAiCodexRuntimeProofRequest
  | NodiaAiApiRuntimeProofRequest;
export type NodiaAiNativeRuntimeTerminalProof =
  NodiaAiNativeRuntimeProofRequest & {
    terminalProofId: string;
    processClosed: true;
    outcome: 'completed' | 'abandoned_unknown';
    observedAt: Date;
    localTransportClosed?: never;
    remoteOutcome?: never;
  };
/** A closed local HTTP executor never proves remote cancellation or an unobserved result. */
export type NodiaAiApiRuntimeTerminalProof = NodiaAiApiRuntimeProofRequest & {
  terminalProofId: string;
  localTransportClosed: true;
  remoteOutcome: 'completed' | 'unknown';
  processClosed?: never;
  outcome: 'completed' | 'abandoned_unknown';
  observedAt: Date;
};
export type NodiaAiRuntimeTerminalProof =
  NodiaAiNativeRuntimeTerminalProof | NodiaAiApiRuntimeTerminalProof;
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
