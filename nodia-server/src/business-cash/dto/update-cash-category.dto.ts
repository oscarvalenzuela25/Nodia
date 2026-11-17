import {
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CASH_MAX_VERSION,
  CASH_UUID_PATTERN,
} from '../policies/cash-category.policy.js';

export class UpdateCashCategoryDto {
  @Matches(CASH_UUID_PATTERN)
  request_key: string;

  @IsInt()
  @Min(1)
  @Max(CASH_MAX_VERSION)
  expected_version: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  is_active?: boolean;
}
