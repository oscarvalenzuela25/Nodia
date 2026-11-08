import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsIn,
  ArrayMaxSize,
  ArrayNotEmpty,
  ValidateBy,
} from 'class-validator';

export class FilterProductDto {
  @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateBy({ name: 'isCanonicalProductId', validator: { validate: (value: unknown) =>
    typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n } }, { each: true })
  id_in?: string[];

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsIn(['available', 'unavailable', 'unknown'], { each: true })
  availability_in?: Array<'available' | 'unavailable' | 'unknown'>;

  @IsOptional()
  @IsString()
  barcode_eq?: string;

  @IsOptional()
  @IsString()
  barcode_cont?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  has_stock_eq?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  has_stock_null?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  is_offer_enabled_eq?: boolean;

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
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  price_change_in?: string[];

  @IsOptional()
  @IsString()
  name_eq?: string;

  @IsOptional()
  @IsString()
  name_not_eq?: string;

  @IsOptional()
  @IsString()
  name_not_cont?: string;

  @IsOptional()
  @IsString()
  code_not_eq?: string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  code_not_in?: string[];

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  provider_id_null?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  provider_id_not_null?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  )
  @IsNumber()
  stock_gteq?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  )
  @IsNumber()
  stock_lteq?: number;

  @IsOptional()
  @IsString()
  s?: string;
}
