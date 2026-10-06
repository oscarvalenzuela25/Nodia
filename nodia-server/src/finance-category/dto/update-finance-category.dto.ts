import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import {
  FinanceText,
  OptionalFinanceField,
} from '../../finance-common/validation/finance-validation.js';

export class UpdateFinanceCategoryDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @OptionalFinanceField()
  @FinanceText()
  name?: string;
  @ApiPropertyOptional({ maxLength: 255 })
  @OptionalFinanceField()
  @FinanceText()
  key?: string;
  @ApiPropertyOptional()
  @OptionalFinanceField()
  @IsBoolean()
  is_active?: boolean;
}
