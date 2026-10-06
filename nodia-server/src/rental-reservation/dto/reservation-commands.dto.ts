import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  ValidateNested,
} from 'class-validator';
import {
  IsRentalId,
  IsRentalInstant,
  IsRentalMoney,
  OptionalDefined,
  RentalText,
} from '../../rental-common/rental-validation.js';

export class PlatformPolicyDto {
  @ApiProperty() @RentalText() reference!: string;
  @ApiProperty() @RentalText(5000) description!: string;
}
export class ConfirmRentalReservationDto {
  @ApiPropertyOptional({ type: [String] })
  @OptionalDefined()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsRentalId({ each: true })
  same_day_approvals?: string[];
  @ApiPropertyOptional({ type: PlatformPolicyDto })
  @OptionalDefined()
  @Type(() => PlatformPolicyDto)
  @ValidateNested()
  platform_policy?: PlatformPolicyDto;
}
export class EmptyRentalCommandDto {}
export class PreviewRentalCancellationDto {
  @ApiProperty() @IsRentalInstant() cancelled_at!: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalMoney()
  refund_amount?: string;
  @ApiPropertyOptional()
  @OptionalDefined()
  @RentalText(1000)
  resolution_note?: string;
}
export class CancelRentalReservationDto extends PreviewRentalCancellationDto {
  @ApiProperty() @IsRentalMoney() expected_refund_amount!: string;
}
