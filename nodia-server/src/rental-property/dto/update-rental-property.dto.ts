import { IsInt, Min, Max } from 'class-validator';
import {
  IsRentalId,
  IsTimezone,
  IsLocalTime,
  IsRentalPercent,
  IsRentalMoney,
  OptionalNullable,
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateRentalPropertyDto {
  @ApiPropertyOptional() @OptionalDefined() @RentalText() name?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsTimezone() timezone?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsInt()
  @Min(1)
  @Max(1000)
  max_guests?: number;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsLocalTime()
  check_in_time?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsLocalTime()
  check_out_time?: string;
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
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsInt()
  @Min(0)
  @Max(10080)
  minimum_turnover_minutes?: number;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
  @ApiPropertyOptional() @OptionalDefined() @IsBoolean() is_active?: boolean;
  @ApiPropertyOptional({ nullable: true, type: String })
  @OptionalNullable()
  @IsRentalId()
  default_cancellation_policy_id?: string | null;
}
