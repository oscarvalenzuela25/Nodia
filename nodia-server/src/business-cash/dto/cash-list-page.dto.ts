import { Transform } from 'class-transformer';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export const CASH_MAX_PAGE = 100000;
export const CASH_MAX_LIMIT = 100;

const parseQueryInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class CashListPageDto {
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
}
