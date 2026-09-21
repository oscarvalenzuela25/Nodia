import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsUUID()
  business_id: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      value === 'null' ||
      value === 'undefined'
    ) {
      return null;
    }
    return String(value).trim();
  })
  @IsString()
  provider_id?: string | null;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '' || isNaN(Number(value))) {
      return 0;
    }
    return Math.round(Number(value));
  })
  @IsInt()
  @Min(0)
  total_amount?: number = 0;

  @IsOptional()
  @IsString()
  path_storage?: string = '';

  @IsOptional()
  @Transform(({ value }) => {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      value === 'null' ||
      value === 'undefined'
    ) {
      return {};
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? parsed
          : {};
      } catch {
        return {};
      }
    }
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  })
  @IsObject()
  data?: Record<string, any> = {};

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  file?: any;
}
