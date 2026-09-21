import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';
import { UpdateProductLogDto } from './update-product-log.dto.js';

export class BulkUpdateProductLogItemDto extends UpdateProductLogDto {
  @IsNotEmpty()
  @IsUUID()
  id: string;
}

export class BulkUpdateProductLogDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateProductLogItemDto)
  items: BulkUpdateProductLogItemDto[];
}
