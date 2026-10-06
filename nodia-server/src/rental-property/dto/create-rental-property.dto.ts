import { IsInt, Min, Max } from 'class-validator';
import {
  IsTimezone,
  IsLocalTime,
  IsRentalPercent,
  IsRentalMoney,
  OptionalNullable,
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CreateRentalPropertyDto {
  @ApiProperty() @RentalText() name!: string;
  @ApiProperty() @IsTimezone() timezone!: string;
  @ApiProperty({ minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  max_guests!: number;
  @ApiProperty() @IsLocalTime() check_in_time!: string;
  @ApiProperty() @IsLocalTime() check_out_time!: string;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(500, true)
  location?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  @OptionalNullable()
  @IsRentalMoney(true)
  default_nightly_rate?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  @OptionalNullable()
  @IsRentalPercent()
  default_deposit_percent?: string | null;
  @ApiPropertyOptional({ default: 0 })
  @OptionalDefined()
  @IsInt()
  @Min(0)
  @Max(10080)
  minimum_turnover_minutes?: number;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
  @ApiPropertyOptional({ default: true })
  @OptionalDefined()
  @IsBoolean()
  is_active?: boolean;
}
