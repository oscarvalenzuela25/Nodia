import { Injectable, ConflictException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { calendarStay } from '../../rental-common/rental-calendar.rules.js';
import { assertPhase } from '../types/rental-reservation.rules.js';
import { assertEmptyCommand } from '../../rental-common/rental-validation.js';
import type { EmptyRentalCommandDto } from '../dto/reservation-commands.dto.js';
@Injectable()
export class CompleteRentalReservationUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly reservations: RentalReservationService,
  ) {}
  async execute(
    actorId: string,
    propertyId: string,
    id: string,
    dto: EmptyRentalCommandDto,
    requestKey: string,
  ) {
    assertEmptyCommand(dto);
    return this.transactions.mutate(
      {
        actorId,
        propertyId,
        requestKey,
        operation: 'reservation.complete',
        resourceId: id,
        command: dto,
      },
      async (ctx) => {
        const row = await this.reservations.find(
          ctx.manager,
          propertyId,
          id,
          true,
        );
        assertPhase(row, ['in_progress']);
        if (
          ctx.now.getTime() < calendarStay(row, ctx.property.timezone).ends_at
        )
          throw new ConflictException('rental:invalid_transition');
        row.status = 'completed';
        row.updated_by = actorId;
        const saved = await this.reservations.save(ctx.manager, row);
        return {
          resource_id: id,
          resource_type: 'reservation',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: { status: { before: 'in_progress', after: 'completed' } },
        };
      },
    );
  }
}
