import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateAiApiKeyDto {
  @IsString()
  @IsNotEmpty()
  provider_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  secret: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_selected?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
