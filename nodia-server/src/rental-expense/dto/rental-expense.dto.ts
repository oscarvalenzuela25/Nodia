import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RentalQueryDto } from '../../rental-common/dto/rental-query.dto.js';
import {
  IsRentalId,
  IsRentalMoney,
  IsCivilDate,
  OptionalDefined,
  OptionalNullable,
  RentalText,
} from '../../rental-common/rental-validation.js';

export class CreateRentalExpenseDto {
  @ApiProperty() @RentalText() name!: string;
  @ApiProperty({ type: String }) @IsRentalMoney(true) amount!: string;
  @ApiProperty() @IsCivilDate() incurred_on!: string;
  @ApiProperty({ enum: ['pending', 'paid'] })
  @IsIn(['pending', 'paid'])
  status!: 'pending' | 'paid';
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsCivilDate()
  paid_on?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsRentalId()
  reservation_id?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(100, true)
  category?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
}

export class UpdateRentalExpenseDto {
  @ApiPropertyOptional() @OptionalDefined() @RentalText() name?: string;
  @ApiPropertyOptional({ type: String })
  @OptionalDefined()
  @IsRentalMoney(true)
  amount?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() incurred_on?: string;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @IsRentalId()
  reservation_id?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(100, true)
  category?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalNullable()
  @RentalText(5000, true)
  notes?: string | null;
}

export class PayRentalExpenseDto {
  @ApiProperty() @IsCivilDate() paid_on!: string;
}

export class VoidRentalExpenseDto {
  @ApiProperty() @RentalText(1000) reason!: string;
}

export class RentalExpenseQueryDto extends RentalQueryDto {
  @ApiPropertyOptional()
  @OptionalDefined()
  @IsRentalId()
  reservation_id?: string;
  @ApiPropertyOptional({ enum: ['pending', 'paid', 'voided'] })
  @OptionalDefined()
  @IsIn(['pending', 'paid', 'voided'])
  status?: 'pending' | 'paid' | 'voided';
  @ApiPropertyOptional() @OptionalDefined() @RentalText(100) category?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() from_on?: string;
  @ApiPropertyOptional() @OptionalDefined() @IsCivilDate() to_on?: string;
}
