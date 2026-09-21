import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductLogDto {
  @IsNotEmpty()
  @IsString()
  product_id: string;

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
}
