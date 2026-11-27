import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsIn,
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
import { NodiaCvSelectionDto } from './nodia-cv-generation.dto.js';
import { CV_EDIT_MAX_INSTRUCTIONS_BYTES } from '../engine/types.js';
import type { CvDraftReviewEvidence, CvTechnologyAddition, CvTechnologyReview } from '../types/nodia-cv-generation.types.js';
import { CV_MAX_TECHNOLOGIES, CV_TECHNOLOGY_NAME } from '../engine/technologies.js';

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

export class NodiaCvTechnologyAdditionDto implements CvTechnologyAddition {
  @ApiProperty({ type: String, maxLength: 80 })
  @trimText
  @Matches(CV_TECHNOLOGY_NAME)
  name!: string;

  @ApiProperty({ enum: ['confirmed', 'study'] })
  @IsIn(['confirmed', 'study'])
  status!: CvTechnologyAddition['status'];

  @ApiPropertyOptional({ type: String, maxLength: 160 })
  @ValidateIf((entry: NodiaCvTechnologyAdditionDto) => entry.status === 'confirmed' || entry.source !== undefined)
  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Matches(/^[^\p{Cc}\p{Cs}\p{Bidi_Control}]+$/u)
  source?: string;

  @ApiPropertyOptional({ type: String, maxLength: 600 })
  @ValidateIf((entry: NodiaCvTechnologyAdditionDto) => entry.status === 'confirmed' || entry.detail !== undefined)
  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(600)
  @Matches(/^(?:[^\p{Cc}\p{Cs}\p{Bidi_Control}]|\n)+$/u)
  detail?: string;
}

export class NodiaCvTechnologyReviewDto implements CvTechnologyReview {
  @ApiProperty({ type: [String], maxItems: CV_MAX_TECHNOLOGIES })
  @IsArray()
  @ArrayMaxSize(CV_MAX_TECHNOLOGIES)
  @Matches(CV_TECHNOLOGY_NAME, { each: true })
  included!: string[];

  @ApiProperty({ type: [NodiaCvTechnologyAdditionDto], maxItems: CV_MAX_TECHNOLOGIES })
  @IsArray()
  @ArrayMaxSize(CV_MAX_TECHNOLOGIES)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => NodiaCvTechnologyAdditionDto)
  additions!: NodiaCvTechnologyAdditionDto[];
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

  @ApiPropertyOptional({ type: NodiaCvTechnologyReviewDto })
  @ValidateIf((_entry, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => NodiaCvTechnologyReviewDto)
  technologies?: NodiaCvTechnologyReviewDto;
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
