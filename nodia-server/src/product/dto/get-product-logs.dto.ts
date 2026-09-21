import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { FilterProductLogDto } from './filter-product-log.dto.js';

export class GetProductLogsDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterProductLogDto)
  q?: FilterProductLogDto;
}
