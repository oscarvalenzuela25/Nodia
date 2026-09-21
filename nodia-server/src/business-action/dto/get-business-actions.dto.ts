import { IsOptional, ValidateNested } from 'class-validator';
import { BusinessActionFilterDto } from './filter-business-action.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetBusinessActionsDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessActionFilterDto)
  q?: BusinessActionFilterDto;
}
