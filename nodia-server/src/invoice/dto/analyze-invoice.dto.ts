import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AnalyzeInvoiceDto {
  @IsNotEmpty()
  @IsUUID()
  business_id: string;

  @IsOptional()
  @IsString()
  provider_id?: string;

  @IsOptional()
  @IsString()
  ai_provider_id?: string;

  @IsOptional()
  @IsString()
  ai_provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  @IsIn(['default', 'ocr'])
  model_type?: 'default' | 'ocr';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  extended_thinking?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['agentic', 'web'])
  engine?: 'agentic' | 'web';

  @IsOptional()
  @IsString()
  @IsIn(['api_key', 'token_plan_web', 'token_plan_agentic'])
  mode?: 'api_key' | 'token_plan_web' | 'token_plan_agentic';

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,31}$/)
  @MaxLength(32)
  thinking_level?: string;

  @IsOptional()
  file?: any;
}
