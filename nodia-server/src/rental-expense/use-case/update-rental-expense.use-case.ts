import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { validateRentalDto } from '../../rental-common/rental-validation.js';
import { RentalExpenseService } from '../rental-expense.service.js';
import { UpdateRentalExpenseDto } from '../dto/rental-expense.dto.js';
import {
  validateExpenseDates,
  validateExpenseAssociation,
} from './rental-expense.rules.js';

@Injectable()
export class UpdateRentalExpenseUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly expenses: RentalExpenseService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    input: UpdateRentalExpenseDto,
    requestKey: string,
  ) {
    const dto = await validateRentalDto(UpdateRentalExpenseDto, input);
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    if (!Object.keys(patch).length)
      throw new BadRequestException('rental:invalid_input');
    return this.tx.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'expense.update',
        resourceId: id,
        command: patch,
      },
      async (ctx) => {
        const row = await this.expenses.find(ctx.manager, propertyId, id);
        if (!row) throw new NotFoundException('rental:not_found');
        if (row.status === 'voided')
          throw new ConflictException('rental:invalid_transition');
        if (
          row.status === 'paid' &&
          (dto.amount !== undefined || dto.incurred_on !== undefined)
        )
          throw new ConflictException('rental:agreement_immutable');
        const reservationId =
          dto.reservation_id !== undefined
            ? dto.reservation_id
            : row.reservation_id;
        await validateExpenseAssociation(ctx, this.expenses, reservationId);
        const changed = {
          ...row,
          ...patch,
          updated_by: actorId,
          updated_at: ctx.now,
        };
        validateExpenseDates(
          ctx,
          changed.incurred_on,
          changed.paid_on,
          changed.status,
        );
        const saved = await this.expenses.save(ctx.manager, changed);
        const changes: Record<string, unknown> = {};
        for (const key of Object.keys(patch)) {
          changes[key] =
            key === 'notes'
              ? { redacted: true }
              : {
                  before: Reflect.get(row, key) as unknown,
                  after: Reflect.get(saved, key) as unknown,
                };
        }
        return {
          resource_id: saved.id,
          resource_type: 'expense',
          status: saved.status,
          updated_at: saved.updated_at,
          changes,
        };
      },
    );
  }
}
