import {
  IsBoolean,
  IsIn,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CASH_UUID_PATTERN } from '../policies/cash-category.policy.js';
import {
  CASH_AMOUNT_PATTERN,
  CASH_CATEGORY_ID_PATTERN,
} from '../policies/cash-movement-command.policy.js';
import type { CashMovementType } from '../types/cash.types.js';

export class CreateCashMovementDto {
  @Matches(CASH_UUID_PATTERN)
  request_key: string;

  @Matches(CASH_UUID_PATTERN)
  business_id: string;

  @IsIn(['income', 'expense'])
  type: CashMovementType;

  @Matches(CASH_CATEGORY_ID_PATTERN)
  category_id: string;

  @Matches(CASH_AMOUNT_PATTERN)
  amount: string;

  @IsString()
  occurred_on: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  is_active?: boolean;
}
