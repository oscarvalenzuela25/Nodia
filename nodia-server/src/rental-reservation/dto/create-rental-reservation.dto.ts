import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator';
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

export class CreateRentalReservationDto {
  @ApiProperty() @RentalText() guest_name!: string;
  @ApiProperty() @RentalText() guest_contact!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(1000) guests_count!: number;
  @ApiProperty({ enum: ['whatsapp', 'airbnb', 'facebook', 'other'] })
  @IsIn(['whatsapp', 'airbnb', 'facebook', 'other'])
  channel!: 'whatsapp' | 'airbnb' | 'facebook' | 'other';
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(255, true)
  external_reference?: string | null;
  @ApiProperty() @IsCivilDate() check_in_on!: string;
  @ApiProperty() @IsCivilDate() check_out_on!: string;
  @ApiProperty() @IsLocalTime() check_in_time!: string;
  @ApiProperty() @IsLocalTime() check_out_time!: string;
  @ApiProperty() @IsRentalMoney(true) nightly_rate!: string;
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
  @ApiProperty() @IsRentalMoney() deposit_amount!: string;
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
