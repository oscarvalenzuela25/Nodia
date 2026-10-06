import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsObject, Max, Min } from 'class-validator';
import { OptionalDefined } from '../rental-validation.js';

const integer = (value: unknown) =>
  typeof value === 'string' && /^[1-9]\d{0,6}$/.test(value)
    ? Number(value)
    : value;
export class RentalQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Transform(({ value }: { value: unknown }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Transform(({ value }: { value: unknown }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
  @ApiPropertyOptional({ type: Object })
  @OptionalDefined()
  @IsObject()
  q?: Record<string, unknown>;
}
