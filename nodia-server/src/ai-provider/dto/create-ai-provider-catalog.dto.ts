import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAiProviderCatalogDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  key: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  name: string;

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
