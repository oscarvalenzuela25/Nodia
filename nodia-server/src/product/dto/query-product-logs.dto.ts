import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { FilterProductLogDto } from './filter-product-log.dto.js';

export class QueryProductLogsDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((v) => String(v));
  })
  @IsArray()
  @IsString({ each: true })
  product_ids?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((v) => String(v));
  })
  @IsArray()
  @IsString({ each: true })
  codes?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FilterProductLogDto)
  q?: FilterProductLogDto;

  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsBoolean()
  includes?: boolean;

  @IsOptional()
  @IsString()
  s?: string;
}
