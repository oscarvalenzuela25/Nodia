import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessTranslateItemDto } from './business-translate-item.dto.js';

export class CreateBusinessDto {
  @IsNotEmpty()
  @IsString()
  @Length(2, 255)
  name: string;

  @IsOptional()
  @IsBoolean()
  has_description?: boolean = false;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessTranslateItemDto)
  translates?: BusinessTranslateItemDto[];
}
