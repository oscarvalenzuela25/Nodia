import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import {
  validateRentalDto,
  isRentalId,
} from '../../rental-common/rental-validation.js';
import {
  pageResult,
  validateRentalQuery,
  validateCivilPeriod,
} from '../../rental-common/rental-query.js';
import { RentalExpenseService } from '../rental-expense.service.js';
import { RentalExpenseQueryDto } from '../dto/rental-expense.dto.js';
import { projectRentalExpense } from '../types/rental-expense.types.js';

@Injectable()
export class GetRentalExpensesUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly expenses: RentalExpenseService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    input: RentalExpenseQueryDto,
  ) {
    const query = await validateRentalDto(RentalExpenseQueryDto, input);
    validateRentalQuery(query, 'expenses');
    validateCivilPeriod(query.from_on, query.to_on);
    return this.tx.read(actorId, propertyId, async ({ manager }) => {
      const [rows, total] = await this.expenses.list(
        manager,
        propertyId,
        query,
      );
      return pageResult(rows.map(projectRentalExpense), total, query);
    });
  }
}

@Injectable()
export class GetRentalExpenseUseCase {
  constructor(
    private readonly tx: RentalTransactionService,
    private readonly expenses: RentalExpenseService,
  ) {}
  async execute(actorId: string, propertyId: string, id: string) {
    if (!isRentalId(id)) throw new BadRequestException('rental:invalid_input');
    return this.tx.read(actorId, propertyId, async ({ manager }) => {
      const row = await this.expenses.find(manager, propertyId, id);
      if (!row) throw new NotFoundException('rental:not_found');
      return projectRentalExpense(row);
    });
  }
}
