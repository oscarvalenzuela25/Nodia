import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TranslateItemDto } from '../../translation/dto/translate-item.dto.js';
import { AiConnectionMode } from '../types/ai-provider.types.js';

export class CreateAiProviderDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsOptional()
  @IsEnum(AiConnectionMode)
  mode?: AiConnectionMode;

  @IsOptional()
  @IsObject()
  fields?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  fields_version?: number;

  @IsOptional()
  @IsBoolean()
  auto_rotate_api_keys?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslateItemDto)
  translates?: TranslateItemDto[];
}
