import { ConflictException, Injectable } from '@nestjs/common';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import { FinanceMovementService } from '../finance-movement.service.js';
import { UpdateFinanceMovementDto } from '../dto/update-finance-movement.dto.js';
import {
  ensureRepaymentCapacity,
  isConfirmed,
  repaymentType,
  requireActiveCategory,
  requireInitialMovement,
  requireOwned,
  validateMovementState,
  validateStatusTransition,
} from '../../finance-obligation/use-case/finance-ledger.rules.js';
import { projectMovement } from '../types/finance-movement.types.js';

@Injectable()
export class UpdateFinanceMovementUseCase {
  constructor(
    private readonly ledger: FinanceLedgerService,
    private readonly movements: FinanceMovementService,
  ) {}

  async execute(userId: string, id: string, dto: UpdateFinanceMovementDto) {
    return this.ledger.transaction(async (manager) => {
      // Read identity without a movement lock, then acquire shared writer order: obligation -> movement.
      const snapshot = requireOwned(
        await this.ledger.movement(manager, userId, id, false),
      );
      const obligation = snapshot.obligation_id
        ? requireOwned(
            await this.ledger.obligation(
              manager,
              userId,
              snapshot.obligation_id,
            ),
          )
        : null;
      const movement = requireOwned(
        await this.ledger.movement(manager, userId, id),
      );
      // DTO class fields exist with undefined values after ValidationPipe transformation.
      const next = { ...movement };
      if (dto.name !== undefined) next.name = dto.name;
      if (dto.amount !== undefined) next.amount = dto.amount;
      if (dto.type !== undefined) next.type = dto.type;
      if (dto.status !== undefined) next.status = dto.status;
      if (dto.category_id !== undefined) next.category_id = dto.category_id;
      if (dto.is_active !== undefined) next.is_active = dto.is_active;
      validateMovementState(next.type, next.status);
      const changesOrdinaryConfirmedDirection =
        obligation === null &&
        movement.type !== next.type &&
        isConfirmed(movement) &&
        isConfirmed(next);
      if (!changesOrdinaryConfirmedDirection)
        validateStatusTransition(movement.status, next.status);
      if (obligation !== null) {
        if (next.type !== movement.type)
          throw new ConflictException('finance:immutable_linked_direction');
        const initial = requireInitialMovement(
          await this.ledger.initialMovements(manager, obligation),
        );
        if (movement.type !== repaymentType(obligation)) {
          if (dto.amount !== undefined && dto.amount !== movement.amount)
            throw new ConflictException('finance:edit_principal_on_obligation');
          if (
            next.status === 'cancelled' &&
            movement.status !== 'cancelled' &&
            BigInt(await this.ledger.confirmedPaid(manager, obligation)) > 0n
          ) {
            throw new ConflictException('finance:initial_has_payments');
          }
        } else {
          const changesFinancialValue =
            next.amount !== movement.amount || next.status !== movement.status;
          if (
            changesFinancialValue &&
            next.status !== 'cancelled' &&
            initial.status === 'cancelled'
          )
            throw new ConflictException('finance:cancelled_obligation');
          // Archive never removes confirmed value; do not filter existing payments by active/date.
          if (isConfirmed(next))
            ensureRepaymentCapacity(
              obligation,
              await this.ledger.confirmedPaid(manager, obligation, id),
              next,
            );
        }
      }
      if (
        dto.category_id !== undefined &&
        dto.category_id !== movement.category_id
      ) {
        requireActiveCategory(
          await this.ledger.category(manager, userId, dto.category_id),
        );
      }
      await this.ledger.saveMovement(manager, next);
      return projectMovement(
        requireOwned(await this.movements.findOne(userId, id, manager)),
      );
    });
  }
}
