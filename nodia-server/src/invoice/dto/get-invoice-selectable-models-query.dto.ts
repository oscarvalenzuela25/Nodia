import { IsIn, IsString, Matches } from 'class-validator';

export class GetInvoiceSelectableModelsQueryDto {
  @IsString({ message: 'ai_provider:invalid_id' })
  @Matches(/^[1-9]\d{0,18}$/, { message: 'ai_provider:invalid_id' })
  provider_id: string;

  @IsIn(['agentic', 'api_key'], { message: 'ai_provider:invalid_mode' })
  mode: 'agentic' | 'api_key';
}
