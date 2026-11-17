import { Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CASH_UUID_PATTERN } from '../policies/cash-category.policy.js';
import { CashListPageDto } from './cash-list-page.dto.js';

export const CASH_MOVEMENT_SORTS = [
  'occurred_on asc',
  'occurred_on desc',
  'amount asc',
  'amount desc',
] as const;

class CashMovementFiltersDto {
  @Matches(CASH_UUID_PATTERN)
  business_id_eq: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn([true, false, 'true', 'false'])
  is_active_eq?: boolean | 'true' | 'false';

  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^[1-9]\d{0,18}$/)
  category_id_eq?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  occurred_on_gteq?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  occurred_on_lteq?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  search?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(CASH_MOVEMENT_SORTS)
  s?: (typeof CASH_MOVEMENT_SORTS)[number];
}

export class QueryCashMovementsDto extends CashListPageDto {
  @IsObject()
  @ValidateNested()
  @Type(() => CashMovementFiltersDto)
  q: CashMovementFiltersDto;
}

export class QueryCashMonthlySummaryDto {
  @Matches(CASH_UUID_PATTERN)
  business_id: string;
}

export class CashMovementParamsDto {
  @Matches(CASH_UUID_PATTERN)
  id: string;
}
