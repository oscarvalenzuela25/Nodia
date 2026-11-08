import type { CodexSession, CodexModel } from './codex-contract.js';
import type {
  CodexChatImage,
  CodexChatImageLimits,
  CodexChatImageMime,
} from './codex-chat-images.js';
import type { CodexChatAudio, CodexChatAudioLimits, CodexChatAudioMime } from './codex-chat-audio.js';
import type { CodexChatToolCall } from '../../../ai-provider/use-case/codex-chat-tool-channel.use-case.js';
import type {
  NodiaAiCodexRuntimeProofRequest,
  NodiaAiRuntimeTerminalProof,
} from '../../../nodia-ai-runtime/types/reconciliation.types.js';

export type CodexChatIdentity = NodiaAiCodexRuntimeProofRequest;
export interface CodexChatPayload {
  /** Explicit image-only lane; never inferred from ordinary chat text. */
  readonly imageGeneration?: { readonly prompt: string };
  readonly modelId: string;
  readonly effort?: string;
  readonly prompt: string;
  /** Context measurement knows only count before reading private originals. */
  readonly images?: readonly { mediaType?: CodexChatImageMime }[];
  readonly audio?: readonly { mediaType?: CodexChatAudioMime }[];
  /** Preserve the original order of mixed attachments, independently of staging. */
  readonly mediaOrder?: readonly ('image' | 'audio')[];
  readonly tools: readonly {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }[];
}
export interface CodexChatRequest extends CodexChatPayload {
  readonly images?: readonly CodexChatImage[];
  readonly imageLimits?: CodexChatImageLimits;
  readonly audio?: readonly CodexChatAudio[];
  readonly audioLimits?: CodexChatAudioLimits;
  readonly identity: CodexChatIdentity;
  readonly deadlineAt: Date;
  readonly signal: AbortSignal;
  readonly limits: {
    readonly requests: number;
    readonly toolCalls: number;
    readonly argumentUtf8Bytes: number;
    readonly resultUtf8Bytes: number;
    readonly jsonDepth: number;
    readonly collectionItems: number;
  };
}
export interface CodexChatCallbacks {
  /** Revalidate the already-armed SQL reservation; this never grants authority. */
  readonly onPrepared: (identity: CodexChatIdentity) => Promise<void>;
  readonly assertLease: (signal: AbortSignal) => Promise<void>;
  /** Durable checkpoint before processing every native frame, including rejects. */
  readonly onProtocolProgress: (
    count: number,
    signal: AbortSignal,
    unforwardedRequests?: number,
  ) => Promise<void>;
  readonly onToolCall: (
    call: CodexChatToolCall,
    signal: AbortSignal,
  ) => Promise<unknown>;
}
export interface CodexChatObservation {
  session: CodexSession;
  models: CodexModel[];
  resourceKey: string;
  runtimeSessionId: string;
  /** Native protocol admission alone never certifies an account's tool use. */
  supportsMcp: false;
}
export class CodexChatRuntimeError extends Error {
  constructor(
    readonly code: string,
    readonly outcome: 'not_dispatched' | 'unknown',
  ) {
    super(code);
    this.name = 'CodexChatRuntimeError';
  }
}
/** Produced only by the supervisor after proving this attempt owns no live child. */
export class CodexChatAdmissionError extends Error {
  readonly nativeClosed = true;
  constructor(readonly code: string) {
    super(code);
    this.name = 'CodexChatAdmissionError';
  }
}
/** A private cleanup port may prove a previously consumed ACK from its exact SQL receipt. */
export class CodexChatReceiptAbsentError extends Error {
  constructor() {
    super('codex_chat_receipt_absent');
    this.name = 'CodexChatReceiptAbsentError';
  }
}
export interface CodexChatMeasurement {
  measurementKind: 'upper_bound';
  canonicalUtf8Bytes: number;
  catalogUtf8Bytes: number;
  overheadUtf8Bytes: number;
  totalUtf8Bytes: number;
  maxUtf8Bytes: number;
}
export interface CodexChatReply {
  text: string;
  generatedImage?: CodexChatImage;
  terminalProof: NodiaAiRuntimeTerminalProof;
}
