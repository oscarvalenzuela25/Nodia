import {
  IsFinanceBigint,
  OptionalFinanceField,
} from '../validation/finance-validation.js';
/** Explicit recipient selection, not an actor or ownership update. */
export class FinanceOwnerQueryDto {
  @OptionalFinanceField()
  @IsFinanceBigint()
  owner_id?: string;
}
