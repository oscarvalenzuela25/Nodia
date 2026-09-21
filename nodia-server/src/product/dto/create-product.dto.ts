import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty()
  @IsUUID()
  business_id: string;

  @IsOptional()
  @IsString()
  provider_id?: string | null;

  @IsNotEmpty()
  @IsString()
  code: string;

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
  profit_percentage: number;

  @IsNotEmpty()
  @IsInt()
  sale_price: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number = 0;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
