import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class TeacherSelectionDto {
  @IsString() @Length(1, 19) connection_id!: string;
  @IsIn(['agentic', 'api_key']) mode!: 'agentic' | 'api_key';
  @IsString() @Length(1, 1024) model_id!: string;
  @IsOptional() @IsString() @Length(1, 256) effort_id!: string | null;
}
export class CreateSessionDto {
  @Transform(trim) @IsString() @Length(1, 240) topic!: string;
  @Transform(trim) @IsString() @Length(1, 2000) objective!: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 120) title?:
    string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 4000) declared_base?:
    string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 4000) context?:
    string | null;
  @IsString() @Length(2, 35) explanation_language!: string;
  @IsOptional() @IsIn(['teacher_suggests', 'days', 'topics']) organization?:
    'teacher_suggests' | 'days' | 'topics';
  @IsOptional() @IsInt() @Min(1) @Max(365) day_count?: number | null;
  @IsOptional() @ValidateNested() @Type(() => TeacherSelectionDto)
  selection?: TeacherSelectionDto | null;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean()
  start_plan?: boolean;
}
export class PatchSetupDraftDto {
  @IsInt() @Min(0) @Max(2147483646) expected_draft_revision!: number;
  @IsString() @Length(0, 4000) text!: string;
}
export class SessionStateDto {
  @IsInt() @Min(1) @Max(2147483646) expected_session_revision!: number;
}
export class PatchSessionDto extends SessionStateDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 240) topic?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  objective?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 120) title?:
    string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 4000) declared_base?:
    string | null;
  @IsOptional() @Transform(trim) @IsString() @Length(0, 4000) context?:
    string | null;
  @IsOptional() @IsString() @Length(2, 35) explanation_language?: string;
  @IsOptional() @IsIn(['teacher_suggests', 'days', 'topics']) organization?:
    'teacher_suggests' | 'days' | 'topics';
  @IsOptional() @IsInt() @Min(1) @Max(365) day_count?: number | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => TeacherSelectionDto)
  selection?: TeacherSelectionDto | null;
}
export class SetupMessageDto extends SessionStateDto {
  @Transform(trim) @IsString() @Length(1, 4000) text!: string;
  @IsBoolean() generate_reply = true;
  @IsOptional() @IsInt() @Min(0) @Max(2147483646)
  expected_draft_revision?: number;
}
export class ProposePlanDto extends SessionStateDto {
  @IsOptional() @IsUUID() base_proposal_id?: string;
  @IsOptional() @IsString() @Length(64, 64) base_hash?: string;
  @IsOptional() @IsString() @Length(1, 4000) adjustment_text?: string;
  @IsIn(['teacher_suggests', 'days', 'topics']) organization!: 'teacher_suggests' | 'days' | 'topics';
  @IsOptional() @IsInt() @Min(1) @Max(365) day_count?: number | null;
}
export class PatchProposalDto extends SessionStateDto {
  @IsString() @Length(64, 64) expected_proposal_hash!: string;
  @IsObject() outline!: Record<string, unknown>;
  @IsOptional() @IsObject() guide?: Record<string, unknown>;
}
export class ApplyCandidateDto extends SessionStateDto {
  @IsUUID() candidate_id!: string;
  @IsUUID() expected_base_revision_id!: string;
  @IsString() @Length(64, 64) expected_base_hash!: string;
}
export class AcceptPlanDto extends SessionStateDto {
  @IsUUID() proposal_revision_id!: string;
  @IsString() @Length(64, 64) proposal_hash!: string;
}
export class ActivateRevisionDto extends AcceptPlanDto {
  @IsUUID() expected_current_plan_revision_id!: string;
}
export class PrepareMaterialDto extends SessionStateDto {
  @IsUUID() plan_revision_id!: string;
  @IsOptional() @IsIn(['new', 'current']) variant: 'new' | 'current' =
    'current';
}
export class StartAttemptDto extends SessionStateDto {
  @IsOptional() @IsUUID() plan_revision_id?: string;
  @IsIn(['direct', 'after_study', 'practice', 'diagnostic']) entry_route!:
    'direct' | 'after_study' | 'practice' | 'diagnostic';
  @IsOptional() @IsBoolean() new_attempt = false;
}
export class ResponsePatchDto {
  @IsUUID() question_id!: string;
  @IsInt() @Min(1) @Max(2147483646) expected_response_revision!: number;
  @IsObject() answer!: Record<string, unknown>;
}
export class AttemptRevisionDto {
  @IsInt() @Min(1) @Max(2147483646) expected_attempt_revision!: number;
}
export class PatchResponsesDto extends AttemptRevisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => ResponsePatchDto)
  responses!: ResponsePatchDto[];
}
export class SubmitPracticeAnswerDto extends AttemptRevisionDto {
  @IsInt() @Min(1) @Max(2147483646) expected_response_revision!: number;
  @IsObject() answer!: Record<string, unknown>;
}
export class ClosePendingAttemptDto extends AttemptRevisionDto {
  @IsIn(['feedback_unknown_unrecoverable', 'feedback_failed', 'needs_review'])
  reason!:
    'feedback_unknown_unrecoverable' | 'feedback_failed' | 'needs_review';
}
export class RequestHelpDto extends AttemptRevisionDto {
  @IsUUID() question_id!: string;
  @IsBoolean() accept_assisted_attempt!: boolean;
}
export class CursorDataDto {
  @IsOptional() @IsUUID() plan_revision_id?: string | null;
  @IsOptional() @IsUUID() section_id?: string | null;
  @IsOptional() @IsUUID() unit_id?: string | null;
  @IsOptional() @IsUUID() content_version_id?: string | null;
  @IsOptional() @IsUUID() attempt_id?: string | null;
  @IsOptional() @IsUUID() item_id?: string | null;
  @IsIn(['setup', 'theory', 'practice', 'final', 'review']) phase!:
    'setup' | 'theory' | 'practice' | 'final' | 'review';
  @IsOptional() @IsString() @Length(1, 64) block_id?: string | null;
}
export class PatchCursorDto extends CursorDataDto {
  @IsInt() @Min(1) @Max(2147483646) expected_cursor_revision!: number;
}
export class PauseDto extends SessionStateDto {
  @IsInt() @Min(1) @Max(2147483646) expected_cursor_revision!: number;
  @ValidateNested() @Type(() => CursorDataDto) cursor!: CursorDataDto;
  @IsOptional() @IsUUID() attempt_id?: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483646)
  expected_attempt_revision?: number;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => ResponsePatchDto)
  pending_responses?: ResponsePatchDto[];
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PatchSetupDraftDto)
  pending_setup_draft?: PatchSetupDraftDto;
}
export class ContinueJobDto extends SessionStateDto {
  @IsString() @Length(1, 19) expected_job_fence!: string;
}
export class GetTeacherSessionsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) page = 1;
  @IsOptional() @Type(() => Number) @IsIn([10, 20, 50]) limit = 10;
  @IsOptional() @IsString() @Length(0, 120) q?: string;
  @IsOptional() @IsIn(['true', 'false']) archived = 'false';
  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'completed', 'archived'])
  state?: string;
}
export class TeacherEligibilityDto {
  @IsIn(['agentic', 'api_key']) mode!: 'agentic' | 'api_key';
  @IsString() @Length(1, 1024) model_id!: string;
  @IsOptional() @IsString() @Length(1, 256) effort_id?: string;
}
export class TeacherModelsDto {
  @IsIn(['agentic']) mode!: 'agentic';
}
