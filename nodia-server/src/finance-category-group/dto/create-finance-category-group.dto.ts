import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import {
  FinanceIdArray,
  FinanceText,
  OptionalFinanceField,
} from '../../finance-common/validation/finance-validation.js';

export class CreateFinanceCategoryGroupDto {
  @ApiProperty({ maxLength: 255 }) @FinanceText() name!: string;
  @ApiProperty({ maxLength: 255 }) @FinanceText() key!: string;
  @ApiProperty({ type: [String], maxItems: 100 })
  @FinanceIdArray()
  category_ids!: string[];
  @ApiPropertyOptional({ default: true })
  @OptionalFinanceField()
  @IsBoolean()
  is_active?: boolean;
}
