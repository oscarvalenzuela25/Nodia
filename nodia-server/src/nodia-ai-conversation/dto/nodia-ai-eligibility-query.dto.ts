import { IsIn, ValidateIf } from 'class-validator';
import { IsUtf8Text } from './nodia-ai-validation.js';

/** Omitted effort means provider default; the literal string "null" is not null. */
export class NodiaAiEligibilityQueryDto {
  @IsIn(['api_key', 'agentic'])
  mode!: 'api_key' | 'agentic';

  @IsUtf8Text(1024) model_id!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUtf8Text(256)
  effort_id?: string;
}
