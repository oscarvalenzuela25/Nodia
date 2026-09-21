import { IsOptional, ValidateNested } from 'class-validator';
import { ProviderFilterDto } from './filter-provider.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetProvidersDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderFilterDto)
  q?: ProviderFilterDto;
}
