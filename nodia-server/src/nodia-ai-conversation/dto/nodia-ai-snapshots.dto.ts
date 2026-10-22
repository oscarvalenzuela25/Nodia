import { Type } from 'class-transformer';
import {
  Equals,
  IsDefined,
  IsIn,
  IsInt,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { NodiaAiSelectionDto } from './nodia-ai-selection.dto.js';
import { NodiaAiRoutingSnapshotDto } from './nodia-ai-routing.dto.js';
import { IsUtf8Text } from './nodia-ai-validation.js';
export class NodiaAiBudgetUsageDto {
  @IsInt() @Min(0) @Max(2147483647) tool_calls!: number;
  @IsInt() @Min(0) @Max(2147483647) mcp_rpc_messages!: number;
  @IsInt() @Min(0) @Max(2147483647) provider_dispatches!: number;
  @IsInt() @Min(0) @Max(2147483647) compactions!: number;
  @IsInt() @Min(0) @Max(2147483647) delegations!: number;
}
export class NodiaAiBudgetSnapshotDto extends NodiaAiBudgetUsageDto {
  @Equals(1) schema_version!: 1;
}
export class NodiaAiStageDto {
  @IsInt() @Min(1) @Max(2147483647) stage_seq!: number;
  @IsUtf8Text(128)
  stage_key!: string;
  @IsIn(['base', 'delegated']) routing_phase!: 'base' | 'delegated';
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiSelectionDto)
  selection!: NodiaAiSelectionDto;
}
export class NodiaAiSnapshotsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiSelectionDto)
  base_selection!: NodiaAiSelectionDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiRoutingSnapshotDto)
  routing!: NodiaAiRoutingSnapshotDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiBudgetSnapshotDto)
  budget!: NodiaAiBudgetSnapshotDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiBudgetUsageDto)
  usage!: NodiaAiBudgetUsageDto;
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsDefined()
  @ValidateNested()
  @Type(() => NodiaAiStageDto)
  stage!: NodiaAiStageDto | null;
}
