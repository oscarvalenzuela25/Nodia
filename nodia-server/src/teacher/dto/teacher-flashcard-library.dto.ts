import {
  IsIn,
  IsObject,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import type { FlashcardLibraryPart } from '../policies/teacher-flashcard-library.js';
import type { TeacherSelection } from '../types/teacher.types.js';

export class GenerateFlashcardLibraryDto {
  @IsUUID()
  request_key!: string;

  @IsObject()
  origin!: Record<string, unknown>;

  @IsIn(['text', 'image', 'both'])
  parts!: FlashcardLibraryPart | 'both';

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  text_selection?: Record<string, unknown>;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  image_selection?: Record<string, unknown>;
}

export class FlashcardLibraryEligibilityDto {
  @IsIn(['text', 'image'])
  kind!: FlashcardLibraryPart;

  @IsString()
  @Matches(/^[1-9][0-9]{0,18}$/)
  connection_id!: string;

  @IsIn(['agentic', 'api_key'])
  mode!: TeacherSelection['mode'];

  @IsString()
  @Length(1, 1024)
  model_id!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, 256)
  effort_id?: string;
}
