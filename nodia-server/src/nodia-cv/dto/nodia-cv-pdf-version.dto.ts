import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
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
import {
  CV_PDF_TEMPLATES,
  type CvPdfTemplate,
} from '../pdf/nodia-cv-pdf-contract.js';
import type {
  CvDraftRequirement,
  CvEvidenceFact,
  CvTechnologyOption,
} from '../engine/index.js';
import type { CvDraftReviewEvidence, CvTechnologyReview } from '../types/nodia-cv-generation.types.js';
import { NodiaCvTechnologyReviewDto } from './nodia-cv-draft.dto.js';

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
  @ApiProperty({ enum: CV_PDF_TEMPLATES })
  @IsIn(CV_PDF_TEMPLATES)
  template!: CvPdfTemplate;
}

export class CopyNodiaCvVersionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  request_key!: string;
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
  @ApiProperty({ enum: CV_PDF_TEMPLATES }) template!: CvPdfTemplate;
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
  @ApiProperty({ enum: CV_PDF_TEMPLATES }) template!: CvPdfTemplate;
  @ApiProperty({ type: String, format: 'date-time' }) created_at!: Date;
}

class NodiaCvSavedRequirementDto implements CvDraftRequirement {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) quote!: string;
  @ApiProperty({ enum: ['required', 'preferred', 'uncertain'] })
  kind!: CvDraftRequirement['kind'];
  @ApiProperty({ enum: ['supported', 'confirm', 'omitted', 'gap'] })
  coverage!: CvDraftRequirement['coverage'];
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
}

class NodiaCvSavedFactDto implements CvEvidenceFact {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) groupId!: string;
  @ApiProperty({ type: String }) section!: CvEvidenceFact['section'];
  @ApiProperty({ type: String }) field!: string;
  @ApiProperty({ type: String }) text!: string;
}

class NodiaCvSavedEvidenceDto implements CvDraftReviewEvidence {
  @ApiProperty({ type: String }) requirement_id!: string;
  @ApiProperty({ type: String }) source!: string;
  @ApiProperty({ type: String }) detail!: string;
}

class NodiaCvSavedTechnologyOptionDto implements CvTechnologyOption {
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: ['required', 'preferred', 'uncertain', 'outside'] })
  kind!: CvTechnologyOption['kind'];
  @ApiProperty({ type: Boolean }) in_profile!: boolean;
  @ApiProperty({ type: [String] }) requirement_ids!: string[];
}

export class NodiaCvVersionAnalysisDto {
  @ApiProperty({ type: [NodiaCvSavedRequirementDto] })
  requirements!: CvDraftRequirement[];
  @ApiProperty({ type: [NodiaCvSavedFactDto] }) facts!: CvEvidenceFact[];
  @ApiProperty({ type: [NodiaCvSavedEvidenceDto] })
  evidence!: CvDraftReviewEvidence[];
  @ApiPropertyOptional({ type: [NodiaCvSavedTechnologyOptionDto] })
  technology_options?: CvTechnologyOption[];
  @ApiPropertyOptional({ type: NodiaCvTechnologyReviewDto })
  technologies?: CvTechnologyReview;
}

export class NodiaCvVersionDetailDto extends IntersectionType(
  NodiaCvVersionSummaryDto,
  NodiaCvPdfVerificationDto,
) {
  @ApiProperty({ type: NodiaCvVersionAnalysisDto, nullable: true })
  analysis!: NodiaCvVersionAnalysisDto | null;
}

export class NodiaCvVersionPageDto {
  @ApiProperty({ type: [NodiaCvVersionSummaryDto] })
  items!: NodiaCvVersionSummaryDto[];
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) limit!: number;
  @ApiProperty({ type: Number }) total!: number;
}
