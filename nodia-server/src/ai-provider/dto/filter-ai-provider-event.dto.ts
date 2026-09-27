import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { RansackFilter } from '../../common/types/ransack.type.js';
import { AiProviderEvent } from '../entities/ai-provider-event.entity.js';

export class FilterAiProviderEventDto implements RansackFilter<AiProviderEvent> {
  @IsOptional()
  @IsString()
  provider_id_eq?: string;

  @IsOptional()
  @IsString()
  connection_id_eq?: string;

  @IsOptional()
  @IsString()
  api_key_id_eq?: string;

  @IsOptional()
  @IsString()
  actor_user_id_eq?: string;

  @IsOptional()
  @IsString()
  event_type_eq?: string;

  @IsOptional()
  @IsString()
  reason_code_eq?: string;

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
