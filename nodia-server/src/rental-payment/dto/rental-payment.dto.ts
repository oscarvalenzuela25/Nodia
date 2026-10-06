import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, ValidateNested } from 'class-validator';
import { RentalQueryDto } from '../../rental-common/dto/rental-query.dto.js';
import {
  IsRentalId,
  IsRentalMoney,
  IsCivilDate,
  OptionalDefined,
  OptionalNullable,
  RentalText,
} from '../../rental-common/rental-validation.js';

export class RentalPlatformPolicyDto {
  @ApiProperty() @RentalText() reference!: string;
  @ApiProperty() @RentalText(5000) description!: string;
}

export class CreateRentalPaymentDto {
  @ApiProperty() @IsRentalId() reservation_id!: string;
  @ApiProperty({ enum: ['payment', 'refund'] })
  @IsIn(['payment', 'refund'])
  type!: 'payment' | 'refund';
  @ApiProperty({ type: String }) @IsRentalMoney(true) amount!: string;
  @ApiProperty() @IsCivilDate() occurred_on!: string;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(100, true)
  method?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(255, true)
  reference?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
  @ApiPropertyOptional({ type: RentalPlatformPolicyDto })
  @OptionalDefined()
  @ValidateNested()
  @Type(() => RentalPlatformPolicyDto)
  platform_policy?: RentalPlatformPolicyDto;
}

export class VoidRentalPaymentDto {
  @ApiProperty() @RentalText(1000) reason!: string;
}

export class RentalPaymentQueryDto extends RentalQueryDto {
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalId()
  reservation_id?: string;
  @ApiPropertyOptional({ enum: ['payment', 'refund'] })
  @OptionalDefined()
  @IsIn(['payment', 'refund'])
  type?: 'payment' | 'refund';
  @ApiPropertyOptional({ enum: ['confirmed', 'voided'] })
  @OptionalDefined()
  @IsIn(['confirmed', 'voided'])
  status?: 'confirmed' | 'voided';
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() from_on?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() to_on?: string;
}
