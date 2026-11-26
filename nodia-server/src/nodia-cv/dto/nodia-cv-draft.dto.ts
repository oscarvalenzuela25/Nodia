import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NodiaCvSelectionDto } from './nodia-cv-generation.dto.js';
import { CV_EDIT_MAX_INSTRUCTIONS_BYTES } from '../engine/types.js';
import type { CvDraftReviewEvidence } from '../types/nodia-cv-generation.types.js';

const trimText = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.normalize('NFC').replace(/\r\n?/g, '\n').trim()
    : value,
);

class NodiaCvReviewEvidenceDto implements CvDraftReviewEvidence {
  @ApiProperty({ type: String, pattern: '^r[1-9][0-9]{0,2}$' })
  @IsString()
  @Matches(/^r[1-9][0-9]{0,2}$/)
  requirement_id!: string;

  @ApiProperty({ type: String, maxLength: 160 })
  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Matches(/^[^\p{Cc}\p{Cs}\p{Bidi_Control}]+$/u)
  source!: string;

  @ApiProperty({ type: String, maxLength: 600 })
  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  @Matches(/^(?:[^\p{Cc}\p{Cs}\p{Bidi_Control}]|\n)+$/u)
  detail!: string;
}

export class UpdateNodiaCvDraftDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;

  @ApiProperty({ type: [String], maxItems: 4096 })
  @IsArray()
  @ArrayMaxSize(4096)
  @Matches(/^e[1-9][0-9]{0,5}$/, { each: true })
  included_fact_ids!: string[];

  @ApiProperty({ type: [NodiaCvReviewEvidenceDto], maxItems: 128 })
  @IsArray()
  @ArrayMaxSize(128)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => NodiaCvReviewEvidenceDto)
  evidence!: NodiaCvReviewEvidenceDto[];
}

export class StartNodiaCvAiEditDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  request_key!: string;

  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;

  @ApiProperty({ type: String, maxLength: CV_EDIT_MAX_INSTRUCTIONS_BYTES })
  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(CV_EDIT_MAX_INSTRUCTIONS_BYTES)
  @Matches(/^(?:[^\p{Cc}\p{Cs}\p{Bidi_Control}]|\n)+$/u)
  instructions!: string;

  @ApiProperty({ type: NodiaCvSelectionDto })
  @IsObject()
  @ValidateNested()
  @Type(() => NodiaCvSelectionDto)
  selection!: NodiaCvSelectionDto;
}
