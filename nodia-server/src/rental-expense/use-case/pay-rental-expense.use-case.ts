import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { RentalExpenseService } from '../rental-expense.service.js';
import { PayRentalExpenseDto } from '../dto/rental-expense.dto.js';
import { validateExpenseDates } from './rental-expense.rules.js';

@Injectable()
export class PayRentalExpenseUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly expenses: RentalExpenseService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: PayRentalExpenseDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(PayRentalExpenseDto, input);
    return this.tx.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'expense.pay',
        resourceId: id,
        command: dto,
      },
      async (ctx) => {
        const row = await this.expenses.find(ctx.manager, propertyId, id);
        if (!row) throw new NotFoundException('rental:not_found');
        if (row.status !== 'pending')
          throw new ConflictException('rental:invalid_transition');
        validateExpenseDates(ctx, row.incurred_on, dto.paid_on, 'paid');
        const saved = await this.expenses.save(ctx.manager, {
          ...row,
          status: 'paid',
          paid_on: dto.paid_on,
          updated_by: actorId,
          updated_at: ctx.now,
        });
        return {
          resource_id: saved.id,
          resource_type: 'expense',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: {
            status: { before: 'pending', after: 'paid' },
            amount: row.amount,
            paid_on: dto.paid_on,
          },
        };
      },
    );
  }
}
