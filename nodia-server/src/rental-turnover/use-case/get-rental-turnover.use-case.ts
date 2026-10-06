import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import {
  calendarStay,
  immediateNeighbors,
  planValid,
  sameDay,
  sameDayValid,
} from '../../rental-common/rental-calendar.rules.js';
import { RentalTurnoverService } from '../rental-turnover.service.js';
import { projectTurnover } from '../types/rental-turnover.projection.js';
@Injectable()
export class GetRentalTurnoverUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly turnovers: RentalTurnoverService,
  ) {}
  execute(actorId: string, propertyId: string, id: string) {
    return this.transactions.read(actorId, propertyId, async (ctx) => {
      const row = await this.turnovers.find(ctx.manager, propertyId, id);
      const incoming = calendarStay(
        await this.turnovers.incoming(
          ctx.manager,
          propertyId,
          row.incoming_reservation_id,
        ),
        ctx.property.timezone,
      );
      const { previous } = await immediateNeighbors(ctx, incoming);
      return {
        ...projectTurnover(row),
        current_previous_reservation_id: previous?.id ?? null,
        same_day_required: sameDay(previous, incoming),
        plan_valid: planValid(
          row,
          incoming,
          previous,
          ctx.property.minimum_turnover_minutes,
        ),
        needs_approval: !sameDayValid(
          row,
          incoming,
          previous,
          ctx.property.minimum_turnover_minutes,
        ),
      };
    });
  }
}
