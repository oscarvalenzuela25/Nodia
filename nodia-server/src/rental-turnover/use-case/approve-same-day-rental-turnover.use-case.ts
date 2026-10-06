import { Injectable, ConflictException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import {
  calendarStay,
  immediateNeighbors,
  refreshPlan,
  planValid,
  sameDay,
} from '../../rental-common/rental-calendar.rules.js';
import { assertEmptyCommand } from '../../rental-common/rental-validation.js';
import type { EmptyRentalCommandDto } from '../../rental-reservation/dto/reservation-commands.dto.js';
import { RentalTurnoverService } from '../rental-turnover.service.js';
@Injectable()
export class ApproveSameDayRentalTurnoverUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly turnovers: RentalTurnoverService,
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
        operation: 'turnover.approve_same_day',
        resourceId: id,
        command: dto,
      },
      async (ctx) => {
        const original = await this.turnovers.find(ctx.manager, propertyId, id);
        const reservation = await this.turnovers.incoming(
          ctx.manager,
          propertyId,
          original.incoming_reservation_id,
        );
        if (!['draft', 'confirmed'].includes(reservation.status))
          throw new ConflictException('rental:invalid_transition');
        const incoming = calendarStay(reservation, ctx.property.timezone);
        const { previous } = await immediateNeighbors(ctx, incoming);
        const row = refreshPlan(original, previous);
        if (
          !sameDay(previous, incoming) ||
          row.linen_ready !== true ||
          !planValid(
            row,
            incoming,
            previous,
            ctx.property.minimum_turnover_minutes,
          )
        )
          throw new ConflictException('rental:turnover_required');
        row.same_day_approved_at = ctx.now;
        row.updated_by = actorId;
        const saved = await this.turnovers.save(ctx.manager, row);
        return {
          resource_id: id,
          resource_type: 'turnover',
          status: saved.cleaning_status,
          updated_at: saved.updated_at,
          changes: {
            same_day_approved_at: ctx.now,
            previous_reservation_id: row.previous_reservation_id,
          },
        };
      },
    );
  }
}
