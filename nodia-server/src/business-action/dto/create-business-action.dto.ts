import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TranslateItemDto } from '../../translation/dto/translate-item.dto.js';

export class CreateBusinessActionDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsOptional()
  @IsBoolean()
  has_description?: boolean = false;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslateItemDto)
  translates?: TranslateItemDto[];
}
