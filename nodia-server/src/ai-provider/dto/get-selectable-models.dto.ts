import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetSelectableModelsDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsIn(['api_key', 'web_session', 'token_plan_web', 'token_plan_agentic'])
  mode?: 'api_key' | 'web_session' | 'token_plan_web' | 'token_plan_agentic';

  @IsOptional()
  @IsString()
  provider_id?: string;
}
