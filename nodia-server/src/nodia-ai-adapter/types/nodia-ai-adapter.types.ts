import type { EntityManager } from 'typeorm';
import type { NodiaAiRuntimeTerminalProof } from '../../nodia-ai-runtime/types/reconciliation.types.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** Current private MCP transport envelope ceilings; these are not provider/model quotas. */
export const NODIA_AI_MCP_CATALOG_LIMITS = Object.freeze({
  // AI-31 catalog: 67 product reads plus seven technical tools, including reports.
  // Verified as a complete descriptor fixture; future growth needs fresh evidence.
  tools: 74,
  utf8Bytes: 131072,
  descriptionUtf8Bytes: 2048,
});

export interface NodiaAiAdapterObservation {
  available: boolean;
  observedAt: Date;
  source: 'gemini_live_session_and_catalog';
  resourceKey: string | null;
  configurationGeneration: string;
  sessionGeneration: string;
  adapterContractVersion: 'nodia-ai-gemini-chat/1';
  supportsMcp: boolean;
  verifiedModalities?: readonly ('image' | 'pdf' | 'audio')[];
  /** Exact formats proved in this selection/session; category summaries never authorize originals. */
  verifiedAttachmentMediaTypes?: readonly string[];
  reason: string | null;
}
export const NODIA_AI_NATIVE_MEDIA_TYPES = Object.freeze({
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
} as const);

export function isNodiaAiNativeFormatVerified(
  verified: readonly string[] | undefined,
  kind: string,
  mediaType: string | null,
): boolean {
  return mediaType !== null &&
    Object.hasOwn(NODIA_AI_NATIVE_MEDIA_TYPES, mediaType) &&
    NODIA_AI_NATIVE_MEDIA_TYPES[mediaType as keyof typeof NODIA_AI_NATIVE_MEDIA_TYPES] === kind &&
    verified?.includes(mediaType) === true;
}
export interface NodiaAiAdapterTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
export function isNodiaAiMcpToolDescriptorValid(
  tool: NodiaAiAdapterTool,
): boolean {
  return (
    /^[a-z][a-z0-9_]{0,63}$/.test(tool.name) &&
    typeof tool.description === 'string' &&
    tool.description.trim().length > 0 &&
    Buffer.byteLength(tool.description, 'utf8') <=
      NODIA_AI_MCP_CATALOG_LIMITS.descriptionUtf8Bytes &&
    tool.inputSchema.type === 'object' &&
    tool.inputSchema.additionalProperties === false
  );
}
export function nodiaAiMcpCatalogUtf8Bytes(
  tools: readonly NodiaAiAdapterTool[],
): number {
  return Buffer.byteLength(
    JSON.stringify(
      tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      })),
    ),
    'utf8',
  );
}
export interface NodiaAiAdapterToolCall {
  callId: string;
  name: string;
  arguments: unknown;
}
export interface NodiaAiContextMeasureInput {
  selection: NodiaAiSelection;
  canonicalPrompt: string;
  tools?: readonly NodiaAiAdapterTool[];
  attachments?: readonly { kind: 'image' | 'pdf' | 'audio'; media_type?: string }[];
}
/** Observable initial prompt only; SDK/CLI internal token windows remain unknown. */
export interface NodiaAiContextMeasurement {
  measurementContractVersion: 'nodia-ai-context-budget/1';
  measurementScope: 'initial_native_prompt';
  measurementKind: 'exact' | 'upper_bound';
  canonicalUtf8Bytes: number;
  catalogUtf8Bytes: number;
  overheadUtf8Bytes: number;
  totalUtf8Bytes: number;
  maxUtf8Bytes: number;
  modelContextTokens: null;
  firstMcpListingUpperBoundUtf8Bytes: number;
}
export interface NodiaAiAdapterRequest {
  attemptId: string;
  selection: NodiaAiSelection;
  canonicalPrompt: string;
  deadlineAt: Date;
  resourceKey: string;
  sessionGeneration: string;
  configurationGeneration: string;
  attachments?: readonly {
    kind: 'image' | 'pdf' | 'audio';
    media_type: string;
    sha256: string;
    content_base64: string;
  }[];
  tools?: readonly NodiaAiAdapterTool[];
  onToolCall?: (
    call: NodiaAiAdapterToolCall,
    signal: AbortSignal,
  ) => Promise<
    import('../../nodia-ai-conversation/types/nodia-ai-persistence.types.js').NodiaAiJsonObject
  >;
  onProtocolProgress?: (
    rpcMessages: number,
    signal: AbortSignal,
    unforwardedToolRequests?: number,
  ) => Promise<void>;
}
export type NodiaAiAdapterReply =
  | { kind: 'answer'; text: string; terminalProof: NodiaAiRuntimeTerminalProof }
  | {
      kind: 'delegation_request';
      reason: string;
      terminalProof: NodiaAiRuntimeTerminalProof;
    };

/** Only Server grants authority and arms durable dispatch; transport never retries. */
export abstract class NodiaAiAdapterPort {
  abstract measureContext(
    input: NodiaAiContextMeasureInput,
    signal?: AbortSignal,
  ): Promise<NodiaAiContextMeasurement>;
  abstract observe(
    selection: NodiaAiSelection,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterObservation>;
  abstract verifyConfiguration(
    selection: NodiaAiSelection,
    generation: string,
    manager?: EntityManager,
  ): Promise<void>;
  abstract execute(
    request: NodiaAiAdapterRequest,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterReply>;
}
export class NodiaAiAdapterError extends Error {
  constructor(
    public readonly code: string,
    public readonly outcome: 'not_dispatched' | 'unknown',
  ) {
    super(code);
    this.name = 'NodiaAiAdapterError';
  }
}
