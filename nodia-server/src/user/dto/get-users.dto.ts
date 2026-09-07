import { IsOptional, ValidateNested } from 'class-validator';
import { UserFilterDto } from './filter-user.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetUsersDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UserFilterDto)
  q?: UserFilterDto;
}
