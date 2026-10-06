import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import {
  FinanceIdArray,
  FinanceText,
  OptionalFinanceField,
} from '../../finance-common/validation/finance-validation.js';

export class UpdateFinanceCategoryGroupDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @OptionalFinanceField()
  @FinanceText()
  name?: string;
  @ApiPropertyOptional({ maxLength: 255 })
  @OptionalFinanceField()
  @FinanceText()
  key?: string;
  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @OptionalFinanceField()
  @FinanceIdArray()
  category_ids?: string[];
  @ApiPropertyOptional()
  @OptionalFinanceField()
  @IsBoolean()
  is_active?: boolean;
}
