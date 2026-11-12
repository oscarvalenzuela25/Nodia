import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { SessionStateDto } from './teacher.dto.js';

export class LearningBlueprintDto extends SessionStateDto {
  @IsString() @Length(1, 160) title!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) dimensions!: unknown[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) items!: unknown[];
  @IsBoolean() reviewed!: boolean;
}
export class LearningMappingDto extends SessionStateDto {
  @IsUUID() blueprint_id!: string;
  @IsUUID() dimension_id!: string;
  @IsUUID() plan_revision_id!: string;
  @IsUUID() objective_id!: string;
}
export class LearningMetadataDto extends SessionStateDto {
  @IsUUID() response_id!: string;
  @IsInt() @Min(1) @Max(2147483646) expected_response_revision!: number;
  @IsOptional() @IsString() @Length(0, 2000) self_explanation?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(100) confidence?: number | null;
}
export class LearningInteractionDto extends SessionStateDto {
  @IsUUID() content_version_id!: string;
  @IsString() @Length(1, 64) block_id!: string;
  @IsIn(['prediction', 'check']) kind!: 'prediction' | 'check';
  @IsString() @Length(1, 2000) text!: string;
}
