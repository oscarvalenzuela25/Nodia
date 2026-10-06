import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';
import {
  IsFinanceBigint,
  FinanceText,
  OptionalFinanceField,
} from '../../finance-common/validation/finance-validation.js';
import type { FinanceObligationType } from '../entities/finance-obligation.entity.js';

export class CreateFinanceObligationDto {
  @ApiProperty() @FinanceText() name!: string;
  @ApiProperty() @FinanceText() key!: string;
  @ApiProperty({ enum: ['loan', 'debt'] })
  @IsIn(['loan', 'debt'])
  type!: FinanceObligationType;
  @ApiProperty({ type: String }) @IsFinanceBigint() amount!: string;
  @ApiProperty({ type: String }) @IsFinanceBigint() category_id!: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @OptionalFinanceField({ nullable: true })
  @IsString()
  @MaxLength(5000)
  description?: string | null;
  @ApiPropertyOptional({ default: true })
  @OptionalFinanceField()
  @IsBoolean()
  is_active?: boolean;
}
