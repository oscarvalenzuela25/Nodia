import { IsIn, ValidateIf } from 'class-validator';
import { IsPostgresBigint, IsUtf8Text } from './nodia-ai-validation.js';
export class NodiaAiSelectionDto {
  @IsPostgresBigint() connection_id!: string;
  @IsIn(['api_key', 'agentic']) mode!: 'api_key' | 'agentic';
  @IsUtf8Text(1024) model_id!: string;
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsUtf8Text(256)
  effort_id?: string | null;
}
