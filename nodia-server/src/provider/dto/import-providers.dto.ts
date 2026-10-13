import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProviderDto } from './create-provider.dto.js';
import { ContactValuesDto } from '../../provider-contact/dto/provider-contact.dto.js';

export class ImportProviderContactDto extends ContactValuesDto {
  @IsOptional() @Matches(/^[1-9]\d{0,18}$/) id?: string;
  @IsOptional() @IsInt() @Min(1) @Max(2147483646) version?: number;
}
export class ImportProviderItemDto extends CreateProviderDto {
  @IsOptional() @Matches(/^[1-9]\d{0,18}$/) id?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportProviderContactDto)
  contacts?: ImportProviderContactDto[];
}
export class ImportProvidersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportProviderItemDto)
  items: ImportProviderItemDto[];
}
