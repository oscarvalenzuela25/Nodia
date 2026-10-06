import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateFinanceMovementDto {
  @ApiPropertyOptional() @OptionalFinanceField() @FinanceText() name?: string;
  @ApiPropertyOptional({ type: String })
  @OptionalFinanceField()
  @IsFinanceBigint()
  amount?: string;
  @ApiPropertyOptional({ enum: ['income', 'expense'] })
  @OptionalFinanceField()
  @IsIn(['income', 'expense'])
  type?: FinanceMovementType;
  @ApiPropertyOptional({ enum: ['pending', 'received', 'paid', 'cancelled'] })
  @OptionalFinanceField()
  @IsIn(['pending', 'received', 'paid', 'cancelled'])
  status?: FinanceMovementStatus;
  @ApiPropertyOptional({ type: String })
  @OptionalFinanceField()
  @IsFinanceBigint()
  category_id?: string;
  @ApiPropertyOptional()
  @OptionalFinanceField()
  @IsBoolean()
  is_active?: boolean;
}
