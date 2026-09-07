import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateActionDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsOptional()
  @IsString()
  module_id?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}
