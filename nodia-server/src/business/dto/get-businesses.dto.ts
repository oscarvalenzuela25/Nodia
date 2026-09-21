import { IsOptional, ValidateNested } from 'class-validator';
import { BusinessFilterDto } from './filter-business.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetBusinessesDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessFilterDto)
  q?: BusinessFilterDto;
}
