import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class FilterProductDto {
  @IsOptional()
  @IsUUID()
  business_id_eq?: string;

  @IsOptional()
  @IsString()
  provider_id_eq?: string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  provider_id_in?: string[];

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
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  name_in?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  is_active_eq?: boolean;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  stock_status_in?: string[];

  @IsOptional()
  @IsString()
  s?: string;
}
