import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { RansackFilter } from '../../common/types/ransack.type.js';
import { AiApiKey } from '../entities/ai-api-key.entity.js';

export class FilterAiApiKeyDto implements RansackFilter<AiApiKey> {
  @IsOptional()
  @IsString()
  provider_id_eq?: string;

  @IsOptional()
  @IsString()
  connection_id_eq?: string;

  @IsOptional()
  @IsString()
  label_cont?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  is_selected_eq?: boolean;

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
  health_state_eq?: string;

  @IsOptional()
  @IsString()
  s?: string;
}
