import { ApiProperty } from '@nestjs/swagger';
import { IsFinanceBigint } from '../validation/finance-validation.js';

export class FinanceIdDto {
  @ApiProperty({ type: String, example: '1' })
  @IsFinanceBigint()
  id: string;
}
