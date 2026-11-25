import {
  IsIn,
  IsInt,
  IsObject,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class GenerateFlashcardTextDto {
  @IsUUID()
  request_key!: string;

  @IsObject()
  selection!: Record<string, unknown>;

  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  source?: Record<string, unknown>;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID()
  card_id?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483646)
  revision?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['text'])
  parts?: 'text';
}
