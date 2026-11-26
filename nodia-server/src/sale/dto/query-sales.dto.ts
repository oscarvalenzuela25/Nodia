import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SALE_PAYMENT_METHODS,
  SALE_STATUSES,
  type SalePaymentMethod,
  type SaleStatus,
} from '../types/sale.types.js';

export class QuerySalesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsIn(SALE_STATUSES) status?: SaleStatus;
  @IsOptional() @IsIn(SALE_PAYMENT_METHODS) payment_method?: SalePaymentMethod;
  @IsOptional() @IsString() @MaxLength(40) from?: string;
  @IsOptional() @IsString() @MaxLength(40) to_exclusive?: string;
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @IsIn(['units', 'amount']) metric?: 'units' | 'amount';
}
