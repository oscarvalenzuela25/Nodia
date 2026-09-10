import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ModuleGroupFilterDto } from './filter-module-group.dto.js';

export class GetModuleGroupsDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ModuleGroupFilterDto)
  q?: ModuleGroupFilterDto;
}
