import { Injectable } from '@nestjs/common';
import { FinanceLedgerService } from '../finance-ledger.service.js';
import { CreateFinanceObligationDto } from '../dto/create-finance-obligation.dto.js';
import {
  projectObligation,
  requireActiveCategory,
} from './finance-ledger.rules.js';

@Injectable()
export class CreateFinanceObligationUseCase {
  constructor(private readonly ledger: FinanceLedgerService) {}
  async execute(userId: string, dto: CreateFinanceObligationDto) {
    return this.ledger.transaction(async (manager) => {
      requireActiveCategory(
        await this.ledger.category(manager, userId, dto.category_id),
      );
      const obligation = await this.ledger.saveObligation(manager, {
        user_id: userId,
        name: dto.name,
        key: dto.key,
        type: dto.type,
        amount: dto.amount,
        description: dto.description ?? null,
        is_active: dto.is_active ?? true,
      });
      const initial = await this.ledger.saveMovement(manager, {
        user_id: userId,
        category_id: dto.category_id,
        obligation_id: obligation.id,
        name: dto.name,
        amount: dto.amount,
        type: dto.type === 'loan' ? 'expense' : 'income',
        status: dto.type === 'loan' ? 'paid' : 'received',
        is_active: dto.is_active ?? true,
      });
      return projectObligation(obligation, initial, '0');
    });
  }
}
