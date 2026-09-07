import { IsOptional, ValidateNested } from 'class-validator';
import { ActionFilterDto } from './filter-action.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetActionsDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ActionFilterDto)
  q?: ActionFilterDto;
}
