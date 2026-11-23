import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  flashcardImageSides,
  type FlashcardImageSide,
} from '../types/teacher-flashcards.types.js';

export class FlashcardCardsQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^[1-9][0-9]{0,8}$/.test(value)
      ? Number(value)
      : value,
  )
  @IsInt()
  @Min(1)
  @Max(999999999)
  page = 1;

  @IsString()
  deck_id = 'general';
}

export class CreateFlashcardDeckDto {
  @IsString()
  title!: string;
}

export class CreateFlashcardDto {
  @IsUUID()
  request_key!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  deck_id?: string;

  @IsString()
  question!: string;

  @IsString()
  answer!: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsObject()
  source?: Record<string, unknown> | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsObject()
  image?: Record<string, unknown> | null;
}

export class PatchFlashcardDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  deck_id?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  question?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  answer?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsObject()
  source?: Record<string, unknown> | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsObject()
  image?: Record<string, unknown> | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(flashcardImageSides)
  image_side?: FlashcardImageSide;
}

export class CreateFlashcardReviewDto {
  @IsUUID()
  request_key!: string;

  @IsBoolean()
  remembered!: boolean;
}
