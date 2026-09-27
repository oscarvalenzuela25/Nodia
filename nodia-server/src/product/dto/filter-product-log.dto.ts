import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterProductLogDto {
  @IsOptional()
  @IsString()
  product_id_eq?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((v) => String(v));
  })
  @IsArray()
  @IsString({ each: true })
  product_id_in?: string[];

  @IsOptional()
  @IsString()
  code_cont?: string;

  @IsOptional()
  @IsString()
  code_eq?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((v) => String(v));
  })
  @IsArray()
  @IsString({ each: true })
  code_in?: string[];

  @IsOptional()
  @IsString()
  name_cont?: string;

  @IsOptional()
  @IsString()
  s?: string;
}
