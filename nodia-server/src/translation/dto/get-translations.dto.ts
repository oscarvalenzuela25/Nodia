import { IsOptional, ValidateNested } from 'class-validator';
import { TranslationFilterDto } from './filter-translation.dto.js';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class GetTranslationsDto extends PaginationQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TranslationFilterDto)
  q?: TranslationFilterDto;
}
