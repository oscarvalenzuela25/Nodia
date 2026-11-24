import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const CV_PROFILE_MAX_BYTES = 96 * 1024;
const MAX_ROWS = 25;
const MAX_LINES = 30;
const MAX_REVISION = 2_147_483_647;
const month = /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/;
const year = /^(?!0000)\d{4}$/;
const validText =
  // oxlint-disable-next-line eslint/no-control-regex -- Reject controls that PostgreSQL and PDF text cannot safely preserve.
  /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uD800-\uDFFF]*$/u;
const present = ValidateIf((_object, value: unknown) => value !== undefined);
const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);
const trimLines = Transform(({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((line: unknown) =>
        typeof line === 'string' ? line.trim() : line,
      )
    : value,
);
const queryInteger = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value)
    ? Number(value)
    : value,
);

function optionalText(maxLength = 160) {
  return applyDecorators(
    ApiPropertyOptional({ type: String, maxLength }),
    present,
    trim,
    IsString(),
    MaxLength(maxLength),
    Matches(validText),
  );
}

function requiredText(maxLength = 160) {
  return applyDecorators(
    ApiProperty({ type: String, minLength: 1, maxLength }),
    trim,
    IsString(),
    IsNotEmpty(),
    MaxLength(maxLength),
    Matches(validText),
  );
}

function precision(pattern: RegExp, example: string) {
  return applyDecorators(
    ApiPropertyOptional({ type: String, pattern: pattern.source, example }),
    present,
    IsString(),
    Matches(pattern),
  );
}

function presentationUrl() {
  return applyDecorators(
    ApiPropertyOptional({ type: String, format: 'uri', maxLength: 2048 }),
    present,
    trim,
    IsString(),
    MaxLength(2048),
    IsUrl({
      protocols: ['http', 'https'],
      require_protocol: true,
      disallow_auth: true,
    }),
  );
}

function lines(maxLength = 500) {
  return applyDecorators(
    ApiPropertyOptional({
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength },
      maxItems: MAX_LINES,
    }),
    present,
    trimLines,
    IsArray(),
    ArrayMaxSize(MAX_LINES),
    IsString({ each: true }),
    IsNotEmpty({ each: true }),
    MaxLength(maxLength, { each: true }),
    Matches(validText, { each: true }),
  );
}

function collection(model: () => new () => object) {
  return applyDecorators(
    ApiPropertyOptional({ type: model, isArray: true, maxItems: MAX_ROWS }),
    present,
    IsArray(),
    ArrayMaxSize(MAX_ROWS),
    IsObject({ each: true }),
    ValidateNested({ each: true }),
    Type(model),
  );
}

class CvProfileEntryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'Stable entry ID. Omit it on create and when adding a new entry.',
  })
  @present
  @IsUUID('4')
  id?: string;
}

export class CvContactDto {
  @optionalText() location?: string;

  @ApiPropertyOptional({ type: String, format: 'email', maxLength: 254 })
  @present
  @trim
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @optionalText(60) phone?: string;
  @presentationUrl() linkedin_url?: string;
  @presentationUrl() github_url?: string;
  @presentationUrl() portfolio_url?: string;
}

export class CvExperienceDto extends CvProfileEntryDto {
  @requiredText() company!: string;
  @requiredText() position!: string;
  @optionalText() location?: string;

  @ApiPropertyOptional({ enum: ['current', 'finished'] })
  @present
  @IsIn(['current', 'finished'])
  status?: 'current' | 'finished';

  @precision(month, '2025-08') start_month?: string;
  @precision(month, '2026-11') end_month?: string;
  @lines() highlights?: string[];
  @lines(100) technologies?: string[];
}

export class CvProjectDto extends CvProfileEntryDto {
  @requiredText() name!: string;
  @optionalText() role?: string;
  @optionalText(120) status?: string;
  @optionalText(4000) validation_context?: string;
  @precision(month, '2025-08') start_month?: string;
  @precision(month, '2026-11') end_month?: string;
  @lines() contributions?: string[];
  @lines(100) technologies?: string[];
  @presentationUrl() url?: string;
}

export class CvSkillAreaDto extends CvProfileEntryDto {
  @requiredText() name!: string;
  @lines(100) skills?: string[];
}

export class CvEducationDto extends CvProfileEntryDto {
  @requiredText(200) title!: string;
  @requiredText(200) institution!: string;
  @precision(year, '2020') start_year?: string;
  @precision(year, '2024') end_year?: string;
  @optionalText(4000) details?: string;
}

export class CvCertificationDto extends CvProfileEntryDto {
  @requiredText(200) name!: string;
  @optionalText(200) issuer?: string;
  @precision(year, '2026') year?: string;
  @optionalText() credential_id?: string;
  @presentationUrl() verification_url?: string;
}

export class CvLanguageDto extends CvProfileEntryDto {
  @requiredText(100) language!: string;
  @optionalText(120) level?: string;
  @optionalText(4000) usage?: string;
}

export class CvAdditionalSectionDto extends CvProfileEntryDto {
  @requiredText() title!: string;
  @lines() lines?: string[];
}

export class NodiaCvProfileInputDto {
  @requiredText(120) profile_name!: string;
  @requiredText() full_name!: string;
  @optionalText() professional_title?: string;
  @optionalText() second_title?: string;
  @optionalText(4000) summary?: string;
  @lines(100) main_stack?: string[];

  @ApiPropertyOptional({ type: CvContactDto })
  @present
  @IsObject()
  @ValidateNested()
  @Type(() => CvContactDto)
  contact?: CvContactDto;

  @collection(() => CvExperienceDto) experiences?: CvExperienceDto[];
  @collection(() => CvProjectDto) projects?: CvProjectDto[];
  @collection(() => CvSkillAreaDto) skill_areas?: CvSkillAreaDto[];
  @collection(() => CvEducationDto) education?: CvEducationDto[];
  @collection(() => CvCertificationDto) certifications?: CvCertificationDto[];
  @collection(() => CvLanguageDto) languages?: CvLanguageDto[];
  @collection(() => CvAdditionalSectionDto)
  additional_sections?: CvAdditionalSectionDto[];
}

export class CreateNodiaCvProfileDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('4')
  request_key!: string;

  @ApiProperty({ type: NodiaCvProfileInputDto })
  @IsObject()
  @ValidateNested()
  @Type(() => NodiaCvProfileInputDto)
  profile!: NodiaCvProfileInputDto;
}

export class UpdateNodiaCvProfileDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: MAX_REVISION })
  @IsInt()
  @Min(1)
  @Max(MAX_REVISION)
  revision!: number;

  @ApiProperty({ type: NodiaCvProfileInputDto })
  @IsObject()
  @ValidateNested()
  @Type(() => NodiaCvProfileInputDto)
  profile!: NodiaCvProfileInputDto;
}

export class DeleteNodiaCvProfileQueryDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: MAX_REVISION })
  @queryInteger
  @IsInt()
  @Min(1)
  @Max(MAX_REVISION)
  revision!: number;
}

export class NodiaCvProfileListQueryDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 10_000,
    default: 1,
  })
  @queryInteger
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 50, default: 10 })
  @queryInteger
  @IsInt()
  @Min(1)
  @Max(50)
  page_size = 10;
}
