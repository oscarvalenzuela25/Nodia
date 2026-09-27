import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAiProviderEventDto {
  @IsString()
  @IsNotEmpty()
  provider_id: string;

  @IsOptional()
  @IsString()
  connection_id?: string;

  @IsOptional()
  @IsString()
  api_key_id?: string;

  @IsOptional()
  @IsString()
  actor_user_id?: string;

  @IsString()
  @IsNotEmpty()
  event_type: string;

  @IsOptional()
  @IsString()
  reason_code?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
