import { IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class FilterProductLogDto {
  @IsOptional()
  @IsString()
  product_id_eq?: string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
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
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
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
