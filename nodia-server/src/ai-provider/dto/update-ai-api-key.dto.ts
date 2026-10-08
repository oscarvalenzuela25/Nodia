import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AiKeyHealthState } from '../types/ai-provider.types.js';

export class UpdateAiApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8192)
  @IsNotEmpty()
  secret?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
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
