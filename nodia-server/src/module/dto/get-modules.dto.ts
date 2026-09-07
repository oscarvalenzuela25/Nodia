import { IsOptional, ValidateNested } from 'class-validator';
import { ModuleFilterDto } from './filter-module.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetModulesDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ModuleFilterDto)
  q?: ModuleFilterDto;
}
