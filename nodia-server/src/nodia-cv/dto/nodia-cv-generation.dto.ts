import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { AiSelection } from '../../ai-generation/ai-selection.js';

export const CV_MAX_OFFER_BYTES = 24 * 1024;
const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class NodiaCvSelectionDto implements AiSelection {
  @ApiProperty({ type: String })
  @IsString()
  @Matches(/^[1-9][0-9]{0,18}$/)
  connection_id!: string;

  @ApiProperty({ enum: ['api_key', 'agentic'] })
  @IsIn(['api_key', 'agentic'])
  mode!: AiSelection['mode'];

  @ApiProperty({ type: String, maxLength: 1024 })
  @trim
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  model_id!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 256 })
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @trim
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  effort_id: string | null = null;
}

export class StartNodiaCvGenerationDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  request_key!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  profile_id!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  profile_revision!: number;

  @ApiProperty({ enum: ['es', 'en'] })
  @IsIn(['es', 'en'])
  language!: 'es' | 'en';

  @ApiProperty({ type: String, maxLength: CV_MAX_OFFER_BYTES })
  @trim
  @IsString()
  @IsNotEmpty()
  @MaxLength(CV_MAX_OFFER_BYTES)
  offer_text!: string;

  @ApiPropertyOptional({ type: String, maxLength: 160 })
  @ValidateIf((_object, value) => value !== undefined)
  @trim
  @IsString()
  @MaxLength(160)
  vacancy_title?: string;

  @ApiPropertyOptional({ type: String, maxLength: 160 })
  @ValidateIf((_object, value) => value !== undefined)
  @trim
  @IsString()
  @MaxLength(160)
  vacancy_company?: string;

  @ApiProperty({ type: NodiaCvSelectionDto })
  @IsObject()
  @ValidateNested()
  @Type(() => NodiaCvSelectionDto)
  selection!: NodiaCvSelectionDto;
}
