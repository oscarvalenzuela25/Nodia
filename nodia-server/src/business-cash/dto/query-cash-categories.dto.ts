import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CASH_UUID_PATTERN } from '../policies/cash-category.policy.js';

export const CASH_CATEGORY_SORTS = ['name asc', 'name desc'] as const;
export const CASH_MAX_PAGE = 100000;
export const CASH_MAX_LIMIT = 100;

const parseQueryInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

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

export class QueryCashCategoriesDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(parseQueryInteger)
  @IsInt()
  @Min(1)
  @Max(CASH_MAX_PAGE)
  page?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(parseQueryInteger)
  @IsInt()
  @Min(1)
  @Max(CASH_MAX_LIMIT)
  limit?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => CashCategoryFiltersDto)
  q: CashCategoryFiltersDto;
}
