import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { FilterProductDto } from './filter-product.dto.js';

export class ExportProductsCsvDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FilterProductDto)
  q?: FilterProductDto;
}
