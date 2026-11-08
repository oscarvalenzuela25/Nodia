import {
  IsInt,
  IsString,
  Matches,
  Min,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class ProductImageVersionDto {
  @IsInt()
  @Min(1)
  expected_product_version: number;
}

export class ReserveProductImageDto extends ProductImageVersionDto {
  @IsOptional()
  @IsUUID('4')
  request_key?: string;

  @IsString()
  @Matches(/^[1-9][0-9]{0,18}$/)
  product_id: string;
}
