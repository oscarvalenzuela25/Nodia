import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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
  @IsIn(['gemini', 'mistral'])
  ai_provider?: 'gemini' | 'mistral';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  extended_thinking?: boolean;

  @IsOptional()
  file?: any;
}
