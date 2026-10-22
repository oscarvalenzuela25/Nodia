import { Type } from 'class-transformer';
import { IsUUID, ValidateIf, ValidateNested, IsDefined } from 'class-validator';
import { NodiaAiSelectionDto } from './nodia-ai-selection.dto.js';
import { IsUtf8Text } from './nodia-ai-validation.js';
export class CreateNodiaAiConversationDto {
  @IsUUID('4') client_request_id!: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUtf8Text(256)
  title?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiSelectionDto)
  selection?: NodiaAiSelectionDto;
}
