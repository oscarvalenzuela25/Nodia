import { ConflictException, Injectable } from '@nestjs/common';
import { FinanceLedgerService } from '../finance-ledger.service.js';
import { UpdateFinanceObligationDto } from '../dto/update-finance-obligation.dto.js';
import {
  projectObligation,
  requireInitialMovement,
  requireOwned,
} from './finance-ledger.rules.js';

@Injectable()
export class UpdateFinanceObligationUseCase {
  constructor(private readonly ledger: FinanceLedgerService) {}
  async execute(userId: string, id: string, dto: UpdateFinanceObligationDto) {
    return this.ledger.transaction(async (manager) => {
      const obligation = requireOwned(
        await this.ledger.obligation(manager, userId, id),
      );
      let initial = requireInitialMovement(
        await this.ledger.initialMovements(manager, obligation),
      );
      const paid = await this.ledger.confirmedPaid(manager, obligation);
      if (dto.amount !== undefined && BigInt(dto.amount) < BigInt(paid))
        throw new ConflictException('finance:principal_below_payments');
      if (dto.amount !== undefined && dto.amount !== obligation.amount) {
        initial = await this.ledger.saveMovement(manager, {
          ...initial,
          amount: dto.amount,
        });
      }
      const next = { ...obligation };
      if (dto.name !== undefined) next.name = dto.name;
      if (dto.key !== undefined) next.key = dto.key;
      if (dto.amount !== undefined) next.amount = dto.amount;
      if (dto.description !== undefined) next.description = dto.description;
      if (dto.is_active !== undefined) next.is_active = dto.is_active;
      const saved = await this.ledger.saveObligation(manager, next);
      return projectObligation(saved, initial, paid);
    });
  }
}
