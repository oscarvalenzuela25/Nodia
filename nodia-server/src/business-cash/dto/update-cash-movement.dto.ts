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
import {
  CASH_AMOUNT_PATTERN,
  CASH_CATEGORY_ID_PATTERN,
} from '../policies/cash-movement-command.policy.js';

export class UpdateCashMovementDto {
  @Matches(CASH_UUID_PATTERN)
  request_key: string;

  @IsInt()
  @Min(1)
  @Max(CASH_MAX_VERSION)
  expected_version: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Matches(CASH_CATEGORY_ID_PATTERN)
  category_id?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Matches(CASH_AMOUNT_PATTERN)
  amount?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  occurred_on?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  is_active?: boolean;
}
