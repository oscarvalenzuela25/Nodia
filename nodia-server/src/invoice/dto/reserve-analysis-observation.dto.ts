import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import type { AnalysisContext } from '../../common/ai/analysis-progress.js';
export class ReserveAnalysisObservationDto implements AnalysisContext {
  @IsUUID() business_id: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128) provider_id?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128) ai_provider_id?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128) ai_provider?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128) model?: string;
  @IsOptional() @IsIn(['default', 'ocr']) model_type?: string;
  @IsOptional() @IsIn(['api_key', 'token_plan_web', 'token_plan_agentic']) mode?: string;
  @IsOptional() @IsIn(['web', 'agentic']) engine?: string;
  @IsOptional() @Matches(/^[a-z][a-z0-9_-]{0,31}$/) thinking_level?: string;
  @IsOptional() @IsBoolean() extended_thinking?: boolean;
}
