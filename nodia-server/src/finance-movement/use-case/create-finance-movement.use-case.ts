import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import { FinanceMovementService } from '../finance-movement.service.js';
import { CreateFinanceMovementDto } from '../dto/create-finance-movement.dto.js';
import {
  ensureRepaymentCapacity,
  repaymentType,
  requireActiveCategory,
  requireInitialMovement,
  requireOwned,
  validateMovementState,
} from '../../finance-obligation/use-case/finance-ledger.rules.js';
import { projectMovement } from '../types/finance-movement.types.js';

@Injectable()
export class CreateFinanceMovementUseCase {
  constructor(
    private readonly ledger: FinanceLedgerService,
    private readonly movements: FinanceMovementService,
  ) {}

  async execute(userId: string, dto: CreateFinanceMovementDto) {
    validateMovementState(dto.type, dto.status);
    return this.ledger.transaction(async (manager) => {
      const obligation = dto.obligation_id
        ? requireOwned(
            await this.ledger.obligation(manager, userId, dto.obligation_id),
          )
        : null;
      if (obligation !== null) {
        if (!obligation.is_active)
          throw new ConflictException('finance:inactive_obligation');
        if (dto.type !== repaymentType(obligation))
          throw new BadRequestException('finance:invalid_repayment_direction');
        const initial = requireInitialMovement(
          await this.ledger.initialMovements(manager, obligation),
        );
        if (initial.status === 'cancelled')
          throw new ConflictException('finance:cancelled_obligation');
      }
      requireActiveCategory(
        await this.ledger.category(manager, userId, dto.category_id),
      );
      const movement = {
        user_id: userId,
        name: dto.name,
        amount: dto.amount,
        type: dto.type,
        status: dto.status,
        category_id: dto.category_id,
        obligation_id: dto.obligation_id ?? null,
        is_active: dto.is_active ?? true,
      };
      if (obligation !== null)
        ensureRepaymentCapacity(
          obligation,
          await this.ledger.confirmedPaid(manager, obligation),
          movement,
        );
      const saved = await this.ledger.saveMovement(manager, movement);
      return projectMovement(
        requireOwned(await this.movements.findOne(userId, saved.id, manager)),
      );
    });
  }
}
