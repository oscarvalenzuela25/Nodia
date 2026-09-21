import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { FilterProductDto } from './filter-product.dto.js';

export class GetProductsDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterProductDto)
  q?: FilterProductDto;
}
