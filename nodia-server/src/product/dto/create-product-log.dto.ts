import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
  Matches,
  MaxLength,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PRODUCT_BARCODE_PATTERN } from '../product-catalog.js';
import {
  PRODUCT_MEASUREMENT_UNITS,
  type ProductMeasurementUnit,
} from '../product-measurement-unit.js';

export class CreateProductLogDto {
  @IsNotEmpty()
  @IsString()
  product_id: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(255)
  code?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(PRODUCT_MEASUREMENT_UNITS)
  measurement_unit?: ProductMeasurementUnit;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(PRODUCT_BARCODE_PATTERN)
  barcode?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  offer_price?: number | null;

  @IsOptional()
  @IsBoolean()
  is_offer_enabled?: boolean | null;

  @IsOptional()
  @IsBoolean()
  has_stock?: boolean | null;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsInt()
  cost_price: number;

  @IsNotEmpty()
  @IsInt()
  cost_price_tax: number;

  @IsNotEmpty()
  @IsInt()
  sale_price: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
