import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const cvApplicationDocumentKinds = ['cover', 'recommendation'] as const;
export const cvApplicationDocumentTextLimit = 3000;
export type CvApplicationDocumentKind =
  (typeof cvApplicationDocumentKinds)[number];

export class PrepareNodiaCvApplicationDocumentDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;

  @ApiProperty({ enum: cvApplicationDocumentKinds })
  @IsIn(cvApplicationDocumentKinds)
  kind!: CvApplicationDocumentKind;

  @ApiProperty({ type: String, maxLength: cvApplicationDocumentTextLimit })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.normalize('NFC').replace(/\r\n?/g, '\n').trim()
      : value,
  )
  @IsString()
  @MaxLength(cvApplicationDocumentTextLimit)
  @Matches(/^(?:[^\p{Cc}\p{Cs}\p{Bidi_Control}]|\n)+$/u)
  text!: string;
}
