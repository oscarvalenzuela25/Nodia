import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class NodiaAiCapabilitiesQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(256)
  query?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  module_key?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  cursor?: string;
}

export class NodiaAiCapabilityVersionQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  catalog_version!: string;
}
