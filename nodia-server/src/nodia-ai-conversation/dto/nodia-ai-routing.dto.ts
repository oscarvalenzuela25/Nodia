import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDefined,
  IsInt,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { NodiaAiSelectionDto } from './nodia-ai-selection.dto.js';
import { IsUtf8Text } from './nodia-ai-validation.js';
export class NodiaAiRoutingTargetDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiSelectionDto)
  selection!: NodiaAiSelectionDto;
  @IsUtf8Text(256) configuration_generation!: string;
  @IsUtf8Text(256) session_generation!: string;
}
export class NodiaAiRoutingSnapshotDto {
  @Equals(1) schema_version!: 1;
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(1) @Max(2147483647) revision!: number;
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiRoutingTargetDto)
  target!: NodiaAiRoutingTargetDto | null;
}
export class UpdateNodiaAiRoutingDto {
  @IsInt() @Min(1) @Max(2147483647) expected_conversation_revision!: number;
  @IsInt() @Min(1) @Max(2147483647) expected_routing_revision!: number;
  @IsBoolean() enabled!: boolean;
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiRoutingTargetDto)
  target!: NodiaAiRoutingTargetDto | null;
}
