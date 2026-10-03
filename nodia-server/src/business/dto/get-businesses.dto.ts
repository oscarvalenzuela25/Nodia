import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { BusinessFilterDto } from './filter-business.dto.js';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetBusinessesDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all_businesses?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessFilterDto)
  q?: BusinessFilterDto;
}
