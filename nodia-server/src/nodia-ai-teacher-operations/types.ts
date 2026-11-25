import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../nodia-ai-proposal/types/proposal-preparer.types.js';

export const TEACHER_MODULE_ROUTE = '/nodia-teacher';
export const NODIA_AI_TEACHER_OPERATIONS = Symbol(
  'NODIA_AI_TEACHER_OPERATIONS',
);
export const NODIA_AI_TEACHER_READS = Symbol('NODIA_AI_TEACHER_READS');

export interface TeacherOperationContext {
  readonly actorId: string;
  readonly sessionId: string;
  readonly manager: EntityManager;
  readonly statementTimeoutMs?: number;
  readonly requestKey?: string;
}

export interface TeacherReadCandidate {
  readonly toolName: string;
  execute(
    input: NodiaAiJsonObject,
    context: TeacherOperationContext,
  ): Promise<NodiaAiJsonObject>;
}

export interface TeacherPreparedCommand {
  readonly id?: string;
  readonly command: NodiaAiJsonObject;
  readonly preconditions: NodiaAiJsonObject;
  readonly title: string;
  readonly preview?: NodiaAiJsonObject;
}

export interface TeacherWriteCandidate {
  readonly toolName: string;
  prepare(
    input: NodiaAiJsonObject,
    context: TeacherOperationContext,
  ): Promise<TeacherPreparedCommand>;
  verify(
    command: TeacherPreparedCommand,
    context: TeacherOperationContext,
  ): Promise<void>;
  execute(
    command: TeacherPreparedCommand,
    context: TeacherOperationContext & { requestKey: string },
  ): Promise<{ id: string }>;
}

export interface NodiaAiTeacherOperation extends NodiaAiProposalPreparer {
  executeConfirmed(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; ownerId: string }>;
}
