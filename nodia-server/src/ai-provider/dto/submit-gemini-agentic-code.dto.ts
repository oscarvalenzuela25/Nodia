import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

export class SubmitGeminiAgenticCodeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2048)
  @Matches(/^[A-Za-z0-9_./+~-]{8,2048}$/)
  code: string;
}
