import { IsIn, ValidateIf } from 'class-validator';
import { IsPostgresBigint, IsUtf8Text } from './nodia-ai-validation.js';
export class NodiaAiSelectionDto {
  @IsPostgresBigint() connection_id!: string;
  @IsIn(['api_key', 'token_plan_web', 'token_plan_agentic']) mode!:
    'api_key' | 'token_plan_web' | 'token_plan_agentic';
  @IsUtf8Text(1024) model_id!: string;
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsUtf8Text(256)
  effort_id?: string | null;
}
