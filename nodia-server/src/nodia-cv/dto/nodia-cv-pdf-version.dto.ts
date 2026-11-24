import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { CvPdfTemplate } from '../pdf/nodia-cv-pdf-renderer.service.js';

const templates = ['classic', 'compact'] as const;
const languages = ['es', 'en'] as const;
const queryInteger = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
    ? Number(value)
    : value,
);

class NodiaCvDraftRevisionDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;
}

export class PrepareNodiaCvPdfDto extends NodiaCvDraftRevisionDto {
  @ApiProperty({ enum: templates })
  @IsIn(templates)
  template!: CvPdfTemplate;
}

export class SaveNodiaCvVersionDto extends NodiaCvDraftRevisionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  request_key!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  generation_id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  artifact_id!: string;

  @ApiProperty({ type: String, pattern: '^[0-9a-f]{64}$' })
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  sha256!: string;
}

export class ListNodiaCvVersionsDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 10000, default: 1 })
  @queryInteger
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 50, default: 10 })
  @queryInteger
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

export class NodiaCvPdfVerificationDto {
  @ApiProperty({ enum: ['a4'] }) format!: 'a4';
  @ApiProperty({ type: String }) renderer!: string;
  @ApiProperty({ type: String, pattern: '^[0-9a-f]{64}$' }) sha256!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 4 }) page_count!: number;
  @ApiProperty({ type: String }) extracted_text!: string;
  @ApiProperty({ type: Boolean }) missing_contact!: boolean;
}

export class NodiaCvPreparedPdfDto extends NodiaCvPdfVerificationDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) generation_id!: string;
  @ApiProperty({ type: Number, minimum: 1 }) revision!: number;
  @ApiProperty({ enum: templates }) template!: CvPdfTemplate;
  @ApiProperty({ enum: languages }) language!: (typeof languages)[number];
  @ApiProperty({ type: String, format: 'date-time' }) expires_at!: Date;
}

export class NodiaCvVersionSummaryDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: Number, minimum: 1 }) version_number!: number;
  @ApiProperty({ type: String }) profile_name!: string;
  @ApiProperty({ type: String, nullable: true }) vacancy_title!: string | null;
  @ApiProperty({ type: String, nullable: true }) vacancy_company!:
    string | null;
  @ApiProperty({ enum: languages }) language!: (typeof languages)[number];
  @ApiProperty({ enum: templates }) template!: CvPdfTemplate;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: Date;
}

export class NodiaCvVersionPageDto {
  @ApiProperty({ type: [NodiaCvVersionSummaryDto] })
  items!: NodiaCvVersionSummaryDto[];
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) limit!: number;
  @ApiProperty({ type: Number }) total!: number;
}
