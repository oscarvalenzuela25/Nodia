import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AiConnectionMode } from '../types/ai-provider.types.js';

export class GetSelectableModelsDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsEnum(AiConnectionMode)
  mode?: AiConnectionMode;
}
