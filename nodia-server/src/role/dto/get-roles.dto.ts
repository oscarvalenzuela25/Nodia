import { IsOptional, ValidateNested } from 'class-validator';
import { RoleFilterDto } from './filter-role.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetRolesDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RoleFilterDto)
  q?: RoleFilterDto;
}
