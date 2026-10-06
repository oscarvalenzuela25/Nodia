import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { RentalExpenseService } from '../rental-expense.service.js';
import { CreateRentalExpenseDto } from '../dto/rental-expense.dto.js';
import {
  validateExpenseDates,
  validateExpenseAssociation,
} from './rental-expense.rules.js';

@Injectable()
export class CreateRentalExpenseUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly expenses: RentalExpenseService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: CreateRentalExpenseDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(CreateRentalExpenseDto, input);
    const command = {
      ...dto,
      paid_on: dto.paid_on ?? null,
      reservation_id: dto.reservation_id ?? null,
      category: dto.category ?? null,
      notes: dto.notes ?? null,
    };
    return this.tx.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'expense.create',
        resourceId: null,
        command,
      },
      async (ctx) => {
        validateExpenseDates(
          ctx,
          dto.incurred_on,
          dto.paid_on ?? null,
          dto.status,
        );
        await validateExpenseAssociation(
          ctx,
          this.expenses,
          dto.reservation_id ?? null,
        );
        const saved = await this.expenses.save(ctx.manager, {
          property_id: propertyId,
          name: dto.name,
          amount: dto.amount,
          incurred_on: dto.incurred_on,
          status: dto.status,
          paid_on: dto.paid_on ?? null,
          reservation_id: dto.reservation_id ?? null,
          category: dto.category ?? null,
          notes: dto.notes ?? null,
          created_by: actorId,
          updated_by: actorId,
          created_at: ctx.now,
          updated_at: ctx.now,
        });
        return {
          resource_id: saved.id,
          resource_type: 'expense',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: {
            name: dto.name,
            amount: dto.amount,
            status: dto.status,
            incurred_on: dto.incurred_on,
            paid_on: dto.paid_on ?? null,
            reservation_id: dto.reservation_id ?? null,
          },
        };
      },
    );
  }
}
