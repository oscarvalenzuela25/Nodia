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

export const CASH_CATEGORY_SORTS = ['name asc', 'name desc'] as const;

class CashCategoryFiltersDto {
  @Matches(CASH_UUID_PATTERN)
  business_id_eq: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn([true, false, 'true', 'false'])
  is_active_eq?: boolean | 'true' | 'false';

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  name_cont?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(CASH_CATEGORY_SORTS)
  s?: (typeof CASH_CATEGORY_SORTS)[number];
}

export class QueryCashCategoriesDto extends CashListPageDto {
  @IsObject()
  @ValidateNested()
  @Type(() => CashCategoryFiltersDto)
  q: CashCategoryFiltersDto;
}
