import {
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  IsOptional,
  IsIn,
} from 'class-validator';
import { PRODUCT_BARCODE_PATTERN } from '../product-catalog.js';

export class ProductBarcodeQueryDto {
  @IsUUID()
  business_id: string;

  @IsString()
  @MaxLength(255)
  @Matches(PRODUCT_BARCODE_PATTERN)
  barcode: string;
}

export class ProductAvailabilityQueryDto {
  @IsUUID()
  business_id: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  activity?: 'active' | 'inactive' | 'all';
}
