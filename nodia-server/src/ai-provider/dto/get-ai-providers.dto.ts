import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { FilterAiProviderDto } from './filter-ai-provider.dto.js';

export class GetAiProvidersDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterAiProviderDto)
  q?: FilterAiProviderDto;
}
