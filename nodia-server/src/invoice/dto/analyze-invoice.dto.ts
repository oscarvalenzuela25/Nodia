import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AnalyzeInvoiceDto {
  @IsNotEmpty()
  @IsUUID()
  business_id: string;

  @IsOptional()
  @IsString()
  provider_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['gemini', 'mistral'])
  ai_provider?: 'gemini' | 'mistral';

  @IsOptional()
  file?: any;
}
