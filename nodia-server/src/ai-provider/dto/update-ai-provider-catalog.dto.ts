import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAiProviderCatalogDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsBoolean()
  can_use_api_key?: boolean;

  @IsOptional()
  @IsBoolean()
  can_use_token_plan_web?: boolean;

  @IsOptional()
  @IsBoolean()
  can_use_token_plan_agentic?: boolean;
}
