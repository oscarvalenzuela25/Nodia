import { IsBoolean, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { IsUtf8Text } from './nodia-ai-validation.js';
export class UpdateNodiaAiConversationDto {
  @IsInt() @Min(1) @Max(2147483647) expected_conversation_revision!: number;
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsUtf8Text(256)
  title?: string | null;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  is_pinned?: boolean;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  is_archived?: boolean;
}
