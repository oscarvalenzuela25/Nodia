import { IsBoolean, IsString, Matches, ValidateIf } from 'class-validator';
import { CASH_UUID_PATTERN } from '../policies/cash-category.policy.js';

export class CreateCashCategoryDto {
  @Matches(CASH_UUID_PATTERN)
  request_key: string;

  @Matches(CASH_UUID_PATTERN)
  business_id: string;

  @IsString()
  name: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  is_active?: boolean;
}
