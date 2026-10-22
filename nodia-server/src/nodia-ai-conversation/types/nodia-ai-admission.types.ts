import type { EntityManager } from 'typeorm';
import type {
  NodiaAiActorReference,
  NodiaAiAuthorizedActor,
} from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import type {
  NodiaAiConversationSummary,
  NodiaAiJsonObject,
  NodiaAiSelection,
} from './nodia-ai-persistence.types.js';

export const NODIA_AI_ADMISSION_PREPARER = Symbol(
  'NODIA_AI_ADMISSION_PREPARER',
);
export interface NodiaAiAdmissionPrepared {
  selection: NodiaAiSelection;
  catalogVersion: string;
  contextManifest: NodiaAiJsonObject;
  grantScope: NodiaAiJsonObject;
  allowedModules: string[];
  allowedOperations: string[];
}
/** Observation performs external checks without DB locks. prepare only freezes/revalidates that observation. */
export interface NodiaAiAdmissionPreparer {
  observe(
    identity: NodiaAiActorReference,
    chat: Readonly<NodiaAiConversationSummary>,
    options?: { toolProfileId?: string },
  ): Promise<unknown>;
  prepare(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    chat: Readonly<NodiaAiConversation>,
    now: Date,
    observation: unknown,
  ): Promise<NodiaAiAdmissionPrepared>;
}
