import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  INVALID_PROVIDER_VISIT_ALARM_TIME,
  PROVIDER_VISIT_ALARM_TIME_PATTERN,
} from '../provider-visit-alarm-time.js';

export class CreateProviderDto {
  @IsNotEmpty()
  @IsUUID()
  business_id: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 255)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  tax?: number = 19;

  @IsOptional()
  @IsObject()
  fields?: Record<string, any> = {};

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  use_ocr?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: '08:45' })
  @IsOptional()
  @Matches(PROVIDER_VISIT_ALARM_TIME_PATTERN, {
    message: INVALID_PROVIDER_VISIT_ALARM_TIME,
  })
  visit_alarm_time?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
