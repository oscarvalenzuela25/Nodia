import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsObject, Max, Min } from 'class-validator';
import type { FinanceActive } from '../types/finance.types.js';
import {
  FinanceIdArray,
  IsFinanceBigint,
  OptionalFinanceField,
} from '../validation/finance-validation.js';

function queryInteger(value: unknown): unknown {
  if (typeof value === 'string' && /^[1-9]\d{0,8}$/.test(value))
    return Number(value);
  return value;
}

export class FinanceQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Transform(({ value }: { value: unknown }) => queryInteger(value))
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Transform(({ value }: { value: unknown }) => queryInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @ApiPropertyOptional({
    enum: ['active', 'inactive', 'all'],
    default: 'active',
  })
  @IsIn(['active', 'inactive', 'all'])
  active: FinanceActive = 'active';

  @ApiPropertyOptional({
    type: Object,
    description: 'Bounded Ransack filters; no user_id or is_active.',
  })
  @OptionalFinanceField()
  @IsObject()
  q?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @OptionalFinanceField()
  @FinanceIdArray()
  category_ids?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @OptionalFinanceField()
  @FinanceIdArray()
  category_group_ids?: string[];

  @ApiPropertyOptional({ type: String })
  @OptionalFinanceField()
  @IsFinanceBigint()
  obligation_id?: string;
}
