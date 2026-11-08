import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAiProviderCatalogDto {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsBoolean()
  can_use_api_key?: boolean;


  @IsOptional()
  @IsBoolean()
  can_use_agentic?: boolean;
}
