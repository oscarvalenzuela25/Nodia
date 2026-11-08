import type { AiSelection } from './ai-selection.js';
import type { TeacherAgenticDescriptor, TeacherAgenticObservation, TeacherAgenticProof } from './agentic-text-contract.js';

/** Authority, counters and ownership are durable callbacks; transport has no domain tools. */
export interface AiGenerationExecutionContext {
  operationId:string;selection:AiSelection;resourceKey:string;configurationGeneration:string;
  sessionGeneration:string;deadlineAt:Date;prompt:string;
  beforeExchange():Promise<void>;checkLease():Promise<void>;
  teacherOwner?: {actorId:string;sessionId:string;jobId:string;attemptId:string};
  nativeObservation?: TeacherAgenticObservation;
  persistAgenticDescriptor?(descriptor:TeacherAgenticDescriptor):Promise<void>;
}
export interface AiGenerationResult { text:string;responseHash:string;localClosed:true;remoteOutcome:'completed';
  agentic?:{descriptor:TeacherAgenticDescriptor;proof:TeacherAgenticProof}; }
export abstract class AiGenerationPort {
  abstract measure(prompt:string):{utf8Bytes:number;maximumUtf8Bytes:number};
  abstract execute(context:AiGenerationExecutionContext,signal:AbortSignal):Promise<AiGenerationResult>;
}
