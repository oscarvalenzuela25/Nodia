import { assertEmptyCommand } from '../../rental-common/rental-validation.js';
import { Injectable, ConflictException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalReservationService } from '../rental-reservation.service.js';
import { RentalTurnover } from '../../rental-turnover/entities/rental-turnover.entity.js';
import {
  calendarStay,
  immediateNeighbors,
  refreshPlan,
  sameDayValid,
} from '../../rental-common/rental-calendar.rules.js';
import { assertPhase } from '../types/rental-reservation.rules.js';
import type { EmptyRentalCommandDto } from '../dto/reservation-commands.dto.js';
@Injectable()
export class StartRentalReservationUseCase {
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
        operation: 'reservation.start',
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
        assertPhase(row, ['confirmed']);
        if (!ctx.property.is_active)
          throw new ConflictException('rental:property_inactive');
        const stay = calendarStay(row, ctx.property.timezone);
        if (
          ctx.now.getTime() < stay.starts_at ||
          ctx.now.getTime() >= stay.ends_at
        )
          throw new ConflictException('rental:invalid_transition');
        const original = await ctx.manager
          .getRepository(RentalTurnover)
          .findOneBy({ property_id: propertyId, incoming_reservation_id: id });
        const { previous } = await immediateNeighbors(ctx, stay);
        const plan = original ? refreshPlan(original, previous) : null;
        if (
          !plan ||
          !sameDayValid(
            plan,
            stay,
            previous,
            ctx.property.minimum_turnover_minutes,
          ) ||
          plan.linen_ready !== true ||
          plan.cleaning_status !== 'completed' ||
          plan.ready_at === null ||
          plan.ready_at > ctx.now
        )
          throw new ConflictException('rental:turnover_required');
        row.status = 'in_progress';
        row.updated_by = actorId;
        const saved = await this.reservations.save(ctx.manager, row);
        return {
          resource_id: id,
          resource_type: 'reservation',
          status: saved.status,
          updated_at: saved.updated_at,
          changes: { status: { before: 'confirmed', after: 'in_progress' } },
        };
      },
    );
  }
}
