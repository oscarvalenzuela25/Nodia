import { IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ obj, value }) => {
    if (value !== undefined) return Number(value);
    if (obj?.size !== undefined) return Number(obj.size);
    return 10;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'false' || value === false || value === '0' || value === 0) {
      return false;
    }
    return true;
  })
  @IsBoolean()
  includes: boolean = true;
}
