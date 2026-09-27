import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { FilterAiApiKeyDto } from './filter-ai-api-key.dto.js';

export class GetAiApiKeysDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterAiApiKeyDto)
  q?: FilterAiApiKeyDto;
}
