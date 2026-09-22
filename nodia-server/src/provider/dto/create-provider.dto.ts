import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateProviderDto {
  @IsNotEmpty()
  @IsUUID()
  business_id: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 255)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  tax?: number = 19;

  @IsOptional()
  @IsObject()
  fields?: Record<string, any> = {};

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
