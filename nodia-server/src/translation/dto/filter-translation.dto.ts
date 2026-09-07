import { IsOptional, IsString } from 'class-validator';
import { RansackFilter } from '../../common/types/ransack.type.js';
import { Translation } from '../entities/translation.entity.js';

export class TranslationFilterDto implements RansackFilter<Translation> {
  @IsOptional()
  @IsString()
  key_cont?: string;

  @IsOptional()
  @IsString()
  key_eq?: string;

  @IsOptional()
  @IsString()
  locale_eq?: string;

  @IsOptional()
  @IsString()
  value_cont?: string;

  @IsOptional()
  @IsString()
  s?: string;
}
