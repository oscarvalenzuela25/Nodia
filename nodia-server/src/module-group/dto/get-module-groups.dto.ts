import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { ModuleGroupFilterDto } from './filter-module-group.dto.js';

export class GetModuleGroupsDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  ordering?: boolean = false;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModuleGroupFilterDto)
  q?: ModuleGroupFilterDto;
}
