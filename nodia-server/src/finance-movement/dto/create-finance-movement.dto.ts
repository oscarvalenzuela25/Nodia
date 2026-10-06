import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';
import {
  IsFinanceBigint,
  FinanceText,
  OptionalFinanceField,
} from '../../finance-common/validation/finance-validation.js';
import type {
  FinanceMovementStatus,
  FinanceMovementType,
} from '../entities/finance-movement.entity.js';

export class CreateFinanceMovementDto {
  @ApiProperty() @FinanceText() name!: string;
  @ApiProperty({ type: String, example: '20000' })
  @IsFinanceBigint()
  amount!: string;
  @ApiProperty({ enum: ['income', 'expense'] })
  @IsIn(['income', 'expense'])
  type!: FinanceMovementType;
  @ApiProperty({ enum: ['pending', 'received', 'paid', 'cancelled'] })
  @IsIn(['pending', 'received', 'paid', 'cancelled'])
  status!: FinanceMovementStatus;
  @ApiProperty({ type: String }) @IsFinanceBigint() category_id!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  @OptionalFinanceField({ nullable: true })
  @IsFinanceBigint()
  obligation_id?: string | null;
  @ApiPropertyOptional({ default: true })
  @OptionalFinanceField()
  @IsBoolean()
  is_active?: boolean;
}
