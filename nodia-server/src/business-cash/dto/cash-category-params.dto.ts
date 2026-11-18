import { Matches } from 'class-validator';
import { CASH_UUID_PATTERN } from '../policies/cash-category.policy.js';

export class CashCategoryParamsDto {
  @Matches(/^[1-9]\d{0,18}$/)
  id: string;
}

export class CashReceiptParamsDto {
  @Matches(CASH_UUID_PATTERN)
  businessId: string;

  @Matches(CASH_UUID_PATTERN)
  key: string;
}
