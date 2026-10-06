import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength } from 'class-validator';
import {
  IsFinanceBigint,
  FinanceText,
  OptionalFinanceField,
} from '../../finance-common/validation/finance-validation.js';

export class UpdateFinanceObligationDto {
  @ApiPropertyOptional() @OptionalFinanceField() @FinanceText() name?: string;
  @ApiPropertyOptional() @OptionalFinanceField() @FinanceText() key?: string;
  @ApiPropertyOptional({ type: String })
  @OptionalFinanceField()
  @IsFinanceBigint()
  amount?: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @OptionalFinanceField({ nullable: true })
  @IsString()
  @MaxLength(5000)
  description?: string | null;
  @ApiPropertyOptional()
  @OptionalFinanceField()
  @IsBoolean()
  is_active?: boolean;
}
