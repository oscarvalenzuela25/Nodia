import { IsBoolean, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { ModuleFilterDto } from './filter-module.dto.js';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetModulesDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  ordering?: boolean = false;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  locate_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModuleFilterDto)
  q?: ModuleFilterDto;
}
