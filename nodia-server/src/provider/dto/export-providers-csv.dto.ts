import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class ExportProvidersCsvDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  lang?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @Matches(/^[1-9]\d{0,18}$/, { each: true })
  ids?: string[];
}
