import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { FilterAiProviderEventDto } from './filter-ai-provider-event.dto.js';

export class GetAiProviderEventsDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterAiProviderEventDto)
  q?: FilterAiProviderEventDto;
}
