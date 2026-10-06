import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ContactSchedule } from '../types/provider-contact.types.js';

export class ContactParamsDto {
  @Matches(/^[1-9]\d{0,18}$/) providerId: string;
}
export class ContactIdParamsDto extends ContactParamsDto {
  @Matches(/^[1-9]\d{0,18}$/) id: string;
}
export class ContactListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(255) search?: string;
}
export class ContactPhoneDto {
  @IsString() @Matches(/^\+[1-9]\d{6,14}$/) number: string;
}
export class ContactValuesDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ContactPhoneDto)
  phone: ContactPhoneDto[] = [];
  @IsOptional() @IsEmail() @MaxLength(254) email: string | null = null;
  @IsOptional() @IsObject() schedule: ContactSchedule = {};
  @IsOptional() @IsString() @MaxLength(2000) description: string | null = null;
  @IsOptional() @IsBoolean() is_active: boolean = true;
}
export class CreateProviderContactDto extends ContactValuesDto {
  @IsUUID('4') request_key: string;
}
export class UpdateProviderContactDto extends ContactValuesDto {
  @IsInt() @Min(1) @Max(2147483646) version: number;
}
export class ToggleProviderContactDto {
  @IsInt() @Min(1) @Max(2147483646) version: number;
  @IsBoolean() is_active: boolean;
}
