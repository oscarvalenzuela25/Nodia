import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, Min, Max } from 'class-validator';
import {
  IsRentalId,
  IsRentalMoney,
  IsCivilDate,
  IsLocalTime,
  IsRentalInstant,
  OptionalNullable,
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';

/** Fields are further restricted by the persisted agreement phase. */
export class UpdateRentalReservationDto {
  @ApiPropertyOptional() @OptionalDefined() @RentalText() guest_name?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @RentalText()
  guest_contact?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsInt()
  @Min(1)
  @Max(1000)
  guests_count?: number;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsIn(['whatsapp', 'airbnb', 'facebook', 'other'])
  channel?: 'whatsapp' | 'airbnb' | 'facebook' | 'other';
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(255, true)
  external_reference?: string | null;
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() check_in_on?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsCivilDate()
  check_out_on?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsLocalTime()
  check_in_time?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsLocalTime()
  check_out_time?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalMoney(true)
  nightly_rate?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalMoney()
  cleaning_fee?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalMoney()
  discount_amount?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalMoney()
  commission_amount?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalMoney()
  deposit_amount?: string;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsRentalInstant()
  deposit_due_at?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsRentalInstant()
  balance_due_at?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsRentalId()
  cancellation_policy_id?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
  @ApiPropertyOptional() @OptionalDefined() @IsBoolean() is_active?: boolean;
}
