import { IsNotEmpty, IsString } from 'class-validator';

export class TranslateItemDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsNotEmpty()
  @IsString()
  es: string;

  @IsNotEmpty()
  @IsString()
  en: string;
}
