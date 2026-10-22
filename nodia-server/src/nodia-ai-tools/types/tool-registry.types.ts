import type { EntityManager } from 'typeorm';
import type { NodiaAiAuthorizedActor } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { KnowledgeRequirement } from '../../nodia-ai-context/types/knowledge.types.js';

export const NODIA_AI_TOOL_FAMILIES = Symbol('NODIA_AI_TOOL_FAMILIES');
export const NODIA_AI_CAPABILITIES_CATALOG_VERSION = Symbol(
  'NODIA_AI_CAPABILITIES_CATALOG_VERSION',
);

export type NodiaAiCapabilityKind =
  | 'read'
  | 'prepare_change'
  | 'read_artifact'
  | 'analyze_attachment'
  | 'prepare_secure_flow'
  | 'prepare_workflow'
  | 'prepare_preference_change';

/** Preparers only create drafts/proposals. Human acceptance and execution stay separate. */
export const isNodiaAiMcpPreparationKind = (
  kind: NodiaAiCapabilityKind,
): boolean =>
  kind === 'prepare_change' ||
  kind === 'prepare_secure_flow' ||
  kind === 'prepare_workflow' ||
  kind === 'prepare_preference_change';

/** Execution still requires an explicit published contract and the frozen invocation grant. */
export const isNodiaAiMcpExecutableKind = (
  kind: NodiaAiCapabilityKind,
): boolean =>
  kind === 'read' ||
  kind === 'read_artifact' ||
  kind === 'analyze_attachment' ||
  isNodiaAiMcpPreparationKind(kind);

/** Analysis requires the SQL / pure external validation / SQL boundary, never a direct handler. */
export const isNodiaAiMcpExecutableRegistration = (tool: {
  readonly kind: NodiaAiCapabilityKind;
  readonly external?: unknown;
}): boolean =>
  isNodiaAiMcpExecutableKind(tool.kind) &&
  (tool.kind !== 'analyze_attachment' || !!tool.external);

/** Exact trusted schema bytes, matching the knowledge compiler hash. Never a URL to fetch. */
export interface NodiaAiToolSchemaReference {
  readonly sourceJson: string;
  readonly definition: string;
  readonly sha256: string;
}
export interface NodiaAiToolHandlerContext {
  readonly manager: EntityManager;
  readonly actor: NodiaAiAuthorizedActor;
  readonly moduleRoutes: readonly string[];
  readonly signal?: AbortSignal;
  /** Bound by the backend runtime policy, never by tool arguments. */
  readonly statementTimeoutMs?: number;
  /** Bounded by backend policy before loading expansive resource relations. */
  readonly maxCollectionItems?: number;
  readonly maxRows?: number;
  readonly conversationId?: string;
  readonly runId?: string;
  readonly toolCallId?: string;
  /** Actual armed provider attempt, supplied exclusively by the fenced callback dispatcher. */
  readonly attemptId?: string;
  /** Absolute backend-owned deadline; never extended by an external reader. */
  readonly deadlineAt?: number;
}
/** Prepared under SQL authority, executed after commit, then verified in a fresh checkpoint. */
export interface NodiaAiPreparedToolOperation {
  readonly fingerprint: string;
  readonly execute: (signal: AbortSignal) => Promise<NodiaAiJsonObject>;
  readonly verify: (context: NodiaAiToolHandlerContext) => Promise<void>;
  readonly discard?: () => Promise<void>;
}
export interface NodiaAiToolRegistration {
  readonly capabilityId: string;
  readonly revision: number;
  readonly publication: 'published';
  readonly toolName: string;
  readonly kind: NodiaAiCapabilityKind;
  readonly moduleKey: string;
  readonly resourceKey: string;
  readonly operationKey: string;
  readonly descriptionKey: string;
  readonly description: string;
  readonly requiredModuleRoutes: readonly string[];
  readonly actionKeys: readonly string[];
  readonly inputSchema: NodiaAiToolSchemaReference;
  readonly outputSchema: NodiaAiToolSchemaReference;
  readonly effectKey: string;
  /** Preserve the native domain's consistency and revocation guarantees. Default is READ COMMITTED. */
  readonly readIsolation?: 'REPEATABLE READ';
  readonly external?: {
    readonly prepare: (
      input: NodiaAiJsonObject,
      context: NodiaAiToolHandlerContext,
    ) => Promise<NodiaAiPreparedToolOperation>;
  };
  /** Required even for replay: resource authority can change after the original result. */
  readonly verifyAuthority: (
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) => Promise<void>;
  /** Revalidate authority of every resource contained in a stored/public result. */
  readonly verifyResultAuthority?: (
    input: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) => Promise<void>;
  readonly handler: (
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ) => Promise<NodiaAiJsonObject>;
}
export interface NodiaAiToolModuleRegistration {
  readonly key: string;
  readonly route: string;
  readonly label: string;
}
export interface NodiaAiToolResourceRegistration {
  readonly key: string;
  readonly label: string;
  readonly requiredModuleRoutes: readonly string[];
  /** Explicit published read capability implementing EntitySearchInput/EntityCandidates. */
  readonly resolveCapabilityId?: string;
}
export interface NodiaAiToolFamily {
  readonly familyKey: string;
  readonly modules: readonly NodiaAiToolModuleRegistration[];
  readonly resources: readonly NodiaAiToolResourceRegistration[];
  readonly capabilities: readonly NodiaAiToolRegistration[];
}
export interface NodiaAiRegisteredTool extends Omit<
  NodiaAiToolRegistration,
  'inputSchema' | 'outputSchema'
> {
  readonly requirement: Readonly<KnowledgeRequirement>;
  readonly contractHash: string;
  readonly inputSchemaRef: string;
  readonly outputSchemaRef: string;
  readonly inputSchema: Readonly<NodiaAiJsonObject>;
  readonly outputSchema: Readonly<NodiaAiJsonObject>;
  readonly requiredFields: readonly string[];
  readonly optionalFields: readonly string[];
}
