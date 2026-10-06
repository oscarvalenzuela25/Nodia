import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { RentalExpenseService } from '../rental-expense.service.js';
import { VoidRentalExpenseDto } from '../dto/rental-expense.dto.js';

@Injectable()
export class VoidRentalExpenseUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly expenses: RentalExpenseService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: VoidRentalExpenseDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(VoidRentalExpenseDto, input);
    return this.tx.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'expense.void',
        resourceId: id,
        command: dto,
      },
      async (ctx) => {
        const row = await this.expenses.find(ctx.manager, propertyId, id);
        if (!row) throw new NotFoundException('rental:not_found');
        if (row.status === 'voided')
          throw new ConflictException('rental:invalid_transition');
        const saved = await this.expenses.save(ctx.manager, {
          ...row,
          status: 'voided',
          paid_on: null,
          updated_by: actorId,
          updated_at: ctx.now,
        });
        return {
          resource_id: saved.id,
          resource_type: 'expense',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: {
            status: { before: row.status, after: 'voided' },
            paid_on: { before: row.paid_on, after: null },
            amount: row.amount,
            reason: dto.reason,
          },
        };
      },
    );
  }
}
