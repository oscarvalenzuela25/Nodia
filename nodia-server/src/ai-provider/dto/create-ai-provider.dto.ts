import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TranslateItemDto } from '../../translation/dto/translate-item.dto.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';

export class CreateAiProviderDto {
  @IsOptional()
  @IsString()
  catalog_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsEnum(AiConnectionMode)
  mode?: AiConnectionMode;

  @IsOptional()
  @IsObject()
  fields?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  use_api_key?: boolean;


  @IsOptional()
  @IsBoolean()
  use_agentic?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['api_key', 'agentic'])
  default_mode?: 'api_key' | 'agentic' | null;

  @IsOptional()
  @IsBoolean()
  auto_rotate_api_keys?: boolean;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslateItemDto)
  translates?: TranslateItemDto[];
}
