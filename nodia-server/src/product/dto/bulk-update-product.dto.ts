import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { UpdateProductDto } from './update-product.dto.js';

export class BulkUpdateProductItemDto extends UpdateProductDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class BulkUpdateProductDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateProductItemDto)
  items: BulkUpdateProductItemDto[];
}
