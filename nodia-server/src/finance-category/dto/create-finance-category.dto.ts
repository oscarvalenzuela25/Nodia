import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import {
  FinanceText,
  OptionalFinanceField,
} from '../../finance-common/validation/finance-validation.js';

export class CreateFinanceCategoryDto {
  @ApiProperty({ maxLength: 255 }) @FinanceText() name!: string;
  @ApiProperty({ maxLength: 255 }) @FinanceText() key!: string;
  @ApiPropertyOptional({ default: true })
  @OptionalFinanceField()
  @IsBoolean()
  is_active?: boolean;
}
