import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { AiKeyHealthState } from '../types/ai-provider.types.js';

export class UpdateAiApiKeyDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_selected?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsEnum(AiKeyHealthState)
  health_state?: AiKeyHealthState;

  @IsOptional()
  @IsString()
  last_error_code?: string;

  @IsOptional()
  @IsString()
  last_error_message?: string;
}
