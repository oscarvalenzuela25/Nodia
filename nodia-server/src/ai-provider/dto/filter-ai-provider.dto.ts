import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { RansackFilter } from '../../common/types/ransack.type.js';
import { AiProvider } from '../entities/ai-provider.entity.js';

export class FilterAiProviderDto implements RansackFilter<AiProvider> {
  @IsOptional()
  @IsString()
  key_cont?: string;

  @IsOptional()
  @IsString()
  key_eq?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  is_active_eq?: boolean;

  @IsOptional()
  @IsString()
  s?: string;
}
