import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { CreateProductLogDto } from './create-product-log.dto.js';

export class BulkCreateProductLogDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateProductLogDto)
  items: CreateProductLogDto[];
}
