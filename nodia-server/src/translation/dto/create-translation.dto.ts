import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateTranslationDto {
  @IsNotEmpty()
  @IsString()
  key: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 10)
  locale: string;

  @IsNotEmpty()
  @IsString()
  value: string;
}
