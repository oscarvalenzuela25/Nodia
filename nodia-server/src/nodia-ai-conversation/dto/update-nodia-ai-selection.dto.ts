import { Type } from 'class-transformer';
import { IsDefined, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { NodiaAiSelectionDto } from './nodia-ai-selection.dto.js';
export class UpdateNodiaAiSelectionDto {
  @IsInt() @Min(1) @Max(2147483647) expected_conversation_revision!: number;
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiSelectionDto)
  selection!: NodiaAiSelectionDto;
}
