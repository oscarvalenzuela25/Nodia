import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import {
  SALE_COMBINABLE_PAYMENT_METHODS,
  SALE_PAYMENT_METHODS,
  type SalePaymentMethod,
  type SaleTender,
} from '../types/sale.types.js';

export class SaleItemInputDto {
  @IsString() @Matches(/^[1-9][0-9]{0,18}$/) product_id: string;
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(2147483647)
  quantity: number;
  @IsInt() @Min(1) @Max(2147483647) expected_product_version: number;
  @IsString() @Matches(/^(?:0|[1-9][0-9]{0,18})$/) expected_unit_price: string;
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9][0-9]{0,18})$/)
  unit_price_override?: string | null;
}
export class CreateSaleDto {
  @IsUUID() request_key: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items?: SaleItemInputDto[];
  @IsOptional() @IsIn(SALE_PAYMENT_METHODS) payment_method?: SalePaymentMethod;
  @IsOptional() @IsString() @MaxLength(500) payment_method_description?:
    string | null;
}
export class SalePaymentDto {
  @IsIn(SALE_COMBINABLE_PAYMENT_METHODS) payment_method: SaleTender;
  @IsString() @Matches(/^[1-9][0-9]{0,18}$/) amount: string;
}
export class CheckoutSaleDto {
  @IsUUID() request_key: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items: SaleItemInputDto[];
  @IsOptional() @IsIn(SALE_PAYMENT_METHODS) payment_method?: SalePaymentMethod;
  @IsOptional() @IsString() @MaxLength(500) payment_method_description?:
    string | null;
  @ValidateIf((dto: CheckoutSaleDto) => dto.payments !== undefined)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments?: SalePaymentDto[];
}
export class UpdateSaleDto extends CreateSaleDto {
  @IsInt() @Min(1) @Max(2147483647) expected_version: number;
}
export class TransitionSaleDto {
  @IsUUID() request_key: string;
  @IsInt() @Min(1) @Max(2147483647) expected_version: number;
}
export class CancelSaleDto extends TransitionSaleDto {
  @IsString() @MaxLength(500) cancellation_reason: string;
}
