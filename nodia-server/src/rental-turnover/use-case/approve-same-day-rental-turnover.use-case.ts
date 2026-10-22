import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import {
  calendarStay,
  immediateNeighbors,
} from '../../rental-common/rental-calendar.rules.js';
import { assertEmptyCommand } from '../../rental-common/rental-validation.js';
import type { EmptyRentalCommandDto } from '../../rental-reservation/dto/reservation-commands.dto.js';
import { RentalTurnoverService } from '../rental-turnover.service.js';
import { approveRentalTurnoverSameDay } from '../types/rental-turnover.rules.js';
@Injectable()
export class ApproveSameDayRentalTurnoverUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly turnovers: RentalTurnoverService,
  ) {}
  async execute(
    actor: ActorReference,
    propertyId: string,
    id: string,
    dto: EmptyRentalCommandDto,
    requestKey: string,
  ) {
    const actorId = actor.userId;
    assertEmptyCommand(dto);
    return this.transactions.mutate(
      {
        actor,
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
        const incoming = calendarStay(reservation, ctx.property.timezone);
        const { previous } = await immediateNeighbors(ctx, incoming);
        const row = approveRentalTurnoverSameDay(
          original,
          incoming,
          previous,
          ctx.property.minimum_turnover_minutes,
          ctx.now,
        );
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
