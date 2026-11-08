import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetSelectableModelsDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsIn(['api_key', 'agentic'])
  mode?: 'api_key' | 'agentic';

  @IsOptional()
  @IsString()
  provider_id?: string;
}
